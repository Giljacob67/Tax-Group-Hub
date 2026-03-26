/**
 * Shared LLM client for Tax Group Hub.
 *
 * Consolidates getLLMConfig() and callLLM() into a single module
 * used by conversations.ts, orchestrate.ts, and automate.ts.
 */

import OpenAI from "openai";
import { getEffectiveOllamaUrl, getEffectiveOllamaModel } from "../routes/settings.js";

export interface LLMConfig {
  client: OpenAI;
  model: string;
  provider: string;
}

export interface LLMResult {
  output: string;
  tokensUsed: number;
  executionTimeMs: number;
}

/**
 * Get an OpenAI-compatible client configured for the active LLM provider.
 * Priority: Ollama > Gemini > null
 */
export async function getLLMConfig(): Promise<LLMConfig | null> {
  const { url: ollamaUrl } = await getEffectiveOllamaUrl();
  const ollamaModel = await getEffectiveOllamaModel();

  if (ollamaUrl) {
    const baseURL = ollamaUrl.endsWith("/v1") ? ollamaUrl : `${ollamaUrl.replace(/\/+$/, "")}/v1`;
    return {
      client: new OpenAI({
        baseURL,
        apiKey: "ollama",
        defaultHeaders: { "ngrok-skip-browser-warning": "true" },
      }),
      model: ollamaModel,
      provider: "Ollama",
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      client: new OpenAI({
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey: geminiKey,
      }),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-04-17",
      provider: "Gemini",
    };
  }

  return null;
}

/**
 * Call the LLM with a system prompt and user message.
 * Returns output, token count, and execution time.
 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  _context?: Record<string, unknown>,
): Promise<LLMResult> {
  const startTime = Date.now();
  const config = await getLLMConfig();

  if (!config) {
    throw new Error("No LLM configured. Set GEMINI_API_KEY or OLLAMA_URL.");
  }

  const completion = await config.client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 4096,
  });

  const output = completion.choices?.[0]?.message?.content || "";
  const tokensUsed = completion.usage?.total_tokens || 0;

  return {
    output,
    tokensUsed,
    executionTimeMs: Date.now() - startTime,
  };
}
