import { Router, type IRouter } from "express";
import {
  db,
  llmConnectionsTable,
  llmProfilesTable,
  appConfigTable,
} from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/crypto.js";
import { apiError } from "../lib/api-response.js";
import logger from "../lib/logger.js";
import { isRealUser } from "../middlewares/auth.js";
import { discoverModels } from "../lib/model-discovery.js";
import { callLLM } from "../lib/llm-client.js";
import { healthCheckConnections } from "../lib/llm-router.js";
import {
  validateIdParam,
  validateSafeUrl,
  validateWhitelist,
} from "../lib/validation.js";
import {
  runDiagnostics,
  validateCredentials,
  testCapability,
} from "../lib/llm-diagnostics.js";

const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "ollama",
  "ollama_cloud",
  "custom_openai",
] as const;
type ProviderId = (typeof PROVIDER_IDS)[number];

const router: IRouter = Router();

// ─── Helper: scoped query filter ──────────────────────────────────────────────
function scopeByUser(userId: string | undefined) {
  return isRealUser(userId)
    ? eq(llmConnectionsTable.userId, userId)
    : undefined;
}

// ─── GET /api/llm/providers — List supported providers with metadata ──────────
router.get("/llm/providers", (_req, res) => {
  res.json({
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        label: "OpenAI GPT",
        icon: "⬡",
        color: "text-emerald-400",
        ring: "ring-emerald-500/40",
        dot: "bg-emerald-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "OpenAI API Key",
        keyPlaceholder: "sk-...",
      },
      {
        id: "anthropic",
        name: "Anthropic",
        label: "Anthropic Claude",
        icon: "◈",
        color: "text-amber-400",
        ring: "ring-amber-500/40",
        dot: "bg-amber-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "Anthropic API Key",
        keyPlaceholder: "sk-ant-...",
      },
      {
        id: "google",
        name: "Google",
        label: "Google Gemini",
        icon: "✦",
        color: "text-blue-400",
        ring: "ring-blue-500/40",
        dot: "bg-blue-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "Gemini API Key",
        keyPlaceholder: "AIzaSy...",
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        label: "OpenRouter",
        icon: "⇌",
        color: "text-purple-400",
        ring: "ring-purple-500/40",
        dot: "bg-purple-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "OpenRouter API Key",
        keyPlaceholder: "sk-or-...",
      },
      {
        id: "ollama",
        name: "Ollama",
        label: "Ollama Local",
        icon: "🦙",
        color: "text-sky-400",
        ring: "ring-sky-500/40",
        dot: "bg-sky-400",
        supportsDiscovery: true,
        needsBaseUrl: true,
        baseUrlPlaceholder: "http://localhost:11434",
        keyLabel: "Bearer Token (opcional)",
        keyPlaceholder: "Deixe em branco se não houver auth",
      },
      {
        id: "ollama_cloud",
        name: "Ollama Cloud",
        label: "Ollama Cloud",
        icon: "☁",
        color: "text-sky-300",
        ring: "ring-sky-400/40",
        dot: "bg-sky-300",
        supportsDiscovery: true,
        needsBaseUrl: true,
        baseUrlPlaceholder: "https://ollama.com/api",
        keyLabel: "Bearer Token (opcional)",
        keyPlaceholder: "Deixe em branco se não houver auth",
      },
      {
        id: "custom_openai",
        name: "Custom OpenAI",
        label: "OpenAI-Compatible",
        icon: "⚙",
        color: "text-gray-400",
        ring: "ring-gray-500/40",
        dot: "bg-gray-400",
        supportsDiscovery: true,
        needsBaseUrl: true,
        baseUrlPlaceholder: "https://api.exemplo.com/v1",
        keyLabel: "API Key",
        keyPlaceholder: "sk-...",
      },
    ],
  });
});

