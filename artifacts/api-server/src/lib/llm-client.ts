/**
 * Universal LLM client for Tax Group Hub.
 * Uses Vercel AI SDK for provider-agnostic calls.
 */

import { createHash } from "node:crypto";
import { 
  generateText, 
  generateObject,
  embedMany,
  type LanguageModel,
  type GenerateTextResult,
  type EmbeddingModel
} from "ai";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createAnthropic, anthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { getEffectiveOllamaUrl, getEffectiveOllamaModel, getConfigValue } from "../routes/settings.js";
import { db } from "@workspace/db";
import { embeddingCacheTable, apiKeysTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { availableTools, type ToolId } from "./tools/registry.js";

import { decrypt } from "./crypto.js";

export interface LLMResult {
  output: string;
  tokensUsed: number;
  executionTimeMs: number;
  model: string;
  provider: string;
  toolCalls?: any[];
}

/**
 * Get a specific API key from DB or Env
 */
async function getApiKey(provider: string, userId?: string): Promise<string | null> {
  // Try DB first (BYOK)
  // Scoped to user if userId provided, or global keys where user_id IS NULL
  
  const dbKeys = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.provider, provider));
  
  // Prefer user specific key, then fallback to global (null)
  const userKey = userId ? dbKeys.find(k => k.userId === userId) : null;
  const globalKey = dbKeys.find(k => !k.userId);
  
  const selectedDbKey = userKey || globalKey;
  if (selectedDbKey?.key) {
    return decrypt(selectedDbKey.key);
  }

  // Fallback to Env
  const envMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GEMINI_API_KEY,
    tavily: process.env.TAVILY_API_KEY,
    resend: process.env.RESEND_API_KEY,
  };

  return envMap[provider] || null;
}

/**
 * Returns a configured LanguageModel based on provider and model name.
 * Defaults to Ollama (if available) or Gemini.
 */
export async function getLanguageModel(requestedProvider?: string, requestedModel?: string, userId?: string, requestedCustomUrl?: string): Promise<{ model: LanguageModel; providerName: string; modelId: string }> {
  // Normalize provider names
  let provider = (requestedProvider || "auto").toLowerCase();
  
  // ── Read active provider preference from DB ──────────────────────────────────
  const activeProviderDb = await getConfigValue("ACTIVE_LLM_PROVIDER");
  const activeLlmUrl     = await getConfigValue("ACTIVE_LLM_URL");
  const activeLlmModel   = await getConfigValue("ACTIVE_LLM_MODEL");

  // Only override provider when the caller has not explicitly specified one
  if ((provider === "auto" || !requestedProvider) && activeProviderDb && activeProviderDb !== "auto") {
    provider = activeProviderDb.toLowerCase();
    if (activeLlmModel && !requestedModel) requestedModel = activeLlmModel;
  }

  // 1. OLLAMA CLOUD (custom URL Ollama-compatible endpoint)
  if (provider === "ollama_cloud") {
    const cloudUrl = requestedCustomUrl || activeLlmUrl || process.env.OLLAMA_CLOUD_URL || "";
    if (!cloudUrl) throw new Error("Ollama Cloud URL não configurada. Configure-a nas Integrações.");
    const cloudKey = await getApiKey("ollama_cloud", userId);
    const customOpenAI = createOpenAI({
      baseURL: cloudUrl.endsWith("/v1") ? cloudUrl : `${cloudUrl.replace(/\/+$/, "")}/v1`,
      apiKey: cloudKey || "ollama",
    });
    const modelId = requestedModel || activeLlmModel || "llama3.2";
    return { model: customOpenAI(modelId), providerName: "Ollama Cloud", modelId };
  }

  // 2. OPENROUTER (OpenAI-compatible API with many models)
  if (provider === "openrouter") {
    const openrouterKey = await getApiKey("openrouter", userId);
    if (!openrouterKey) throw new Error("OpenRouter API Key não configurada.");
    const customOpenAI = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openrouterKey,
    });
    const modelId = requestedModel || activeLlmModel || "meta-llama/llama-3.1-70b-instruct";
    return { model: customOpenAI(modelId), providerName: "OpenRouter", modelId };
  }

  // 3. OLLAMA LOCAL
  const { url: ollamaUrl } = await getEffectiveOllamaUrl();
  const ollamaDefaultModel = await getEffectiveOllamaModel();
  
  if ((provider === "ollama" || provider === "auto") && ollamaUrl) {
    const customOpenAI = createOpenAI({
      baseURL: ollamaUrl.endsWith("/v1") ? ollamaUrl : `${ollamaUrl.replace(/\/+$/, "")}/v1`,
      apiKey: "ollama",
    });
    const modelId = requestedModel || ollamaDefaultModel;
    return { 
      model: customOpenAI(modelId), 
      providerName: "Ollama", 
      modelId 
    };
  }

  // 2. ANTHROPIC
  const anthropicKey = await getApiKey("anthropic", userId);
  if ((provider === "anthropic" || provider === "claude") && anthropicKey) {
    const customAnthropic = createAnthropic({ apiKey: anthropicKey });
    const modelId = requestedModel || "claude-3-5-sonnet-20240620";
    return { model: customAnthropic(modelId), providerName: "Anthropic", modelId };
  }

  // 3. OPENAI
  const openaiKey = await getApiKey("openai", userId);
  if ((provider === "openai" || provider === "gpt") && openaiKey) {
    const customOpenAI = createOpenAI({ apiKey: openaiKey });
    const modelId = requestedModel || "gpt-4o";
    return { model: customOpenAI(modelId), providerName: "OpenAI", modelId };
  }

  // 4. GOOGLE / GEMINI
  const googleKey = await getApiKey("google", userId);
  if ((provider === "google" || provider === "gemini" || provider === "auto") && googleKey) {
    const customGoogle = createGoogleGenerativeAI({ apiKey: googleKey });
    const modelId = requestedModel || activeLlmModel || process.env.GEMINI_MODEL || "gemini-1.5-flash";
    return { model: customGoogle(modelId), providerName: "Google", modelId };
  }

  throw new Error(`Nenhum provedor de IA disponível para: "${provider}". Verifique se a chave de API está configurada em Configurações.`);
}

