/**
 * Shared LLM client for Tax Group Hub.
 *
 * Consolidates getLLMConfig() and callLLM() into a single module
 * used by conversations.ts, orchestrate.ts, and automate.ts.
 */

import OpenAI from "openai";
import { createHash } from "node:crypto";
import { getEffectiveOllamaUrl, getEffectiveOllamaModel } from "../routes/settings.js";
import { db } from "@workspace/db";
import { embeddingCacheTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

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
  const executionTimeMs = Date.now() - startTime;

  console.log(`[LLM] ${config.provider} (${config.model}) | Tokens: ${tokensUsed} | Duration: ${executionTimeMs}ms`);

  return {
    output,
    tokensUsed,
    executionTimeMs,
  };
}

/**
 * Generate embeddings for a given array of texts.
 * Uses a DB cache (MD5 hash) to avoid redundant API calls.
 * Uses text-embedding-004 (Gemini) or nomic-embed-text (Ollama).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const config = await getLLMConfig();
  if (!config) {
    throw new Error("No LLM configured for embeddings.");
  }

  const embedModel = config.provider === "Gemini" ? "text-embedding-004" : "nomic-embed-text";

  // 1. Compute MD5 hash for each text
  const hashes = texts.map((t) => createHash("md5").update(t).digest("hex"));

  // 2. Look up all hashes in the cache
  let cachedRows: { textHash: string; embedding: number[] | null }[] = [];
  try {
    cachedRows = await db
      .select({ textHash: embeddingCacheTable.textHash, embedding: embeddingCacheTable.embedding })
      .from(embeddingCacheTable)
      .where(inArray(embeddingCacheTable.textHash, hashes));
  } catch (cacheErr) {
    console.warn("[Embedding Cache] DB lookup failed, falling back to API:", cacheErr);
  }

  const cacheMap = new Map(cachedRows.map((r) => [r.textHash, r.embedding]));

  // 3. Identify which texts are not in cache
  const missingIndices: number[] = [];
  const missingTexts: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (!cacheMap.has(hashes[i])) {
      missingIndices.push(i);
      missingTexts.push(texts[i]);
    } else {
      console.log(`[Embedding Cache] HIT for hash ${hashes[i].substring(0, 8)}...`);
    }
  }

  // 4. Fetch embeddings from API for missing texts
  const newEmbeddings: number[][] = [];
  if (missingTexts.length > 0) {
    console.log(`[Embedding Cache] MISS — calling API for ${missingTexts.length}/${texts.length} texts`);
    const response = await config.client.embeddings.create({
      model: embedModel,
      input: missingTexts,
    });
    const sorted = response.data.sort((a: any, b: any) => a.index - b.index);
    for (const item of sorted) {
      newEmbeddings.push(item.embedding);
    }

    // 5. Persist new embeddings to cache (fire-and-forget)
    Promise.all(
      missingIndices.map((origIdx, i) =>
        db
          .insert(embeddingCacheTable)
          .values({ textHash: hashes[origIdx], embedding: newEmbeddings[i] })
          .onConflictDoNothing()
          .catch((e: Error) => console.warn("[Embedding Cache] Failed to persist:", e.message)),
      ),
    ).catch(() => {});
  }

  // 6. Assemble final result in original order
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