// ─── GET /api/llm/models/static — Static catalog of well-known LLM models ───
// Public endpoint used by the IA & LLM tab to populate the "Model" dropdown
// in the wizard even before the user has any connection configured.
// Mirrors the curated list in settings.ts:GET /settings/models but does
// NOT require auth.
router.get("/llm/models/static", async (_req, res) => {
  const models = [
    // ─── Google Gemini ────────────────────────────────────────────
    {
      id: "gemini-3-flash-preview",
      name: "Gemini 3 Flash",
      provider: "google",
      description: "Rapido e eficiente.",
      tag: "cloud",
    },
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro",
      provider: "google",
      description: "Mais capaz, melhor para analises longas.",
      tag: "cloud",
    },
    {
      id: "gemini-2.5-pro-preview-05-06",
      name: "Gemini 2.5 Pro",
      provider: "google",
      description: "Excelente raciocinio e contexto longo.",
      tag: "cloud",
    },
    {
      id: "gemini-2.0-flash-lite",
      name: "Gemini 2.0 Flash Lite",
      provider: "google",
      description: "Compacto e economico.",
      tag: "cloud",
    },
    // ─── Ollama Cloud ─────────────────────────────────────────────
    {
      id: "minimax-m3:cloud",
      name: "MiniMax M3 Cloud",
      provider: "ollama_cloud",
      description: "Coding & Agentic Frontier, 1M context.",
      tag: "cloud",
    },
    {
      id: "minimax-m2.7:cloud",
      name: "Minimax M2.7 Cloud",
      provider: "ollama_cloud",
      description: "Coding e workflows agenticos.",
      tag: "cloud",
    },
    {
      id: "gemma4:cloud",
      name: "Gemma 4 Cloud",
      provider: "ollama_cloud",
      description: "Open-source multimodal ate 31b.",
      tag: "cloud",
    },
    {
      id: "qwen3.5:cloud",
      name: "Qwen 3.5 Cloud",
      provider: "ollama_cloud",
      description: "Open-source multimodal ate 122b.",
      tag: "cloud",
    },
    {
      id: "qwen-2.5-coder-32b",
      name: "Qwen 2.5 Coder 32B",
      provider: "ollama_cloud",
      description: "Excelente para codigo.",
      tag: "cloud",
    },
    {
      id: "glm-5.1:cloud",
      name: "GLM 5.1 Cloud",
      provider: "ollama_cloud",
      description: "Agentic engineering top-tier.",
      tag: "cloud",
    },
    {
      id: "kimi-k2.6:cloud",
      name: "Kimi K2.6 Cloud",
      provider: "ollama_cloud",
      description: "Long-horizon coding agentico.",
      tag: "cloud",
    },
    {
      id: "kimi-k2.5:cloud",
      name: "Kimi K2.5 Cloud",
      provider: "ollama_cloud",
      description: "Contexto ultra-longo.",
      tag: "cloud",
    },
    {
      id: "deepseek-v3.2:cloud",
      name: "DeepSeek V3.2 Cloud",
      provider: "ollama_cloud",
      description: "Eficiencia e raciocinio.",
      tag: "cloud",
    },
    {
      id: "deepseek-v4-pro:cloud",
      name: "DeepSeek V4 Pro Cloud",
      provider: "ollama_cloud",
      description: "Frontier MoE 1M context, 3 raciocinios.",
      tag: "cloud",
    },
    {
      id: "deepseek-v4-flash:cloud",
      name: "DeepSeek V4 Flash Cloud",
      provider: "ollama_cloud",
      description: "V4 preview MoE eficiente.",
      tag: "cloud",
    },
    {
      id: "llama-3.1-70b",
      name: "LLaMA 3.1 70B",
      provider: "ollama",
      description: "Open-source top de linha.",
      tag: "local",
    },
    {
      id: "llama-3.1-8b",
      name: "LLaMA 3.1 8B",
      provider: "ollama",
      description: "Open-source veloz.",
      tag: "local",
    },
    {
      id: "qwen3-coder-next:cloud",
      name: "Qwen3 Coder Next Cloud",
      provider: "ollama_cloud",
      description: "Coding-focused agentic.",
      tag: "cloud",
    },
  ];
  res.json({ models });
});

