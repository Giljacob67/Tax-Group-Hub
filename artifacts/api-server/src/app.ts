import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { authMiddleware } from "./middlewares/auth.js";
import {
  apiLimiter,
  llmLimiter,
  uploadLimiter,
  authLimiter,
  loginLimiter,
} from "./middlewares/rate-limit.js";
import { requestId } from "./middlewares/request-id.js";
import { errorHandler } from "./middlewares/error-handler.js";
import router from "./routes";
import logger from "./lib/logger.js";

const app: Express = express();

// Trust proxy — required for rate-limit to read real client IP behind Vercel/reverse proxy
app.set("trust proxy", 1);

const getOrigins = (): string[] => {
  if (process.env.CORS_ORIGINS)
    return process.env.CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  if (process.env.NODE_ENV === "production")
    return process.env.APP_URL ? [process.env.APP_URL] : [];
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
};

// Security headers (CSP, X-Content-Type-Options, X-Frame-Options, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: process.env.NODE_ENV === "production"
          ? ["'self'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// Request ID tracing
app.use(requestId);

// CORS
app.use(
  cors({
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      const allowed = getOrigins();
      
      // Allow requests with no origin (same-origin, server-to-server, health checks)
      // This is safe because we're behind Vercel's proxy which handles actual CORS
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // Check if origin is in allowed list
      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        // Log blocked origin for debugging
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// Body parsing — with size limits to prevent payload attacks
// 8mb: allows base64-encoded file uploads up to ~6mb via /api/knowledge/upload
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Serve static uploads (Phase 10 Branding)
// INTENTIONALLY before auth: brand logos are referenced by the public landing page.
// Only server-controlled files land in this directory (via /api/branding/upload).
import path from "node:path";
const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve("/tmp", "uploads")
  : path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));

// Global Authentication Middleware — applied to all /api routes
app.use("/api", authMiddleware);

// Rate limiting
app.use("/api", apiLimiter);

// Stricter rate limit for LLM-heavy endpoints
app.use("/api/automate/execute", llmLimiter);
app.use("/api/automate/pipeline", llmLimiter);
app.use("/api/automate/trigger", llmLimiter);
app.use("/api/orchestrate", llmLimiter);

// Upload-specific rate limit (separate from general API limiter)
app.use("/api/knowledge/upload", uploadLimiter);

// Auth-specific rate limits (protect against brute-force)
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/2fa/validate", authLimiter);
app.use("/api/auth/2fa/complete-login", authLimiter);
app.use("/api/auth/2fa/verify", authLimiter);
app.use("/api/setup", authLimiter);

// Routes
app.use("/api", router);

// Global Error Handler
app.use(errorHandler);

export default app;
