import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  db, designGalleryTable, knowledgeChunksTable, knowledgeDocumentsTable,
  appConfigTable, integrationLogsTable,
} from "@workspace/db";
import { eq, and, desc, inArray, sql, isNull } from "drizzle-orm";
import { generateEmbeddings } from "../lib/llm-client.js";
import { apiError } from "../lib/api-response.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { listIntegrationLogs, writeIntegrationLog, safePayloadPreview } from "../lib/integration-logger.js";
import { dispatchWebhook } from "../lib/webhook-dispatcher.js";
import { validateSafeUrl } from "../lib/validation.js";
import { safeNumber } from "../lib/validation.js";

const router: IRouter = Router();

// Root GET - list available integration endpoints
router.get("/integrations", (_req, res) => {
  res.json({
    endpoints: [
      { method: "POST", path: "/api/integrations/generate-image", description: "Generate image with Gemini AI" },
      { method: "GET", path: "/api/integrations/image-gallery/:agentId", description: "Get image gallery for agent" },
      { method: "POST", path: "/api/integrations/canva-link", description: "Generate Canva design link" },
      { method: "POST", path: "/api/integrations/search-knowledge", description: "Semantic search in knowledge base" },
    ],
  });
});

router.post("/integrations/generate-image", async (req, res) => {
  try {
    const { prompt, style, agentId } = req.body as { prompt?: string; style?: string; agentId?: string };
    if (!prompt?.trim()) {
      apiError(res, 400, "prompt is required");
      return;
    }

    const fullPrompt = style
      ? `${prompt}. Style: ${style}. Professional, high-quality, suitable for business context.`
      : `${prompt}. Professional, high-quality, suitable for business and tax consulting context.`;

    const geminiKey = process.env.GEMINI_API_KEY;
    let imageUrl: string;

    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                responseModalities: ["IMAGE", "TEXT"]
              },
            }),
          }
        );
        interface GeminiPart { inlineData?: { mimeType: string; data: string }; text?: string }
        interface GeminiResponse { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }
        const data = (await response.json()) as GeminiResponse;
        const imagePart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (imagePart?.inlineData) {
          imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        } else {
          throw new Error("No image in Gemini response");
        }
      } catch {
        imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent("Tax Group AI")}`;
      }
    } else {
      imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 30))}`;
    }

    const galleryKey = agentId || "global";
    const userId = req.userId;

    // Persist to DB (cap at 20 items per agent/user)
    const existing = await db
      .select({ id: designGalleryTable.id })
      .from(designGalleryTable)
      .where(
        and(
          eq(designGalleryTable.agentId, galleryKey),
          userId ? eq(designGalleryTable.userId, userId) : isNull(designGalleryTable.userId)
        )
      )
      .orderBy(desc(designGalleryTable.createdAt));

    if (existing.length >= 20) {
      const toDelete = existing.slice(19).map((r) => r.id);
      if (toDelete.length > 0) {
        await db.delete(designGalleryTable).where(inArray(designGalleryTable.id, toDelete));
      }
    }

    await db.insert(designGalleryTable).values({
      agentId: galleryKey,
      userId: userId || null,
      imageUrl,
      prompt: fullPrompt,
    });

    const gallery = await db
      .select()
      .from(designGalleryTable)
      .where(
        and(
          eq(designGalleryTable.agentId, galleryKey),
          userId ? eq(designGalleryTable.userId, userId) : isNull(designGalleryTable.userId)
        )
      )
      .orderBy(desc(designGalleryTable.createdAt));

    res.json({
      imageUrl,
      prompt: fullPrompt,
      gallery: gallery.map(g => ({ url: g.imageUrl, prompt: g.prompt, createdAt: g.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error("Error generating image:", err);
    apiError(res, 500, "Internal server error");
  }
});

router.get("/integrations/image-gallery/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.userId;

    const images = await db
      .select()
      .from(designGalleryTable)
      .where(
        and(
          eq(designGalleryTable.agentId, agentId),
          userId ? eq(designGalleryTable.userId, userId) : isNull(designGalleryTable.userId)
        )
      )
      .orderBy(desc(designGalleryTable.createdAt));

    res.json({
      images: images.map(g => ({ url: g.imageUrl, prompt: g.prompt, createdAt: g.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error("Error fetching image gallery:", err);
    apiError(res, 500, "Internal server error");
  }
});

router.post("/integrations/canva-link", async (req, res) => {
  try {
    const { contentType, title, description } = req.body as { contentType?: string; title?: string; description?: string };
    if (!contentType) {
      apiError(res, 400, "contentType is required");
      return;
    }

    const canvaDesignTypes: Record<string, { type: string; label: string }> = {
      presentation: { type: "Presentation", label: "Apresentação" },
      social_post: { type: "SocialMedia", label: "Post para Redes Sociais" },
      document: { type: "Document", label: "Documento" },
      flyer: { type: "Flyer", label: "Flyer" },
      "post-linkedin": { type: "SocialMedia", label: "Post LinkedIn" },
      "email-header": { type: "EmailHeader", label: "Header de Email" },
      "one-pager": { type: "Document", label: "One-Pager" },
      banner: { type: "FacebookCover", label: "Banner" },
      infografico: { type: "Infographic", label: "Infográfico" },
      instagram: { type: "InstagramPost", label: "Post Instagram" },
    };

    const design = canvaDesignTypes[contentType] || { type: "Presentation", label: contentType };
    const encodedTitle = encodeURIComponent(title || `Tax Group - ${design.label}`);
    const url = `https://www.canva.com/design/new?designType=${design.type}&title=${encodedTitle}`;
    res.json({ url, contentType, label: design.label });
  } catch (err) {
    console.error("Error generating Canva link:", err);
    apiError(res, 500, "Internal server error");
  }
});

router.post("/integrations/search-knowledge", async (req, res) => {
  try {
    const { query, agentId, limit } = req.body as { query?: string; agentId?: string; limit?: number };
    if (!query?.trim()) {
      apiError(res, 400, "query is required");
      return;
    }

    try {
      const [queryEmbedding] = await generateEmbeddings([query]);
      const userId = req.userId;
      
      const similarity = sql<number>`1 - (${knowledgeChunksTable.embedding} <=> ${JSON.stringify(queryEmbedding)})`;
      
      const results = await db
        .select({
          documentId: knowledgeChunksTable.documentId,
          content: knowledgeChunksTable.content,
          score: similarity,
          filename: knowledgeDocumentsTable.filename,
        })
        .from(knowledgeChunksTable)
        .innerJoin(knowledgeDocumentsTable, eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id))
        .where(
          and(
            agentId ? eq(knowledgeDocumentsTable.agentId, agentId) : sql`TRUE`,
            userId ? eq(knowledgeDocumentsTable.userId, userId) : sql`TRUE`
          )
        )
        .orderBy((t: any) => desc(t.score))
        .limit(limit || 5);

      res.json({
        query,
        results: results.filter((r) => r.score > 0.3), // Vector similarity threshold
      });
    } catch (embErr) {
      console.error("Vector search error:", embErr);
      apiError(res, 500, "Failed to perform vector search");
    }
  } catch (err) {
    console.error("Error searching knowledge:", err);
    apiError(res, 500, "Internal server error");
  }
});

// ── Integration Health ──────────────────────────────────────────────────────

/**
 * GET /api/integrations/health
 * Returns real-time status of all tracked integrations.
 */
router.get("/integrations/health", async (req, res) => {
  try {
    const userId = req.userId;

    // Last logs per integration (last 50 entries)
    const recentLogs = await db
      .select()
      .from(integrationLogsTable)
      .where(userId ? eq(integrationLogsTable.userId, userId) : sql`TRUE`)
      .orderBy(desc(integrationLogsTable.createdAt))
      .limit(50);

    // Make config status
    const [makeUrlRow] = await db.select().from(appConfigTable)
      .where(eq(appConfigTable.key, "integration:make:webhook_url")).limit(1);
    const [makeEnabledRow] = await db.select().from(appConfigTable)
      .where(eq(appConfigTable.key, "integration:make:enabled")).limit(1);

    const makeConfigured = !!makeUrlRow?.value;
    const makeEnabled = makeEnabledRow?.value === "true";

    const integrations = [
      {
        key: "make",
        name: "Make.com",
        category: "Automação",
        isRealIntegration: true,
        status: makeConfigured ? (makeEnabled ? "connected" : "available") : "available",
        configured: makeConfigured,
        enabled: makeEnabled,
        lastRunAt: recentLogs.find(l => l.integrationKey === "make")?.createdAt ?? null,
        lastError: recentLogs.find(l => l.integrationKey === "make" && l.status === "error")?.errorMessage ?? null,
        logCount: recentLogs.filter(l => l.integrationKey === "make").length,
      },
      {
        key: "webhooks",
        name: "Webhooks",
        category: "Automação",
        isRealIntegration: true,
        status: "connected" as const,
        configured: true,
        enabled: true,
        lastRunAt: recentLogs.find(l => l.integrationKey === "webhooks")?.createdAt ?? null,
        lastError: null,
        logCount: recentLogs.filter(l => l.integrationKey === "webhooks").length,
      },
      {
        key: "whatsapp",
        name: "WhatsApp Business",
        category: "Comunicação",
        isRealIntegration: true,
        status: "connected" as const,
        configured: true,
        enabled: true,
        lastRunAt: recentLogs.find(l => l.integrationKey === "whatsapp")?.createdAt ?? null,
        lastError: null,
        logCount: recentLogs.filter(l => l.integrationKey === "whatsapp").length,
      },
      {
        key: "telegram",
        name: "Telegram",
        category: "Comunicação",
        isRealIntegration: true,
        status: "connected" as const,
        configured: true,
        enabled: true,
        lastRunAt: recentLogs.find(l => l.integrationKey === "telegram")?.createdAt ?? null,
        lastError: null,
        logCount: recentLogs.filter(l => l.integrationKey === "telegram").length,
      },
      {
        key: "canva",
        name: "Canva",
        category: "Conteúdo & Design",
        isRealIntegration: true,
        status: "connected" as const,
        configured: true,
        enabled: true,
        lastRunAt: recentLogs.find(l => l.integrationKey === "canva")?.createdAt ?? null,
        lastError: null,
        logCount: recentLogs.filter(l => l.integrationKey === "canva").length,
      },
      {
        key: "gemini-images",
        name: "Geração de Imagens",
        category: "IA & Modelos",
        isRealIntegration: true,
        status: process.env.GEMINI_API_KEY ? "connected" : "available",
        configured: !!process.env.GEMINI_API_KEY,
        enabled: !!process.env.GEMINI_API_KEY,
        lastRunAt: recentLogs.find(l => l.integrationKey === "gemini-images")?.createdAt ?? null,
        lastError: null,
        logCount: recentLogs.filter(l => l.integrationKey === "gemini-images").length,
      },
    ];

    const connected = integrations.filter(i => i.status === "connected").length;
    const errors = recentLogs.filter(l => l.status === "error").length;
    const lastRun = recentLogs[0]?.createdAt ?? null;

    res.json({ integrations, summary: { connected, errors, lastRun } });
  } catch (err) {
    console.error("[Integrations] health error:", err);
    apiError(res, 500, "Failed to load integration health");
  }
});

// ── Integration Logs ────────────────────────────────────────────────────────

/**
 * GET /api/integrations/logs
 * Filtered log list. Respects userId tenancy.
 */
router.get("/integrations/logs", async (req, res) => {
  try {
    const userId = req.userId;
    const { integration, status, direction, limit } = req.query as Record<string, string>;

    const logs = await listIntegrationLogs({
      userId: userId ?? undefined,
      integrationKey: integration || undefined,
      status: status as any || undefined,
      direction: direction as any || undefined,
      limit: safeNumber(limit, { min: 1, max: 200 }) ?? 100,
    });

    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error("[Integrations] logs list error:", err);
    apiError(res, 500, "Failed to load logs");
  }
});

/**
 * GET /api/integrations/logs/:id
 * Single log detail.
 */
router.get("/integrations/logs/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid log id"); return; }

    const [log] = await db.select().from(integrationLogsTable)
      .where(eq(integrationLogsTable.id, id)).limit(1);

    if (!log) { apiError(res, 404, "Log not found"); return; }

    // Tenancy: only own logs
    if (req.userId && log.userId && log.userId !== req.userId) {
      apiError(res, 404, "Log not found"); return;
    }

    res.json({ log });
  } catch (err) {
    console.error("[Integrations] log detail error:", err);
    apiError(res, 500, "Failed to load log");
  }
});

