import type { Request, Response, NextFunction } from "express";

/**
 * Simple API key authentication middleware.
 * 
 * If API_KEY env var is set, all requests must include:
 *   Authorization: Bearer <API_KEY>
 *   — or —
 *   x-api-key: <API_KEY>
 * 
 * If API_KEY is NOT set, the middleware is a no-op (all requests pass).
 * This allows the app to work without auth during development.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;
  
  // No API key configured = no auth required
  if (!apiKey) {
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

  // Check query parameter (less secure, but useful for webhooks)
  const queryKey = req.query.api_key;
  if (queryKey === apiKey) {
    next();
    return;
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Valid API key required. Set API_KEY environment variable and pass it via Authorization header.",
  });
}
