import { Router, type IRouter } from "express";
import { db, appConfigTable, channelConfigsTable, apiKeysTable, activeLlmSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/crypto.js";
import logger from "../lib/logger.js";
import { normalizeServiceUrl } from "../lib/outbound-url.js";

const router: IRouter = Router();

function getScopedUserId(userId?: string): string {
  return typeof userId === "string" && userId.trim() !== "" ? userId : "demo-user";
}

// Root GET - list available settings endpoints
router.get("/settings", (_req, res) => {
  res.json({
    endpoints: [
      { method: "GET", path: "/api/settings/integrations", description: "List configured integrations" },
      { method: "GET", path: "/api/settings/models", description: "List available AI models" },
      { method: "GET", path: "/api/settings/keys", description: "List BYOK API Keys" },
      { method: "POST", path: "/api/settings/keys", description: "Set BYOK API Key" },
      { method: "DELETE", path: "/api/settings/keys/:provider", description: "Delete BYOK API Key" },
      { method: "GET", path: "/api/settings/ollama", description: "Get Ollama configuration" },
      { method: "PUT", path: "/api/settings/ollama", description: "Update Ollama configuration" },
      { method: "POST", path: "/api/settings/ollama/test", description: "Test Ollama connection" },
    ],
  });
});

export async function getConfigValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.key, key));
  return row?.value ?? null;
}

export async function getEffectiveOllamaUrl(): Promise<{ url: string | null; source: "db" | "env" | null }> {
  const dbVal = await getConfigValue("OLLAMA_URL");
  if (dbVal) return { url: dbVal, source: "db" };
  const envVal = process.env.OLLAMA_URL || null;
  if (envVal) return { url: envVal, source: "env" };
  return { url: null, source: null };
}

export async function getEffectiveOllamaModel(): Promise<string> {
  const dbVal = await getConfigValue("OLLAMA_MODEL");
  return dbVal || process.env.OLLAMA_MODEL || "llama3.2";
}

interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  envVar?: string;
  configured?: boolean;
  active?: boolean;
  category?: string;
  status?: string;
  icon?: string;
}

export interface ActiveLlmPreference {
  provider: string;
  customUrl: string | null;
  model: string | null;
  source: "tenant" | "legacy" | "default";
}

export async function getActiveLlmPreference(userId?: string): Promise<ActiveLlmPreference> {
  const scopedUserId = getScopedUserId(userId);
  const [tenantPreference] = await db
    .select()
    .from(activeLlmSettingsTable)
    .where(eq(activeLlmSettingsTable.userId, scopedUserId))
    .limit(1);

  if (tenantPreference) {
    return {
      provider: tenantPreference.provider || "auto",
      customUrl: tenantPreference.customUrl || null,
      model: tenantPreference.model || null,
      source: "tenant",
    };
  }

  const [legacyProvider, legacyCustomUrl, legacyModel] = await Promise.all([
    getConfigValue("ACTIVE_LLM_PROVIDER"),
    getConfigValue("ACTIVE_LLM_URL"),
    getConfigValue("ACTIVE_LLM_MODEL"),
  ]);

  if (legacyProvider || legacyCustomUrl || legacyModel) {
    return {
      provider: legacyProvider || "auto",
      customUrl: legacyCustomUrl || null,
      model: legacyModel || null,
      source: "legacy",
    };
  }

  return {
    provider: "auto",
    customUrl: null,
    model: null,
    source: "default",
  };
}