/**
 * Call the LLM using Vercel AI SDK.
 * Supports automated tool calling with maxSteps.
 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string | Array<{ role: string; content: string }>,
  options?: { 
    provider?: string; 
    model?: string; 
    customUrl?: string;
    jsonMode?: boolean;
    toolIds?: string[];
    userId?: string;
  }
): Promise<LLMResult> {
  const startTime = Date.now();

  // â”€â”€ Special handling for Ollama Cloud (native Ollama API, not OpenAI-compatible)
  const provider = (options?.provider || "auto").toLowerCase();
  if (provider === "ollama_cloud") {
    let cloudUrl = (options?.customUrl || process.env.OLLAMA_CLOUD_URL || "").replace(/\/+$/, "");
    const modelId = options?.model || "llama3.2";
    if (!cloudUrl) throw new Error("Ollama Cloud URL nÃ£o configurada.");

    // Normalize: avoid /api duplication if user already entered /api
    const chatEndpoint = cloudUrl.endsWith("/api") ? `${cloudUrl}/chat` : `${cloudUrl}/api/chat`;

    const messages: Array<{ role: string; content: string }> = Array.isArray(userMessage)
      ? [{ role: "system", content: systemPrompt }, ...userMessage]
      : [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }];

    const ollamaKey = await getApiKey("ollama_cloud", options?.userId);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ollamaKey) headers["Authorization"] = `Bearer ${ollamaKey}`;

    const response = await fetch(chatEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: modelId, messages, stream: false }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Cloud erro ${response.status}: ${errText}`);
    }

    const data = await response.json() as { message?: { content?: string }; response?: string };
    const output = data.message?.content || data.response || "";
    const executionTimeMs = Date.now() - startTime;

    return {
      output,
      tokensUsed: 0,
      executionTimeMs,
      model: modelId,
      provider: "Ollama Cloud",
      toolCalls: undefined,
    };
  }

  const { model, providerName, modelId } = await getLanguageModel(options?.provider, options?.model, options?.userId, options?.customUrl);

  // Prepare tools if requested
  const tools: Record<string, any> = {};
  if (options?.toolIds) {
    for (const id of options.toolIds) {
      if (availableTools[id as keyof typeof availableTools]) {
        tools[id] = availableTools[id as keyof typeof availableTools];
      }
    }
  }

  const isArrayPayload = Array.isArray(userMessage);

  const payload: any = {
    model,
    system: systemPrompt,
    maxTokens: 4096,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: Object.keys(tools).length > 0 ? 5 : 1, // Enable multi-step tools
  };

  if (isArrayPayload) {
    payload.messages = userMessage;
  } else {
    payload.prompt = userMessage;
  }

  const result = await generateText(payload);

  const executionTimeMs = Date.now() - startTime;
  const rawUsage = result.usage as any;
  const tokensUsed = (rawUsage?.promptTokens || 0) + (rawUsage?.completionTokens || 0);

  console.log(`[LLM] ${providerName} (${modelId}) | Tokens: ${tokensUsed} | Steps: ${result.steps?.length || 1} | Duration: ${executionTimeMs}ms`);

  return {
    output: result.text,
    tokensUsed,
    executionTimeMs,
    model: modelId,
    provider: providerName,
    toolCalls: result.toolCalls,
  };
}

/**
 * Generate embeddings for a given array of texts.
 * Uses a DB cache (MD5 hash) to avoid redundant API calls.
 */
