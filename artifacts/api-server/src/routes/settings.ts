import { Router, type IRouter } from "express";
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

export async function getConfigValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.key, key));
  return row?.value ?? null;
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
    const openrouterModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
    const hasOpenRouter = !!(process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || process.env.OPENROUTER_API_KEY);

    const integrations: IntegrationStatus[] = [
      {
        id: "openrouter",
        name: "Gemini via OpenRouter",
        description: "Acesso ao Gemini 2.5 e outros modelos de IA na nuvem via OpenRouter. Provedor principal para chat com os agentes.",
        envVar: "OPENROUTER_API_KEY",
        configured: hasOpenRouter,
        active: hasOpenRouter,
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

    let activeLLM: string | null = null;
    if (hasOpenRouter) {
      const modelName = openrouterModel.split("/").pop() || openrouterModel;
      activeLLM = `Gemini via OpenRouter (${modelName})`;
    }

    res.json({
      integrations,
      activeLLM,
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
    const models: ModelOption[] = [
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Ultima geracao Google. Rapido, inteligente e eficiente. Recomendado." },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Modelo mais capaz do Google. Melhor para analises complexas e raciocinio avancado." },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Geracao anterior. Velocidade e qualidade equilibradas." },
      { id: "google/gemini-flash-1.5", name: "Gemini Flash 1.5", description: "Modelo estavel e eficiente. Bom para tarefas gerais." },
      { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", description: "Melhor para textos longos e analises detalhadas." },
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", description: "Rapido e economico. Otimo para tarefas simples e diretas." },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Alto desempenho. Excelente para redacao e analise detalhada." },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", description: "Compacto e agil. Bom custo-beneficio para uso geral." },
      { id: "openai/gpt-4o", name: "GPT-4o", description: "Modelo premium OpenAI. Maximo desempenho em todas as tarefas." },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", description: "Open source Meta. Forte em raciocinio e codigo." },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3", description: "Open source. Excelente em raciocinio e tarefas tecnicas." },
      { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", description: "Open source Alibaba. Forte em multilingual e codigo." },
    ];

    res.json({
      models,
      defaultModel: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      provider: (process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || process.env.OPENROUTER_API_KEY) ? "openrouter" : null,
    });
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
