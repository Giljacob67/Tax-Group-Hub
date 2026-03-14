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
      name: "Gemini API",
      description: "Geracao de imagens com IA usando Google Gemini. Usado no Design Studio dos agentes de marketing.",
      envVar: "GEMINI_API_KEY",
      configured: !!process.env.GEMINI_API_KEY,
      active: !!process.env.GEMINI_API_KEY,
      category: "media",
    },
    {
      id: "google-embeddings",
      name: "Google Embeddings",
      description: "Busca semantica na base de conhecimento usando Google Text Embeddings.",
      envVar: "GOOGLE_API_KEY",
      configured: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
      active: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
      category: "search",
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
