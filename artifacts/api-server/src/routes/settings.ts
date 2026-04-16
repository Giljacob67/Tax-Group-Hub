import { Router, type IRouter } from "express";
import { db, appConfigTable, channelConfigsTable, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/crypto.js";

const router: IRouter = Router();

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

import { isRealUser } from "../middlewares/auth.js";

router.get("/settings/integrations", async (req, res) => {
  try {
    const userId = req.userId;
    const { url: ollamaUrl } = await getEffectiveOllamaUrl();
    const ollamaModel = await getEffectiveOllamaModel();

    // Check DB for BYOK Keys
    const userKeys = await db
      .select({ provider: apiKeysTable.provider })
      .from(apiKeysTable)
      .where(isRealUser(userId) ? eq(apiKeysTable.userId, userId) : undefined);
    
    // Convert to easy lookup set
    const hasDbKey = new Set(userKeys.map(k => k.provider));

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
      },
      {
        id: "google",
        name: "Google Gemini",
        status: checkStatus("google", "GEMINI_API_KEY"),
        description: "Performance e Contexto Longo",
        icon: "♊",
      },
      {
        id: "anthropic",
        name: "Anthropic Claude",
        status: checkStatus("anthropic", "ANTHROPIC_API_KEY"),
        description: "Raciocínio Técnico Superior",
        icon: "🎭",
      },
      {
        id: "openai",
        name: "OpenAI GPT-4",
        status: checkStatus("openai", "OPENAI_API_KEY"),
        description: "Estabilidade e Multimodalidade",
        icon: "🧠",
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

    let activeLLM: string | null = null;
    if (ollamaUrl) {
      activeLLM = `Ollama (${ollamaModel})`;
    } else if (isConnected("google", "GEMINI_API_KEY")) {
      activeLLM = `Gemini (${geminiModel})`;
    } else if (isConnected("anthropic", "ANTHROPIC_API_KEY")) {
      activeLLM = `Anthropic (Claude 3.5)`;
    }

    res.json({
      integrations,
      activeLLM,
      ollamaModel,
      geminiModel,
    });
  } catch (err) {
    console.error("Error fetching integrations:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /settings/keys — List custom active keys for user
router.get("/settings/keys", async (req, res) => {
  try {
    const userId = req.userId;
    const userKeys = await db
      .select({ provider: apiKeysTable.provider, createdAt: apiKeysTable.createdAt })
      .from(apiKeysTable)
      .where(isRealUser(userId) ? eq(apiKeysTable.userId, userId) : undefined);
    
    res.json({ keys: userKeys });
  } catch (err) {
    res.status(500).json({ error: "Failed to list API keys" });
  }
});

// POST /settings/keys — Set a custom BYOK key
router.post("/settings/keys", async (req, res) => {
  try {
    const userId = req.userId;
    const { provider, key } = req.body;
    
    if (!provider || !key) {
      res.status(400).json({ error: "Provider and key are required" });
      return;
    }

    const encryptedKey = encrypt(key.trim());

    const [existing] = await db
      .select({ id: apiKeysTable.id })
      .from(apiKeysTable)
      .where(
        and(
          eq(apiKeysTable.provider, provider),
          isRealUser(userId) ? eq(apiKeysTable.userId, userId) : undefined
        )
      )
      .limit(1);

    if (existing) {
      await db.update(apiKeysTable)
        .set({ key: encryptedKey, updatedAt: new Date() })
        .where(eq(apiKeysTable.id, existing.id));
    } else {
      await db.insert(apiKeysTable).values({
        userId: isRealUser(userId) ? userId : null,
        provider,
        key: encryptedKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to set API key:", err);
    res.status(500).json({ error: "Failed to set API key" });
  }
});

// DELETE /settings/keys/:provider — Delete a custom BYOK key
router.delete("/settings/keys/:provider", async (req, res) => {
  try {
    const userId = req.userId;
    const provider = req.params.provider;

    await db.delete(apiKeysTable)
      .where(
        and(
          eq(apiKeysTable.provider, provider),
          isRealUser(userId) ? eq(apiKeysTable.userId, userId) : undefined
        )
      );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

// GET /settings/channels — List omnichannel channel configurations
router.get("/settings/channels", async (req, res) => {
  try {
    const userId = req.userId;
    const channels = await db
      .select()
      .from(channelConfigsTable)
      .where(isRealUser(userId) ? eq(channelConfigsTable.userId, userId) : undefined);
    
    res.json({ channels });
  } catch (err) {
    console.error("Error listing channels:", err);
    res.status(500).json({ error: "Failed to list channels" });
  }
});

// POST /settings/channels — Create/Update channel mapping
router.post("/settings/channels", async (req, res) => {
  try {
    const { platform, externalId, agentId, config } = req.body;
    const userId = req.userId;

    if (!platform || !externalId || !agentId) {
      res.status(400).json({ error: "platform, externalId and agentId are required" });
      return;
    }

    // Insert or Update logic
    const [existing] = await db
      .select()
      .from(channelConfigsTable)
      .where(and(eq(channelConfigsTable.platform, platform), eq(channelConfigsTable.externalId, externalId)))
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
           userId: userId || null,
           config: config || {},
         })
         .returning();
       res.json({ success: true, channel: newChan });
    }
  } catch (err) {
    console.error("Error saving channel config:", err);
    res.status(500).json({ error: "Failed to save channel config" });
  }
});

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

router.get("/settings/models", async (_req, res) => {
  try {
    const { url: ollamaUrl } = await getEffectiveOllamaUrl();

    const models: ModelOption[] = [
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Rapido e eficiente. Recomendado para tarefas gerais e respostas ageis." },
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Mais capaz. Melhor para analises complexas e textos longos." },
      { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", description: "Alta performance. Excelente raciocinio e contexto longo." },
      { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash", description: "Velocidade e qualidade equilibradas. Ultima geracao Flash." },
      { id: "gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Geracao anterior Flash. Estavel e confiavel." },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "Versao compacta. Otimo custo-beneficio para tarefas simples." },
    ];

    res.json({
      models,
      defaultModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      provider: ollamaUrl ? "ollama" : process.env.GEMINI_API_KEY ? "gemini" : null,
    });
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/settings/ollama", async (_req, res) => {
  try {
    const { url, source } = await getEffectiveOllamaUrl();
    const model = await getEffectiveOllamaModel();
    res.json({ url, source, model });
  } catch (err) {
    console.error("Error fetching ollama settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings/ollama", async (req, res) => {
  try {
    const { url, model } = req.body as { url?: string; model?: string };
    if (url !== undefined && url !== null && url !== "") {
      try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          throw new Error("Protocolo invalido");
        }
        
        const host = u.hostname.toLowerCase();
        const isPrivate = 
          host === "localhost" || 
          host === "127.0.0.1" || 
          host === "::1" || 
          host.startsWith("192.168.") || 
          host.startsWith("10.") || 
          host.startsWith("172.16.") || 
          host.startsWith("172.17.") || 
          host.startsWith("172.18.") || 
          host.startsWith("172.19.") || 
          host.startsWith("172.20.") || 
          host.startsWith("172.21.") || 
          host.startsWith("172.22.") || 
          host.startsWith("172.23.") || 
          host.startsWith("172.24.") || 
          host.startsWith("172.25.") || 
          host.startsWith("172.26.") || 
          host.startsWith("172.27.") || 
          host.startsWith("172.28.") || 
          host.startsWith("172.29.") || 
          host.startsWith("172.30.") || 
          host.startsWith("172.31.");

        if (isPrivate && process.env.ALLOW_PRIVATE_OLLAMA !== "true") {
          res.status(400).json({ error: "Seguranca: URLs de rede privada/local nao sao permitidas por padrao." });
          return;
        }
      } catch {
        res.status(400).json({ error: "URL invalida. Use o formato: http://host:porta" });
        return;
      }
      const cleanUrl = url.replace(/\/+$/, "");
      await db
        .insert(appConfigTable)
        .values({ key: "OLLAMA_URL", value: cleanUrl, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appConfigTable.key, set: { value: cleanUrl, updatedAt: new Date() } });
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
    console.error("Error saving ollama settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settings/ollama/test", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    let testUrl: string;

    if (url) {
      try {
        new URL(url);
      } catch {
        res.json({ success: false, error: "URL invalida. Use o formato: http://host:porta" });
        return;
      }
      testUrl = url.replace(/\/+$/, "");
    } else {
      const { url: effectiveUrl } = await getEffectiveOllamaUrl();
      if (!effectiveUrl) {
        res.json({ success: false, error: "Nenhuma URL do Ollama configurada." });
        return;
      }
      testUrl = effectiveUrl;
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
    console.error("Error testing ollama connection:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
