import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
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
import { enrichContact } from "../lib/cnpj-enrichment.js";
import { sendWhatsAppMessage, resolveWhatsAppMediaUrl } from "../lib/whatsapp.js";

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
  const reqId = req.id;

  const parsed = TelegramUpdate.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[Webhook Telegram] invalid payload", { reqId, errors: parsed.error.flatten() });
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
      if (expectedSecret && (!receivedSecret || !safeCompare(String(receivedSecret), expectedSecret))) {
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
    console.error("[Webhook Telegram Error]", { reqId, err });
  } finally {
    // Always ACK to prevent Telegram from retrying
    if (!res.headersSent) res.sendStatus(200);
  }
});

// ── WhatsApp (Meta Cloud API) schemas ─────────────────────────────────────────

const WhatsAppMessage = z.object({
  type: z.string(),
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  text: z.object({ body: z.string() }).optional(),
  audio: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
  image: z.object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() }).optional(),
  document: z.object({ id: z.string(), filename: z.string().optional(), mime_type: z.string().optional() }).optional(),
}).passthrough();

type WhatsAppMsg = z.infer<typeof WhatsAppMessage>;

const WhatsAppWebhookPayload = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.string(),
        metadata: z.object({ phone_number_id: z.string() }).passthrough(),
        messages: z.array(WhatsAppMessage).optional(),
        statuses: z.array(z.unknown()).optional(),
      }).passthrough(),
      field: z.string(),
    })),
  })),
});

/**
 * GET /api/webhooks/whatsapp/:channelId
 * Meta webhook verification handshake.
 */
router.get("/webhooks/whatsapp/:channelId", async (req, res) => {
  const { channelId } = req.params;
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  const numericId = Number(channelId);
  if (isNaN(numericId)) {
    res.sendStatus(403);
    return;
  }

  try {
    const [config] = await db
      .select()
      .from(channelConfigsTable)
      .where(and(eq(channelConfigsTable.platform, "whatsapp"), eq(channelConfigsTable.id, numericId)))
      .limit(1);

    const expectedToken = (config?.config as Record<string, unknown> | null)?.verifyToken;
    if (mode === "subscribe" && token === expectedToken) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } catch (err) {
    console.error("[Webhook WhatsApp] GET verification error:", err);
    res.sendStatus(403);
  }
});

/**
 * POST /api/webhooks/whatsapp/:channelId
 * Meta Cloud API webhook — mirrors the Telegram handler.
 */
