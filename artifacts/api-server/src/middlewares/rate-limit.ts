import rateLimit from "express-rate-limit";

/**
 * General API rate limiter.
 * 300 requests per minute per IP — generous to support polling + uploads.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Rate limit exceeded. Max 300 requests per minute.",
  },
});

/**
 * Upload-specific limiter: 30 uploads per minute per IP.
 * Prevents abuse while allowing burst document ingestion.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Upload rate limit exceeded. Max 30 uploads per minute.",
  },
});

/**
 * Strict rate limiter for LLM-heavy endpoints (orchestrate, pipeline).
 * 10 requests per minute per IP to prevent API credit burn.
 */
export const llmLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message:
      "LLM rate limit exceeded. Max 10 requests per minute for AI operations.",
  },
});

/**
 * Auth-specific rate limiter: 5 attempts per minute per IP.
 * Protects login, password reset, and 2FA endpoints from brute-force attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: "Too Many Requests",
    message:
      "Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.",
  },
});

/**
 * Stricter auth limiter for login: 10 attempts per 15 minutes per IP.
 * Provides additional protection against sustained brute-force attacks.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: "Too Many Requests",
    message:
      "Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.",
  },
});