// ─── POST /api/llm/validate — Test credentials without saving ─────────────────
// Used by the Model Hub wizard (ConnectionWizardV2) to give instant feedback
// before the user commits the connection to the database.
router.post("/llm/validate", async (req, res) => {
  try {
    const body = req.body as {
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
      modelId?: string;
    };
    const provider = validateWhitelist(body.provider, PROVIDER_IDS);
    if (!provider) {
      apiError(res, 400, "provider inválido.");
      return;
    }
    if (!body.apiKey || typeof body.apiKey !== "string") {
      apiError(res, 400, "apiKey é obrigatório.");
      return;
    }

    let baseUrl: string | undefined;
    if (body.baseUrl) {
      const safe = await validateSafeUrl(body.baseUrl.trim());
      if (!safe) {
        apiError(
          res,
          400,
          "baseUrl inválida ou aponta para rede privada/metadata (SSRF protection).",
        );
        return;
      }
      baseUrl = safe;
    } else if (
      provider === "ollama" ||
      provider === "ollama_cloud" ||
      provider === "custom_openai"
    ) {
      apiError(res, 400, "baseUrl é obrigatório para este provedor.");
      return;
    }

    const results = await validateCredentials(provider, body.apiKey, baseUrl);
    const ok = results.every((r) => r.ok);
    res.json({ success: true, ok, provider, results });
  } catch (err: any) {
    logger.error({ err }, "[LLM] validate error");
    apiError(res, 500, err?.message || "Falha ao validar credenciais.");
  }
});

// ─── POST /api/llm/discover — Fetch available models from a provider ──────────
router.post("/llm/discover", async (req, res) => {
  try {
    const body = req.body as {
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    const provider = validateWhitelist(body.provider, PROVIDER_IDS);
    if (!provider || !body.apiKey) {
      apiError(res, 400, "provider and apiKey are required");
      return;
    }
    let baseUrl: string | undefined;
    if (body.baseUrl) {
      const safe = await validateSafeUrl(body.baseUrl);
      if (!safe) {
        apiError(
          res,
          400,
          "baseUrl inválida ou aponta para rede privada/metadata.",
        );
        return;
      }
      baseUrl = safe;
    }
    const result = await discoverModels(provider, body.apiKey, baseUrl);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "[LLM] discover error");
    apiError(res, 500, "Discovery failed");
  }
});

// ─── GET /api/llm/connections — List all connections for user ─────────────────
router.get("/llm/connections", async (req, res) => {
  try {
    const userId = req.userId;
    const connections: (typeof llmConnectionsTable.$inferSelect)[] = await db
      .select()
      .from(llmConnectionsTable)
      .where(scopeByUser(userId))
      .orderBy(desc(llmConnectionsTable.createdAt));

    // Decrypt keys before sending? NO — never send API keys to frontend.
    // Strip sensitive fields.
    const safe = connections.map(
      (c: typeof llmConnectionsTable.$inferSelect) => {
        const { apiKey: _, ...rest } = c;
        return { ...rest, hasKey: !!c.apiKey };
      },
    );

    res.json({ success: true, connections: safe });
  } catch (err) {
    logger.error({ err }, "[LLM] list connections error");
    apiError(res, 500, "Failed to list connections");
  }
});

