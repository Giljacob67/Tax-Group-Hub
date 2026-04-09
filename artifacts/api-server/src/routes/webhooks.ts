import { 
  db, 
  conversationsTable, 
  messagesTable, 
  channelConfigsTable, 
  usageLogsTable 
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { callLLM } from "../lib/llm-client.js";
import { AGENTS } from "../lib/agents-data.js";
import { processExternalMedia } from "../lib/media-processor.js";

const router: IRouter = Router();

/**
 * Helper to send a message back to Telegram
 */
async function sendTelegramMessage(chatId: string, text: string, token: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

/**
 * POST /api/webhooks/telegram/:token
 */
router.post("/webhooks/telegram/:token", async (req, res) => {
  const { token } = req.params;
  const update = req.body;

  // Telegram expects 200 OK fast
  res.sendStatus(200);

  try {
    if (!update.message) return;

    const chatId = String(update.message.chat.id);
    const text = update.message.text;
    const voice = update.message.voice;
    const document = update.message.document;
    const photo = update.message.photo; // Array of sizes

    // 1. Identify Agent/User for this token
    const [config] = await db
      .select()
      .from(channelConfigsTable)
      .where(and(eq(channelConfigsTable.platform, "telegram"), eq(channelConfigsTable.externalId, token)))
      .limit(1);

    if (!config) {
      console.warn(`[Webhook] No configuration found for Telegram token: ${token.substring(0, 10)}...`);
      return;
    }

    const agent = AGENTS.find(a => a.id === config.agentId);
    if (!agent) return;

    // 2. Find or Create Conversation
    let [conv] = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.platform, "telegram"), eq(conversationsTable.externalId, chatId)))
      .limit(1);

    if (!conv) {
      [conv] = await db
        .insert(conversationsTable)
        .values({
          agentId: agent.id,
          userId: config.userId,
          platform: "telegram",
          externalId: chatId,
          title: `Chat Telegram (${chatId})`,
        })
        .returning();
    }

    // 3. Process Input (Text or Media)
    let userContent = text || "";
    
    if (voice) {
       // Download and transcribe
       const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${voice.file_id}`);
       const fileData = await fileInfoRes.json();
       const fileUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
       const processed = await processExternalMedia(fileUrl, "audio/ogg", "voice_note.ogg");
       userContent = processed.content;
    } else if (document) {
       const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${document.file_id}`);
       const fileData = await fileInfoRes.json();
       const fileUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
       const processed = await processExternalMedia(fileUrl, document.mime_type || "application/pdf", document.file_name);
       userContent = `[Arquivo: ${document.file_name}]\nContent: ${processed.content}`;
    } else if (photo) {
       // Take the largest photo size
       const p = photo[photo.length - 1];
       const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${p.file_id}`);
       const fileData = await fileInfoRes.json();
       const fileUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
       const processed = await processExternalMedia(fileUrl, "image/jpeg", "photo.jpg");
       userContent = `[Imagem]: ${processed.content}`;
    }

    if (!userContent) return;

    // 4. Save User Message
    await db.insert(messagesTable).values({
      conversationId: conv.id,
      role: "user",
      content: userContent,
    });

    // 5. Call LLM
    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(messagesTable.createdAt);

    const context = history.map(m => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`).join("\n");

    const llmResponse = await callLLM(
       agent.systemPrompt, 
       `Histórico da conversa:\n${context}\n\nNova mensagem: ${userContent}`,
       { toolIds: ["webSearch", "emailSender"] } // Enable tools for webhook agents
    );

    // 6. Save Assistant Response
    await db.insert(messagesTable).values({
      conversationId: conv.id,
      role: "assistant",
      content: llmResponse.output,
    });

    // 7. Send Back to Telegram
    await sendTelegramMessage(chatId, llmResponse.output, token);

    // 8. Log Usage (Phase 9)
    await db.insert(usageLogsTable).values({
       userId: config.userId,
       conversationId: conv.id,
       agentId: agent.id,
       model: llmResponse.model,
       provider: llmResponse.provider,
       totalTokens: llmResponse.tokensUsed,
       latencyMs: llmResponse.executionTimeMs,
       platform: "telegram"
    }).catch(e => console.error("[Analytics] Telegram log error:", e));

  } catch (err) {
    console.error("[Webhook Telegram Error]:", err);
  }
});

/**
 * POST /api/webhooks/whatsapp/:channelId
 * Placeholder for WhatsApp (Meta/Twilio)
 */
router.post("/webhooks/whatsapp/:channelId", async (req, res) => {
  // Logic similar to Telegram but with Meta Cloud API payloads
  res.sendStatus(200);
  console.log("[Webhook WhatsApp] received payload but not fully implemented yet.");
});

export default router;
