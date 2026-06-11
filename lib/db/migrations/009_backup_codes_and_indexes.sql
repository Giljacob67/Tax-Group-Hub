-- =====================================================
-- Migration 009: Backup codes + FK indexes + indexes
-- Data: 2026-06-11
-- =====================================================

-- 1. Adicionar coluna backup_codes na tabela app_users (2FA)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS backup_codes jsonb;

-- 2. Índices FK para messages (performance de JOINs)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- 3. Índices FK para knowledge_chunks (performance de queries por documento)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);

-- 4. Índices FK para crm_deals (performance de JOINs com contacts)
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact_id ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_assigned_to ON crm_deals(assigned_to);

-- 5. Índices FK para crm_activities (performance de timeline)
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal_id ON crm_activities(deal_id);

-- 6. Índices FK para crm_tasks (performance de filtros)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact_id ON crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_deal_id ON crm_tasks(deal_id);