// ─── POST /api/llm/connections — Create a new connection ──────────────────────
router.post("/llm/connections", async (req, res) => {
  try {
    const userId = req.userId;
    const body = req.body as {
      name?: string;
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
      modelId?: string;
      modelName?: string;
      contextWindow?: number;
      maxTokens?: number;
      supportsVision?: boolean;
      supportsTools?: boolean;
      supportsJson?: boolean;
      priceInput?: string;
      priceOutput?: string;
      providerMetadata?: Record<string, unknown>;
      usageType?: string;
    };

    if (!body.provider || !body.apiKey || !body.modelId) {
      apiError(res, 400, "provider, apiKey and modelId are required");
      return;
    }
    const provider = validateWhitelist(body.provider, PROVIDER_IDS);
    if (!provider) {
      apiError(res, 400, "provider inválido.");
      return;
    }
    let baseUrl: string | undefined;
    if (body.baseUrl) {
      const safe = await validateSafeUrl(body.baseUrl);
      if (!safe) {
        apiError(
          res,
          400,
          "baseUrl inválida ou aponta para rede privada/metadata.",
        );
        return;
      }
      baseUrl = safe;
    } else if (
      provider === "ollama" ||
      provider === "ollama_cloud" ||
      provider === "custom_openai"
    ) {
      apiError(res, 400, "baseUrl é obrigatório para este provedor.");
      return;
    }

    const encryptedKey = encrypt(body.apiKey.trim());
    const effectiveUsageType = body.usageType || "chat";

    // Clear previous default for this usageType before inserting the new one
    await db
      .update(llmConnectionsTable)
      .set({ isDefault: false })
      .where(
        and(
          eq(llmConnectionsTable.usageType, effectiveUsageType),
          scopeByUser(userId) as any,
        ),
      );

    const [conn] = await db
      .insert(llmConnectionsTable)
      .values({
        userId: isRealUser(userId) ? userId : null,
        name: body.name || `${body.provider} — ${body.modelId}`,
        provider,
        baseUrl: baseUrl || null,
        apiKey: encryptedKey,
        modelId: body.modelId,
        modelName: body.modelName || body.modelId,
        contextWindow: body.contextWindow ?? null,
        maxTokens: body.maxTokens ?? null,
        supportsVision: body.supportsVision ?? false,
        supportsTools: body.supportsTools ?? false,
        supportsJson: body.supportsJson ?? false,
        priceInput: body.priceInput || null,
        priceOutput: body.priceOutput || null,
        providerMetadata: body.providerMetadata || null,
        usageType: effectiveUsageType,
        isDefault: true,
        isActive: true,
      })
      .returning();

    const { apiKey: _, ...safe } = conn;
    res
      .status(201)
      .json({ success: true, connection: { ...safe, hasKey: true } });
  } catch (err) {
    logger.error({ err }, "[LLM] create connection error");
    apiError(res, 500, "Failed to create connection");
  }
});

// ─── PUT /api/llm/connections/:id — Update a connection ───────────────────────
router.put("/llm/connections/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) {
      apiError(res, 400, "Invalid connection id");
      return;
    }

    const body = req.body as Partial<{
      name: string;
      provider: string;
      baseUrl: string;
      apiKey: string;
      modelId: string;
      modelName: string;
      contextWindow: number;
      maxTokens: number;
      supportsVision: boolean;
      supportsTools: boolean;
      supportsJson: boolean;
      priceInput: string;
      priceOutput: string;
      providerMetadata: Record<string, unknown>;
      usageType: string;
      isActive: boolean;
    }>;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.provider !== undefined) {
      const wp = validateWhitelist(body.provider, PROVIDER_IDS);
      if (!wp) {
        apiError(res, 400, "provider inválido.");
        return;
      }
      updateData.provider = wp;
    }
    if (body.name !== undefined) updateData.name = body.name;
    if (body.baseUrl !== undefined) {
      if (!body.baseUrl) {
        updateData.baseUrl = null;
      } else {
        const safe = await validateSafeUrl(body.baseUrl);
        if (!safe) {
          apiError(res, 400, "baseUrl inválida ou privada.");
          return;
        }
        updateData.baseUrl = safe;
      }
    }
    if (body.apiKey !== undefined)
      updateData.apiKey = encrypt(body.apiKey.trim());
    if (body.modelId !== undefined) updateData.modelId = body.modelId;
    if (body.modelName !== undefined) updateData.modelName = body.modelName;
    if (body.contextWindow !== undefined)
      updateData.contextWindow = body.contextWindow;
    if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
    if (body.supportsVision !== undefined)
      updateData.supportsVision = body.supportsVision;
    if (body.supportsTools !== undefined)
      updateData.supportsTools = body.supportsTools;
    if (body.supportsJson !== undefined)
      updateData.supportsJson = body.supportsJson;
    if (body.priceInput !== undefined)
      updateData.priceInput = body.priceInput || null;
    if (body.priceOutput !== undefined)
      updateData.priceOutput = body.priceOutput || null;
    if (body.providerMetadata !== undefined)
      updateData.providerMetadata = body.providerMetadata;
    if (body.usageType !== undefined) updateData.usageType = body.usageType;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const [updated] = await db
      .update(llmConnectionsTable)
      .set(updateData)
      .where(and(...conditions))
      .returning();

    if (!updated) {
      apiError(res, 404, "Connection not found");
      return;
    }

    const { apiKey: _, ...safe } = updated;
    res.json({ success: true, connection: { ...safe, hasKey: true } });
  } catch (err) {
    logger.error({ err }, "[LLM] update connection error");
    apiError(res, 500, "Failed to update connection");
  }
});

