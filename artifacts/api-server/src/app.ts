import express, { type Express } from "express";
import cors from "cors";
import { apiKeyAuth } from "./middlewares/auth.js";
import { apiLimiter, llmLimiter } from "./middlewares/rate-limit.js";
import router from "./routes";

const app: Express = express();

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.APP_URL || false
    : true,
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

export default app;
