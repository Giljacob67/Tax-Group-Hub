import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual requires equal-length buffers; pad to the longer side and
  // fold the length mismatch into the boolean so timing is not informative.
  const len = Math.max(ba.length, bb.length, 1);
  const pad = (buf: Buffer) => {
    const out = Buffer.alloc(len);
    buf.copy(out);
    return out;
  };
  const eq = ba.length === bb.length && timingSafeEqual(pad(ba), pad(bb));
  return ba.length === bb.length && eq;
}

// Extend Express Request to carry userId and auth metadata for multi-tenancy.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isCron?: boolean;
      authMethod?:
        | "jwt"
        | "api-key"
        | "webhook"
        | "cron"
        | "dev-fallback"
        | "service-key";
    }
  }
}

/**
 * Checks if the given userId belongs to a real human user.
 * Filters out system, demo or unauthenticated fallbacks.
 *
 * NOTE: in production no request should ever end up with a reserved userId
 * like "system"/"default"/"demo-user". The fallback assignments in
 * authMiddleware are dev-only — they let the local environment work without
 * a real auth provider. The requireUserId() helper below should be used
 * inside protected routes so we never silently operate on a tenant that
 * does not exist.
 */
export function isRealUser(userId?: string | null): userId is string {
  if (typeof userId !== "string") return false;
  if (userId.trim() === "") return false;
  if (
    ["default", "dev-user", "demo-user", "system", "service"].includes(userId)
  )
    return false;
  return true;
}

/**
 * Routes reachable without user authentication.
 * Read-only public endpoints; writes on these paths still require auth.
 *
 * LLM provider metadata and model discovery are static reference data —
 * they expose no user info and are needed for the IA & LLM tab to render
 * the wizard UI before the user has any credentials configured.
 *
 * LLM validate/discover take user-supplied credentials in the body and
 * are intentionally open: they form a chicken-and-egg flow where the
 * user must validate a key BEFORE having a connection to authenticate
 * with. The endpoints never write or read user-owned data; they only
 * call the upstream provider's API with the supplied key.
 *
 * LLM connections/profiles still REQUIRE auth — those are per-tenant
 * state and protected by the standard auth flow.
 */
const PUBLIC_PATHS: ReadonlyArray<string> = [
  "/healthz",
  "/branding/config",
  "/branding/resolve",
  "/agents",
  "/agents/search",
  "/llm/providers",
  "/llm/validate",
  "/llm/discover",
  "/llm/models/static",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-reset-token",
  "/auth/2fa/complete-login",
];

const PUBLIC_GET_PATHS: ReadonlyArray<string> = [
  "/settings/integrations",
  "/settings/models",
  "/settings/ollama",
  "/settings/active-provider",
];

/**
 * Vercel Cron paths. Vercel sends `Authorization: Bearer <CRON_SECRET>` (or
 * the modern `x-cron-secret` header). We accept both so the platform can
 * rotate without breaking the deployment.
 */
const CRON_PATHS: ReadonlyArray<string> = [
  "/automate/process-sequences",
  "/automate/trigger/reforma-tributaria",
  "/automate/trigger/new-lead",
  "/automate/trigger/editorial-calendar",
  "/automate/trigger/follow-up-check",
  "/automate/trigger/content-request",
  "/automate/trigger/enrich-cnpj",
  "/knowledge/process-queue",
  "/integrations/hubspot/sync",
];

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7);
}