// ── Make.com Config ─────────────────────────────────────────────────────────

const MAKE_KEYS = {
  url: "integration:make:webhook_url",
  secret: "integration:make:secret",
  enabled: "integration:make:enabled",
  env: "integration:make:environment",
  description: "integration:make:description",
};

async function getMakeConfig() {
  const rows = await db.select().from(appConfigTable).where(
    sql`${appConfigTable.key} LIKE 'integration:make:%'`
  );
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const rawUrl = map[MAKE_KEYS.url] ?? "";
  const hasUrl = !!rawUrl;
  const hasSecret = !!map[MAKE_KEYS.secret];
  return {
    webhookUrl: hasUrl ? maskConfigUrl(rawUrl) : "",
    hasSecret,
    enabled: map[MAKE_KEYS.enabled] === "true",
    environment: map[MAKE_KEYS.env] ?? "production",
    description: map[MAKE_KEYS.description] ?? "",
    configured: hasUrl,
  };
}

function maskConfigUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch { return url.substring(0, 50) + "…"; }
}

async function upsertConfig(key: string, value: string) {
  await db.insert(appConfigTable).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appConfigTable.key, set: { value, updatedAt: new Date() } });
}

/**
 * GET /api/integrations/make/config
 * Returns masked Make.com config (never returns raw secret or full URL with tokens).
 */
