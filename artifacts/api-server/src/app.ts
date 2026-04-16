import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { apiKeyAuth } from "./middlewares/auth.js";
import { apiLimiter, llmLimiter } from "./middlewares/rate-limit.js";
import { requestId } from "./middlewares/request-id.js";
import { errorHandler } from "./middlewares/error-handler.js";
import router from "./routes";

const app: Express = express();

// Trust proxy — required for rate-limit to read real client IP behind Vercel/reverse proxy
app.set("trust proxy", 1);

const getOrigins = () => {
  if (process.env.CORS_ORIGINS) return process.env.CORS_ORIGINS.split(',');
  if (process.env.NODE_ENV === "production") return [process.env.APP_URL || false];
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
};

// Security headers (CSP, X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet());

// Request ID tracing
app.use(requestId);

// CORS
app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowed = getOrigins();
    if (!origin || allowed.includes(origin) || allowed.includes(true) || allowed.includes("true")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Body parsing — with size limits to prevent payload attacks
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Serve static uploads (Phase 10 Branding)
import path from "node:path";
const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve("/tmp", "uploads")
  : path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));

// Global API key auth — applied to all /api routes
app.use("/api", apiKeyAuth);

// Rate limiting
app.use("/api", apiLimiter);

// Stricter rate limit for LLM-heavy endpoints
app.use("/api/automate/execute", llmLimiter);
app.use("/api/automate/pipeline", llmLimiter);
app.use("/api/automate/trigger", llmLimiter);
app.use("/api/orchestrate", llmLimiter);

// Routes
app.use("/api", router);

// Global Error Handler
app.use(errorHandler);

export default app;
