import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { crmContactsTable } from "./crm.js";

export const deliverablesTable = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  orgId: integer("org_id"),
  title: text("title").notNull(),
  // 'diagnostico' | 'proposta' | 'resumo_oportunidade' | 'followup' | 'roteiro_reuniao'
  type: text("type").notNull(),
  // 'RTI' | 'AFD' | 'REP' | 'reforma_tributaria' | 'comercial' | 'outro'
  product: text("product"),
  // 'draft' | 'review' | 'approved' | 'exported' | 'archived'
  status: text("status").notNull().default("draft"),
  // 'high' | 'medium' | 'low' | 'none'
  confidenceLevel: text("confidence_level").notNull().default("none"),
  contactId: integer("contact_id").references(() => crmContactsTable.id, {
    onDelete: "set null",
  }),
  dealId: integer("deal_id"),
  model: text("model"),
  provider: text("provider"),
  guardrailWarnings: jsonb("guardrail_warnings").$type<string[]>(),
  ragSourceCount: integer("rag_source_count").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliverableSectionsTable = pgTable("deliverable_sections", {
  id: serial("id").primaryKey(),
  deliverableId: integer("deliverable_id")
    .notNull()
    .references(() => deliverablesTable.id, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  order: integer("order").notNull().default(0),
  // 'high' | 'medium' | 'low' | 'none'
  confidenceLevel: text("confidence_level").notNull().default("none"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliverableSourcesTable = pgTable("deliverable_sources", {
  id: serial("id").primaryKey(),
  deliverableId: integer("deliverable_id")
    .notNull()
    .references(() => deliverablesTable.id, { onDelete: "cascade" }),
  sectionKey: text("section_key"),
  sourceTitle: text("source_title").notNull(),
  excerpt: text("excerpt"),
  similarityScore: integer("similarity_score"), // 0-100
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deliverableVersionsTable = pgTable("deliverable_versions", {
  id: serial("id").primaryKey(),
  deliverableId: integer("deliverable_id")
    .notNull()
    .references(() => deliverablesTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  sectionsSnapshot:
    jsonb("sections_snapshot").$type<
      Array<{ key: string; title: string; content: string }>
    >(),
  changedBy: text("changed_by"),
  changeSummary: text("change_summary"),
  model: text("model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Infer types
export type Deliverable = typeof deliverablesTable.$inferSelect;
export type DeliverableSection = typeof deliverableSectionsTable.$inferSelect;
export type DeliverableSource = typeof deliverableSourcesTable.$inferSelect;
export type DeliverableVersion = typeof deliverableVersionsTable.$inferSelect;

export const insertDeliverableSchema = createInsertSchema(
  deliverablesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;

export const insertDeliverableSectionSchema = createInsertSchema(
  deliverableSectionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliverableSection = z.infer<
  typeof insertDeliverableSectionSchema
>;
