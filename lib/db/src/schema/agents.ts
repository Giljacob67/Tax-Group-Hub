import { pgTable, text, serial, timestamp, integer, jsonb, boolean, bigint, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  userId: text("user_id"), // Added for future tenancy
  title: text("title").notNull().default("Nova Conversa"),
  model: text("model"),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const designGalleryTable = pgTable("design_gallery", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().default("global"),
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
