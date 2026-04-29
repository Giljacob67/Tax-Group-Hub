/**
 * migrate-improvements.ts
 * Cria todas as novas tabelas e colunas da Fase 1 e Fase 2 do Tax Group Hub.
 * Execute: npx tsx lib/db/src/migrate-improvements.ts
 * Requer DATABASE_URL no ambiente.
 */
import { db } from "./index.js";
import { sql } from "drizzle-orm";

async function run() {
  console.log("🚀 Iniciando migração do Tax Group Hub...\n");

  // ─── 1. pipeline_executions ──────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pipeline_executions (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT,
      steps        JSONB NOT NULL DEFAULT '[]',
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_time_ms INTEGER NOT NULL DEFAULT 0,
      status       TEXT NOT NULL DEFAULT 'completed',
      created_at   TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  pipeline_executions");

  // ─── 2. content_performance ──────────────────────────────────────────────
  await db.execute(sql`
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
  `);
  console.log("✅  content_performance");

  // ─── 3. knowledge_documents — novos campos RAG ───────────────────────────
  const knowledgeCols = [
    ["category",    "TEXT"],
    ["tags",        "JSONB"],
    ["valid_until", "TIMESTAMP"],
    ["priority",    "INTEGER DEFAULT 5"],
  ];
  for (const [col, type] of knowledgeCols) {
    await db.execute(sql.raw(
      `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS ${col} ${type};`
    ));
    console.log(`✅  knowledge_documents.${col}`);
  }

  // ─── 4. crm_contacts ─────────────────────────────────────────────────────
  await db.execute(sql`
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
      status                 TEXT NOT NULL DEFAULT 'prospect',
      ai_score               INTEGER,
      ai_score_details       JSONB,
      ai_recommended_product TEXT,
      empresaqui_id          TEXT,
      last_enriched_at       TIMESTAMP,
      created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  crm_contacts");

  // Unique constraint composto (cnpj por tenant)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_cnpj_user_idx 
    ON crm_contacts (cnpj, user_id);
  `);
  console.log("✅  crm_contacts unique index (cnpj, user_id)");

  // ─── 5. crm_deals ────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_deals (
      id                  SERIAL PRIMARY KEY,
      contact_id          INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      user_id             TEXT NOT NULL,
      title               TEXT NOT NULL,
      produto             TEXT,
      stage               TEXT NOT NULL DEFAULT 'prospecting',
      value               TEXT,
      probability         INTEGER DEFAULT 0,
      expected_close_date TIMESTAMP,
      lost_reason         TEXT,
      won_at              TIMESTAMP,
      lost_at             TIMESTAMP,
      assigned_to         TEXT,
      notes               TEXT,
      created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  crm_deals");

  // ─── 6. crm_activities ───────────────────────────────────────────────────
  await db.execute(sql`
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
  `);
  console.log("✅  crm_activities");

  // ─── 7. crm_enrichment_log ───────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_enrichment_log (
      id              SERIAL PRIMARY KEY,
      contact_id      INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      source          TEXT NOT NULL,
      raw_data        JSONB,
      fields_updated  JSONB,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  crm_enrichment_log");

  // ─── 8. tenant_branding ────────────────────────────────────────────────
  await db.execute(sql`
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
  `);
  console.log("✅  tenant_branding");

  // ─── 8.1 API Keys & Channels ───────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS active_llm_settings (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL UNIQUE,
      provider   TEXT NOT NULL DEFAULT 'auto',
      custom_url TEXT,
      model      TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("active_llm_settings");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id         SERIAL PRIMARY KEY,
      provider   TEXT NOT NULL,
      key        TEXT NOT NULL,
      key_last4  TEXT,
      user_id    TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("api_keys");

  await db.execute(sql`
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_last4 TEXT;
  `);
  console.log("api_keys.key_last4");

  await db.execute(sql`
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
  `);
  console.log("✅  channel_configs");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id                SERIAL PRIMARY KEY,
      user_id           TEXT,
      conversation_id   INTEGER,
      agent_id          TEXT,
      model             TEXT,
      provider          TEXT,
      prompt_tokens     INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens      INTEGER NOT NULL DEFAULT 0,
      latency_ms        INTEGER,
      platform          TEXT NOT NULL DEFAULT 'web',
      created_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  usage_logs");

  // ─── 9. Phase 3: Novas Tabelas e Colunas CRM ──────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_pipelines (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      stages     JSONB NOT NULL,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  crm_pipelines");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_attachments (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      contact_id  INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      deal_id     INTEGER REFERENCES crm_deals(id) ON DELETE CASCADE,
      file_name   TEXT NOT NULL,
      file_size   INTEGER,
      mime_type   TEXT NOT NULL,
      url         TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  crm_attachments");

  await db.execute(sql.raw(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB;`));
  console.log("✅  crm_contacts.custom_fields");

  await db.execute(sql.raw(`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS custom_fields JSONB;`));
  await db.execute(sql.raw(`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS pipeline_id TEXT NOT NULL DEFAULT 'default';`));
  console.log("✅  crm_deals.custom_fields e pipeline_id");

  console.log("\n🎉 Migração concluída com sucesso!");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Migração falhou:", err);
  process.exit(1);
});
