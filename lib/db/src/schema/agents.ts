import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  boolean,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { dimAgnosticVector } from "../vector.js";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"),
  title: text("title").notNull().default("Nova Conversa"),
  model: text("model"),
  provider: text("provider"),
  connectionId: integer("connection_id"),
  platform: text("platform").default("web"), // 'web' | 'whatsapp' | 'telegram'
  externalId: text("external_id"), // phone number or chat_id
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const knowledgeDocumentsTable = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"), // Added for future tenancy
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storageKey: text("storage_key").notNull(),
  extractedContent: text("extracted_content"),
  status: text("status").notNull().default("pending"),
  processed: boolean("processed").notNull().default(false),
  retries: integer("retries").notNull().default(0), // Added for resiliency
  errorLog: text("error_log"), // Added for debug
  fileData: text("file_data"), // Base64 do arquivo original (fallback para reindexação)
  blobUrl: text("blob_url"), // URL do Vercel Blob (upload direto, sem limite de payload)
  // --- Classificação e RAG ---
  category: text("category"), // 'RTI' | 'AFD' | 'REP' | 'Propostas' | etc.
  product: text("product"), // produto relacionado: 'RTI' | 'AFD' | 'REP' | 'Reforma Tributária' | etc.
  origin: text("origin").default("upload"), // 'upload' | 'drive' | 'internal' | 'system'
  tags: jsonb("tags").$type<string[]>(),
  validUntil: timestamp("valid_until"),
  priority: integer("priority").default(5),
  chunkCount: integer("chunk_count").default(0),
  embeddingModel: text("embedding_model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const designGalleryTable = pgTable("design_gallery", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().default("global"),
  userId: text("user_id"), // Added for strict tenancy
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appConfigTable = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDesignGallerySchema = createInsertSchema(
  designGalleryTable,
).omit({ id: true, createdAt: true });
export type DesignGalleryItem = typeof designGalleryTable.$inferSelect;
export type InsertDesignGalleryItem = z.infer<typeof insertDesignGallerySchema>;

export const insertConversationSchema = createInsertSchema(
  conversationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export const insertKnowledgeDocumentSchema = createInsertSchema(
  knowledgeDocumentsTable,
).omit({ id: true, createdAt: true });

export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type KnowledgeDocument = typeof knowledgeDocumentsTable.$inferSelect;
export type InsertKnowledgeDocument = z.infer<
  typeof insertKnowledgeDocumentSchema
>;

export const knowledgeChunksTable = pgTable("knowledge_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  // Dim-agnostic vector via customType. See lib/db/src/vector.ts. Drizzle
  // type is `number[]`; the DB column has no dim pin so the same row can
  // hold 768 (Google), 1536 (OpenAI), 1024 (Ollama mxbai), etc.
  embedding: dimAgnosticVector("embedding"),
  // Track which model produced the embedding so we can validate or rebuild
  // a chunk when the user changes their embedding provider.
  embeddingModel: text("embedding_model"),
  embeddingDim: integer("embedding_dim"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertKnowledgeChunkSchema = createInsertSchema(
  knowledgeChunksTable,
).omit({ id: true, createdAt: true });
export type KnowledgeChunk = typeof knowledgeChunksTable.$inferSelect;
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;

/**
 * Embedding cache: avoids calling the embedding API for identical text chunks.
 * Key: MD5 hash of the text + the model that produced the vector. Value: the
 * embedding vector. We must include `model` in the key because two providers
 * with the same text produce different-shaped vectors.
 */
export const embeddingCacheTable = pgTable(
  "embedding_cache",
  {
    id: serial("id").primaryKey(),
    textHash: text("text_hash").notNull(),
    model: text("model").notNull().default("google/text-embedding-005"),
    // Same dim-agnostic column as knowledge_chunks.embedding — see comment there.
    embedding: dimAgnosticVector("embedding").notNull(),
    dim: integer("dim").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Composite uniqueness: one cached vector per (text, model) pair.
    uniqueIndex("embedding_cache_hash_model_idx").on(t.textHash, t.model),
  ],
);

export type EmbeddingCache = typeof embeddingCacheTable.$inferSelect;

/**
 * Storage for integration and AI provider API Keys (BYOK support)
 */
export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // 'openai', 'anthropic', 'resend', 'tavily', 'whatsapp', etc
  key: text("key").notNull(),
  userId: text("user_id"), // Added for future tenancy (Bring Your Own Key)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;

/**
 * Maps external bot channels (Telegram tokens, WhatsApp numbers) to specific agents/users.
 */
export const channelConfigsTable = pgTable("channel_configs", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(), // 'whatsapp' | 'telegram'
  externalId: text("external_id").notNull(), // bot token or phone number
  agentId: text("agent_id").notNull(),
  userId: text("user_id"),
  config: jsonb("config"), // extra secrets or settings
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ChannelConfig = typeof channelConfigsTable.$inferSelect;
export const insertChannelConfigSchema = createInsertSchema(
  channelConfigsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

/**
 * Stores LLM metrics for analytics and billing.
 */
export const usageLogsTable = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  conversationId: integer("conversation_id"),
  agentId: text("agent_id"),
  connectionId: integer("connection_id"),
  model: text("model"),
  provider: text("provider"),
  usageType: text("usage_type").default("chat"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  cost: integer("cost"), // stored in cents (e.g. 125 = $1.25)
  latencyMs: integer("latency_ms"),
  platform: text("platform").notNull().default("web"), // 'web' | 'whatsapp' | 'telegram' | 'automate'
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UsageLog = typeof usageLogsTable.$inferSelect;
export const insertUsageLogSchema = createInsertSchema(usageLogsTable).omit({
  id: true,
  createdAt: true,
});

/**
 * Custom branding configuration for tenants.
 */
export const tenantBrandingTable = pgTable("tenant_branding", {
  id: serial("id").primaryKey(),
  userId: text("user_id").unique(), // One branding config per user/owner
  companyName: text("company_name").notNull().default("Tax Group Hub"),
  logoStorageKey: text("logo_storage_key"), // Internal path in /uploads
  primaryColor: text("primary_color").notNull().default("#3b82f6"), // Default tailwind blue-500
  customDomain: text("custom_domain"), // Optional custom domain for white-label
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TenantBranding = typeof tenantBrandingTable.$inferSelect;
export const insertTenantBrandingSchema = createInsertSchema(
  tenantBrandingTable,
).omit({ id: true, createdAt: true, updatedAt: true });

/**
 * Integration execution logs — tracks every inbound/outbound integration event.
 * Payload previews are truncated and must never contain secrets/tokens.
 */
export const integrationLogsTable = pgTable("integration_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  integrationKey: text("integration_key").notNull(), // 'make' | 'webhooks' | 'whatsapp' | 'canva' | etc
  integrationName: text("integration_name").notNull(),
  eventType: text("event_type").notNull(), // 'lead.created' | 'webhook.received' | 'integration.tested' etc
  direction: text("direction").notNull().default("outbound"), // 'inbound' | 'outbound'
  status: text("status").notNull().default("pending"), // 'success' | 'error' | 'pending' | 'ignored'
  durationMs: integer("duration_ms"),
  httpStatus: integer("http_status"),
  requestUrl: text("request_url"), // masked: show domain only, no secrets in query params
  requestMethod: text("request_method").default("POST"),
  payloadPreview: text("payload_preview"), // truncated JSON, no secrets
  errorMessage: text("error_message"),
  technicalDetails: text("technical_details"),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type IntegrationLog = typeof integrationLogsTable.$inferSelect;
export const insertIntegrationLogSchema = createInsertSchema(
  integrationLogsTable,
).omit({ id: true, createdAt: true });

/**
 * Registra cada execução de pipeline multi-agente (/automate/pipeline)
 * para analytics e auditoria de uso.
 */
export const pipelineExecutionsTable = pgTable("pipeline_executions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  steps: jsonb("steps").notNull().$type<
    Array<{
      agentId: string;
      input: string;
      output: string;
      tokensUsed: number;
      timeMs: number;
      success: boolean;
    }>
  >(),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalTimeMs: integer("total_time_ms").notNull().default(0),
  status: text("status").notNull().default("completed"), // 'completed' | 'partial' | 'failed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PipelineExecution = typeof pipelineExecutionsTable.$inferSelect;
export const insertPipelineExecutionSchema = createInsertSchema(
  pipelineExecutionsTable,
).omit({ id: true, createdAt: true });
export type InsertPipelineExecution = z.infer<
  typeof insertPipelineExecutionSchema
>;

/**
 * Tracking de performance do conteúdo gerado pelos agentes de marketing.
 * Permite medir ROI real do conteúdo (impressões → cliques → conversões).
 */
export const contentPerformanceTable = pgTable("content_performance", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"),
  channel: text("channel").notNull(), // 'linkedin' | 'email' | 'whatsapp' | 'video' | 'seo'
  contentType: text("content_type").notNull(), // 'post' | 'email' | 'script' | 'one-pager' | 'article'
  generatedContent: text("generated_content").notNull(),
  publishedAt: timestamp("published_at"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  score: integer("score"), // 1-10, avaliação manual
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ContentPerformance = typeof contentPerformanceTable.$inferSelect;
export const insertContentPerformanceSchema = createInsertSchema(
  contentPerformanceTable,
).omit({ id: true, createdAt: true });
export type InsertContentPerformance = z.infer<
  typeof insertContentPerformanceSchema
>;

/**
 * User feedback on individual AI responses — thumbs up/down + optional reason.
 * messageId references messagesTable but is stored as integer (not FK) to avoid
 * cascade complexity when messages are deleted.
 */
export const aiResponseFeedbackTable = pgTable("ai_response_feedback", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  conversationId: integer("conversation_id").notNull(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"),
  rating: integer("rating").notNull(), // 1 = thumbs up, -1 = thumbs down
  reason: text("reason"), // 'wrong_info' | 'incomplete' | 'hallucination' | 'off_topic' | 'great'
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiResponseFeedback = typeof aiResponseFeedbackTable.$inferSelect;
export const insertAiResponseFeedbackSchema = createInsertSchema(
  aiResponseFeedbackTable,
).omit({ id: true, createdAt: true });
export type InsertAiResponseFeedback = z.infer<
  typeof insertAiResponseFeedbackSchema
>;

/**
 * Test cases for regression testing agent responses.
 * expectedSources: list of filenames expected in RAG context.
 */
export const aiTestCasesTable = pgTable("ai_test_cases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"),
  question: text("question").notNull(),
  expectedAnswer: text("expected_answer"),
  expectedSources: jsonb("expected_sources").$type<string[]>(),
  criteria: text("criteria"), // free-text evaluation criteria
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiTestCase = typeof aiTestCasesTable.$inferSelect;
export const insertAiTestCaseSchema = createInsertSchema(aiTestCasesTable).omit(
  { id: true, createdAt: true },
);
export type InsertAiTestCase = z.infer<typeof insertAiTestCaseSchema>;

/**
 * Execution log for each test case run — supports model comparison.
 */
export const aiTestRunsTable = pgTable("ai_test_runs", {
  id: serial("id").primaryKey(),
  testCaseId: integer("test_case_id")
    .notNull()
    .references(() => aiTestCasesTable.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'running' | 'passed' | 'failed' | 'error'
  score: integer("score"), // 0-100 manual or automated score
  response: text("response"),
  ragSources: jsonb("rag_sources").$type<string[]>(),
  latencyMs: integer("latency_ms"),
  tokensUsed: integer("tokens_used"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiTestRun = typeof aiTestRunsTable.$inferSelect;
export const insertAiTestRunSchema = createInsertSchema(aiTestRunsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiTestRun = z.infer<typeof insertAiTestRunSchema>;
