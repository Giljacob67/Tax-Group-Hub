import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * LLM Connections — the core of the Model Hub.
 * Each row represents a configured connection to a provider+model.
 */
export const llmConnectionsTable = pgTable("llm_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id"), // null = global/system key
  name: text("name").notNull(), // e.g. "OpenRouter — GPT-4o"
  provider: text("provider").notNull(), // "openrouter" | "openai" | "anthropic" | "google" | "ollama" | "custom_openai"
  baseUrl: text("base_url"), // for OpenRouter, Ollama, or custom OpenAI-compatible
  apiKey: text("api_key").notNull(), // AES-256-GCM encrypted
  modelId: text("model_id").notNull(), // "gpt-4o", "meta-llama/llama-3.3-70b"
  modelName: text("model_name"), // friendly name returned from provider

  // Discovered metadata (cached from provider APIs)
  contextWindow: integer("context_window"),
  maxTokens: integer("max_tokens"),
  supportsVision: boolean("supports_vision").default(false),
  supportsTools: boolean("supports_tools").default(false),
  supportsJson: boolean("supports_json").default(false),
  priceInput: text("price_input"), // e.g. "$2.50 / 1M tokens"
  priceOutput: text("price_output"), // e.g. "$10.00 / 1M tokens"
  pricePer1MInput: integer("price_per_1m_input"), // in cents, e.g. 250 = $2.50
  pricePer1MOutput: integer("price_per_1m_output"), // in cents
  providerMetadata: jsonb("provider_metadata").$type<Record<string, unknown>>(), // raw extras from discovery

  // Usage classification
  usageType: text("usage_type").notNull().default("chat"), // "chat" | "fast" | "reasoning" | "vision" | "embedding" | "image" | "transcription"
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),

  // Health check
  lastTestedAt: timestamp("last_tested_at"),
  lastTestStatus: text("last_test_status").default("untested"), // "ok" | "error" | "untested"
  lastError: text("last_error"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLlmConnectionSchema = createInsertSchema(
  llmConnectionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTestedAt: true,
  lastTestStatus: true,
  lastError: true,
});

export type LlmConnection = typeof llmConnectionsTable.$inferSelect;
export type InsertLlmConnection = z.infer<typeof insertLlmConnectionSchema>;

/**
 * LLM Profiles — presets that assign different connections to different use-cases.
 * Inspired by Cursor: Chat vs. Fast vs. Reasoning vs. Vision vs. Agent.
 */
export const llmProfilesTable = pgTable("llm_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(), // "Padrão", "Econômico", "Máxima Qualidade"
  description: text("description"),

  chatConnectionId: integer("chat_connection_id"), // general chat
  fastConnectionId: integer("fast_connection_id"), // quick/light tasks
  reasoningConnectionId: integer("reasoning_connection_id"), // o1, deepseek-r1
  visionConnectionId: integer("vision_connection_id"), // image analysis
  embeddingConnectionId: integer("embedding_connection_id"), // RAG embeddings
  imageConnectionId: integer("image_connection_id"), // image generation
  transcriptionConnectionId: integer("transcription_connection_id"), // audio

  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLlmProfileSchema = createInsertSchema(llmProfilesTable).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  },
);

export type LlmProfile = typeof llmProfilesTable.$inferSelect;
export type InsertLlmProfile = z.infer<typeof insertLlmProfileSchema>;
