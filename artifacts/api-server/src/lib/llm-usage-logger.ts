/**
 * Unified LLM usage logging helper.
 * Call this after every LLM invocation to ensure complete analytics coverage.
 */

import { db, usageLogsTable, llmConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { LLMResult } from "./llm-client.js";

export interface LogUsageOptions {
  userId?: string;
  conversationId?: number;
  agentId?: string;
  connectionId?: number;
  provider?: string;
  model?: string;
  platform?: "web" | "whatsapp" | "telegram" | "automate";
  usageType?: string;
  success?: boolean;
  errorMessage?: string;
}

function calculateCost(
  promptTokens: number,
  completionTokens: number,
  pricePer1MInput?: number | null,
  pricePer1MOutput?: number | null,
): number | null {
  if (!pricePer1MInput || !pricePer1MOutput) return null;
  // cost in cents
  const inputCost = (promptTokens / 1_000_000) * pricePer1MInput;
  const outputCost = (completionTokens / 1_000_000) * pricePer1MOutput;
  return Math.round((inputCost + outputCost) * 100);
}

export async function logLLMUsage(
  result: LLMResult,
  opts: LogUsageOptions,
): Promise<void> {
  try {
    // Try to find connection for pricing
    let pricePer1MInput: number | null = null;
    let pricePer1MOutput: number | null = null;

    if (opts.connectionId) {
      const [conn] = await db
        .select({
          pricePer1MInput: llmConnectionsTable.pricePer1MInput,
          pricePer1MOutput: llmConnectionsTable.pricePer1MOutput,
        })
        .from(llmConnectionsTable)
        .where(eq(llmConnectionsTable.id, opts.connectionId))
        .limit(1);
      if (conn) {
        pricePer1MInput = conn.pricePer1MInput;
        pricePer1MOutput = conn.pricePer1MOutput;
      }
    }

    const cost = calculateCost(
      result.promptTokens,
      result.completionTokens,
      pricePer1MInput,
      pricePer1MOutput,
    );

    await db.insert(usageLogsTable).values({
      userId: opts.userId || null,
      conversationId: opts.conversationId || null,
      agentId: opts.agentId || null,
      connectionId: opts.connectionId || null,
      model: result.model,
      provider: result.provider,
      usageType: opts.usageType || "chat",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.tokensUsed,
      cost,
      latencyMs: result.executionTimeMs,
      platform: opts.platform || "web",
      success: opts.success !== false,
      errorMessage: opts.errorMessage || null,
    });
  } catch (err) {
    // Never fail the main operation because of logging
    console.error("[LLM Usage Logger] Failed to log usage:", err);
  }
}