router.get("/settings/integrations", async (req, res) => {
  try {
    const userId = getScopedUserId(req.userId);
    const { url: ollamaUrl } = await getEffectiveOllamaUrl();
    const ollamaModel = await getEffectiveOllamaModel();
    const activeLlmPreference = await getActiveLlmPreference(userId);
    const activeLlmUrl = activeLlmPreference.customUrl;
    const activeLlmModel = activeLlmPreference.model;

    // Check DB for BYOK Keys
    const userKeys = await db
      .select({ provider: apiKeysTable.provider })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, userId));
    
    // Convert to easy lookup set
    const hasDbKey = new Set(userKeys.map((k: any) => k.provider));

    const checkStatus = (providerId: string, envKey?: string) => {
      if (hasDbKey.has(providerId)) return "connected";
      if (envKey && process.env[envKey]) return "connected";
      return "disconnected";
    };

    const isConnected = (providerId: string, envKey?: string) => checkStatus(providerId, envKey) === "connected";

    const integrations: IntegrationStatus[] = [
      {
        id: "ollama",
        name: "Ollama",
        status: ollamaUrl ? "connected" : "disconnected",
        description: "IA Local (Privacidade Total)",
        icon: "🦙",
        configured: !!ollamaUrl,
        active: !!ollamaUrl,
        category: "llm",
      },
      {
        id: "google",
        name: "Google Gemini",
        status: checkStatus("google", "GEMINI_API_KEY"),
        description: "Performance e Contexto Longo",
        icon: "♊",
        envVar: "GEMINI_API_KEY",
        configured: isConnected("google", "GEMINI_API_KEY"),
        active: isConnected("google", "GEMINI_API_KEY"),
        category: "llm",
      },
      {
        id: "anthropic",
        name: "Anthropic Claude",
        status: checkStatus("anthropic", "ANTHROPIC_API_KEY"),
        description: "Raciocínio Técnico Superior",
        icon: "🎭",
        envVar: "ANTHROPIC_API_KEY",
        configured: isConnected("anthropic", "ANTHROPIC_API_KEY"),
        active: isConnected("anthropic", "ANTHROPIC_API_KEY"),
        category: "llm",
      },
      {
        id: "ollama_cloud",
        name: "Ollama Cloud",
        status: (isConnected("ollama_cloud", "OLLAMA_CLOUD_API_KEY") || !!activeLlmUrl) ? "connected" : "disconnected",
        description: "Instância gerenciada de Ollama em Nuvem (Hosted Ollama)",
        icon: "☁️",
        configured: isConnected("ollama_cloud", "OLLAMA_CLOUD_API_KEY") || !!activeLlmUrl,
        active: isConnected("ollama_cloud", "OLLAMA_CLOUD_API_KEY") || !!activeLlmUrl,
        category: "llm",
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        status: checkStatus("openrouter", "OPENROUTER_API_KEY"),
        description: "Acesso a LLaMA, Mistral, Qwen e muito mais via OpenRouter",
        icon: "🌌",
        envVar: "OPENROUTER_API_KEY",
        configured: isConnected("openrouter", "OPENROUTER_API_KEY"),
        active: isConnected("openrouter", "OPENROUTER_API_KEY"),
        category: "llm",
      },
      {
        id: "openai",
        name: "OpenAI GPT-4",
        status: checkStatus("openai", "OPENAI_API_KEY"),
        description: "Estabilidade e Multimodalidade",
        icon: "🧠",
        envVar: "OPENAI_API_KEY",
        configured: isConnected("openai", "OPENAI_API_KEY"),
        active: isConnected("openai", "OPENAI_API_KEY"),
        category: "llm",
      },
      {
        id: "tavily",
        name: "Tavily Search",
        description: "Busca em tempo real otimizada para LLMs (RAG).",
        envVar: "TAVILY_API_KEY",
        configured: isConnected("tavily", "TAVILY_API_KEY"),
        active: isConnected("tavily", "TAVILY_API_KEY"),
        category: "tool",
      },
      {
        id: "resend",
        name: "Resend (Email)",
        description: "Envio de emails transacionais para leads.",
        envVar: "RESEND_API_KEY",
        configured: isConnected("resend", "RESEND_API_KEY"),
        active: isConnected("resend", "RESEND_API_KEY"),
        category: "tool",
      },
    ];

    const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    // Read active provider from DB (set via PUT /settings/active-provider)
    const activeProviderDb = activeLlmPreference.provider;
    const activeLlmModelDb = activeLlmPreference.model;

    const PROVIDER_LABELS: Record<string, string> = {
      ollama: `Ollama Local`,
      ollama_cloud: `Ollama Cloud`,
      google: `Google Gemini`,
      anthropic: `Anthropic Claude`,
      openai: `OpenAI GPT`,
      openrouter: `OpenRouter`,
    };

    let activeLLM: string | null = null;
    if (activeProviderDb && activeProviderDb !== "auto") {
      const label = PROVIDER_LABELS[activeProviderDb] || activeProviderDb;
      const modelLabel = activeLlmModelDb || (activeProviderDb === "ollama" ? ollamaModel : null);
      activeLLM = modelLabel ? `${label} · ${modelLabel}` : label;
    } else if (ollamaUrl) {
      activeLLM = `Ollama Local · ${ollamaModel}`;
    } else if (isConnected("google", "GEMINI_API_KEY")) {
      activeLLM = `Google Gemini · ${geminiModel}`;
    } else if (isConnected("anthropic", "ANTHROPIC_API_KEY")) {
      activeLLM = `Anthropic Claude`;
    }

    res.json({
      integrations,
      activeLLM,
      activeProvider: activeProviderDb || "auto",
      activeModel: activeLlmModelDb || null,
      ollamaModel,
      geminiModel,
    });
  } catch (err: any) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId }, "settings_integrations_failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /settings/keys — List custom active keys for user
