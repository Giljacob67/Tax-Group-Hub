/**
 * Universal LLM client for Tax Group Hub.
 * Uses Vercel AI SDK for provider-agnostic calls.
 */

import { createHash } from "node:crypto";
import { 
  generateText, 
  embedMany,
  type LanguageModel,
  type EmbeddingModel
} from "ai";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createAnthropic, anthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { getEffectiveOllamaUrl, getEffectiveOllamaModel, getConfigValue } from "../routes/settings.js";
import { db } from "@workspace/db";
import { embeddingCacheTable, apiKeysTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { availableTools, type ToolId } from "./tools/registry.js";

import { decrypt } from "./crypto.js";

export interface LLMResult {
  output: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  executionTimeMs: number;
  model: string;
  provider: string;
  toolCalls?: unknown[];
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
    perplexity: process.env.PERPLEXITY_API_KEY,
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

  // OPENROUTER (OpenAI-compatible API with many models)
  if (provider === "openrouter") {
    const openrouterKey = await getApiKey("openrouter", userId);
    if (!openrouterKey) throw new Error("OpenRouter API Key não configurada.");
    const customOpenAI = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openrouterKey,
    });
    const modelId = requestedModel || activeLlmModel || "meta-llama/llama-3.3-70b-instruct";
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
    const modelId = requestedModel || "claude-sonnet-4-5-20250929";
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
    const modelId = requestedModel || activeLlmModel || process.env.GEMINI_MODEL || "gemini-2.5-flash";
    return { model: customGoogle(modelId), providerName: "Google", modelId };
  }

  // 5. CUSTOM OPENAI-COMPATIBLE (e.g. self-hosted, third-party APIs)
  if (provider === "custom_openai" && requestedCustomUrl) {
    const cleanUrl = requestedCustomUrl.replace(/\/+$/, "");
    const customOpenAI = createOpenAI({
      baseURL: cleanUrl.endsWith("/v1") ? cleanUrl : `${cleanUrl}/v1`,
      apiKey: (await getApiKey("custom_openai", userId)) || "custom",
    });
    const modelId = requestedModel || "custom-model";
    return { model: customOpenAI(modelId), providerName: "Custom", modelId };
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

  // Ollama Cloud uses the native /api/chat endpoint (not OpenAI-compatible).
  // callLLM handles it here before delegating to getLanguageModel for all other providers.
  const provider = (options?.provider || "auto").toLowerCase();
  if (provider === "ollama_cloud") {
    const activeLlmUrl = await getConfigValue("ACTIVE_LLM_URL");
    const cloudUrl = (options?.customUrl || activeLlmUrl || process.env.OLLAMA_CLOUD_URL || "").replace(/\/+$/, "");
    if (!cloudUrl) throw new Error("Ollama Cloud URL não configurada.");

    const modelId = options?.model || "llama3.2";
    // Normalize: avoid /api duplication if caller already included it
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

    return { output, tokensUsed: 0, promptTokens: 0, completionTokens: 0, executionTimeMs: Date.now() - startTime, model: modelId, provider: "Ollama Cloud" };
  }

  const { model, providerName, modelId } = await getLanguageModel(options?.provider, options?.model, options?.userId, options?.customUrl);

  // Prepare tools if requested
  const tools: Record<string, unknown> = {};
  if (options?.toolIds) {
    for (const id of options.toolIds) {
      if (availableTools[id as keyof typeof availableTools]) {
        tools[id] = availableTools[id as keyof typeof availableTools];
      }
    }
  }

  const isArrayPayload = Array.isArray(userMessage);
  const hasTools = Object.keys(tools).length > 0;

  const result = isArrayPayload
    ? await generateText({
        model,
        system: systemPrompt,
        maxOutputTokens: 4096,
        tools: hasTools ? (tools as Parameters<typeof generateText>[0]["tools"]) : undefined,
        messages: userMessage as NonNullable<Parameters<typeof generateText>[0]["messages"]>
      })
    : await generateText({
        model,
        system: systemPrompt,
        maxOutputTokens: 4096,
        tools: hasTools ? (tools as Parameters<typeof generateText>[0]["tools"]) : undefined,
        prompt: userMessage as string,
      });

  const executionTimeMs = Date.now() - startTime;
  const promptTokens = result.usage?.inputTokens ?? 0;
  const completionTokens = result.usage?.outputTokens ?? 0;
  const tokensUsed = promptTokens + completionTokens;

  console.info(`[LLM] ${providerName} (${modelId}) | tokens=${tokensUsed} steps=${result.steps?.length ?? 1} ms=${executionTimeMs}`);

  return {
    output: result.text,
    tokensUsed,
    promptTokens,
    completionTokens,
    executionTimeMs,
    model: modelId,
    provider: providerName,
    toolCalls: result.toolCalls,
  };
}

