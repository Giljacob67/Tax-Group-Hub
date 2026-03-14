import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  knowledgeDocumentsTable,
} from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { getAgentById } from "../lib/agents-data.js";
import OpenAI from "openai";

const router: IRouter = Router();

// Initialize OpenRouter client (compatible with OpenAI SDK)
function getLLMClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

// List conversations (optionally by agentId)
router.get("/conversations", async (req, res) => {
  try {
    const { agentId } = req.query;

    let query = db
      .select({
        id: conversationsTable.id,
        agentId: conversationsTable.agentId,
        title: conversationsTable.title,
        createdAt: conversationsTable.createdAt,
        updatedAt: conversationsTable.updatedAt,
        messageCount: count(messagesTable.id),
      })
      .from(conversationsTable)
      .leftJoin(messagesTable, eq(conversationsTable.id, messagesTable.conversationId))
      .groupBy(conversationsTable.id)
      .orderBy(desc(conversationsTable.updatedAt));

    let conversations;
    if (agentId && typeof agentId === "string") {
      conversations = await db
        .select({
          id: conversationsTable.id,
          agentId: conversationsTable.agentId,
          title: conversationsTable.title,
          createdAt: conversationsTable.createdAt,
          updatedAt: conversationsTable.updatedAt,
          messageCount: count(messagesTable.id),
        })
        .from(conversationsTable)
        .leftJoin(messagesTable, eq(conversationsTable.id, messagesTable.conversationId))
        .where(eq(conversationsTable.agentId, agentId))
        .groupBy(conversationsTable.id)
        .orderBy(desc(conversationsTable.updatedAt));
    } else {
      conversations = await query;
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

// Create a conversation
router.post("/conversations", async (req, res) => {
  try {
    const { agentId, title } = req.body as { agentId?: string; title?: string };
    if (!agentId) {
      res.status(400).json({ error: "agentId is required" });
      return;
    }

    const agent = getAgentById(agentId);
    const conversationTitle = title || `Conversa com ${agent?.name || agentId}`;

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

// Get conversation with messages
router.get("/conversations/:conversationId", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    res.json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
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

// Delete conversation
router.delete("/conversations/:conversationId", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db
      .delete(conversationsTable)
      .where(eq(conversationsTable.id, conversationId));

    res.json({ success: true, message: "Conversation deleted" });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send a message
router.post("/conversations/:conversationId/messages", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const { content, useKnowledgeBase } = req.body as {
      content?: string;
      useKnowledgeBase?: boolean;
    };

    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    // Validate conversation exists
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const agent = getAgentById(conv.agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    // Save user message
    const [userMsg] = await db
      .insert(messagesTable)
      .values({
        conversationId,
        role: "user",
        content: content.trim(),
      })
      .returning();

    // Get conversation history
    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    // Build messages for LLM
    const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: agent.systemPrompt,
      },
    ];

    // Add conversation history (excluding the user message we just saved)
    for (const msg of history.slice(0, -1)) {
      if (msg.role === "user" || msg.role === "assistant") {
        llmMessages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    // Add current user message
    llmMessages.push({ role: "user", content: content.trim() });

    // Call LLM
    let assistantContent: string;
    const client = getLLMClient();

    if (client) {
      try {
        const completion = await client.chat.completions.create({
          model: "google/gemini-flash-1.5",
          messages: llmMessages,
          max_tokens: 2000,
        });
        assistantContent =
          completion.choices[0]?.message?.content ||
          "Desculpe, não consegui gerar uma resposta. Tente novamente.";
      } catch (llmErr) {
        console.error("LLM error:", llmErr);
        assistantContent = `⚠️ Erro ao conectar com a IA. Verifique se a chave OPENROUTER_API_KEY está configurada.\n\nMensagem recebida: "${content.trim()}"`;
      }
    } else {
      // Demo mode: generate a contextual response without API key
      assistantContent = `🤖 **Modo Demo** — Configure a chave OPENROUTER_API_KEY para respostas reais da IA.\n\n**Agente:** ${agent.name}\n**Sua mensagem:** ${content.trim()}\n\nEste agente está configurado para: ${agent.description}\n\n*Para ativar a IA, adicione sua chave OpenRouter nas configurações do projeto.*`;
    }

    // Save assistant message
    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({
        conversationId,
        role: "assistant",
        content: assistantContent,
      })
      .returning();

    // Update conversation updatedAt
    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId));

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
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
