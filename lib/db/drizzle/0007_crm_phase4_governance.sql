-- CRM Phase 4: Governança, Dashboards, Rastreabilidade
-- Migration 0007

-- ─── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm_audit_log" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "actor_id" text,
  "actor_type" text NOT NULL DEFAULT 'user',
  "entity_type" text NOT NULL,
  "entity_id" integer NOT NULL,
  "action" text NOT NULL,
  "field_name" text,
  "old_value" text,
  "new_value" text,
  "context" jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "crm_audit_user_idx" ON "crm_audit_log" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "crm_audit_entity_idx" ON "crm_audit_log" ("entity_type", "entity_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "crm_audit_action_idx" ON "crm_audit_log" ("user_id", "action", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "crm_audit_actor_idx" ON "crm_audit_log" ("actor_id", "actor_type", "created_at" DESC);

-- ─── App User Roles (RBAC) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_user_roles" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "scope" text,
  "granted_by" text,
  "granted_at" timestamp NOT NULL DEFAULT NOW(),
  "expires_at" timestamp,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "role", "scope")
);
CREATE INDEX IF NOT EXISTS "app_user_roles_user_idx" ON "app_user_roles" ("user_id", "is_active");