/**
 * Canonical embedding models per provider. Adding a new model here is the
 * only place to teach the cache and the chunk store that a vector of
 * `dimensions` floats came from `key`.
 */
export const EMBEDDING_MODELS = {
  // Google AI Studio / Vertex AI — Gemini Embedding
  "google/text-embedding-004": { provider: "google" as const, dimensions: 768, modelId: "text-embedding-004" },
  "google/gemini-embedding-001": { provider: "google" as const, dimensions: 768, modelId: "gemini-embedding-001" },
  // OpenAI
  "openai/text-embedding-3-small": { provider: "openai" as const, dimensions: 1536, modelId: "text-embedding-3-small" },
  "openai/text-embedding-3-small-768": { provider: "openai" as const, dimensions: 768, modelId: "text-embedding-3-small" },
  "openai/text-embedding-3-large": { provider: "openai" as const, dimensions: 3072, modelId: "text-embedding-3-large" },
  "openai/text-embedding-ada-002": { provider: "openai" as const, dimensions: 1536, modelId: "text-embedding-ada-002" },
  // Ollama (hosted or cloud)
  "ollama/nomic-embed-text": { provider: "ollama" as const, dimensions: 768, modelId: "nomic-embed-text" },
  "ollama/mxbai-embed-large": { provider: "ollama" as const, dimensions: 1024, modelId: "mxbai-embed-large" },
  "ollama/all-minilm": { provider: "ollama" as const, dimensions: 384, modelId: "all-minilm" },
} as const;

export type EmbeddingModelKey = keyof typeof EMBEDDING_MODELS;
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModelKey = "google/text-embedding-004";

export class EmbeddingDimError extends Error {
  constructor(public readonly expected: number, public readonly got: number) {
    super(`Embedding dimension mismatch: provider expects ${expected} dims, got ${got}.`);
    this.name = "EmbeddingDimError";
  }
}

/**
 * Lightweight structural check on a vector. We do not do a full numeric
 * comparison — that would defeat caching — but we DO require the length to
 * match the model the caller asked for.
 */
export function validateEmbeddingDim(vec: number[], model: EmbeddingModelKey): number[] {
  const expected = EMBEDDING_MODELS[model].dimensions;
  if (!Array.isArray(vec) || vec.length !== expected) {
    throw new EmbeddingDimError(expected, vec?.length ?? 0);
  }
  return vec;
}

/**
 * Generate embeddings for a given array of texts.
 * Uses a DB cache (keyed by MD5(text) + model) to avoid redundant API calls.
 *
 * Default model is Google text-embedding-004 (768 dims) for backwards
 * compatibility. Callers that need a different provider/dim must pass
 * `opts.model`.
 */