// ─── DELETE /api/llm/connections/:id — Remove a connection ────────────────────
router.delete("/llm/connections/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) {
      apiError(res, 400, "Invalid connection id");
      return;
    }

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const [deleted] = await db
      .delete(llmConnectionsTable)
      .where(and(...conditions))
      .returning();
    if (!deleted) {
      apiError(res, 404, "Connection not found");
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[LLM] delete connection error");
    apiError(res, 500, "Failed to delete connection");
  }
});

// ─── POST /api/llm/connections/:id/test — Test a specific connection ──────────
router.post("/llm/connections/:id/test", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) {
      apiError(res, 400, "Invalid connection id");
      return;
    }

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const [conn] = await db
      .select()
      .from(llmConnectionsTable)
      .where(and(...conditions))
      .limit(1);

    if (!conn) {
      apiError(res, 404, "Connection not found");
      return;
    }

    const apiKey = decrypt(conn.apiKey);
    const start = Date.now();

    try {
      // Map our provider names to llm-client provider names
      let provider = conn.provider;
      let customUrl = conn.baseUrl || undefined;
      if (provider === "custom_openai") provider = "openrouter"; // hack: custom_openai uses openai-sdk with custom baseURL

      // Warn about localhost URLs when backend is in the cloud
      if (
        customUrl &&
        /^(http:\/\/localhost|http:\/\/127\.)/i.test(customUrl) &&
        process.env.VERCEL
      ) {
        throw new Error(
          "URLs localhost (http://localhost:11434) não são acessíveis quando o backend roda na nuvem. Use um Ollama remoto com HTTPS ou rode o backend localmente.",
        );
      }

      const result = await callLLM(
        "You are a connectivity test assistant. Reply with exactly: 'OK · <model-name>'",
        "Reply with exactly: 'OK · <your model name>'",
        {
          provider,
          model: conn.modelId,
          customUrl,
          userId,
        },
      );

      const ok = result.output.toLowerCase().includes("ok");

      await db
        .update(llmConnectionsTable)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: ok ? "ok" : "error",
          lastError: ok
            ? null
            : `Unexpected response: ${result.output.slice(0, 200)}`,
        })
        .where(eq(llmConnectionsTable.id, id));

      res.json({
        success: true,
        ok,
        response: result.output,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        executionTimeMs: Date.now() - start,
      });
    } catch (err: any) {
      await db
        .update(llmConnectionsTable)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: "error",
          lastError: err.message?.slice(0, 500) || "Unknown error",
        })
        .where(eq(llmConnectionsTable.id, id));

      res.json({
        success: true,
        ok: false,
        error: err.message,
        executionTimeMs: Date.now() - start,
      });
    }
  } catch (err) {
    logger.error({ err }, "[LLM] test connection error");
    apiError(res, 500, "Failed to test connection");
  }
});

// ─── POST /api/llm/connections/:id/activate — Set as default for usageType ────
router.post("/llm/connections/:id/activate", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) {
      apiError(res, 400, "Invalid connection id");
      return;
    }

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const [conn] = await db
      .select()
      .from(llmConnectionsTable)
      .where(and(...conditions))
      .limit(1);

    if (!conn) {
      apiError(res, 404, "Connection not found");
      return;
    }

    // Clear previous default for this usageType
    const clearConditions = [
      eq(llmConnectionsTable.usageType, conn.usageType),
      eq(llmConnectionsTable.isDefault, true),
    ];
    if (userScope) clearConditions.push(userScope);

    await db
      .update(llmConnectionsTable)
      .set({ isDefault: false })
      .where(and(...clearConditions));

    // Set new default
    await db
      .update(llmConnectionsTable)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(llmConnectionsTable.id, id));

    res.json({ success: true, connectionId: id, usageType: conn.usageType });
  } catch (err) {
    logger.error({ err }, "[LLM] activate connection error");
    apiError(res, 500, "Failed to activate connection");
  }
});

