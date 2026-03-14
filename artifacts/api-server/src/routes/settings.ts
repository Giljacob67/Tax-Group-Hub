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

export default router;
