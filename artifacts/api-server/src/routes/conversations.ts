import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  knowledgeDocumentsTable,
} from "@workspace/db";
import { eq, desc, count, and, isNotNull } from "drizzle-orm";
import { getAgentById } from "../lib/agents-data.js";
import OpenAI from "openai";

const router: IRouter = Router();

function getLLMClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });
}

const LLM_MODEL = "google/gemini-flash-1.5";

function buildRAGContext(docs: Array<{ filename: string; extractedContent: string | null }>, userMessage: string): string {
  const keywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scored = docs
    .filter(d => d.extractedContent)
    .map(d => {
      const content = d.extractedContent!;
      const lower = content.toLowerCase();
      const score = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
      return { ...d, score, content };
    })
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) return "";

  const chunks = scored.map(d => {
    const trimmed = d.content.length > 2000 ? d.content.substring(0, 2000) + "..." : d.content;
    return `[Documento: ${d.filename}]\n${trimmed}`;
  });

  return `\n\n--- CONTEXTO DA BASE DE CONHECIMENTO ---\nUse os trechos abaixo como referência para responder de forma mais precisa:\n\n${chunks.join("\n\n")}`;
}

router.get("/conversations", async (req, res) => {
  try {
    const { agentId } = req.query;
    const baseQuery = {
      id: conversationsTable.id,
      agentId: conversationsTable.agentId,
      title: conversationsTable.title,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      messageCount: count(messagesTable.id),
    };

    let conversations;
    if (agentId && typeof agentId === "string") {
      conversations = await db
        .select(baseQuery)
        .from(conversationsTable)
        .leftJoin(messagesTable, eq(conversationsTable.id, messagesTable.conversationId))
        .where(eq(conversationsTable.agentId, agentId))
        .groupBy(conversationsTable.id)
        .orderBy(desc(conversationsTable.updatedAt));
    } else {
      conversations = await db
        .select(baseQuery)
        .from(conversationsTable)
        .leftJoin(messagesTable, eq(conversationsTable.id, messagesTable.conversationId))
        .groupBy(conversationsTable.id)
        .orderBy(desc(conversationsTable.updatedAt));
    }

    res.json({
      conversations: conversations.map((c) => ({
        ...c,
        id: String(c.id),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messageCount: Number(c.messageCount),
      })),
    });
  } catch (err) {
    console.error("Error listing conversations:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { agentId, title } = req.body as { agentId?: string; title?: string };
    if (!agentId) {
      res.status(400).json({ error: "agentId is required" });
      return;
    }
    const agent = getAgentById(agentId);
    const conversationTitle = title || `Nova conversa`;
    const [conv] = await db
      .insert(conversationsTable)
      .values({ agentId, title: conversationTitle })
      .returning();

    res.status(201).json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messageCount: 0,
    });
  } catch (err) {
    console.error("Error creating conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:conversationId", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conversationId)).orderBy(messagesTable.createdAt);
    const agent = getAgentById(conv.agentId);

    res.json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      model: LLM_MODEL,
      provider: "OpenRouter",
      agentName: agent?.name || conv.agentId,
      messages: messages.map((m) => ({
        id: String(m.id),
        conversationId: String(m.conversationId),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        metadata: m.metadata,
      })),
    });
  } catch (err) {
    console.error("Error getting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/conversations/:conversationId", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const { title } = req.body as { title?: string };
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (!title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const [conv] = await db
      .update(conversationsTable)
      .set({ title: title.trim(), updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId))
      .returning();
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      updatedAt: conv.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Error renaming conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:conversationId/export", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conversationId)).orderBy(messagesTable.createdAt);
    const agent = getAgentById(conv.agentId);

    let md = `# ${conv.title}\n\n`;
    md += `**Agente:** ${agent?.name || conv.agentId}\n`;
    md += `**Data:** ${conv.createdAt.toISOString().split("T")[0]}\n\n---\n\n`;

    for (const msg of messages) {
      const role = msg.role === "user" ? "👤 Você" : "🤖 Assistente";
      md += `### ${role}\n\n${msg.content}\n\n---\n\n`;
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${conv.title.replace(/[^a-zA-Z0-9 ]/g, "")}.md"`);
    res.send(md);
  } catch (err) {
    console.error("Error exporting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/conversations/:conversationId", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await db.delete(conversationsTable).where(eq(conversationsTable.id, conversationId));
    res.json({ success: true, message: "Conversation deleted" });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:conversationId/messages", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const { content, useKnowledgeBase, customSystemPrompt } = req.body as {
      content?: string;
      useKnowledgeBase?: boolean;
      customSystemPrompt?: string;
    };

    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const agent = getAgentById(conv.agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const [userMsg] = await db
      .insert(messagesTable)
      .values({ conversationId, role: "user", content: content.trim() })
      .returning();

    const existingMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    const userMessageCount = existingMessages.filter(m => m.role === "user").length;
    let autoTitle: string | null = null;
    if (userMessageCount === 1) {
      autoTitle = content.trim().length > 60 ? content.trim().substring(0, 57) + "..." : content.trim();
      await db.update(conversationsTable).set({ title: autoTitle, updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));
    }

    let systemPrompt = customSystemPrompt || agent.systemPrompt;

    if (useKnowledgeBase !== false) {
      const knowledgeDocs = await db
        .select({ filename: knowledgeDocumentsTable.filename, extractedContent: knowledgeDocumentsTable.extractedContent })
        .from(knowledgeDocumentsTable)
        .where(
          and(
            eq(knowledgeDocumentsTable.agentId, conv.agentId),
            isNotNull(knowledgeDocumentsTable.extractedContent)
          )
        );

      const globalDocs = await db
        .select({ filename: knowledgeDocumentsTable.filename, extractedContent: knowledgeDocumentsTable.extractedContent })
        .from(knowledgeDocumentsTable)
        .where(
          and(
            eq(knowledgeDocumentsTable.agentId, "global"),
            isNotNull(knowledgeDocumentsTable.extractedContent)
          )
        );

      const allDocs = [...knowledgeDocs, ...globalDocs];
      const ragContext = buildRAGContext(allDocs, content.trim());
      if (ragContext) {
        systemPrompt += ragContext;
      }
    }

    const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of existingMessages.slice(0, -1)) {
      if (msg.role === "user" || msg.role === "assistant") {
        llmMessages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }
    llmMessages.push({ role: "user", content: content.trim() });

    let assistantContent: string;
    const client = getLLMClient();

    if (client) {
      try {
        const completion = await client.chat.completions.create({
          model: LLM_MODEL,
          messages: llmMessages,
          max_tokens: 2000,
        });
        assistantContent = completion.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta. Tente novamente.";
      } catch (llmErr) {
        console.error("LLM error:", llmErr);
        assistantContent = `⚠️ Erro ao conectar com a IA. Verifique se a chave OPENROUTER_API_KEY está configurada.\n\nMensagem recebida: "${content.trim()}"`;
      }
    } else {
      assistantContent = `🤖 **Modo Demo** — Configure a chave OPENROUTER_API_KEY para respostas reais da IA.\n\n**Agente:** ${agent.name}\n**Sua mensagem:** ${content.trim()}\n\nEste agente está configurado para: ${agent.description}\n\n*Para ativar a IA, adicione sua chave OpenRouter nas configurações do projeto.*`;
    }

    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({ conversationId, role: "assistant", content: assistantContent })
      .returning();

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));

    res.json({
      userMessage: {
        id: String(userMsg.id),
        conversationId: String(userMsg.conversationId),
        role: userMsg.role,
        content: userMsg.content,
        createdAt: userMsg.createdAt.toISOString(),
      },
      assistantMessage: {
        id: String(assistantMsg.id),
        conversationId: String(assistantMsg.conversationId),
        role: assistantMsg.role,
        content: assistantMsg.content,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
      autoTitle,
      model: LLM_MODEL,
      provider: "OpenRouter",
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
