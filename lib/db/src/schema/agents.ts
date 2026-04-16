import { pgTable, text, serial, timestamp, integer, jsonb, boolean, bigint, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"), 
  title: text("title").notNull().default("Nova Conversa"),
  model: text("model"),
  platform: text("platform").default("web"), // 'web' | 'whatsapp' | 'telegram'
  externalId: text("external_id"), // phone number or chat_id
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
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
  // --- Novos campos de classificação e RAG ---
  category: text("category"), // 'legislacao' | 'jurisprudencia' | 'manual' | 'material_interno'
  tags: jsonb("tags").$type<string[]>(), // ex: ["IBS", "CBS", "Split Payment"]
  validUntil: timestamp("valid_until"), // data de validade do documento
  priority: integer("priority").default(5), // boost no RAG (1-10)
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

export const insertDesignGallerySchema = createInsertSchema(designGalleryTable).omit({ id: true, createdAt: true });
export type DesignGalleryItem = typeof designGalleryTable.$inferSelect;
export type InsertDesignGalleryItem = z.infer<typeof insertDesignGallerySchema>;

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocumentsTable).omit({ id: true, createdAt: true });

export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type KnowledgeDocument = typeof knowledgeDocumentsTable.$inferSelect;
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;

export const knowledgeChunksTable = pgTable("knowledge_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunksTable).omit({ id: true, createdAt: true });
export type KnowledgeChunk = typeof knowledgeChunksTable.$inferSelect;
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;

/**
 * Embedding cache: avoids calling the embedding API for identical text chunks.
 * Key: MD5 hash of the text. Value: the embedding vector.
 */
export const embeddingCacheTable = pgTable("embedding_cache", {
  id: serial("id").primaryKey(),
  textHash: text("text_hash").notNull().unique(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
export const insertChannelConfigSchema = createInsertSchema(channelConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });

/**
 * Stores LLM metrics for analytics and billing.
 */
export const usageLogsTable = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  conversationId: integer("conversation_id"),
  agentId: text("agent_id"),
  model: text("model"),
  provider: text("provider"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  latencyMs: integer("latency_ms"),
  platform: text("platform").notNull().default("web"), // 'web' | 'whatsapp' | 'telegram' | 'automate'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UsageLog = typeof usageLogsTable.$inferSelect;
export const insertUsageLogSchema = createInsertSchema(usageLogsTable).omit({ id: true, createdAt: true });

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
export const insertTenantBrandingSchema = createInsertSchema(tenantBrandingTable).omit({ id: true, createdAt: true, updatedAt: true });

/**
 * Registra cada execução de pipeline multi-agente (/automate/pipeline)
 * para analytics e auditoria de uso.
 */
export const pipelineExecutionsTable = pgTable("pipeline_executions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  steps: jsonb("steps").notNull().$type<Array<{
    agentId: string;
    input: string;
    output: string;
    tokensUsed: number;
    timeMs: number;
    success: boolean;
  }>>(),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalTimeMs: integer("total_time_ms").notNull().default(0),
  status: text("status").notNull().default("completed"), // 'completed' | 'partial' | 'failed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PipelineExecution = typeof pipelineExecutionsTable.$inferSelect;
export const insertPipelineExecutionSchema = createInsertSchema(pipelineExecutionsTable).omit({ id: true, createdAt: true });
export type InsertPipelineExecution = z.infer<typeof insertPipelineExecutionSchema>;

/**
 * Tracking de performance do conteúdo gerado pelos agentes de marketing.
 * Permite medir ROI real do conteúdo (impressões → cliques → conversões).
 */
export const contentPerformanceTable = pgTable("content_performance", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"),
  channel: text("channel").notNull(),           // 'linkedin' | 'email' | 'whatsapp' | 'video' | 'seo'
  contentType: text("content_type").notNull(),  // 'post' | 'email' | 'script' | 'one-pager' | 'article'
  generatedContent: text("generated_content").notNull(),
  publishedAt: timestamp("published_at"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  score: integer("score"),                      // 1-10, avaliação manual
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ContentPerformance = typeof contentPerformanceTable.$inferSelect;
export const insertContentPerformanceSchema = createInsertSchema(contentPerformanceTable).omit({ id: true, createdAt: true });
export type InsertContentPerformance = z.infer<typeof insertContentPerformanceSchema>;

