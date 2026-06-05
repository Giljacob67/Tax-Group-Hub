/**
 * LLM Router — unified call via connection ID with fallback chains.
 */

import { db, llmConnectionsTable, llmProfilesTable } from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";
import { callLLM, type LLMResult } from "./llm-client.js";
import { decrypt } from "./crypto.js";
import logger from "./logger.js";

export interface RouterOptions {
  connectionId?: number;
  profileId?: number;
  usageType?:
    | "chat"
    | "fast"
    | "reasoning"
    | "vision"
    | "embedding"
    | "image"
    | "transcription";
  userId?: string;
}

/**
 * Resolve which connection to use based on priority:
 * 1. Explicit connectionId
 * 2. Profile + usageType
 * 3. Default connection for usageType
 */
async function resolveConnection(
  opts: RouterOptions,
): Promise<typeof llmConnectionsTable.$inferSelect | null> {
  // 1. Direct connectionId — allow user-owned OR global (userId IS NULL) connections
  if (opts.connectionId) {
    const tenancyFilter = opts.userId
      ? or(
          eq(llmConnectionsTable.userId, opts.userId),
          isNull(llmConnectionsTable.userId),
        )
      : isNull(llmConnectionsTable.userId);
    const [conn] = await db
      .select()
      .from(llmConnectionsTable)
      .where(and(eq(llmConnectionsTable.id, opts.connectionId), tenancyFilter))
      .limit(1);
    if (conn) return conn;
  }

  // 2. Profile + usageType
  if (opts.profileId || opts.usageType) {
    const profileConditions = [eq(llmProfilesTable.isActive, true)];
    if (opts.profileId) {
      profileConditions.push(eq(llmProfilesTable.id, opts.profileId));
    }
    if (opts.userId) {
      profileConditions.push(eq(llmProfilesTable.userId, opts.userId));
    }

    const [profile] = await db
      .select()
      .from(llmProfilesTable)
      .where(and(...profileConditions))
      .limit(1);

    if (profile) {
      const typeToField: Record<string, string> = {
        chat: "chatConnectionId",
        fast: "fastConnectionId",
        reasoning: "reasoningConnectionId",
        vision: "visionConnectionId",
        embedding: "embeddingConnectionId",
        image: "imageConnectionId",
        transcription: "transcriptionConnectionId",
      };
      const field = typeToField[opts.usageType || "chat"];
      const connId = field ? (profile as any)[field] : null;
      if (connId) {
        const [conn] = await db
          .select()
          .from(llmConnectionsTable)
          .where(eq(llmConnectionsTable.id, connId))
          .limit(1);
        if (conn) return conn;
      }
    }
  }

  // 3. Default connection for usageType (fallback)
  const [defaultConn] = await db
    .select()
    .from(llmConnectionsTable)
    .where(
      and(
        eq(llmConnectionsTable.usageType, opts.usageType || "chat"),
        eq(llmConnectionsTable.isDefault, true),
        eq(llmConnectionsTable.isActive, true),
      ),
    )
    .limit(1);

  return defaultConn || null;
}

/**
 * Build a fallback chain: the resolved connection + other active connections
 * of the same usageType, ordered by lastTestStatus = ok first.
 *
 * The chain is strictly scoped to the caller's userId: a user-owned connection
 * is paired with global connections (userId IS NULL), and a global caller sees
 * only other global connections. This prevents one tenant's failed request from
 * falling through to another tenant's BYOK connection.
 */
async function buildFallbackChain(
  primary: typeof llmConnectionsTable.$inferSelect,
  userId?: string,
): Promise<(typeof llmConnectionsTable.$inferSelect)[]> {
  const tenancyClause = userId
    ? or(
        eq(llmConnectionsTable.userId, userId),
        isNull(llmConnectionsTable.userId),
      )
    : isNull(llmConnectionsTable.userId);

  const all: (typeof llmConnectionsTable.$inferSelect)[] = await db
    .select()
    .from(llmConnectionsTable)
    .where(
      and(
        eq(llmConnectionsTable.usageType, primary.usageType),
        eq(llmConnectionsTable.isActive, true),
        tenancyClause,
      ),
    );

  const filtered = all.filter(
    (c: typeof llmConnectionsTable.$inferSelect) => c.id !== primary.id,
  );

  // Sort: tested-ok first, then untested, then errors
  const score = (c: typeof llmConnectionsTable.$inferSelect) => {
    if (c.lastTestStatus === "ok") return 3;
    if (c.lastTestStatus === "untested") return 2;
    return 1;
  };

  filtered.sort(
    (
      a: typeof llmConnectionsTable.$inferSelect,
      b: typeof llmConnectionsTable.$inferSelect,
    ) => score(b) - score(a),
  );
  return [primary, ...filtered];
}