// ─── GET /api/llm/profiles — List profiles ────────────────────────────────────
router.get("/llm/profiles", async (req, res) => {
  try {
    const userId = req.userId;
    const profiles = await db
      .select()
      .from(llmProfilesTable)
      .where(
        isRealUser(userId) ? eq(llmProfilesTable.userId, userId) : undefined,
      )
      .orderBy(desc(llmProfilesTable.createdAt));

    res.json({ success: true, profiles });
  } catch (err) {
    logger.error({ err }, "[LLM] list profiles error");
    apiError(res, 500, "Failed to list profiles");
  }
});

// ─── POST /api/llm/profiles — Create profile ──────────────────────────────────
router.post("/llm/profiles", async (req, res) => {
  try {
    const userId = req.userId;
    const body = req.body as {
      name: string;
      description?: string;
      chatConnectionId?: number;
      fastConnectionId?: number;
      reasoningConnectionId?: number;
      visionConnectionId?: number;
      embeddingConnectionId?: number;
      imageConnectionId?: number;
      transcriptionConnectionId?: number;
    };

    if (!body.name?.trim()) {
      apiError(res, 400, "name is required");
      return;
    }

    // Validate connectionIds exist and belong to user
    const connectionIds = [
      body.chatConnectionId,
      body.fastConnectionId,
      body.reasoningConnectionId,
      body.visionConnectionId,
      body.embeddingConnectionId,
      body.imageConnectionId,
      body.transcriptionConnectionId,
    ].filter((id): id is number => typeof id === "number" && !Number.isNaN(id));

    if (connectionIds.length > 0) {
      const owned = await db
        .select({ id: llmConnectionsTable.id })
        .from(llmConnectionsTable)
        .where(
          and(
            inArray(llmConnectionsTable.id, connectionIds),
            isRealUser(userId)
              ? eq(llmConnectionsTable.userId, userId)
              : undefined,
          ),
        );
      const ownedIds = new Set(owned.map((c) => c.id));
      const missing = connectionIds.filter((id) => !ownedIds.has(id));
      if (missing.length > 0) {
        apiError(res, 400, `Invalid connectionIds: ${missing.join(", ")}`);
        return;
      }
    }

    // Clear previous default if this one is default
    const isDefault = true; // first profile becomes default
    await db
      .update(llmProfilesTable)
      .set({ isDefault: false })
      .where(
        isRealUser(userId) ? eq(llmProfilesTable.userId, userId) : undefined,
      );

    const [profile] = await db
      .insert(llmProfilesTable)
      .values({
        userId: isRealUser(userId) ? userId : "system",
        name: body.name.trim(),
        description: body.description || null,
        chatConnectionId: body.chatConnectionId ?? null,
        fastConnectionId: body.fastConnectionId ?? null,
        reasoningConnectionId: body.reasoningConnectionId ?? null,
        visionConnectionId: body.visionConnectionId ?? null,
        embeddingConnectionId: body.embeddingConnectionId ?? null,
        imageConnectionId: body.imageConnectionId ?? null,
        transcriptionConnectionId: body.transcriptionConnectionId ?? null,
        isDefault,
      })
      .returning();

    res.status(201).json({ success: true, profile });
  } catch (err) {
    logger.error({ err }, "[LLM] create profile error");
    apiError(res, 500, "Failed to create profile");
  }
});

