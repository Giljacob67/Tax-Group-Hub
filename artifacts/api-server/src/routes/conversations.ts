import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  knowledgeDocumentsTable,
  knowledgeChunksTable,
} from "@workspace/db";
import { eq, desc, count, and, isNotNull, sql } from "drizzle-orm";
import { getAgentById } from "../lib/agents-data.js";
import { getLLMConfig, type LLMConfig, generateEmbeddings } from "../lib/llm-client.js";
import { SendMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

/** Returns true if the userId represents a real user (not a fallback/dev value) */
function isRealUser(userId?: string): userId is string {
  return !!userId && userId !== "default" && userId !== "dev-user" && userId !== "system";
}

function buildRAGContextMock(docs: Array<{ filename: string; extractedContent: string | null }>, userMessage: string): string {
  // kept only for legacy if needed
  return "";
}

router.get("/conversations", async (req, res) => {
  try {
    const { agentId } = req.query;
    const userId = req.userId;
    const baseQuery = {
      id: conversationsTable.id,
      agentId: conversationsTable.agentId,
      title: conversationsTable.title,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      messageCount: count(messagesTable.id),
    };

    // Build where clause: filter by agentId and/or userId
    const buildWhere = () => {
      const conditions = [];
      if (agentId && typeof agentId === "string") conditions.push(eq(conversationsTable.agentId, agentId));
      if (isRealUser(userId)) conditions.push(eq(conversationsTable.userId, userId));
      return conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;
    };

    const whereClause = buildWhere();
    const query = db
      .select(baseQuery)
      .from(conversationsTable)
      .leftJoin(messagesTable, eq(conversationsTable.id, messagesTable.conversationId))
      .groupBy(conversationsTable.id)
      .orderBy(desc(conversationsTable.updatedAt));

    const conversations = whereClause ? await query.where(whereClause) : await query;

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
    const { agentId, title, model } = req.body as { agentId?: string; title?: string; model?: string };
    if (!agentId) {
      res.status(400).json({ error: "agentId is required" });
      return;
    }
    const conversationTitle = title || `Nova conversa`;
    const userId = req.userId;
    const [conv] = await db
      .insert(conversationsTable)
      .values({ agentId, title: conversationTitle, model, userId: userId || null })
      .returning();

    res.status(201).json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      model: conv.model,
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
    const userId = req.userId;
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    // Tenancy check: if real user, verify ownership
    if (isRealUser(userId) && conv.userId && conv.userId !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conversationId)).orderBy(messagesTable.createdAt);
    const agent = getAgentById(conv.agentId);
    const llmConfig = await getLLMConfig();

    res.json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      model: llmConfig?.model || "nenhum",
      provider: llmConfig?.provider || "Nenhum",
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
    md += `**Modelo Base:** ${conv.model || "Padrão"}\n`;
    md += `**Data:** ${new Date(conv.createdAt).toLocaleString("pt-BR")}\n\n`;
    
    if (agent?.systemPrompt) {
      md += `### Prompt do Sistema\n> ${agent.systemPrompt.replace(/\n/g, "\n> ")}\n\n`;
    }

    md += `---\n\n`;

    for (const msg of messages) {
      const role = msg.role === "user" ? "👤 Usuário" : "🤖 Assistente";
      const time = new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      md += `### ${role} (${time})\n\n${msg.content}\n\n---\n\n`;
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="conversa-${conversationId}.md"`);
    res.send(md);
  } catch (err) {
    console.error("Error exporting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/messages/:messageId", async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    if (isNaN(messageId)) {
      res.status(400).json({ error: "Invalid messageId" });
      return;
    }
    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting message:", err);
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
    const parsedBody = SendMessageBody.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "Formato de requisicao invalido", details: parsedBody.error.format() });
      return;
    }
    const { content, useKnowledgeBase, customSystemPrompt, model: modelOverride, stream: streamOverride } = parsedBody.data;
    const isStream = streamOverride === true || req.query.stream === "true";

    if (!content.trim()) {
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

    let systemPrompt = customSystemPrompt 
      ? `${agent.systemPrompt}\n\n[Instructions Addicionais do Usuario para esta sessao]: ${customSystemPrompt}` 
      : agent.systemPrompt;

    if (useKnowledgeBase !== false) {
      try {
        const [queryEmbedding] = await generateEmbeddings([content.trim()]);
        
        // Find top chunks for this agent and global
        const similarity = sql<number>`1 - (${knowledgeChunksTable.embedding} <=> ${JSON.stringify(queryEmbedding)})`;
        const results = await db
          .select({
            content: knowledgeChunksTable.content,
            score: similarity,
            filename: knowledgeDocumentsTable.filename,
          })
          .from(knowledgeChunksTable)
          .innerJoin(knowledgeDocumentsTable, eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id))
          .where(sql`${knowledgeDocumentsTable.agentId} = ${conv.agentId} OR ${knowledgeDocumentsTable.agentId} = 'global'`)
          .orderBy((t) => desc(t.score))
          .limit(5);

        const relevantChunks = results.filter((r) => r.score > 0.3);
        if (relevantChunks.length > 0) {
          const contextText = relevantChunks.map(c => `[Doc: ${c.filename}]\n${c.content}`).join("\n\n");
          systemPrompt += `\n\n--- CONTEXTO REFERÊNCIA ---\n${contextText}`;
        }
      } catch (ragErr) {
        console.error("Failed to generate vector context:", ragErr);
      }
    }

    const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Sliding Window: Only send the last 14 messages to LLM to preserve tokens/budget
    const contextHistory = existingMessages.slice(-14); 

    for (const msg of contextHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        llmMessages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }
    // Note: 'content' is already the last message in existingMessages if we just saved it, 
    // but the slice(-14) might include it. Let's be careful.
    // userMsg was just inserted, so it's the last element of existingMessages.
    // If userMsg is already in llmMessages via the slice, we don't need to push again.
    if (llmMessages[llmMessages.length - 1].content !== content.trim()) {
      llmMessages.push({ role: "user", content: content.trim() });
    }

    let assistantContent = "";
    const llmConfig = await getLLMConfig();

    if (llmConfig) {
      if (modelOverride && llmConfig.provider === "Gemini") {
        llmConfig.model = modelOverride;
      }
      try {
        if (isStream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();
          
          res.write(`data: ${JSON.stringify({ type: "start", userMessage: { id: String(userMsg.id), conversationId: String(userMsg.conversationId), role: userMsg.role, content: userMsg.content, createdAt: userMsg.createdAt.toISOString() }, autoTitle })}\n\n`);

          const completion = await llmConfig.client.chat.completions.create({
            model: llmConfig.model,
            messages: llmMessages,
            stream: true,
          });

          for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content || "";
            if (token) {
              assistantContent += token;
              res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
            }
          }
        } else {
          const completion = await llmConfig.client.chat.completions.create({
            model: llmConfig.model,
            messages: llmMessages,
          });
          assistantContent = completion.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta. Tente novamente.";
        }
      } catch (llmErr) {
        console.error("LLM error:", llmErr);
        assistantContent = `Erro ao conectar com a IA (${llmConfig.provider}). Verifique as configurações do provedor.`;
        if (isStream) res.write(`data: ${JSON.stringify({ type: "token", text: assistantContent })}\n\n`);
      }
    } else {
      assistantContent = `**Modo Demo** — Nenhum provedor de IA configurado.\n\n**Agente:** ${agent.name}\n**Sua mensagem:** ${content.trim()}\n\nConfigure OLLAMA_URL ou GEMINI_API_KEY nas variáveis de ambiente.`;
      if (isStream) res.write(`data: ${JSON.stringify({ type: "token", text: assistantContent })}\n\n`);
    }

    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({ conversationId, role: "assistant", content: assistantContent })
      .returning();

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));

    if (isStream) {
      res.write(`data: ${JSON.stringify({ type: "done", assistantMessage: { id: String(assistantMsg.id), conversationId: String(assistantMsg.conversationId), role: assistantMsg.role, content: assistantMsg.content, createdAt: assistantMsg.createdAt.toISOString() }, model: llmConfig?.model || "nenhum", provider: llmConfig?.provider || "Nenhum" })}\n\n`);
      res.end();
      return;
    }

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
      model: llmConfig?.model || "nenhum",
      provider: llmConfig?.provider || "Nenhum",
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