router.get("/settings/keys", async (req, res) => {
  try {
    const userId = getScopedUserId(req.userId);
    const userKeys = await db
      .select({
        provider: apiKeysTable.provider,
        createdAt: apiKeysTable.createdAt,
        updatedAt: apiKeysTable.updatedAt,
        keyLast4: apiKeysTable.keyLast4,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, userId));
    
    res.json({ keys: userKeys });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId }, "settings_keys_list_failed");
    res.status(500).json({ error: "Failed to list API keys" });
  }
});

// POST /settings/keys — Set a custom BYOK key
router.post("/settings/keys", async (req, res) => {
  try {
    const userId = getScopedUserId(req.userId);
    const { provider, key } = req.body;
    
    if (!provider || !key) {
      res.status(400).json({ error: "Provider and key are required" });
      return;
    }

    const normalizedKey = key.trim();
    const encryptedKey = encrypt(normalizedKey);
    const keyLast4 = normalizedKey.slice(-4) || null;

    const [existing] = await db
      .select({ id: apiKeysTable.id })
      .from(apiKeysTable)
      .where(
        and(
          eq(apiKeysTable.provider, provider),
          eq(apiKeysTable.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      await db.update(apiKeysTable)
        .set({ key: encryptedKey, keyLast4, updatedAt: new Date() })
        .where(eq(apiKeysTable.id, existing.id));
    } else {
      await db.insert(apiKeysTable).values({
        userId,
        provider,
        key: encryptedKey,
        keyLast4,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId, provider: req.body?.provider }, "settings_key_save_failed");
    res.status(500).json({ error: "Failed to set API key" });
  }
});

// DELETE /settings/keys/:provider — Delete a custom BYOK key
router.delete("/settings/keys/:provider", async (req, res) => {
  try {
    const userId = getScopedUserId(req.userId);
    const provider = req.params.provider;

    await db.delete(apiKeysTable)
      .where(
        and(
          eq(apiKeysTable.provider, provider),
          eq(apiKeysTable.userId, userId)
        )
      );
    
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId, provider: req.params.provider }, "settings_key_delete_failed");
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

// ─── Active LLM Provider ─────────────────────────────────────────────────────
// GET /settings/active-provider — returns current active provider config
router.get("/settings/active-provider", async (req, res) => {
  try {
    const preference = await getActiveLlmPreference(req.userId);
    res.json({
      provider: preference.provider,
      customUrl: preference.customUrl,
      model: preference.model,
      source: preference.source,
    });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId }, "settings_active_provider_get_failed");
    res.status(500).json({ error: "Failed to get active provider" });
  }
});

// PUT /settings/active-provider — sets active provider
// body: { provider: "ollama_cloud" | "openrouter" | "google" | "openai" | "anthropic" | "ollama" | "auto", customUrl?: string, model?: string }
router.put("/settings/active-provider", async (req, res) => {
  try {
    const { provider, customUrl, model } = req.body as { provider: string; customUrl?: string; model?: string };
    const userId = getScopedUserId(req.userId);

    if (!provider) {
      res.status(400).json({ error: "provider é obrigatório." }); return;
    }

    const existingPreference = await getActiveLlmPreference(userId);

    const normalizedCustomUrl =
      customUrl === undefined
        ? undefined
        : customUrl
          ? normalizeServiceUrl(customUrl, {
              allowPrivateEnvVar: "ALLOW_PRIVATE_OLLAMA",
              label: "URL do provedor",
            })
          : null;
    const normalizedModel =
      model === undefined ? undefined : model.trim() ? model.trim() : null;
    const nextCustomUrl =
      normalizedCustomUrl === undefined ? existingPreference.customUrl : normalizedCustomUrl;
    const nextModel =
      normalizedModel === undefined ? existingPreference.model : normalizedModel;

    await db
      .insert(activeLlmSettingsTable)
      .values({
        userId,
        provider,
        customUrl: nextCustomUrl,
        model: nextModel,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: activeLlmSettingsTable.userId,
        set: {
          provider,
          customUrl: nextCustomUrl,
          model: nextModel,
          updatedAt: new Date(),
        },
      });

    const savedPreference = await getActiveLlmPreference(userId);
    res.json({
      success: true,
      provider: savedPreference.provider,
      customUrl: savedPreference.customUrl,
      model: savedPreference.model,
      source: savedPreference.source,
    });
  } catch (err: any) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId, provider: req.body?.provider }, "settings_active_provider_save_failed");
    res.status(500).json({ error: "Failed to set active provider", message: err.message });
  }
});

