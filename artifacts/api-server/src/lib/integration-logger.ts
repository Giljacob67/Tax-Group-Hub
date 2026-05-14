/**
 * Integration Logger
 * Writes and queries integration_logs. Payload previews must never contain secrets.
 */

import { randomUUID } from "node:crypto";
import { db, integrationLogsTable } from "@workspace/db";
import { eq, desc, and, type SQL } from "drizzle-orm";

export type LogDirection = "inbound" | "outbound";
export type LogStatus = "success" | "error" | "pending" | "ignored";

export interface WriteLogInput {
  userId?: string;
  integrationKey: string;
  integrationName: string;
  eventType: string;
  direction: LogDirection;
  status: LogStatus;
  durationMs?: number;
  httpStatus?: number;
  requestUrl?: string;
  requestMethod?: string;
  payloadPreview?: string;
  errorMessage?: string;
  technicalDetails?: string;
  correlationId?: string;
}

/** Mask URL — strip query params and auth tokens, show only scheme+host+path */
export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.substring(0, 80);
  }
}

/** Truncate payload preview to 500 chars, remove secrets */
export function safePayloadPreview(payload: unknown, maxLen = 500): string {
  try {
    let s = JSON.stringify(payload, (key, val) => {
      const lower = key.toLowerCase();
      if (lower.includes("secret") || lower.includes("token") || lower.includes("password") ||
          lower.includes("key") || lower.includes("auth") || lower.includes("credential")) {
        return "[REDACTED]";
      }
      return val;
    }, 2);
    if (s.length > maxLen) s = s.slice(0, maxLen) + "…";
    return s;
  } catch {
    return "[parse error]";
  }
}

export async function writeIntegrationLog(input: WriteLogInput): Promise<string> {
  const correlationId = input.correlationId ?? randomUUID();
  try {
    await db.insert(integrationLogsTable).values({
      userId: input.userId ?? null,
      integrationKey: input.integrationKey,
      integrationName: input.integrationName,
      eventType: input.eventType,
      direction: input.direction,
      status: input.status,
      durationMs: input.durationMs ?? null,
      httpStatus: input.httpStatus ?? null,
      requestUrl: input.requestUrl ? maskUrl(input.requestUrl) : null,
      requestMethod: input.requestMethod ?? "POST",
      payloadPreview: input.payloadPreview ?? null,
      errorMessage: input.errorMessage ?? null,
      technicalDetails: input.technicalDetails ?? null,
      correlationId,
    });
  } catch (err) {
    console.error("[IntegrationLogger] Failed to write log:", err);
  }
  return correlationId;
}

export interface ListLogsOptions {
  userId?: string;
  integrationKey?: string;
  status?: LogStatus;
  direction?: LogDirection;
  limit?: number;
}

export async function listIntegrationLogs(opts: ListLogsOptions = {}) {
  const conditions: SQL[] = [];
  if (opts.userId) conditions.push(eq(integrationLogsTable.userId, opts.userId));
  if (opts.integrationKey) conditions.push(eq(integrationLogsTable.integrationKey, opts.integrationKey));
  if (opts.status) conditions.push(eq(integrationLogsTable.status, opts.status));
  if (opts.direction) conditions.push(eq(integrationLogsTable.direction, opts.direction));

  const query = db
    .select()
    .from(integrationLogsTable)
    .orderBy(desc(integrationLogsTable.createdAt))
    .limit(opts.limit ?? 100);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}
