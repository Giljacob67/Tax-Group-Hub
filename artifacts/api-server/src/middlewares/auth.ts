import type { Request, Response, NextFunction } from "express";

// Extend Express Request to carry userId for multi-tenancy
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * API key authentication middleware.
 *
 * If API_KEY env var is set, all requests must include:
 *   Authorization: Bearer <API_KEY>
 *   — or —
 *   x-api-key: <API_KEY>
 *
 * Webhook endpoints can alternatively use:
 *   x-webhook-secret: <WEBHOOK_SECRET>
 *
 * If API_KEY is NOT set, the middleware is a no-op (all requests pass).
 * This allows the app to work without auth during development.
 *
 * SECURITY: Query parameter auth is NOT supported to prevent
 * accidental credential leakage in server/proxy logs.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Exempt health check from auth
  if (req.path === "/healthz" || req.path === "/api/healthz") {
    next();
    return;
  }

  // 1. Check webhook secret for automate endpoints (Higher priority)
  if (req.path.startsWith("/automate/") || req.path.startsWith("/api/automate/")) {
    const providedSecret = req.headers["x-webhook-secret"];
    if (webhookSecret && providedSecret === webhookSecret) {
      req.userId = String(req.headers["x-user-id"] || "system");
      next();
      return;
    }
    // If it's an automate route and webhook secret check failed, we don't return yet,
    // we allow it to fall back to the standard API_KEY check below.
  }

  // 2. If no API key is configured, fall back to open access (legacy demo mode)
  if (!apiKey) {
    req.userId = String(req.headers["x-user-id"] || "demo-user");
    next();
    return;
  }

  // 3. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === apiKey) {
      req.userId = String(req.headers["x-user-id"] || "default");
      next();
      return;
    }
  }

  // 4. Check x-api-key header
  const headerKey = req.headers["x-api-key"];
  if (headerKey === apiKey) {
    req.userId = String(req.headers["x-user-id"] || "default");
    next();
    return;
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Valid API key required. Set API_KEY environment variable and pass it via Authorization header or x-api-key header.",
  });
}