// ─── PUT /api/llm/profiles/:id — Update profile ───────────────────────────────
router.put("/llm/profiles/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = validateIdParam(req.params.id);
    if (id === null) {
      apiError(res, 400, "Invalid profile id");
      return;
    }

    const body = req.body as Partial<{
      name: string;
      description: string;
      chatConnectionId: number | null;
      fastConnectionId: number | null;
      reasoningConnectionId: number | null;
      visionConnectionId: number | null;
      embeddingConnectionId: number | null;
      imageConnectionId: number | null;
      transcriptionConnectionId: number | null;
      isDefault: boolean;
    }>;

    // Validate connectionIds exist and belong to user
    const connectionIds = [
      body.chatConnectionId,
      body.fastConnectionId,
      body.reasoningConnectionId,
      body.visionConnectionId,
      body.embeddingConnectionId,
      body.imageConnectionId,
      body.transcriptionConnectionId,
    ].filter((id): id is number => typeof id === "number" && !Number.isNaN(id));

    if (connectionIds.length > 0) {
      const owned = await db
        .select({ id: llmConnectionsTable.id })
        .from(llmConnectionsTable)
        .where(
          and(
            inArray(llmConnectionsTable.id, connectionIds),
            isRealUser(userId)
              ? eq(llmConnectionsTable.userId, userId)
              : undefined,
          ),
        );
      const ownedIds = new Set(owned.map((c) => c.id));
      const missing = connectionIds.filter((id) => !ownedIds.has(id));
      if (missing.length > 0) {
        apiError(res, 400, `Invalid connectionIds: ${missing.join(", ")}`);
        return;
      }
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined)
      updateData.description = body.description || null;
    if (body.chatConnectionId !== undefined)
      updateData.chatConnectionId = body.chatConnectionId;
    if (body.fastConnectionId !== undefined)
      updateData.fastConnectionId = body.fastConnectionId;
    if (body.reasoningConnectionId !== undefined)
      updateData.reasoningConnectionId = body.reasoningConnectionId;
    if (body.visionConnectionId !== undefined)
      updateData.visionConnectionId = body.visionConnectionId;
    if (body.embeddingConnectionId !== undefined)
      updateData.embeddingConnectionId = body.embeddingConnectionId;
    if (body.imageConnectionId !== undefined)
      updateData.imageConnectionId = body.imageConnectionId;
    if (body.transcriptionConnectionId !== undefined)
      updateData.transcriptionConnectionId = body.transcriptionConnectionId;

    const conditions = [eq(llmProfilesTable.id, id)];
    if (isRealUser(userId))
      conditions.push(eq(llmProfilesTable.userId, userId));

    const [updated] = await db
      .update(llmProfilesTable)
      .set(updateData)
      .where(and(...conditions))
      .returning();

    if (!updated) {
      apiError(res, 404, "Profile not found");
      return;
    }

    // Handle isDefault separately to ensure only one default
    if (body.isDefault) {
      await db
        .update(llmProfilesTable)
        .set({ isDefault: false })
        .where(and(eq(llmProfilesTable.userId, updated.userId)));
      await db
        .update(llmProfilesTable)
        .set({ isDefault: true })
        .where(eq(llmProfilesTable.id, id));
    }

    res.json({ success: true, profile: updated });
  } catch (err) {
    logger.error({ err }, "[LLM] update profile error");
    apiError(res, 500, "Failed to update profile");
  }
});

// ─── DELETE /api/llm/profiles/:id — Remove profile ────────────────────────────
router.delete("/llm/profiles/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) {
      apiError(res, 400, "Invalid profile id");
      return;
    }

    const conditions = [eq(llmProfilesTable.id, id)];
    if (isRealUser(userId))
      conditions.push(eq(llmProfilesTable.userId, userId));

    const [deleted] = await db
      .delete(llmProfilesTable)
      .where(and(...conditions))
      .returning();
    if (!deleted) {
      apiError(res, 404, "Profile not found");
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[LLM] delete profile error");
    apiError(res, 500, "Failed to delete profile");
  }
});

// ─── POST /api/llm/profiles/:id/activate — Set as active profile ──────────────
router.post("/llm/profiles/:id/activate", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) {
      apiError(res, 400, "Invalid profile id");
      return;
    }

    const conditions = [eq(llmProfilesTable.id, id)];
    if (isRealUser(userId))
      conditions.push(eq(llmProfilesTable.userId, userId));

    const [profile] = await db
      .select()
      .from(llmProfilesTable)
      .where(and(...conditions))
      .limit(1);

    if (!profile) {
      apiError(res, 404, "Profile not found");
      return;
    }

    await db
      .update(llmProfilesTable)
      .set({ isActive: false })
      .where(eq(llmProfilesTable.userId, profile.userId));

    await db
      .update(llmProfilesTable)
      .set({ isActive: true })
      .where(eq(llmProfilesTable.id, id));

    res.json({ success: true, profileId: id });
  } catch (err) {
    logger.error({ err }, "[LLM] activate profile error");
    apiError(res, 500, "Failed to activate profile");
  }
});