export async function generateEmbeddings(
  texts: string[],
  userId?: string,
  opts: { model?: EmbeddingModelKey } = {},
): Promise<{ embeddings: number[][]; model: EmbeddingModelKey; dim: number }> {
  if (texts.length === 0) {
    return { embeddings: [], model: opts.model ?? DEFAULT_EMBEDDING_MODEL, dim: 0 };
  }

  const modelKey: EmbeddingModelKey = opts.model ?? DEFAULT_EMBEDDING_MODEL;
  const spec = EMBEDDING_MODELS[modelKey];

  // Resolve the SDK model for the requested provider.
  let sdkModel: EmbeddingModel;
  if (spec.provider === "google") {
    const key = await getApiKey("google", userId);
    if (!key) throw new Error("Google API key ausente para gerar embeddings.");
    sdkModel = createGoogleGenerativeAI({ apiKey: key }).embeddingModel(spec.modelId);
  } else if (spec.provider === "openai") {
    const key = await getApiKey("openai", userId);
    if (!key) throw new Error("OpenAI API key ausente para gerar embeddings.");
    sdkModel = createOpenAI({ apiKey: key }).embeddingModel(spec.modelId);
  } else {
    // ollama
    const ollamaUrl = (await getEffectiveOllamaUrl()).url;
    if (!ollamaUrl) throw new Error("Ollama URL ausente para gerar embeddings.");
    sdkModel = createOpenAI({
      baseURL: ollamaUrl.endsWith("/v1") ? ollamaUrl : `${ollamaUrl.replace(/\/+$/, "")}/v1`,
      apiKey: "ollama",
    }).embeddingModel(spec.modelId);
  }

  // 1. Hash the texts.
  const hashes = texts.map((t) => createHash("md5").update(t).digest("hex"));

  // 2. Cache lookup: only rows whose model matches the one we're generating.
  let cachedRows: { textHash: string; embedding: number[] | null; dim: number | null }[] = [];
  try {
    cachedRows = await db
      .select({
        textHash: embeddingCacheTable.textHash,
        embedding: embeddingCacheTable.embedding,
        dim: embeddingCacheTable.dim,
      })
      .from(embeddingCacheTable)
      .where(and(eq(embeddingCacheTable.model, modelKey), inArray(embeddingCacheTable.textHash, hashes)));
  } catch (e) {
    console.warn("[Embedding Cache] DB error:", e);
  }

  // Validate dim on every cached vector before we trust it. If a cached
  // vector has the wrong dim, drop it and regenerate — better than serving
  // a poisoned embedding to the search.
  const cacheMap = new Map<string, number[]>();
  for (const r of cachedRows) {
    if (!r.embedding) continue;
    if (r.dim !== spec.dimensions) {
      console.warn(`[Embedding Cache] dropping cache row with dim=${r.dim} (expected ${spec.dimensions})`);
      continue;
    }
    cacheMap.set(r.textHash, r.embedding);
  }

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
    console.log(`[Embedding Cache] MISS model=${modelKey} (${missingTexts.length}/${texts.length} texts)`);
    // Build providerOptions without undefined fields (the AI SDK types them as
    // JSONValues which don't accept undefined).
    const providerOptions: { google?: { outputDimensionality: number; taskType: string }; openai?: { dimensions: number } } = {};
    if (spec.provider === "google") {
      providerOptions.google = {
        outputDimensionality: spec.dimensions,
        taskType: "RETRIEVAL_DOCUMENT",
      };
    } else if (spec.provider === "openai" && spec.modelId === "text-embedding-3-small" && spec.dimensions === 768) {
      // Only OpenAI accepts a `dimensions` override today; for the small model
      // that targets 768 dims. Other providers ignore it.
      providerOptions.openai = { dimensions: 768 };
    }
    const { embeddings } = await Promise.race([
      embedMany({
        model: sdkModel,
        values: missingTexts,
        providerOptions: providerOptions as any,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: embedMany excedeu 30000ms")), 30000)
      ),
    ]);

    for (const emb of embeddings) {
      const arr = Array.from(emb);
      try {
        validateEmbeddingDim(arr, modelKey);
      } catch (err) {
        // Provider returned an unexpected shape — surface, don't poison cache.
        throw err;
      }
      newEmbeddings.push(arr);
    }

    // Persist (fire-and-forget). onConflictDoNothing against (text_hash, model).
    Promise.all(
      missingIndices.map((origIdx, i) =>
        db
          .insert(embeddingCacheTable)
          .values({
            textHash: hashes[origIdx],
            model: modelKey,
            embedding: newEmbeddings[i],
            dim: spec.dimensions,
          })
          .onConflictDoNothing()
          .catch((e: Error) => console.warn("[Embedding Cache] Save failed:", e.message)),
      )
    ).catch(() => {});
  }

  // Assemble final result in original order.
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

  return { embeddings: result, model: modelKey, dim: spec.dimensions };
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
  const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
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
    const error = await response.json() as { error?: { message?: string } };
    throw new Error(`Erro na transcrição: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json() as { text: string };
  return result.text;
}