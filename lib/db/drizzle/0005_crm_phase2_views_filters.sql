-- CRM Phase 2: System views, enhanced saved views, expanded filters
-- Migration 0005

-- Add type, isSystem, category columns to crm_saved_views
ALTER TABLE "crm_saved_views" ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'user';
ALTER TABLE "crm_saved_views" ADD COLUMN IF NOT EXISTS "is_system" boolean DEFAULT false;
ALTER TABLE "crm_saved_views" ADD COLUMN IF NOT EXISTS "category" text;

-- Index for quickly fetching system views per user
CREATE INDEX IF NOT EXISTS "crm_saved_views_user_type_idx" ON "crm_saved_views" ("user_id", "type");
