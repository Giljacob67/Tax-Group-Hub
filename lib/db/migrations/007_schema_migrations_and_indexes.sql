-- Migration: Create schema_migrations tracking table + CRM indexes
-- Date: 2026-06-08

CREATE TABLE IF NOT EXISTS _schema_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_migrations_name ON _schema_migrations(name);

-- CRM indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_user_id ON crm_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_user_id ON crm_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user_id ON crm_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_qualification_history_contact ON crm_qualification_history(contact_id);

-- Sequence enrollments unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_seq_enrollment_seq_contact ON sequence_enrollments(sequence_id, contact_id);

-- HubSpot/Empresaqui sync indexes
CREATE INDEX IF NOT EXISTS idx_crm_contacts_hubspot_id ON crm_contacts(hubspot_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_empresaqui_id ON crm_contacts(empresaqui_id);