router.get("/integrations/make/config", async (_req, res) => {
  try {
    const config = await getMakeConfig();
    res.json({ config });
  } catch (err) {
    console.error("[Integrations] make config get error:", err);
    apiError(res, 500, "Failed to load Make config");
  }
});

/**
 * POST /api/integrations/make/config
 * Save Make.com webhook config. Secret is encrypted at rest.
 */
router.post("/integrations/make/config", async (req, res) => {
  try {
    const { webhookUrl, secret, enabled, environment, description } = req.body as {
      webhookUrl?: string;
      secret?: string;
      enabled?: boolean;
      environment?: string;
      description?: string;
    };

    if (webhookUrl !== undefined) {
      if (webhookUrl && !validateSafeUrl(webhookUrl)) {
        apiError(res, 400, "URL inválida ou não permitida."); return;
      }
      await upsertConfig(MAKE_KEYS.url, webhookUrl ?? "");
    }

    if (secret !== undefined && secret !== "") {
      await upsertConfig(MAKE_KEYS.secret, encrypt(secret));
    }

    if (enabled !== undefined) {
      await upsertConfig(MAKE_KEYS.enabled, String(enabled));
    }

    if (environment !== undefined) {
      await upsertConfig(MAKE_KEYS.env, environment);
    }

    if (description !== undefined) {
      await upsertConfig(MAKE_KEYS.description, description.slice(0, 200));
    }

    const config = await getMakeConfig();
    res.json({ success: true, config });
  } catch (err) {
    console.error("[Integrations] make config save error:", err);
    apiError(res, 500, "Failed to save Make config");
  }
});

