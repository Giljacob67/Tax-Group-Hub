import rateLimit from "express-rate-limit";

/**
 * General API rate limiter.
 * 100 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Rate limit exceeded. Max 100 requests per minute.",
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