/**
 * Call LLM via a specific connection with automatic fallback.
 */
export async function callLLMViaConnection(
  systemPrompt: string,
  userMessage: string | Array<{ role: string; content: string }>,
  opts: RouterOptions & {
    jsonMode?: boolean;
    toolIds?: string[];
    maxRetries?: number;
  },
): Promise<
  LLMResult & { connectionUsed?: number; fallbackTriggered?: boolean }
> {
  const connection = await resolveConnection(opts);
  if (!connection) {
    throw new Error(
      `Nenhuma conexão LLM encontrada para usageType='${opts.usageType || "chat"}'. Configure um modelo em Configurações > IA & LLM.`,
    );
  }

  const chain = await buildFallbackChain(connection, opts.userId);
  const maxRetries = opts.maxRetries ?? 2; // primary + up to 2 fallbacks
  const errors: string[] = [];

  for (let i = 0; i < Math.min(chain.length, maxRetries + 1); i++) {
    const conn = chain[i];
    try {
      const apiKey = decrypt(conn.apiKey);

      // Build provider-specific options
      const provider = conn.provider;
      const customUrl = conn.baseUrl || undefined;

      const result = await callLLM(systemPrompt, userMessage, {
        provider,
        model: conn.modelId,
        customUrl,
        jsonMode: opts.jsonMode,
        toolIds: opts.toolIds as any,
        userId: opts.userId,
      });

      return {
        ...result,
        connectionUsed: conn.id,
        fallbackTriggered: i > 0,
      };
    } catch (err: any) {
      logger.warn(
        {
          connectionId: conn.id,
          provider: conn.provider,
          model: conn.modelId,
          error: err.message,
        },
        "LLM call failed, trying fallback",
      );
      errors.push(`[${conn.name}] ${err.message}`);

      // Update last error on connection
      await db
        .update(llmConnectionsTable)
        .set({ lastTestStatus: "error", lastError: err.message?.slice(0, 500) })
        .where(eq(llmConnectionsTable.id, conn.id))
        .catch(() => {});
    }
  }

  throw new Error(
    `Todos os provedores de LLM falharam (${errors.length} tentativas):\n${errors.join("\n")}`,
  );
}

/**
 * Health check all active connections and update their status.
 * Can be called from a cron job or background task.
 */
export async function healthCheckConnections(
  userId?: string,
): Promise<
  Array<{ id: number; name: string; status: string; error?: string }>
> {
  const conditions = [eq(llmConnectionsTable.isActive, true)];
  if (userId) conditions.push(eq(llmConnectionsTable.userId, userId));

  const connections = await db
    .select()
    .from(llmConnectionsTable)
    .where(and(...conditions));

  const results = [];
  for (const conn of connections) {
    try {
      await callLLM(
        "You are a health check assistant. Reply with exactly 'OK'.",
        "Reply with exactly 'OK'.",
        {
          provider: conn.provider,
          model: conn.modelId,
          customUrl: conn.baseUrl || undefined,
          userId: conn.userId || undefined,
        },
      );
      await db
        .update(llmConnectionsTable)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: "ok",
          lastError: null,
        })
        .where(eq(llmConnectionsTable.id, conn.id));
      results.push({ id: conn.id, name: conn.name, status: "ok" });
    } catch (err: any) {
      await db
        .update(llmConnectionsTable)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: "error",
          lastError: err.message?.slice(0, 500),
        })
        .where(eq(llmConnectionsTable.id, conn.id));
      results.push({
        id: conn.id,
        name: conn.name,
        status: "error",
        error: err.message,
      });
    }
  }
  return results;
}
