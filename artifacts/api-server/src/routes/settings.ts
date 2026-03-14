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
        id: "openrouter",
        name: "OpenRouter",
        description: "Acesso a diversos modelos de IA na nuvem (Gemini, GPT, Claude, etc). Usado para chat com os agentes.",
        envVar: "OPENROUTER_API_KEY",
        configured: !!process.env.OPENROUTER_API_KEY,
        active: !!process.env.OPENROUTER_API_KEY,
        category: "llm",
      },
      {
        id: "gemini",
        name: "Google AI (Gemini)",
        description: "Plataforma Google AI unificada. Geracao de imagens (Gemini 2.0 Flash) no Design Studio e busca semantica (Text Embeddings 004) na base de conhecimento. Uma unica chave para ambas as funcionalidades.",
        envVar: "GEMINI_API_KEY",
        configured: !!process.env.GEMINI_API_KEY,
        active: !!process.env.GEMINI_API_KEY,
        category: "google",
      },
    ];

    const openrouterModel = process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5";

    let activeLLM: string | null = null;
    if (ollamaUrl) {
      activeLLM = `Ollama (${ollamaModel})`;
    } else if (process.env.OPENROUTER_API_KEY) {
      activeLLM = `OpenRouter (${openrouterModel})`;
    }

    res.json({
      integrations,
      activeLLM,
      ollamaModel,
      openrouterModel,
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
      { id: "google/gemini-flash-1.5", name: "Gemini Flash 1.5", description: "Rapido e eficiente. Bom para tarefas gerais e respostas ageis." },
      { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", description: "Mais capaz. Melhor para analises complexas e textos longos." },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Ultima geracao. Velocidade e qualidade equilibradas." },
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", description: "Rapido e economico. Otimo para tarefas simples e diretas." },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Alto desempenho. Excelente para redacao e analise detalhada." },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", description: "Compacto e agil. Bom custo-beneficio para uso geral." },
      { id: "openai/gpt-4o", name: "GPT-4o", description: "Modelo premium OpenAI. Maximo desempenho em todas as tarefas." },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", description: "Open source Meta. Forte em raciocinio e codigo." },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3", description: "Open source. Excelente em raciocinio e tarefas tecnicas." },
      { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", description: "Open source Alibaba. Forte em multilingual e codigo." },
      { id: "openrouter/hunter-alpha", name: "Hunter Alpha", description: "Modelo OpenRouter otimizado. Versatil e de alta qualidade." },
    ];

    res.json({
      models,
      defaultModel: process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5",
      provider: ollamaUrl ? "ollama" : process.env.OPENROUTER_API_KEY ? "openrouter" : null,
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
    const { url } = req.body as { url?: string };
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
    } else {
      await db.delete(appConfigTable).where(eq(appConfigTable.key, "OLLAMA_URL"));
    }
    const { url: newUrl, source } = await getEffectiveOllamaUrl();
    res.json({ url: newUrl, source, saved: true });
  } catch (err) {
    console.error("Error saving ollama URL:", err);
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