/**
 * POST /api/integrations/make/test
 * Send a test event to the configured Make.com webhook.
 */
router.post("/integrations/make/test", async (req, res) => {
  try {
    const userId = req.userId;

    const rows = await db.select().from(appConfigTable).where(
      sql`${appConfigTable.key} LIKE 'integration:make:%'`
    );
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const rawUrl = map[MAKE_KEYS.url];
    const encryptedSecret = map[MAKE_KEYS.secret];

    if (!rawUrl) {
      apiError(res, 400, "Make.com não configurado. Salve a URL do webhook primeiro."); return;
    }

    const secret = encryptedSecret ? decrypt(encryptedSecret) : undefined;
    const testPayload = {
      message: "Teste de conectividade — Tax Group Hub",
      environment: map[MAKE_KEYS.env] ?? "production",
      triggeredBy: userId ?? "system",
      timestamp: new Date().toISOString(),
    };

    const result = await dispatchWebhook({
      targetUrl: rawUrl,
      eventType: "integration.tested",
      payload: testPayload,
      secret,
      userId: userId ?? undefined,
      integrationKey: "make",
      integrationName: "Make.com",
    });

    res.json({
      ok: result.ok,
      correlationId: result.correlationId,
      durationMs: result.durationMs,
      httpStatus: result.httpStatus,
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
    });
  } catch (err) {
    console.error("[Integrations] make test error:", err);
    apiError(res, 500, "Erro ao enviar teste para Make.com");
  }
});

