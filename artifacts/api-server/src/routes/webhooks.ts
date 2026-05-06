import { Router, type IRouter } from "express";
import { z } from "zod";
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

// ── Zod schemas ────────────────────────────────────────────────────────────────

const TelegramPhotoSize = z.object({ file_id: z.string() });

const TelegramMessage = z.object({
  message_id: z.number(),
  chat: z.object({ id: z.union([z.number(), z.string()]) }),
  text: z.string().optional(),
  voice: z.object({ file_id: z.string() }).optional(),
  document: z.object({
    file_id: z.string(),
    file_name: z.string().optional(),
    mime_type: z.string().optional(),
  }).optional(),
  photo: z.array(TelegramPhotoSize).optional(),
});

// passthrough() allows unknown update types (callback_query, etc.) without failing
const TelegramUpdate = z.object({
  update_id: z.number(),
  message: TelegramMessage.optional(),
}).passthrough();

const TelegramFileResponse = z.object({
  result: z.object({ file_path: z.string() }),
});

// CRM inbound accepts arbitrary vendor payloads — validate it's an object, not a primitive/array
const CrmInboundPayload = z.record(z.unknown());

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

  const parsed = TelegramUpdate.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[Webhook Telegram] invalid payload:", parsed.error.flatten());
    res.sendStatus(200);
    return;
  }
  const update = parsed.data;

  try {
    if (!update.message) {
      res.sendStatus(200);
      return;
    }

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
    
    const resolveFileUrl = async (fileId: string): Promise<string | null> => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileResponse = TelegramFileResponse.safeParse(await res.json());
      if (!fileResponse.success) return null;
      return `https://api.telegram.org/file/bot${botToken}/${fileResponse.data.result.file_path}`;
    };

    if (voice) {
       const fileUrl = await resolveFileUrl(voice.file_id);
       if (fileUrl) {
         const processed = await processExternalMedia(fileUrl, "audio/ogg", "voice_note.ogg");
         userContent = processed.content;
       }
    } else if (document) {
       const fileUrl = await resolveFileUrl(document.file_id);
       if (fileUrl) {
         const processed = await processExternalMedia(fileUrl, document.mime_type || "application/pdf", document.file_name ?? "file");
         userContent = `[Arquivo: ${document.file_name}]\nContent: ${processed.content}`;
       }
    } else if (photo) {
       const p = photo[photo.length - 1];
       const fileUrl = await resolveFileUrl(p.file_id);
       if (fileUrl) {
         const processed = await processExternalMedia(fileUrl, "image/jpeg", "photo.jpg");
         userContent = `[Imagem]: ${processed.content}`;
       }
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

  } catch (err: any) {
    console.error("[Webhook Telegram Error]:", err);
  } finally {
    // Always ACK to prevent Telegram from retrying
    if (!res.headersSent) res.sendStatus(200);
  }
});

/**
 * POST /api/webhooks/whatsapp/:channelId
 * Placeholder for WhatsApp (Meta/Twilio)
 */
// TODO: implement WhatsApp (Meta Cloud API) — mirror the Telegram handler above
router.post("/webhooks/whatsapp/:channelId", (_req, res) => {
  res.sendStatus(200);
});

/**
 * POST /api/webhooks/crm/inbound/:tenantId
 * Generic inbound webhook to receive leads from external systems (RD Station, Meta Ads, Typeform).
 */
router.post("/webhooks/crm/inbound/:tenantId", async (req, res) => {
  const { tenantId } = req.params;

  const parsed = CrmInboundPayload.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[Webhook CRM] invalid payload — expected an object");
    res.sendStatus(200);
    return;
  }
  const payload = parsed.data;

  try {
    const rawCnpj = payload.cnpj ?? payload.company_cnpj ?? payload.document ?? payload.documento ?? payload.cpf_cnpj;
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

  } catch (err: any) {
    console.error(`[Webhook CRM Inbound Error Payload]:`, payload, err);
  } finally {
    if (!res.headersSent) res.sendStatus(200);
  }
});

export default router;
