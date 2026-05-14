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
    message: "LLM rate limit exceeded. Max 10 requests per minute for AI operations.",
  },
});
