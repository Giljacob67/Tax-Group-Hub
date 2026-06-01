-- 0000_init.sql
-- Initial consolidated schema for Tax Group Hub.
-- Generated from src/schema/*.ts. Idempotent: safe to re-run on a fresh DB.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── agents (conversations, messages, knowledge, app config) ─────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id            SERIAL PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  user_id       TEXT,
  title         TEXT NOT NULL DEFAULT 'Nova Conversa',
  model         TEXT,
  provider      TEXT,
  connection_id INTEGER,
  platform      TEXT DEFAULT 'web',
  external_id   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations (user_id);
CREATE INDEX IF NOT EXISTS conversations_platform_external_idx ON conversations (platform, external_id);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (conversation_id);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id                SERIAL PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  user_id           TEXT,
  filename          TEXT NOT NULL,
  file_type         TEXT NOT NULL,
  file_size         INTEGER NOT NULL,
  storage_key       TEXT NOT NULL,
  extracted_content TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  processed         BOOLEAN NOT NULL DEFAULT FALSE,
  retries           INTEGER NOT NULL DEFAULT 0,
  error_log         TEXT,
  category          TEXT,
  product           TEXT,
  origin            TEXT DEFAULT 'upload',
  tags              JSONB,
  valid_until       TIMESTAMP,
  priority          INTEGER DEFAULT 5,
  chunk_count       INTEGER DEFAULT 0,
  embedding_model   TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS knowledge_documents_user_idx ON knowledge_documents (user_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_status_idx ON knowledge_documents (status);
CREATE INDEX IF NOT EXISTS knowledge_documents_agent_idx ON knowledge_documents (agent_id);

CREATE TABLE IF NOT EXISTS design_gallery (
  id         SERIAL PRIMARY KEY,
  agent_id   TEXT NOT NULL DEFAULT 'global',
  user_id    TEXT,
  image_url  TEXT NOT NULL,
  prompt     TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   VECTOR(768),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_idx ON knowledge_chunks (document_id);

CREATE TABLE IF NOT EXISTS embedding_cache (
  id         SERIAL PRIMARY KEY,
  text_hash  TEXT NOT NULL UNIQUE,
  embedding  VECTOR(768) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS embedding_cache_created_idx ON embedding_cache (created_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id         SERIAL PRIMARY KEY,
  provider   TEXT NOT NULL,
  key        TEXT NOT NULL,
  user_id    TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_keys_user_provider_idx ON api_keys (user_id, provider);

CREATE TABLE IF NOT EXISTS channel_configs (
  id          SERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  external_id TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  user_id     TEXT,
  config      JSONB,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS channel_configs_lookup_idx ON channel_configs (platform, external_id);

CREATE TABLE IF NOT EXISTS usage_logs (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT,
  conversation_id   INTEGER,
  agent_id          TEXT,
  connection_id     INTEGER,
  model             TEXT,
  provider          TEXT,
  usage_type        TEXT DEFAULT 'chat',
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  cost              INTEGER,
  latency_ms        INTEGER,
  platform          TEXT NOT NULL DEFAULT 'web',
  success           BOOLEAN NOT NULL DEFAULT TRUE,
  error_message     TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS usage_logs_user_idx ON usage_logs (user_id);
CREATE INDEX IF NOT EXISTS usage_logs_created_idx ON usage_logs (created_at);

CREATE TABLE IF NOT EXISTS tenant_branding (
  id               SERIAL PRIMARY KEY,
  user_id          TEXT UNIQUE,
  company_name     TEXT NOT NULL DEFAULT 'Tax Group Hub',
  logo_storage_key TEXT,
  primary_color    TEXT NOT NULL DEFAULT '#3b82f6',
  custom_domain    TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_logs (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT,
  integration_key   TEXT NOT NULL,
  integration_name  TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  direction         TEXT NOT NULL DEFAULT 'outbound',
  status            TEXT NOT NULL DEFAULT 'pending',
  duration_ms       INTEGER,
  http_status       INTEGER,
  request_url       TEXT,
  request_method    TEXT DEFAULT 'POST',
  payload_preview   TEXT,
  error_message     TEXT,
  technical_details TEXT,
  correlation_id    TEXT NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS integration_logs_user_idx ON integration_logs (user_id);
CREATE INDEX IF NOT EXISTS integration_logs_created_idx ON integration_logs (created_at);

CREATE TABLE IF NOT EXISTS pipeline_executions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT,
  steps        JSONB NOT NULL DEFAULT '[]',
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_time_ms INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'completed',
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_performance (
  id                SERIAL PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  user_id           TEXT,
  channel           TEXT NOT NULL,
  content_type      TEXT NOT NULL,
  generated_content TEXT NOT NULL,
  published_at      TIMESTAMP,
  impressions       INTEGER DEFAULT 0,
  clicks            INTEGER DEFAULT 0,
  conversions       INTEGER DEFAULT 0,
  score             INTEGER,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_response_feedback (
  id              SERIAL PRIMARY KEY,
  message_id      INTEGER NOT NULL,
  conversation_id INTEGER NOT NULL,
  agent_id        TEXT NOT NULL,
  user_id         TEXT,
  rating          INTEGER NOT NULL,
  reason          TEXT,
  comment         TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_response_feedback_conv_idx ON ai_response_feedback (conversation_id);

CREATE TABLE IF NOT EXISTS ai_test_cases (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  user_id         TEXT,
  question        TEXT NOT NULL,
  expected_answer TEXT,
  expected_sources JSONB,
  criteria        TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_test_runs (
  id           SERIAL PRIMARY KEY,
  test_case_id INTEGER NOT NULL REFERENCES ai_test_cases(id) ON DELETE CASCADE,
  model        TEXT NOT NULL,
  provider     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  score        INTEGER,
  response     TEXT,
  rag_sources  JSONB,
  latency_ms   INTEGER,
  tokens_used  INTEGER,
  notes        TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_test_runs_test_idx ON ai_test_runs (test_case_id);

-- ─── crm ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_contacts (
  id                     SERIAL PRIMARY KEY,
  user_id                TEXT NOT NULL,
  cnpj                   TEXT NOT NULL,
  razao_social           TEXT,
  nome_fantasia          TEXT,
  regime_tributario      TEXT,
  cnae                   TEXT,
  faturamento_estimado   TEXT,
  porte                  TEXT,
  uf                     TEXT,
  cidade                 TEXT,
  endereco               TEXT,
  cep                    TEXT,
  telefone               TEXT,
  email                  TEXT,
  website                TEXT,
  nome_decissor          TEXT,
  cargo_decissor         TEXT,
  socios                 JSONB,
  source                 TEXT NOT NULL DEFAULT 'manual',
  tags                   JSONB,
  custom_fields          JSONB,
  status                 TEXT NOT NULL DEFAULT 'prospect',
  ai_score               INTEGER,
  ai_score_details       JSONB,
  ai_recommended_product TEXT,
  empresaqui_id          TEXT,
  last_enriched_at       TIMESTAMP,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);
-- Drizzle generates the index name `crm_contacts_user_cnpj_idx` from the
-- schema declaration; keep the manual script aligned with that name.
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_user_cnpj_idx
  ON crm_contacts (user_id, cnpj);
CREATE INDEX IF NOT EXISTS crm_contacts_user_idx ON crm_contacts (user_id);
CREATE INDEX IF NOT EXISTS crm_contacts_status_idx ON crm_contacts (status);

CREATE TABLE IF NOT EXISTS crm_pipelines (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  stages     JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id                  SERIAL PRIMARY KEY,
  contact_id          INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  pipeline_id         TEXT NOT NULL DEFAULT 'default',
  title               TEXT NOT NULL,
  produto             TEXT,
  stage               TEXT NOT NULL DEFAULT 'prospecting',
  value               TEXT,
  probability         INTEGER DEFAULT 0,
  expected_close_date TIMESTAMP,
  custom_fields       JSONB,
  lost_reason         TEXT,
  won_at              TIMESTAMP,
  lost_at             TIMESTAMP,
  assigned_to         TEXT,
  notes               TEXT,
  conversation_id     INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_deals_user_idx ON crm_deals (user_id);
CREATE INDEX IF NOT EXISTS crm_deals_contact_idx ON crm_deals (contact_id);

CREATE TABLE IF NOT EXISTS crm_activities (
  id              SERIAL PRIMARY KEY,
  contact_id      INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  deal_id         INTEGER REFERENCES crm_deals(id) ON DELETE SET NULL,
  user_id         TEXT NOT NULL,
  type            TEXT NOT NULL,
  direction       TEXT,
  subject         TEXT,
  content         TEXT,
  scheduled_at    TIMESTAMP,
  completed_at    TIMESTAMP,
  agent_id        TEXT,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_activities_user_idx ON crm_activities (user_id);

CREATE TABLE IF NOT EXISTS crm_enrichment_log (
  id             SERIAL PRIMARY KEY,
  contact_id     INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  source         TEXT NOT NULL,
  raw_data       JSONB,
  fields_updated JSONB,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_attachments (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  contact_id  INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  deal_id     INTEGER REFERENCES crm_deals(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_size   BIGINT,
  mime_type   TEXT NOT NULL,
  url         TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_attachments_user_idx ON crm_attachments (user_id);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  contact_id      INTEGER REFERENCES crm_contacts(id) ON DELETE CASCADE,
  deal_id         INTEGER REFERENCES crm_deals(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'note',
  priority        TEXT NOT NULL DEFAULT 'medium',
  status          TEXT NOT NULL DEFAULT 'pending',
  due_date        TIMESTAMP,
  reminder_at     TIMESTAMP,
  assigned_to     TEXT,
  completed_at    TIMESTAMP,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_tasks_user_idx ON crm_tasks (user_id);
CREATE INDEX IF NOT EXISTS crm_tasks_status_idx ON crm_tasks (status);

CREATE TABLE IF NOT EXISTS crm_saved_views (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT DEFAULT '📋',
  filters    JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  sort_field TEXT,
  sort_dir   TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_automations (
  id             SERIAL PRIMARY KEY,
  user_id        TEXT NOT NULL,
  name           TEXT NOT NULL,
  trigger_type   TEXT NOT NULL,
  trigger_value  TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  action_payload JSONB,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_sequences (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  trigger       TEXT NOT NULL,
  trigger_value TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  steps         JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id           SERIAL PRIMARY KEY,
  sequence_id  INTEGER NOT NULL REFERENCES automation_sequences(id) ON DELETE CASCADE,
  contact_id   INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMP NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  enrolled_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sequence_enrollments_due_idx
  ON sequence_enrollments (next_send_at) WHERE status = 'active';

-- ─── llm (Model Hub) ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS llm_connections (
  id                   SERIAL PRIMARY KEY,
  user_id              TEXT,
  name                 TEXT NOT NULL,
  provider             TEXT NOT NULL,
  base_url             TEXT,
  api_key              TEXT NOT NULL,
  model_id             TEXT NOT NULL,
  model_name           TEXT,
  context_window       INTEGER,
  max_tokens           INTEGER,
  supports_vision      BOOLEAN DEFAULT FALSE,
  supports_tools       BOOLEAN DEFAULT FALSE,
  supports_json        BOOLEAN DEFAULT FALSE,
  price_input          TEXT,
  price_output         TEXT,
  price_per_1m_input   INTEGER,
  price_per_1m_output  INTEGER,
  provider_metadata    JSONB,
  usage_type           TEXT NOT NULL DEFAULT 'chat',
  is_default           BOOLEAN DEFAULT FALSE,
  is_active            BOOLEAN DEFAULT TRUE,
  last_tested_at       TIMESTAMP,
  last_test_status     TEXT DEFAULT 'untested',
  last_error           TEXT,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS llm_connections_user_usage_idx
  ON llm_connections (user_id, usage_type, is_active);
CREATE INDEX IF NOT EXISTS llm_connections_default_idx
  ON llm_connections (user_id, usage_type) WHERE is_default IS TRUE;

CREATE TABLE IF NOT EXISTS llm_profiles (
  id                       SERIAL PRIMARY KEY,
  user_id                  TEXT NOT NULL,
  name                     TEXT NOT NULL,
  description              TEXT,
  chat_connection_id       INTEGER,
  fast_connection_id       INTEGER,
  reasoning_connection_id  INTEGER,
  vision_connection_id     INTEGER,
  embedding_connection_id  INTEGER,
  image_connection_id      INTEGER,
  transcription_connection_id INTEGER,
  is_default               BOOLEAN DEFAULT FALSE,
  is_active                BOOLEAN DEFAULT TRUE,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS llm_profiles_user_idx ON llm_profiles (user_id);

-- ─── deliverables ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliverables (
  id                  SERIAL PRIMARY KEY,
  user_id             TEXT,
  title               TEXT NOT NULL,
  type                TEXT NOT NULL,
  product             TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',
  confidence_level    TEXT NOT NULL DEFAULT 'none',
  contact_id          INTEGER REFERENCES crm_contacts(id) ON DELETE SET NULL,
  deal_id             INTEGER,
  model               TEXT,
  provider            TEXT,
  guardrail_warnings  JSONB,
  rag_source_count    INTEGER DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliverable_sections (
  id                SERIAL PRIMARY KEY,
  deliverable_id    INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  section_key       TEXT NOT NULL,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL DEFAULT '',
  "order"           INTEGER NOT NULL DEFAULT 0,
  confidence_level  TEXT NOT NULL DEFAULT 'none',
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deliverable_sections_deliv_idx
  ON deliverable_sections (deliverable_id, "order");