// POST /settings/active-provider/test — Test a specific provider (or current active if none specified)
router.post("/settings/active-provider/test", async (req, res) => {
  try {
    const { provider, customUrl, model } = req.body as { provider?: string; customUrl?: string; model?: string };
    const userId = getScopedUserId(req.userId);
    const normalizedCustomUrl = customUrl
      ? normalizeServiceUrl(customUrl, {
          allowPrivateEnvVar: "ALLOW_PRIVATE_OLLAMA",
          label: "URL do provedor",
        })
      : undefined;
    // Dynamic import to avoid circular deps
    const { callLLM } = await import("../lib/llm-client.js");
    const result = await callLLM(
      "You are a connectivity test assistant. Be concise.",
      "Reply with exactly: 'OK · <your model name>'",
      { provider, model, customUrl: normalizedCustomUrl, userId }
    );
    res.json({
      success: true,
      response: result.output,
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
      executionTimeMs: result.executionTimeMs,
    });
  } catch (err: any) {
    logger.warn({ err, requestId: (req as any).id, userId: req.userId, provider: req.body?.provider }, "settings_active_provider_test_failed");
    res.json({ success: false, error: err.message || "Erro desconhecido" });
  }
});
// GET /settings/channels — List omnichannel channel configurations
router.get("/settings/channels", async (req, res) => {
  try {
    const userId = getScopedUserId(req.userId);
    const channels = await db
      .select()
      .from(channelConfigsTable)
      .where(eq(channelConfigsTable.userId, userId));
    
    res.json({ channels });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId }, "settings_channels_list_failed");
    res.status(500).json({ error: "Failed to list channels" });
  }
});

// POST /settings/channels — Create/Update channel mapping
router.post("/settings/channels", async (req, res) => {
  try {
    const { platform, externalId, agentId, config } = req.body;
    const userId = getScopedUserId(req.userId);

    if (!platform || !externalId || !agentId) {
      res.status(400).json({ error: "platform, externalId and agentId are required" });
      return;
    }

    // Insert or Update logic
    const [existing] = await db
      .select()
      .from(channelConfigsTable)
      .where(
        and(
          eq(channelConfigsTable.platform, platform),
          eq(channelConfigsTable.externalId, externalId),
          eq(channelConfigsTable.userId, userId),
        )
      )
      .limit(1);

    if (existing) {
       const [updated] = await db
         .update(channelConfigsTable)
         .set({ agentId, config: config || {}, updatedAt: new Date() })
         .where(eq(channelConfigsTable.id, existing.id))
         .returning();
       res.json({ success: true, channel: updated });
    } else {
       const [newChan] = await db
         .insert(channelConfigsTable)
         .values({
            platform,
            externalId,
            agentId,
            userId,
            config: config || {},
          })
         .returning();
       res.json({ success: true, channel: newChan });
    }
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId, platform: req.body?.platform }, "settings_channel_save_failed");
    res.status(500).json({ error: "Failed to save channel config" });
  }
});

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

