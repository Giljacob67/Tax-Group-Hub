import { Router, type IRouter } from "express";
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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
  envVar: string;
  configured: boolean;
  active: boolean;
  category: string;
}

router.get("/settings/integrations", async (_req, res) => {
  try {
    const { url: ollamaUrl } = await getEffectiveOllamaUrl();
    const ollamaModel = await getEffectiveOllamaModel();

    const integrations: IntegrationStatus[] = [
      {
        id: "ollama",
        name: "Ollama (LLM Local)",
        description: "Modelos de IA rodando localmente via Ollama. Requer endpoint acessivel externamente (ngrok, cloudflared, etc).",
        envVar: "OLLAMA_URL",
        configured: !!ollamaUrl,
        active: !!ollamaUrl,
        category: "llm",
      },
      {
        id: "gemini",
        name: "Google AI (Gemini)",
        description: "Plataforma Google AI unificada. Chat com agentes (gemini-3-flash-preview), geracao de imagens (gemini-3-pro-image-preview) no Design Studio e busca semantica (Text Embeddings 004) na base de conhecimento.",
        envVar: "GEMINI_API_KEY",
        configured: !!process.env.GEMINI_API_KEY,
        active: !!process.env.GEMINI_API_KEY,
        category: "llm",
      },
    ];

    const geminiModel = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

    let activeLLM: string | null = null;
    if (ollamaUrl) {
      activeLLM = `Ollama (${ollamaModel})`;
    } else if (process.env.GEMINI_API_KEY) {
      activeLLM = `Gemini (${geminiModel})`;
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
        new URL(url);
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