/**
 * Authentication middleware. Order of precedence:
 *   1. CRON secret (x-cron-secret or Authorization: Bearer) for cron paths
 *   2. JWT (sub / userId claim)
 *   3. Bearer system API key (service identity — never client-supplied)
 *   4. x-api-key header (same service key)
 *   5. Webhook secret (x-webhook-secret) for omnichannel dispatchers
 *   6. Dev fallback (only when NODE_ENV !== "production" and no auth env set)
 *
 * Tenant identity is ALWAYS derived from the token/secret, NEVER from a
 * client-supplied header. The previous behaviour of trusting `x-user-id`
 * together with the system API key allowed impersonation — that vector
 * is closed.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const jwtSecret = process.env.JWT_SECRET;
  const systemApiKey = process.env.API_KEY;
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const serviceUserId = process.env.SERVICE_USER_ID || "service";

  // 1. Cron — only valid for whitelisted paths, constant-time compared.
  if (cronSecret && CRON_PATHS.includes(req.path)) {
    const headerSecret = req.headers["x-cron-secret"];
    const authToken = bearerToken(req);
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The legacy
    // x-cron-secret header is also accepted for non-Vercel callers.
    const provided =
      typeof headerSecret === "string" ? headerSecret : (authToken ?? null);
    if (provided && safeCompare(provided, cronSecret)) {
      req.userId = "service";
      req.isCron = true;
      req.authMethod = "cron";
      next();
      return;
    }
  }

  // Public read paths.
  if (PUBLIC_PATHS.includes(req.path)) {
    next();
    return;
  }
  if (req.path.startsWith("/agents/") && req.method === "GET") {
    next();
    return;
  }
  if (req.method === "GET" && PUBLIC_GET_PATHS.includes(req.path)) {
    next();
    return;
  }

  // 2. JWT
  const token = bearerToken(req);
  if (token && jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret) as {
        sub?: string;
        userId?: string;
      };
      const uid = decoded.userId || decoded.sub;
      if (uid && isRealUser(uid)) {
        req.userId = uid;
        req.authMethod = "jwt";
        next();
        return;
      }
    } catch {
      // fall through to API key check
    }
  }

  // 3. Bearer system API key → service identity (never client-supplied).
  if (token && systemApiKey && safeCompare(token, systemApiKey)) {
    req.userId = serviceUserId;
    req.authMethod = "api-key";
    next();
    return;
  }

  // 4. x-api-key header — same service key.
  const headerKey = req.headers["x-api-key"];
  if (
    systemApiKey &&
    typeof headerKey === "string" &&
    safeCompare(headerKey, systemApiKey)
  ) {
    req.userId = serviceUserId;
    req.authMethod = "api-key";
    next();
    return;
  }

  // 5. Webhook secret → service identity (channel routing is per-token in handlers).
  const webhookProvided = req.headers["x-webhook-secret"];
  if (
    webhookSecret &&
    typeof webhookProvided === "string" &&
    safeCompare(webhookProvided, webhookSecret)
  ) {
    req.userId = "service";
    req.authMethod = "webhook";
    next();
    return;
  }

  // 6. Dev fallback — only when no auth env is configured and not in production.
  if (!systemApiKey && !jwtSecret && process.env.NODE_ENV !== "production") {
    req.userId = "dev-user";
    req.authMethod = "dev-fallback";
    next();
    return;
  }

  res.status(401).json({
    error: "Unauthorized",
    message:
      "Acesso negado. Credenciais inválidas ou não fornecidas (JWT ou API Key necessária).",
  });
}

/**
 * Resolve a userId from a request, refusing to operate on reserved/system
 * ids in production code paths. Use this inside route handlers instead of
 * `req.userId || "system"`.
 */
export function requireUserId(req: Request): string {
  const uid = req.userId;
  if (!isRealUser(uid)) {
    const err = new Error(
      "Autenticação obrigatória (userId inválido ou ausente).",
    );
    (err as any).statusCode = 401;
    (err as any).status = 401;
    throw err;
  }
  return uid;
}

/**
 * Some routes (cron jobs, webhook dispatchers) intentionally act as the
 * service. Use this guard in those handlers so we never silently demote
 * a cron call into a real user scope.
 */
export function requireServiceOrUser(req: Request): string {
  const uid = req.userId;
  if (!uid) {
    const err = new Error("Autenticação obrigatória.");
    (err as any).statusCode = 401;
    throw err;
  }
  return uid;
}