router.get("/settings/models", async (req, res) => {
  try {
    const { url: ollamaUrl } = await getEffectiveOllamaUrl();

    const models: ModelOption[] = [
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Rapido e eficiente. Recomendado para tarefas gerais e respostas ageis." },
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Mais capaz. Melhor para analises complexas e textos longos." },
      { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", description: "Alta performance. Excelente raciocinio e contexto longo." },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "Versao compacta. Otimo custo-beneficio para tarefas simples." },
      { id: "llama-3.1-70b", name: "LLaMA 3.1 70B (Ollama Cloud)", description: "Modelo open-source top de linha (Ollama Cloud / OpenRouter)." },
      { id: "llama-3.1-8b", name: "LLaMA 3.1 8B (Ollama Cloud)", description: "Modelo veloz open-source (Ollama Cloud / OpenRouter)." },
      { id: "qwen-2.5-coder-32b", name: "Qwen 2.5 Coder 32B", description: "Excepcional para código na nuvem corporativa." },
      { id: "glm-5.1:cloud", name: "GLM 5.1 Cloud", description: "Modelo poderoso para compreensão profunda (Ollama Cloud)." },
      { id: "minimax-m2.7:cloud", name: "Minimax M2.7 Cloud", description: "Otimizado para raciocínio em múltiplos cenários (Ollama Cloud)." },
      { id: "kimi-k2.5:cloud", name: "Kimi K2.5 Cloud", description: "Leitor avançado de contexto ultra-longo na nuvem (Ollama Cloud)." },
    ];

    res.json({
      models,
      defaultModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      provider: ollamaUrl ? "ollama" : process.env.GEMINI_API_KEY ? "gemini" : null,
    });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id }, "settings_models_failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/settings/ollama", async (req, res) => {
  try {
    const { url, source } = await getEffectiveOllamaUrl();
    const model = await getEffectiveOllamaModel();
    res.json({ url, source, model });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id }, "settings_ollama_get_failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings/ollama", async (req, res) => {
  try {
    const { url, model } = req.body as { url?: string; model?: string };
    if (url !== undefined && url !== null && url !== "") {
      try {
        const cleanUrl = normalizeServiceUrl(url, {
          allowPrivateEnvVar: "ALLOW_PRIVATE_OLLAMA",
          label: "URL do Ollama",
        });
        await db
          .insert(appConfigTable)
          .values({ key: "OLLAMA_URL", value: cleanUrl, updatedAt: new Date() })
          .onConflictDoUpdate({ target: appConfigTable.key, set: { value: cleanUrl, updatedAt: new Date() } });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : "URL invalida. Use o formato: http://host:porta",
        });
        return;
      }
    } else if (url === "" || url === null) {
      await db.delete(appConfigTable).where(eq(appConfigTable.key, "OLLAMA_URL"));
    }
    if (model !== undefined) {
      const trimmed = model.trim();
      if (trimmed) {
        await db
          .insert(appConfigTable)
          .values({ key: "OLLAMA_MODEL", value: trimmed, updatedAt: new Date() })
          .onConflictDoUpdate({ target: appConfigTable.key, set: { value: trimmed, updatedAt: new Date() } });
      } else {
        await db.delete(appConfigTable).where(eq(appConfigTable.key, "OLLAMA_MODEL"));
      }
    }
    const { url: newUrl, source } = await getEffectiveOllamaUrl();
    const newModel = await getEffectiveOllamaModel();
    res.json({ url: newUrl, source, model: newModel, saved: true });
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId }, "settings_ollama_save_failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settings/ollama/test", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    let testUrl: string;

    if (url) {
      try {
        testUrl = normalizeServiceUrl(url, {
          allowPrivateEnvVar: "ALLOW_PRIVATE_OLLAMA",
          label: "URL do Ollama",
        });
      } catch (error) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : "URL invalida. Use o formato: http://host:porta",
        });
        return;
      }
    } else {
      const { url: effectiveUrl } = await getEffectiveOllamaUrl();
      if (!effectiveUrl) {
        res.json({ success: false, error: "Nenhuma URL do Ollama configurada." });
        return;
      }
      try {
        testUrl = normalizeServiceUrl(effectiveUrl, {
          allowPrivateEnvVar: "ALLOW_PRIVATE_OLLAMA",
          label: "URL do Ollama",
        });
      } catch (error) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : "URL invalida. Use o formato: http://host:porta",
        });
        return;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${testUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        res.json({ success: false, error: `Ollama respondeu com status ${response.status}` });
        return;
      }

      const data = await response.json() as { models?: Array<{ name: string; size: number; modified_at: string }> };
      const models = (data.models || []).map((m: { name: string; size: number; modified_at: string }) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
      }));

      res.json({ success: true, models, url: testUrl });
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      if (errMsg.includes("abort")) {
        res.json({ success: false, error: "Timeout: Ollama nao respondeu em 8 segundos. Verifique se o servico esta rodando e acessivel." });
      } else {
        res.json({ success: false, error: `Erro ao conectar: ${errMsg}` });
      }
    }
  } catch (err) {
    logger.error({ err, requestId: (req as any).id, userId: req.userId }, "settings_ollama_test_failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