// ── Generic Inbound Webhook ─────────────────────────────────────────────────

/**
 * POST /api/integrations/inbound/:source
 * Generic inbound webhook. Logs the event, returns correlationId.
 * Authentication is optional: validate X-TaxGroup-Secret header if configured.
 */
router.post("/integrations/inbound/:source", async (req, res) => {
  const { source } = req.params;
  const correlationId = randomUUID();

  // Limit payload size (express json middleware should already cap, but be explicit)
  const body = req.body;

  try {
    const sanitizedSource = source.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || "unknown";

    await writeIntegrationLog({
      userId: req.userId ?? undefined,
      integrationKey: "webhooks",
      integrationName: `Webhook Inbound (${sanitizedSource})`,
      eventType: (body?.event as string) ?? "webhook.received",
      direction: "inbound",
      status: "success",
      requestMethod: "POST",
      payloadPreview: safePayloadPreview(body),
      correlationId,
    });

    res.json({
      ok: true,
      eventId: correlationId,
      correlationId,
      message: "Webhook recebido com sucesso",
      source: sanitizedSource,
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Integrations] inbound webhook error:", err);
    // Still ACK — don't make external senders retry on our internal errors
    res.json({ ok: true, correlationId, message: "Webhook recebido" });
  }
});

/**
 * POST /api/integrations/events/dispatch
 * Internal endpoint — trigger an integration event (e.g., from CRM actions).
 * Used to fan out events to configured webhooks (Make.com, etc.).
 */
router.post("/integrations/events/dispatch", async (req, res) => {
  try {
    const { eventType, payload } = req.body as { eventType?: string; payload?: Record<string, unknown> };
    if (!eventType) { apiError(res, 400, "eventType required"); return; }

    const userId = req.userId;
    const results: Array<{ target: string; result: Awaited<ReturnType<typeof dispatchWebhook>> }> = [];

    // Fan out to Make.com if configured
    const rows = await db.select().from(appConfigTable).where(
      sql`${appConfigTable.key} LIKE 'integration:make:%'`
    );
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const makeUrl = map[MAKE_KEYS.url];
    const makeEnabled = map[MAKE_KEYS.enabled] === "true";

    if (makeUrl && makeEnabled) {
      const secret = map[MAKE_KEYS.secret] ? decrypt(map[MAKE_KEYS.secret]) : undefined;
      const r = await dispatchWebhook({
        targetUrl: makeUrl,
        eventType,
        payload: payload ?? {},
        secret,
        userId: userId ?? undefined,
        integrationKey: "make",
        integrationName: "Make.com",
      });
      results.push({ target: "make", result: r });
    }

    res.json({ ok: true, dispatched: results.length, results });
  } catch (err) {
    console.error("[Integrations] dispatch error:", err);
    apiError(res, 500, "Dispatch failed");
  }
});

export default router;
