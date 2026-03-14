import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  envVar: string;
  configured: boolean;
  active: boolean;
  category: string;
}

router.get("/settings/integrations", (_req, res) => {
  const integrations: IntegrationStatus[] = [
    {
      id: "ollama",
      name: "Ollama (LLM Local)",
      description: "Modelos de IA rodando localmente via Ollama. Requer endpoint acessivel externamente (ngrok, cloudflared, etc).",
      envVar: "OLLAMA_URL",
      configured: !!process.env.OLLAMA_URL,
      active: !!process.env.OLLAMA_URL,
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

  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
  const openrouterModel = process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5";

  let activeLLM: string | null = null;
  if (process.env.OLLAMA_URL) {
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
});

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

router.get("/settings/models", (_req, res) => {
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
    provider: process.env.OLLAMA_URL ? "ollama" : process.env.OPENROUTER_API_KEY ? "openrouter" : null,
  });
});

export default router;