router.post("/webhooks/whatsapp/:channelId", async (req, res) => {
  const { channelId } = req.params;
  const reqId = req.id;

  const numericId = Number(channelId);
  if (isNaN(numericId)) {
    res.sendStatus(200); // Always ACK to Meta — never let it retry an invalid URL
    return;
  }

  const parsed = WhatsAppWebhookPayload.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[Webhook WhatsApp] invalid payload", { reqId, errors: parsed.error.flatten() });
    res.sendStatus(200);
    return;
  }
  const payload = parsed.data;

  try {
    // Extract the first inbound message from the nested Meta envelope
    const entry = payload.entry[0];
    const change = entry?.changes.find(c => c.field === "messages");
    const message = change?.value.messages?.[0];
    const phoneNumberId = change?.value.metadata.phone_number_id;

    // Ignore status updates (delivered, read, etc.) silently
    if (!message || !phoneNumberId) {
      res.sendStatus(200);
      return;
    }

    const [config] = await db
      .select()
      .from(channelConfigsTable)
      .where(and(eq(channelConfigsTable.platform, "whatsapp"), eq(channelConfigsTable.id, numericId)))
      .limit(1);

    if (!config) {
      console.warn(`[Webhook WhatsApp] No config for channelId: ${channelId}`);
      return;
    }

    const configData = config.config as Record<string, unknown> | null;
    const accessToken = String(configData?.accessToken ?? "");
    if (!accessToken) {
      console.warn(`[Webhook WhatsApp] No accessToken in config for channel ${channelId}`);
      return;
    }

    const agent = AGENTS.find(a => a.id === config.agentId);
    if (!agent) return;

    const fromNumber = message.from;

    // Find or create conversation keyed by WhatsApp sender number
    let [conv] = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.platform, "whatsapp"), eq(conversationsTable.externalId, fromNumber)))
      .limit(1);

    if (!conv) {
      [conv] = await db
        .insert(conversationsTable)
        .values({
          agentId: agent.id,
          userId: config.userId,
          platform: "whatsapp",
          externalId: fromNumber,
          title: `WhatsApp (${fromNumber})`,
        })
        .returning();
    }

    // Process input by message type
    let userContent = "";
    const msg = message as WhatsAppMsg;

    if (msg.type === "text" && msg.text) {
      userContent = msg.text.body;
    } else if (msg.type === "audio" && msg.audio) {
      const mediaUrl = await resolveWhatsAppMediaUrl(msg.audio.id, accessToken);
      if (mediaUrl) {
        const fetched = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (fetched.ok) {
          const buf = Buffer.from(await fetched.arrayBuffer());
          const processed = await processExternalMedia(buf, msg.audio.mime_type || "audio/ogg", "voice_note.ogg");
          userContent = processed.content;
        }
      }
    } else if (msg.type === "image" && msg.image) {
      const mediaUrl = await resolveWhatsAppMediaUrl(msg.image.id, accessToken);
      if (mediaUrl) {
        const processed = await processExternalMedia(mediaUrl, msg.image.mime_type || "image/jpeg", "photo.jpg");
        userContent = msg.image.caption
          ? `[Imagem — legenda: ${msg.image.caption}]\n${processed.content}`
          : `[Imagem]: ${processed.content}`;
      }
    } else if (msg.type === "document" && msg.document) {
      const mediaUrl = await resolveWhatsAppMediaUrl(msg.document.id, accessToken);
      if (mediaUrl) {
        const processed = await processExternalMedia(
          mediaUrl,
          msg.document.mime_type || "application/pdf",
          msg.document.filename ?? "file",
        );
        userContent = `[Arquivo: ${msg.document.filename}]\nContent: ${processed.content}`;
      }
    }

    if (!userContent) return;

    await db.insert(messagesTable).values({ conversationId: conv.id, role: "user", content: userContent });

    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(messagesTable.createdAt);

    const recentHistory = history.slice(-14);
    const context = recentHistory
      .map(m => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
      .join("\n");

    const llmResponse = await callLLM(
      agent.systemPrompt,
      `Histórico da conversa:\n${context}\n\nNova mensagem: ${userContent}`,
      { toolIds: ["webSearch", "emailSender"] },
    );

    await db.insert(messagesTable).values({ conversationId: conv.id, role: "assistant", content: llmResponse.output });

    await sendWhatsAppMessage(fromNumber, llmResponse.output, phoneNumberId, accessToken);

    await db.insert(usageLogsTable).values({
      userId: config.userId,
      conversationId: conv.id,
      agentId: agent.id,
      model: llmResponse.model,
      provider: llmResponse.provider,
      totalTokens: llmResponse.tokensUsed,
      latencyMs: llmResponse.executionTimeMs,
      platform: "whatsapp",
    }).catch((e: Error) => console.error("[Analytics] WhatsApp log error:", e));

  } catch (err: unknown) {
    console.error("[Webhook WhatsApp] error", { reqId, err });
  } finally {
    if (!res.headersSent) res.sendStatus(200);
  }
});

/**
 * POST /api/webhooks/crm/inbound
 * Generic inbound webhook to receive leads from external systems (RD Station, Meta Ads, Typeform).
 *
 * Auth: `x-crm-webhook-secret` shared secret (CRON-style). The tenant id is
 * read from `x-tenant-id` header — never from the URL — so the secret cannot
 * be used to write into an arbitrary tenant without a matching secret + id.
 */
router.post("/webhooks/crm/inbound", async (req, res) => {
  const reqId = req.id;

  const expectedSecret = process.env.CRM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  const providedSecret = req.headers["x-crm-webhook-secret"] || req.headers["x-webhook-secret"];
  if (!expectedSecret || typeof providedSecret !== "string" || !safeCompare(providedSecret, expectedSecret)) {
    res.status(401).json({ error: "Invalid or missing webhook secret" });
    return;
  }

  const tenantId = req.headers["x-tenant-id"];
  if (typeof tenantId !== "string" || tenantId.trim() === "" || ["system", "default", "demo-user"].includes(tenantId)) {
    res.status(400).json({ error: "Invalid or missing x-tenant-id header" });
    return;
  }

  const parsed = CrmInboundPayload.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[Webhook CRM] invalid payload — expected an object", { reqId });
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
      } as any).returning();
      contact = newContact;
      // AI scoring in background — also auto-creates deal if score >= 60
      setImmediate(() => {
        enrichContact(newContact.id, tenantId).catch((err: Error) =>
          console.error("[Enrichment] Webhook enrich failed for contact", newContact.id, err)
        );
      });
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
    console.error("[Webhook CRM Inbound Error]", { reqId, tenantId, err });
  } finally {
    if (!res.headersSent) res.sendStatus(200);
  }
});

export default router;