export async function generateEmbeddings(texts: string[], userId?: string): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Use Google as default for embeddings if available, else Ollama
  const googleKey = await getApiKey("google", userId);
  const ollamaUrl = (await getEffectiveOllamaUrl()).url;

  let embeddingModel: any;

  if (googleKey) {
    const googleProvider = createGoogleGenerativeAI({ apiKey: googleKey });
    embeddingModel = googleProvider.textEmbeddingModel("text-embedding-004");
  } else if (ollamaUrl) {
    const ollamaProvider = createOpenAI({
      baseURL: ollamaUrl.endsWith("/v1") ? ollamaUrl : `${ollamaUrl.replace(/\/+$/, "")}/v1`,
      apiKey: "ollama",
    });
    const modelId = await getEffectiveOllamaModel() || "nomic-embed-text";
    embeddingModel = ollamaProvider.textEmbeddingModel(modelId);
  } else {
    throw new Error("Nenhum provedor configurado para embeddings.");
  }

  // 1. Compute MD5 hash for each text
  const hashes = texts.map((t) => createHash("md5").update(t).digest("hex"));

  // 2. Look up all hashes in the cache
  let cachedRows: { textHash: string; embedding: number[] | null }[] = [];
  try {
    cachedRows = await db
      .select({ textHash: embeddingCacheTable.textHash, embedding: embeddingCacheTable.embedding })
      .from(embeddingCacheTable)
      .where(inArray(embeddingCacheTable.textHash, hashes));
  } catch (e) {
    console.warn("[Embedding Cache] DB error:", e);
  }

  const cacheMap = new Map(cachedRows.map((r) => [r.textHash, r.embedding]));
  const missingIndices: number[] = [];
  const missingTexts: string[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    if (!cacheMap.has(hashes[i])) {
      missingIndices.push(i);
      missingTexts.push(texts[i]);
    }
  }

  const newEmbeddings: number[][] = [];
  if (missingTexts.length > 0) {
    console.log(`[Embedding Cache] MISS - calling API for ${missingTexts.length}/${texts.length} texts`);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: missingTexts,
    });
    
    for (const emb of embeddings) {
      newEmbeddings.push(Array.from(emb));
    }

    // Persist new embeddings to cache (fire-and-forget)
    Promise.all(
      missingIndices.map((origIdx, i) =>
        db
          .insert(embeddingCacheTable)
          .values({ 
            textHash: hashes[origIdx], 
            embedding: newEmbeddings[i] 
          })
          .onConflictDoNothing()
          .catch((e: Error) => console.warn("[Embedding Cache] Save failed:", e.message)),
      )
    ).catch(() => {});
  }

  // Assemble final result in original order
  const result: number[][] = [];
  let newIdx = 0;
  for (let i = 0; i < texts.length; i++) {
    const cached = cacheMap.get(hashes[i]);
    if (cached) {
      result.push(cached);
    } else {
      result.push(newEmbeddings[newIdx++]);
    }
  }

  return result;
}

/**
 * Transcribe audio buffer to text using OpenAI Whisper.
 */
export async function transcribeAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
  const apiKey = await getApiKey("openai");
  if (!apiKey) {
    throw new Error("OpenAI API Key não configurada para transcrição de áudio.");
  }

  const customOpenAI = createOpenAI({ apiKey });
  
  // Vercel AI SDK doesn't have a direct transcribe tool, so we use the openai package if available or fetch
  // Since we have @ai-sdk/openai, we can try to use the raw client if we find it, or just use fetch.
  // I'll use fetch to be safe and avoid adding new dependencies if possible.
  
  const formData = new FormData();
  const blob = new Blob([audioBuffer as any], { type: "audio/mpeg" });
  formData.append("file", blob, fileName);
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = (await response.json()) as any;
    throw new Error(`Erro na transcrição: ${error.error?.message || response.statusText}`);
  }

  const result = (await response.json()) as any;
  return result.text;
}