// ─── GET /api/llm/active-profile — Get current active profile with resolved connections
router.get("/llm/active-profile", async (req, res) => {
  try {
    const userId = req.userId;
    const conditions = isRealUser(userId)
      ? and(
          eq(llmProfilesTable.userId, userId),
          eq(llmProfilesTable.isActive, true),
        )
      : eq(llmProfilesTable.isActive, true);

    const [profile] = await db
      .select()
      .from(llmProfilesTable)
      .where(conditions)
      .limit(1);

    if (!profile) {
      res.json({ success: true, profile: null });
      return;
    }

    // Resolve connections
    const connIds = [
      profile.chatConnectionId,
      profile.fastConnectionId,
      profile.reasoningConnectionId,
      profile.visionConnectionId,
      profile.embeddingConnectionId,
      profile.imageConnectionId,
      profile.transcriptionConnectionId,
    ].filter(Boolean) as number[];

    const resolved: (typeof llmConnectionsTable.$inferSelect)[] = connIds.length
      ? await db
          .select()
          .from(llmConnectionsTable)
          .where(
            and(
              inArray(llmConnectionsTable.id, connIds),
              isRealUser(userId)
                ? eq(llmConnectionsTable.userId, userId)
                : undefined,
            ),
          )
      : [];
    const connMap = new Map(
      resolved.map((c: typeof llmConnectionsTable.$inferSelect) => [c.id, c]),
    );

    const stripKey = (c: typeof llmConnectionsTable.$inferSelect) => {
      const { apiKey: _, ...rest } = c;
      return rest;
    };

    res.json({
      success: true,
      profile: {
        ...profile,
        chatConnection: profile.chatConnectionId
          ? stripKey(connMap.get(profile.chatConnectionId)!)
          : null,
        fastConnection: profile.fastConnectionId
          ? stripKey(connMap.get(profile.fastConnectionId)!)
          : null,
        reasoningConnection: profile.reasoningConnectionId
          ? stripKey(connMap.get(profile.reasoningConnectionId)!)
          : null,
        visionConnection: profile.visionConnectionId
          ? stripKey(connMap.get(profile.visionConnectionId)!)
          : null,
        embeddingConnection: profile.embeddingConnectionId
          ? stripKey(connMap.get(profile.embeddingConnectionId)!)
          : null,
        imageConnection: profile.imageConnectionId
          ? stripKey(connMap.get(profile.imageConnectionId)!)
          : null,
        transcriptionConnection: profile.transcriptionConnectionId
          ? stripKey(connMap.get(profile.transcriptionConnectionId)!)
          : null,
      },
    });
  } catch (err) {
    logger.error({ err }, "[LLM] active profile error");
    apiError(res, 500, "Failed to get active profile");
  }
});

// ─── POST + GET /api/llm/health-check — Run health checks on all active connections ─
// GET is supported for simpler testing (browser/curl), POST for frontend
async function handleHealthCheck(req: any, res: any) {
  try {
    const userId = req.userId;
    const conditions = [eq(llmConnectionsTable.isActive, true)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const connections = await db
      .select()
      .from(llmConnectionsTable)
      .where(and(...conditions));

    const results = await Promise.all(
      connections.map(async (conn) => {
        try {
          const apiKey = decrypt(conn.apiKey);
          const diagnostics = await runDiagnostics(
            {
              id: conn.id,
              provider: conn.provider,
              modelId: conn.modelId,
              baseUrl: conn.baseUrl,
              supportsJson: conn.supportsJson ?? undefined,
              supportsTools: conn.supportsTools ?? undefined,
              apiKey,
            },
            userId,
          );
          return {
            connectionId: conn.id,
            name: conn.name,
            provider: conn.provider,
            diagnostics,
          };
        } catch (err: any) {
          return {
            connectionId: conn.id,
            name: conn.name,
            provider: conn.provider,
            error: err.message,
          };
        }
      }),
    );

    res.json({ success: true, results });
  } catch (err) {
    logger.error({ err }, "[LLM] health-check error");
    apiError(res, 500, "Health check failed");
  }
}

router.post("/llm/health-check", handleHealthCheck);
router.get("/llm/health-check", handleHealthCheck);

export default router;
