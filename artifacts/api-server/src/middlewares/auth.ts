import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to carry userId for multi-tenancy
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Checks if the given userId belongs to a real human user
 * Filters out system, demo or unauthenticated fallbacks
 */
export function isRealUser(userId?: string): userId is string {
  return typeof userId === "string" && !["default", "dev-user", "demo-user", "system"].includes(userId) && userId.trim() !== "";
}

/**
 * Authentication middleware with support for:
 * 1. Webhook Secrets (x-webhook-secret) -> For automated external pipelines
 * 2. System API Key (Authorization: Bearer <API_KEY>) -> For server-to-server internal calls
 * 3. User JWT (Authorization: Bearer <JWT>) -> For Frontend/Dashboard users via Clerk/Self-hosted auth
 * 
 * Orders of precedence: Webhook -> JWT -> Auth Header Key -> x-api-key
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const jwtSecret = process.env.JWT_SECRET;
  const systemApiKey = process.env.API_KEY;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Exempt health check and public branding from auth
  const publicPaths = ["/healthz", "/api/healthz", "/api/branding/config"];
  if (publicPaths.includes(req.path)) {
    next();
    return;
  }

  // 1. Webhook Authentication (Automate/Webhooks routes)
  const webhookProvided = req.headers["x-webhook-secret"];
  if (webhookProvided && webhookSecret && webhookProvided === webhookSecret) {
    req.userId = String(req.headers["x-user-id"] || "system");
    next();
    return;
  }

  // 2. JWT / Bearer Token Authentication
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Try JWT first if secret is available
    if (jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as { sub?: string; userId?: string };
        req.userId = decoded.userId || decoded.sub;
        if (req.userId) {
          next();
          return;
        }
      } catch (err) {
        // Token was provided but invalid for JWTS
        // If it also fails as a system API key next, we'll block
      }
    }

    // Fallback/Alternative: System API Key
    if (systemApiKey && token === systemApiKey) {
      req.userId = String(req.headers["x-user-id"] || "default");
      next();
      return;
    }
  }

  // 3. Simple Header Authentication (x-api-key)
  const headerKey = req.headers["x-api-key"];
  if (systemApiKey && headerKey === systemApiKey) {
    req.userId = String(req.headers["x-user-id"] || "default");
    next();
    return;
  }

  // 4. Development/Safe Fallback (Block if strictly configured)
  if (!systemApiKey && !jwtSecret && process.env.NODE_ENV !== "production") {
    req.userId = "dev-user";
    next();
    return;
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Acesso negado. Credenciais inválidas ou não fornecidas (JWT ou API Key necessária)."
  });
}
