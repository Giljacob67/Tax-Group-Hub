import { pgTable, text, serial, timestamp, integer, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./agents.js";

export const crmContactsTable = pgTable("crm_contacts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  cnpj: text("cnpj").notNull(),
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
  contatoDecisor: text("contato_decisor"),
  influenciadores: jsonb("influenciadores").$type<Array<{ nome: string; cargo?: string; influencia?: string }>>(),
  socios: jsonb("socios").$type<Array<{ nome: string; cpf?: string; participacao?: string }>>(),
  source: text("source").notNull().default("manual"), // 'manual' | 'empresaqui' | 'webhook' | 'import'
  origemLead: text("origem_lead"), // 'manual' | 'indicacao' | 'site' | 'linkedin' | 'eventos' | 'outbound' | 'parceiro'
  loteProspeccao: text("lote_prospeccao"),
  tags: jsonb("tags").$type<string[]>(),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  status: text("status").notNull().default("nao_iniciado"),
  setor: text("setor"),
  segmento: text("segmento"),
  temperatura: text("temperatura"), // 'frio' | 'morno' | 'quente' | 'burning'
  dorComercialPercebida: text("dor_comercial_percebida"),
  produtoInteresse: text("produto_interesse"),
  valorPotencial: text("valor_potencial"),
  responsavelUnidade: text("responsavel_unidade"),
  ultimaInteracao: timestamp("ultima_interacao"),
  proximoFollowup: timestamp("proximo_followup"),
  pendenciasCliente: text("pendencias_cliente"),
  pendenciasUnidade: text("pendencias_unidade"),
  pendenciasMatriz: text("pendencias_matriz"),
  observacoes: text("observacoes"),
  aiScore: integer("ai_score"),
  prioridadeComercial: text("prioridade_comercial"), // 'baixa' | 'media' | 'alta' | 'critica' (Phase 3)
  proximoPassoRecomendado: jsonb("proximo_passo_recomendado").$type<Record<string, any>>(), // Phase 3
  aiScoreDetails: jsonb("ai_score_details"),
  aiRecommendedProduct: text("ai_recommended_product"),
  empresaquiId: text("empresaqui_id"),
  hubspotId: text("hubspot_id"),
  lastEnrichedAt: timestamp("last_enriched_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("crm_contacts_user_cnpj_idx").on(t.userId, t.cnpj)]);

export const insertCrmContactSchema = createInsertSchema(crmContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CrmContact = typeof crmContactsTable.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;

export const crmPipelinesTable = pgTable("crm_pipelines", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  stages: jsonb("stages").$type<string[]>().notNull(), // ex: ["prospecting", "discovery", "proposal", "won"]
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCrmPipelineSchema = createInsertSchema(crmPipelinesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CrmPipeline = typeof crmPipelinesTable.$inferSelect;
export type InsertCrmPipeline = z.infer<typeof insertCrmPipelineSchema>;

export const crmDealsTable = pgTable("crm_deals", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  pipelineId: text("pipeline_id").notNull().default("default"),
  title: text("title").notNull(),
  produto: text("produto"),
  stage: text("stage").notNull().default("qualificacao_comercial"),
  value: text("value"),
  probability: integer("probability").default(0),
  expectedCloseDate: timestamp("expected_close_date"),
  origem: text("origem"),
  resumoDiagnosticoComercial: text("resumo_diagnostico_comercial"),
  briefingMatriz: text("briefing_matriz"),
  dataEnvioMatriz: timestamp("data_envio_matriz"),
  responsavelEnvioMatriz: text("responsavel_envio_matriz"),
  documentosEnviados: jsonb("documentos_enviados").$type<string[]>(),
  prazoRetornoMatriz: timestamp("prazo_retorno_matriz"),
  statusMatriz: text("status_matriz").notNull().default("nao_enviado"),
  retornoMatriz: text("retorno_matriz"),
  dataRetornoMatriz: timestamp("data_retorno_matriz"),
  pendenciasMatriz: text("pendencias_matriz"),
  statusProposta: text("status_proposta"),
  motivoPerda: text("motivo_perda"),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  lostReason: text("lost_reason"),
  wonAt: timestamp("won_at"),
  lostAt: timestamp("lost_at"),
  assignedTo: text("assigned_to"),
  hubspotId: text("hubspot_id"),
  notes: text("notes"),
  observacoesNegociacao: text("observacoes_negociacao"),
  conversationId: integer("conversation_id").references(() => conversationsTable.id, { onDelete: "set null" }),
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
  hubspotId: text("hubspot_id"),
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

export const crmAttachmentsTable = pgTable("crm_attachments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => crmDealsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // bytes
  mimeType: text("mime_type").notNull(), // application/pdf, image/png, etc
  url: text("url").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmAttachmentSchema = createInsertSchema(crmAttachmentsTable).omit({ id: true, createdAt: true });
export type CrmAttachment = typeof crmAttachmentsTable.$inferSelect;
export type InsertCrmAttachment = z.infer<typeof insertCrmAttachmentSchema>;

// ─── Tasks (Phase 3) ──────────────────────────────────────────────────────────
export const crmTasksTable = pgTable("crm_tasks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").references(() => crmContactsTable.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => crmDealsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("note"), // 'call' | 'email' | 'whatsapp' | 'meeting' | 'proposal' | 'note'
  priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high' | 'urgent'
  status: text("status").notNull().default("pending"), // 'pending' | 'done' | 'snoozed' | 'cancelled'
  source: text("source").notNull().default("manual"), // 'manual' | 'automation' | 'ai_suggestion' | 'next_step'
  sourceRef: text("source_ref"), // e.g. automation id, next-step action
  dueDate: timestamp("due_date"),
  reminderAt: timestamp("reminder_at"),
  assignedTo: text("assigned_to"),
  completedAt: timestamp("completed_at"),
  conversationId: integer("conversation_id").references(() => conversationsTable.id, { onDelete: "set null" }),
  hubspotId: text("hubspot_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCrmTaskSchema = createInsertSchema(crmTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CrmTask = typeof crmTasksTable.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;

// ─── Qualification History (Phase 3) ──────────────────────────────────────────
// Histórico de qualificações IA — cada execução gera um registro.
// Permite reprocessar e auditar decisões de IA.
export const crmQualificationHistoryTable = pgTable("crm_qualification_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  score: integer("score"),
  tier: text("tier"), // 'A' | 'B' | 'C' | 'D'
  confidence: integer("confidence"), // 0-100
  result: jsonb("result").$type<Record<string, any>>().notNull(), // QualificationResult completo
  agentId: text("agent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmQualificationHistorySchema = createInsertSchema(crmQualificationHistoryTable).omit({ id: true, createdAt: true });
export type CrmQualificationHistory = typeof crmQualificationHistoryTable.$inferSelect;
export type InsertCrmQualificationHistory = z.infer<typeof insertCrmQualificationHistorySchema>;

// ─── Alerts (Phase 3) ────────────────────────────────────────────────────────
// Alertas comerciais persistíveis. Severidade: 'info' | 'warning' | 'critical'
export const crmAlertsTable = pgTable("crm_alerts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").references(() => crmContactsTable.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => crmDealsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // AlertType
  severity: text("severity").notNull().default("warning"),
  title: text("title").notNull(),
  description: text("description"),
  context: jsonb("context").$type<Record<string, any>>(), // dados do alerta
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmAlertSchema = createInsertSchema(crmAlertsTable).omit({ id: true, createdAt: true });
export type CrmAlert = typeof crmAlertsTable.$inferSelect;
export type InsertCrmAlert = z.infer<typeof insertCrmAlertSchema>;

// ─── Next Step History (Phase 3) ──────────────────────────────────────────────
// Histórico de sugestões de próximo passo. Pode ser usado para treinar modelos
// ou auditar a coerência do motor de recomendação.
export const crmNextStepHistoryTable = pgTable("crm_next_step_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => crmDealsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // NextStepAction
  reason: text("reason").notNull(),
  priority: text("priority").notNull(),
  accepted: boolean("accepted"), // null = pendente, true = aceito, false = ignorado
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmNextStepHistorySchema = createInsertSchema(crmNextStepHistoryTable).omit({ id: true, createdAt: true });
export type CrmNextStepHistory = typeof crmNextStepHistoryTable.$inferSelect;
export type InsertCrmNextStepHistory = z.infer<typeof insertCrmNextStepHistorySchema>;

// ─── Saved Views (Phase 2+) ──────────────────────────────────────────────────
export const crmSavedViewsTable = pgTable("crm_saved_views", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").default("📋"),
  filters: jsonb("filters").$type<Record<string, any>>().notNull().default({}),
  type: text("type").notNull().default("user"), // 'system' | 'user'
  isSystem: boolean("is_system").default(false),
  category: text("category"), // 'operacional' | 'pipeline' | 'matriz' | 'followup' | 'segmento'
  isDefault: boolean("is_default").default(false),
  sortField: text("sort_field"),
  sortDir: text("sort_dir"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const crmAutomationsTable = pgTable("crm_automations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // 'status_changed', 'score_above', 'score_below'
  triggerValue: text("trigger_value").notNull(), // e.g. 'lost', '80'
  actionType: text("action_type").notNull(), // 'create_task', 'log_activity'
  actionPayload: jsonb("action_payload"), // details of the task or activity
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});


export const insertCrmSavedViewSchema = createInsertSchema(crmSavedViewsTable).omit({ id: true, createdAt: true });
export type CrmSavedView = typeof crmSavedViewsTable.$inferSelect;
export type InsertCrmSavedView = z.infer<typeof insertCrmSavedViewSchema>;

// ─── Automation Sequences ─────────────────────────────────────────────────────

export type SequenceStep = {
  day: number;                                          // delay em dias a partir do enrollment (0 = imediato)
  channel: "whatsapp" | "email" | "internal_note";
  agentId: string;                                      // agente que gera o conteúdo
  inputTemplate: string;                                // suporta {{contact_name}}, {{razao_social}}, {{product}}, {{cnpj}}
};

export const automationSequencesTable = pgTable("automation_sequences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),        // 'contact_created' | 'deal_stage_changed' | 'score_above' | 'manual'
  triggerValue: text("trigger_value"),        // ex: 'prospecting' | '60'
  isActive: boolean("is_active").default(true),
  steps: jsonb("steps").$type<SequenceStep[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAutomationSequenceSchema = createInsertSchema(automationSequencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type AutomationSequence = typeof automationSequencesTable.$inferSelect;
export type InsertAutomationSequence = z.infer<typeof insertAutomationSequenceSchema>;

export const sequenceEnrollmentsTable = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull().references(() => automationSequencesTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => crmContactsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  currentStep: integer("current_step").notNull().default(0),
  nextSendAt: timestamp("next_send_at").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'paused' | 'completed' | 'cancelled'
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertSequenceEnrollmentSchema = createInsertSchema(sequenceEnrollmentsTable).omit({ id: true, enrolledAt: true });
export type SequenceEnrollment = typeof sequenceEnrollmentsTable.$inferSelect;
export type InsertSequenceEnrollment = z.infer<typeof insertSequenceEnrollmentSchema>;

// ─── HubSpot Sync State ────────────────────────────────────────────────────────

export const hubspotSyncStateTable = pgTable("hubspot_sync_state", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  objectType: text("object_type").notNull(), // 'companies' | 'contacts' | 'deals' | 'notes' | 'tasks'
  lastPolledAt: timestamp("last_polled_at").notNull().defaultNow(),
  lastUpdatedId: text("last_updated_id"),
  cursorData: text("cursor_data"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("hs_sync_state_user_object_idx").on(t.userId, t.objectType),
]);

export const hubspotListMappingTable = pgTable("hubspot_list_mapping", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  tagName: text("tag_name").notNull(),
  hubspotListId: text("hubspot_list_id").notNull(),
  direction: text("direction").notNull().default("bidirectional"), // 'to_hubspot' | 'from_hubspot' | 'bidirectional'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("hs_list_map_user_tag_idx").on(t.userId, t.tagName),
]);
