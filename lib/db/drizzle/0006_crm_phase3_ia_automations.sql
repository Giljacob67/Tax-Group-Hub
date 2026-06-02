-- CRM Phase 3: IA, Automações, Alertas, Qualificação Estruturada
-- Migration 0006

-- Add prioridadeComercial + proximoPassoRecomendado to contacts
ALTER TABLE "crm_contacts" ADD COLUMN IF NOT EXISTS "prioridade_comercial" text;
ALTER TABLE "crm_contacts" ADD COLUMN IF NOT EXISTS "proximo_passo_recomendado" jsonb;

-- Add source + sourceRef to tasks
ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual';
ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "source_ref" text;

-- ─── Qualification History ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm_qualification_history" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "contact_id" integer NOT NULL REFERENCES "crm_contacts"("id") ON DELETE CASCADE,
  "score" integer,
  "tier" text,
  "confidence" integer,
  "result" jsonb NOT NULL,
  "agent_id" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "crm_qual_history_contact_idx" ON "crm_qualification_history" ("contact_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "crm_qual_history_user_idx" ON "crm_qualification_history" ("user_id", "created_at" DESC);

-- ─── Alerts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm_alerts" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "contact_id" integer REFERENCES "crm_contacts"("id") ON DELETE CASCADE,
  "deal_id" integer REFERENCES "crm_deals"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'warning',
  "title" text NOT NULL,
  "description" text,
  "context" jsonb,
  "is_resolved" boolean DEFAULT false,
  "resolved_at" timestamp,
  "resolved_by" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "crm_alerts_user_open_idx" ON "crm_alerts" ("user_id", "is_resolved", "severity", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "crm_alerts_contact_idx" ON "crm_alerts" ("contact_id");
CREATE INDEX IF NOT EXISTS "crm_alerts_deal_idx" ON "crm_alerts" ("deal_id");

-- ─── Next Step History ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm_next_step_history" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "contact_id" integer NOT NULL REFERENCES "crm_contacts"("id") ON DELETE CASCADE,
  "deal_id" integer REFERENCES "crm_deals"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "reason" text NOT NULL,
  "priority" text NOT NULL,
  "accepted" boolean,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "crm_next_step_history_contact_idx" ON "crm_next_step_history" ("contact_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "crm_next_step_history_user_idx" ON "crm_next_step_history" ("user_id", "created_at" DESC);
