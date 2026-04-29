import { Router, type IRouter } from "express";
import { 
  db, 
  conversationsTable, 
  messagesTable, 
  knowledgeDocumentsTable, 
  knowledgeChunksTable,
  usageLogsTable 
} from "@workspace/db";
import { eq, desc, count, and, sql } from "drizzle-orm";
import { getAgentById } from "../lib/agents-data.js";
import { generateEmbeddings, callLLM, getLanguageModel } from "../lib/llm-client.js";
import { getActiveLlmPreference } from "./settings.js";
import { streamText } from "ai";
import { SendMessageBody } from "@workspace/api-zod";
import { isRealUser } from "../middlewares/auth.js";

const router: IRouter = Router();

function buildRAGContextMock(docs: Array<{ filename: string; extractedContent: string | null }>, userMessage: string): string {
  // kept only for legacy if needed
  return "";
}

async function loadConversationForRequest(conversationId: number, userId?: string) {
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId));

  if (!conv) {
    return { conv: null, error: "not_found" as const };
  }

  if (isRealUser(userId) && conv.userId && conv.userId !== userId) {
    return { conv: null, error: "forbidden" as const };
  }

  return { conv, error: null };
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
      conversations: conversations.map((c: any) => ({
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
  } catch (err: any) {
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
    let modelName = conv.model || "nenhum";
    let providerName = "Nenhum";
    try {
      const { providerName: pn, modelId } = await getLanguageModel();
      modelName = modelId;
      providerName = pn;
    } catch {}

    res.json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      model: modelName,
      provider: providerName,
      agentName: agent?.name || conv.agentId,
      messages: messages.map((m: any) => ({
        id: String(m.id),
        conversationId: String(m.conversationId),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        metadata: m.metadata,
      })),
    });
  } catch (err: any) {
    console.error("Error getting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/conversations/:conversationId", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const userId = req.userId;
    const { title } = req.body as { title?: string };
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (!title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    // Tenancy check: verify ownership before mutation
    const [existing] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
    if (!existing) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (isRealUser(userId) && existing.userId && existing.userId !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const [conv] = await db
      .update(conversationsTable)
      .set({ title: title.trim(), updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId))
      .returning();
    res.json({
      id: String(conv.id),
      agentId: conv.agentId,
      title: conv.title,
      updatedAt: conv.updatedAt.toISOString(),
    });
  } catch (err: any) {
    console.error("Error renaming conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:conversationId/export", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const userId = req.userId;
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const { conv, error } = await loadConversationForRequest(conversationId, userId);
    if (error === "not_found") {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (error === "forbidden") {
      res.status(403).json({ error: "Access denied" });
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
  } catch (err: any) {
    console.error("Error exporting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/messages/:messageId", async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const userId = req.userId;
    if (isNaN(messageId)) {
      res.status(400).json({ error: "Invalid messageId" });
      return;
    }
    // Tenancy check: verify the message belongs to a conversation owned by the user
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (isRealUser(userId)) {
      const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, msg.conversationId));
      if (conv?.userId && conv.userId !== userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/conversations/:conversationId", async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const userId = req.userId;
    if (isNaN(conversationId)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    // Tenancy check: verify ownership before deletion
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (isRealUser(userId) && conv.userId && conv.userId !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    await db.delete(conversationsTable).where(eq(conversationsTable.id, conversationId));
    res.json({ success: true, message: "Conversation deleted" });
  } catch (err: any) {
    console.error("Error deleting conversation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:conversationId/messages", async (req, res) => {
  try {
    const userId = req.userId;
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

    const { conv, error } = await loadConversationForRequest(conversationId, userId);
    if (error === "not_found") {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (error === "forbidden") {
      res.status(403).json({ error: "Access denied" });
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
          .where(
            and(
              sql`${knowledgeDocumentsTable.agentId} = ${conv.agentId} OR ${knowledgeDocumentsTable.agentId} = 'global'`,
              isRealUser(userId) ? eq(knowledgeDocumentsTable.userId, userId) : sql`TRUE`
            )
          )
          .orderBy((t: any) => desc(t.score))
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

    // Read active provider config from DB
    const activeLlmPreference = await getActiveLlmPreference(userId);
    const activeProviderDb = activeLlmPreference.provider;
    const activeLlmUrl = activeLlmPreference.customUrl;
    const activeLlmModel = activeLlmPreference.model;

    // [Refactored for Phase 9] Use unified callLLM for metrics and tool support
    try {
      if (isStream) {
        // For streaming, we'll keep the direct SDK call for now to manage the response object,
        // but we'll manually log usage at the end.
        // TODO: Move stream logic to llm-client for full reuse.
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        
        res.write(`data: ${JSON.stringify({ type: "start", userMessage: { id: String(userMsg.id), conversationId: String(userMsg.conversationId), role: userMsg.role, content: userMsg.content, createdAt: userMsg.createdAt.toISOString() }, autoTitle })}\n\n`);

        // Special handling for Ollama Cloud (native API, not OpenAI-compatible)
        // For streaming mode, we simulate streaming by splitting the response into words
        if (activeProviderDb === "ollama_cloud") {
          const result = await callLLM(systemPrompt, content.trim(), { 
            provider: "ollama_cloud",
            model: modelOverride || activeLlmModel || undefined,
            customUrl: activeLlmUrl || undefined,
            toolIds: ["webSearch", "emailSender"],
            userId: userId || undefined
          });
          assistantContent = result.output;
          
          // Simulate streaming by sending word by word
          const words = assistantContent.split(/(\s+)/);
          for (const word of words) {
            res.write(`data: ${JSON.stringify({ type: "token", text: word })}\n\n`);
          }
          // Log usage
          await db.insert(usageLogsTable).values({
            userId: userId || null,
            conversationId,
            agentId: conv.agentId,
            model: result.model,
            provider: result.provider,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: result.tokensUsed,
            platform: "web"
          }).catch(() => {});
        } else {
          const { model: aiModel } = await getLanguageModel(undefined, modelOverride);
          const streamResult = await streamText({
            model: aiModel,
            system: systemPrompt,
            messages: llmMessages,
            onFinish: async (finish: any) => {
             // Log usage
             await db.insert(usageLogsTable).values({
               userId: userId || null,
               conversationId,
               agentId: conv.agentId,
               model: finish.model || finish.response?.modelId || modelOverride || "unknown",
               provider: finish.provider || finish.response?.provider || "unknown",
               promptTokens: finish.usage?.promptTokens || 0,
               completionTokens: finish.usage?.completionTokens || 0,
               totalTokens: finish.usage?.totalTokens || 0,
               platform: "web"
             }).catch(e => console.error("Usage log error:", e));
          }
        });

        for await (const part of streamResult.fullStream) {
          if (part.type === 'text-delta') {
            const textChunk = (part as any).textDelta || (part as any).text || "";
            assistantContent += textChunk;
            res.write(`data: ${JSON.stringify({ type: "token", text: textChunk })}\n\n`);
          }
        }
        }
      } else {
        const result = await callLLM(systemPrompt, content.trim(), { 
          provider: activeProviderDb || undefined,
          model: modelOverride || activeLlmModel || undefined,
          customUrl: activeLlmUrl || undefined,
          toolIds: ["webSearch", "emailSender"], // Enabled tools in chat
          userId: userId || undefined
        });
        assistantContent = result.output;

        // Log usage (standard call)
        await db.insert(usageLogsTable).values({
          userId: userId || null,
          conversationId,
          agentId: conv.agentId,
          model: result.model,
          provider: result.provider,
          promptTokens: 0, // callLLM only returns totalTokens currently
          completionTokens: 0,
          totalTokens: result.tokensUsed,
          latencyMs: result.executionTimeMs,
          platform: "web"
        }).catch(() => {});
      }
    } catch (llmErr) {
      console.error("LLM error:", llmErr);
      assistantContent = `Erro ao conectar com a IA. Verifique os logs do servidor.`;
      if (isStream) res.write(`data: ${JSON.stringify({ type: "token", text: assistantContent })}\n\n`);
    }

    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({ conversationId, role: "assistant", content: assistantContent })
      .returning();

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));

    if (isStream) {
      res.write(`data: ${JSON.stringify({ type: "done", assistantMessage: { id: String(assistantMsg.id), conversationId: String(assistantMsg.conversationId), role: assistantMsg.role, content: assistantMsg.content, createdAt: assistantMsg.createdAt.toISOString() } })}\n\n`);
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
    });
  } catch (err: any) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
