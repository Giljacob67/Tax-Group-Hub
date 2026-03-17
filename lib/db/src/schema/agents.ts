import { pgTable, text, serial, timestamp, integer, jsonb, boolean, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  title: text("title").notNull().default("Nova Conversa"),
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
