import type { Request, Response, NextFunction } from "express";

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

  // No API key configured = no auth required
  if (!apiKey) {
    next();
    return;
  }

  // Exempt health check from auth
  if (req.path === "/healthz" || req.path === "/api/healthz") {
    next();
    return;
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === apiKey) {
      next();
      return;
    }
  }

  // Check x-api-key header
  const headerKey = req.headers["x-api-key"];
  if (headerKey === apiKey) {
    next();
    return;
  }

  // Check webhook secret for automate endpoints
  if (req.path.startsWith("/automate/") && webhookSecret) {
    const providedSecret = req.headers["x-webhook-secret"];
    if (providedSecret === webhookSecret) {
      next();
      return;
    }
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Valid API key required. Set API_KEY environment variable and pass it via Authorization header or x-api-key header.",
  });
}
