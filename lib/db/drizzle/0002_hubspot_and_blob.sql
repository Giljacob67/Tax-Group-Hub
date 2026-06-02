-- 0002_hubspot_and_blob.sql
-- Idempotent. Adds columns + tables required by the HubSpot sync module
-- and Vercel Blob upload support that landed in the remote commits.

-- ─── CRM: hubspot_id columns on contacts / deals / activities / tasks ─────────
ALTER TABLE crm_contacts    ADD COLUMN IF NOT EXISTS hubspot_id TEXT;
ALTER TABLE crm_deals       ADD COLUMN IF NOT EXISTS hubspot_id TEXT;
ALTER TABLE crm_activities  ADD COLUMN IF NOT EXISTS hubspot_id TEXT;
ALTER TABLE crm_tasks       ADD COLUMN IF NOT EXISTS hubspot_id TEXT;
CREATE INDEX IF NOT EXISTS crm_contacts_hubspot_idx    ON crm_contacts (hubspot_id);
CREATE INDEX IF NOT EXISTS crm_deals_hubspot_idx       ON crm_deals (hubspot_id);
CREATE INDEX IF NOT EXISTS crm_activities_hubspot_idx  ON crm_activities (hubspot_id);
CREATE INDEX IF NOT EXISTS crm_tasks_hubspot_idx       ON crm_tasks (hubspot_id);

-- ─── knowledge_documents: blob_url + fileData + metadata for Vercel Blob ─────
ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS blob_url TEXT,
  ADD COLUMN IF NOT EXISTS blob_token TEXT,
  ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- ─── HubSpot sync state + list mapping tables ─────────────────────────────────
CREATE TABLE IF NOT EXISTS hubspot_sync_state (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  object_type     TEXT NOT NULL,
  last_polled_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  last_updated_id TEXT,
  cursor_data     TEXT,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS hs_sync_state_user_object_idx
  ON hubspot_sync_state (user_id, object_type);

CREATE TABLE IF NOT EXISTS hubspot_list_mapping (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  tag_name        TEXT NOT NULL,
  hubspot_list_id TEXT NOT NULL,
  direction       TEXT NOT NULL DEFAULT 'bidirectional',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS hs_list_map_user_tag_idx
  ON hubspot_list_mapping (user_id, tag_name);

-- ─── integration_logs: event payload blob (Vercel upload tokens) ─────────────
ALTER TABLE integration_logs
  ADD COLUMN IF NOT EXISTS payload JSONB;
