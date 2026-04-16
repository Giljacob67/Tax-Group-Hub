import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./agents.js";

export const crmContactsTable = pgTable("crm_contacts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  cnpj: text("cnpj").notNull(), // Deve ter unique constraint composto ou lidar via app
  razaoSocial: text("razao_social"),
  nomeFantasia: text("nome_fantasia"),
  regimeTributario: text("regime_tributario"), // 'lucro_real' | 'lucro_presumido' | 'simples' | 'mei'
  cnae: text("cnae"),
  faturamentoEstimado: text("faturamento_estimado"),
  porte: text("porte"),
  uf: text("uf"),
  cidade: text("cidade"),
  endereco: text("endereco"),
  cep: text("cep"),
  telefone: text("telefone"),
  email: text("email"),
  website: text("website"),
  nomeDecissor: text("nome_decissor"),
  cargoDecissor: text("cargo_decissor"),
  socios: jsonb("socios").$type<Array<{ nome: string; cpf?: string; participacao?: string }>>(),
  source: text("source").notNull().default("manual"), // 'manual' | 'empresaqui' | 'webhook' | 'import'
  tags: jsonb("tags").$type<string[]>(),
  status: text("status").notNull().default("prospect"), // 'prospect' | 'qualified' | 'opportunity' | 'client' | 'churned' | 'lost'
  aiScore: integer("ai_score"),
  aiScoreDetails: jsonb("ai_score_details"),
  aiRecommendedProduct: text("ai_recommended_product"),
  empresaquiId: text("empresaqui_id"),
  lastEnrichedAt: timestamp("last_enriched_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCrmContactSchema = createInsertSchema(crmContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CrmContact = typeof crmContactsTable.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;

export const crmDealsTable = pgTable("crm_deals", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  produto: text("produto"), // 'AFD' | 'REP' | 'RTI' | 'TTR' | 'PPS' | 'PSF' | 'DUE' | 'ROT' | 'outro'
  stage: text("stage").notNull().default("prospecting"), // 'prospecting' | 'discovery' | 'proposal' | 'negotiation' | 'closing' | 'won' | 'lost'
  value: text("value"), // string to handle currency/big numbers or simply descriptors
  probability: integer("probability").default(0),
  expectedCloseDate: timestamp("expected_close_date"),
  lostReason: text("lost_reason"),
  wonAt: timestamp("won_at"),
  lostAt: timestamp("lost_at"),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCrmDealSchema = createInsertSchema(crmDealsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CrmDeal = typeof crmDealsTable.$inferSelect;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;

export const crmActivitiesTable = pgTable("crm_activities", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => crmDealsTable.id, { onDelete: "set null" }),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // 'call' | 'email' | 'whatsapp' | 'linkedin' | 'meeting' | 'note' | 'ai_generated' | 'stage_change'
  direction: text("direction"), // 'inbound' | 'outbound' | null
  subject: text("subject"),
  content: text("content"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  agentId: text("agent_id"),
  conversationId: integer("conversation_id").references(() => conversationsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmActivitySchema = createInsertSchema(crmActivitiesTable).omit({ id: true, createdAt: true });
export type CrmActivity = typeof crmActivitiesTable.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;

export const crmEnrichmentLogTable = pgTable("crm_enrichment_log", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'empresaqui' | 'rfb' | 'manual'
  rawData: jsonb("raw_data"),
  fieldsUpdated: jsonb("fields_updated").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmEnrichmentLogSchema = createInsertSchema(crmEnrichmentLogTable).omit({ id: true, createdAt: true });
export type CrmEnrichmentLog = typeof crmEnrichmentLogTable.$inferSelect;
export type InsertCrmEnrichmentLog = z.infer<typeof insertCrmEnrichmentLogSchema>;
