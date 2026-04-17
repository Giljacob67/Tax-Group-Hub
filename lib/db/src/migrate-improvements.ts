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

  console.log("\n🎉 Migração concluída com sucesso!");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Migração falhou:", err);
  process.exit(1);
});
