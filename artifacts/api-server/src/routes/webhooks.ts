import { Router, type IRouter } from "express";
import { 
  db, 
  conversationsTable, 
  messagesTable, 
  channelConfigsTable, 
  usageLogsTable,
  crmContactsTable,
  crmDealsTable
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { callLLM } from "../lib/llm-client.js";
import { AGENTS } from "../lib/agents-data.js";
import { processExternalMedia } from "../lib/media-processor.js";

const router: IRouter = Router();

// ... existing helper and telegram webhook code ...
// Will inject the actual code efficiently using a simpler replacement to preserve all original telegram lines.

/**
 * Helper to send a message back to Telegram
 */
async function sendTelegramMessage(chatId: string, text: string, botToken: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

/**
 * POST /api/webhooks/telegram/:webhookId
 *
 * The URL no longer contains the bot token. Instead:
 * - webhookId = channelConfig.id (opaque integer)
 * - Telegram sends X-Telegram-Bot-Api-Secret-Token header (set when registering the webhook)
 * - The real bot token is stored in channelConfigsTable.externalId
 *
 * Legacy support: if webhookId looks like a bot token (contains ':'), it falls back
 * to the old lookup by externalId for backwards compatibility.
 */
router.post("/webhooks/telegram/:webhookId", async (req, res) => {
  const { webhookId } = req.params;
  const update = req.body;

  // Telegram expects 200 OK fast
  res.sendStatus(200);

  try {
    if (!update.message) return;

    // Resolve channel config — support both new (by ID) and legacy (by token) lookups
    let config;
    const isLegacyToken = webhookId.includes(":");
    if (isLegacyToken) {
      // Legacy: webhookId IS the bot token
      [config] = await db
        .select()
        .from(channelConfigsTable)
        .where(and(eq(channelConfigsTable.platform, "telegram"), eq(channelConfigsTable.externalId, webhookId)))
        .limit(1);
    } else {
      // New: webhookId is the channelConfig.id
      const configId = Number(webhookId);
      if (!isNaN(configId)) {
        [config] = await db
          .select()
          .from(channelConfigsTable)
          .where(and(eq(channelConfigsTable.platform, "telegram"), eq(channelConfigsTable.id, configId)))
          .limit(1);
      }
    }

    if (!config) {
      console.warn(`[Webhook] No configuration found for Telegram webhookId: ${webhookId.substring(0, 10)}...`);
      return;
    }

    // Validate secret header for new-style webhooks
    if (!isLegacyToken) {
      const expectedSecret = (config.config as any)?.webhookSecret;
      const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];
      if (expectedSecret && receivedSecret !== expectedSecret) {
        console.warn(`[Webhook] Invalid secret for Telegram config ${config.id}`);
        return;
      }
    }

    // The real bot token is stored in externalId
    const botToken = config.externalId;

    const agent = AGENTS.find(a => a.id === config.agentId);
    if (!agent) return;

    const chatId = String(update.message.chat.id);
    const text = update.message.text;
    const voice = update.message.voice;
    const document = update.message.document;
    const photo = update.message.photo;

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
       const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${voice.file_id}`);
       const fileData = await fileInfoRes.json();
       const fileUrl = `https://api.telegram.org/file/bot${botToken}/${(fileData as any).result.file_path}`;
       const processed = await processExternalMedia(fileUrl, "audio/ogg", "voice_note.ogg");
       userContent = processed.content;
    } else if (document) {
       const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${document.file_id}`);
       const fileData = await fileInfoRes.json();
       const fileUrl = `https://api.telegram.org/file/bot${botToken}/${(fileData as any).result.file_path}`;
       const processed = await processExternalMedia(fileUrl, document.mime_type || "application/pdf", document.file_name);
       userContent = `[Arquivo: ${document.file_name}]\nContent: ${processed.content}`;
    } else if (photo) {
       const p = photo[photo.length - 1];
       const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${p.file_id}`);
       const fileData = await fileInfoRes.json();
       const fileUrl = `https://api.telegram.org/file/bot${botToken}/${(fileData as any).result.file_path}`;
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

    // 5. Call LLM — sliding window to prevent context overflow
    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(messagesTable.createdAt);

    const recentHistory = history.slice(-14);
    const context = recentHistory.map(m => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`).join("\n");

    const llmResponse = await callLLM(
       agent.systemPrompt, 
       `Histórico da conversa:\n${context}\n\nNova mensagem: ${userContent}`,
       { toolIds: ["webSearch", "emailSender"] }
    );

    // 6. Save Assistant Response
    await db.insert(messagesTable).values({
      conversationId: conv.id,
      role: "assistant",
      content: llmResponse.output,
    });

    // 7. Send Back to Telegram
    await sendTelegramMessage(chatId, llmResponse.output, botToken);

    // 8. Log Usage
    await db.insert(usageLogsTable).values({
       userId: config.userId,
       conversationId: conv.id,
       agentId: agent.id,
       model: llmResponse.model,
       provider: llmResponse.provider,
       totalTokens: llmResponse.tokensUsed,
       latencyMs: llmResponse.executionTimeMs,
       platform: "telegram"
    }).catch((e: Error) => console.error("[Analytics] Telegram log error:", e));

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

/**
 * POST /api/webhooks/crm/inbound/:tenantId
 * Generic inbound webhook to receive leads from external systems (RD Station, Meta Ads, Typeform).
 */
router.post("/webhooks/crm/inbound/:tenantId", async (req, res) => {
  const { tenantId } = req.params;
  const payload = req.body || {};

  // Reply fast for webhook senders
  res.sendStatus(200);

  try {
    const rawCnpj = payload.cnpj || payload.company_cnpj || payload.document || payload.documento || payload.cpf_cnpj;
    if (!rawCnpj) return;

    const cnpjValid = String(rawCnpj).replace(/\D/g, "");
    if (cnpjValid.length !== 14) return; // Ignore if not a valid corporate document

    const name = payload.nome || payload.name || payload.razao_social || payload.company_name;
    const email = payload.email || payload.contato_email || payload.company_email || payload.mail;
    const phone = payload.telefone || payload.phone || payload.celular || payload.whatsapp;
    const source = payload.source || payload.origem || "webhook_inbound";

    let [contact] = await db
      .select()
      .from(crmContactsTable)
      .where(and(eq(crmContactsTable.cnpj, cnpjValid), eq(crmContactsTable.userId, tenantId)))
      .limit(1);

    if (!contact) {
      const [newContact] = await db.insert(crmContactsTable).values({
        userId: tenantId,
        cnpj: cnpjValid,
        razaoSocial: name || `Lead Sem Nome - ${cnpjValid}`,
        email: email ? String(email) : null,
        telefone: phone ? String(phone) : null,
        source: source,
      }).returning();
      contact = newContact;
    } else {
      const [updated] = await db.update(crmContactsTable).set({
        email: contact.email || (email ? String(email) : null),
        telefone: contact.telefone || (phone ? String(phone) : null),
        updatedAt: new Date(),
      }).where(eq(crmContactsTable.id, contact.id)).returning();
      contact = updated;
    }

    // Attempt to start a Deal if it doesn't have an active one
    const activeDeals = await db
      .select({ id: crmDealsTable.id })
      .from(crmDealsTable)
      .where(
        and(
          eq(crmDealsTable.contactId, contact.id),
          eq(crmDealsTable.userId, tenantId)
        )
      );

    if (activeDeals.length === 0) {
      await db.insert(crmDealsTable).values({
        userId: tenantId,
        contactId: contact.id,
        title: `Novo Lead Inbound - ${contact.razaoSocial || contact.cnpj}`,
        stage: "prospecting",
        probability: 10,
        value: "0"
      });
    }

  } catch (err) {
    console.error(`[Webhook CRM Inbound Error Payload]:`, payload, err);
  }
});

export default router;
