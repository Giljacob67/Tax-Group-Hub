/**
 * Outbound Webhook Dispatcher
 * Signs payloads with HMAC-SHA256 when a secret is configured.
 * Logs every dispatch attempt to integration_logs.
 */

import { createHmac, randomUUID } from "node:crypto";
import {
  writeIntegrationLog,
  maskUrl,
  safePayloadPreview,
} from "./integration-logger.js";
import { validateSafeUrl } from "./validation.js";

const DISPATCH_TIMEOUT_MS = 10_000;

export interface DispatchOptions {
  targetUrl: string;
  eventType: string;
  payload: Record<string, unknown>;
  secret?: string;
  correlationId?: string;
  userId?: string;
  integrationKey?: string;
  integrationName?: string;
}

export interface DispatchResult {
  ok: boolean;
  httpStatus?: number;
  correlationId: string;
  durationMs: number;
  errorMessage?: string;
  errorCode?: string;
}

/** Produce HMAC-SHA256 hex digest of body string */
function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function httpErrorCode(status: number): string {
  if (status === 401 || status === 403) return "AUTH_REJECTED";
  if (status === 404) return "URL_NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "TARGET_SERVER_ERROR";
  if (status >= 400) return "CLIENT_ERROR";
  return "HTTP_ERROR";
}

export async function dispatchWebhook(
  opts: DispatchOptions,
): Promise<DispatchResult> {
  const correlationId = opts.correlationId ?? randomUUID();
  const integrationKey = opts.integrationKey ?? "webhooks";
  const integrationName = opts.integrationName ?? "Webhook";
  const ts = Date.now();

  // SSRF guard (async: resolves DNS to defeat DNS rebinding)
  const safeUrl = await validateSafeUrl(opts.targetUrl);
  if (!safeUrl) {
    const result: DispatchResult = {
      ok: false,
      correlationId,
      durationMs: 0,
      errorMessage:
        "URL de destino inválida ou não permitida (SSRF protection).",
      errorCode: "INVALID_URL",
    };
    await writeIntegrationLog({
      userId: opts.userId,
      integrationKey,
      integrationName,
      eventType: opts.eventType,
      direction: "outbound",
      status: "error",
      durationMs: 0,
      requestUrl: opts.targetUrl,
      requestMethod: "POST",
      payloadPreview: safePayloadPreview(opts.payload),
      errorMessage: result.errorMessage,
      correlationId,
    });
    return result;
  }

  const bodyObj = {
    event: opts.eventType,
    correlationId,
    timestamp: new Date().toISOString(),
    source: "tax-group-hub",
    payload: opts.payload,
  };
  const bodyStr = JSON.stringify(bodyObj);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-TaxGroup-Event": opts.eventType,
    "X-TaxGroup-Correlation-Id": correlationId,
    "X-TaxGroup-Timestamp": bodyObj.timestamp,
    "User-Agent": "TaxGroupHub/1.0",
  };

  if (opts.secret) {
    headers["X-TaxGroup-Signature"] =
      `sha256=${signPayload(bodyStr, opts.secret)}`;
  }

  let httpStatus: number | undefined;
  let errorMessage: string | undefined;
  let errorCode: string | undefined;
  let ok = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

    const resp = await fetch(safeUrl, {
      method: "POST",
      headers,
      body: bodyStr,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    httpStatus = resp.status;
    ok = resp.ok;

    if (!ok) {
      errorCode = httpErrorCode(httpStatus);
      errorMessage = mapHttpError(httpStatus);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("timeout")) {
      errorCode = "TIMEOUT";
      errorMessage = "O endpoint não respondeu dentro do tempo esperado (10s).";
    } else if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      errorCode = "CONNECTION_REFUSED";
      errorMessage = "Não foi possível conectar ao endpoint. Verifique a URL.";
    } else {
      errorCode = "NETWORK_ERROR";
      errorMessage = `Erro de rede: ${msg.substring(0, 120)}`;
    }
  }

  const durationMs = Date.now() - ts;

  await writeIntegrationLog({
    userId: opts.userId,
    integrationKey,
    integrationName,
    eventType: opts.eventType,
    direction: "outbound",
    status: ok ? "success" : "error",
    durationMs,
    httpStatus,
    requestUrl: safeUrl,
    requestMethod: "POST",
    payloadPreview: safePayloadPreview(opts.payload),
    errorMessage: errorMessage ?? undefined,
    technicalDetails: errorCode,
    correlationId,
  });

  return { ok, httpStatus, correlationId, durationMs, errorMessage, errorCode };
}

function mapHttpError(status: number): string {
  if (status === 401 || status === 403)
    return "Secret inválido ou credencial sem permissão.";
  if (status === 404) return "URL do webhook ou endpoint não encontrado.";
  if (status === 429)
    return "Limite de requisições atingido. Tente novamente mais tarde.";
  if (status >= 500)
    return "Erro no serviço de destino. Tente novamente em instantes.";
  return `O servidor respondeu com status ${status}.`;
}
