/**
 * migrate-multiusuario.ts
 * Fase 1 do redesenho multiusuário do Tax Group Hub.
 *
 * Move a fronteira de tenancy de `user_id` (string) para `org_id` (organização
 * compartilhada). Esta migração é EXPANSIVA e idempotente — apenas cria tabelas
 * e colunas e faz backfill. NÃO remove nada nem torna org_id NOT NULL (isso é
 * a Fase 5, depois que o código passar a escrever org_id em toda inserção).
 *
 * O que faz:
 *   1. Cria `organizations` e `organization_members`.
 *   2. Insere a organização única (id=1, "Tax Group — Maringá").
 *   3. Adiciona `org_id` (nullable) em todas as tabelas de tenant.
 *   4. Backfill `org_id = 1` em todas as linhas existentes.
 *   5. Semeia `organization_members` a partir de `app_users`, com papel
 *      dirigido por e-mail (admins definidos abaixo; demais = comercial).
 *
 * Execute: npx tsx lib/db/src/migrate-multiusuario.ts
 * Requer DATABASE_URL no ambiente.
 */
import { db } from "./index.js";
import { sql } from "drizzle-orm";

// E-mails com papel de admin na organização. Qualquer outro usuário entra
// como 'comercial'. (Fonte: 2 usuários cadastrados em 2026-06-17.)
const ADMIN_EMAILS = [
  "gilberto@jgggroup.com.br",
  "felipe@jgggroup.com.br",
];

const ORG_ID = 1;
const ORG_NAME = "Tax Group — Maringá";
const ORG_SLUG = "tax-group-maringa";

// Tabelas de tenant que recebem org_id e backfill = 1.
// NÃO inclui conversations/messages (permanecem privados por usuário),
// nem tabelas-filhas que derivam o tenant via FK (knowledge_chunks,
// embedding_cache, ai_test_runs, deliverable_sections/sources/versions,
// crm_enrichment_log).
const TENANT_TABLES = [
  // crm.ts
  "crm_contacts",
  "crm_pipelines",
  "crm_deals",
  "crm_activities",
  "crm_attachments",
  "crm_tasks",
  "crm_qualification_history",
  "crm_alerts",
  "crm_next_step_history",
  "crm_saved_views",
  "crm_automations",
  "automation_sequences",
  "sequence_enrollments",
  "hubspot_sync_state",
  "hubspot_list_mapping",
  "crm_audit_log",
  // agents.ts
  "knowledge_documents",
  "design_gallery",
  "api_keys",
  "channel_configs",
  "usage_logs",
  "tenant_branding",
  "integration_logs",
  "pipeline_executions",
  "content_performance",
  "ai_response_feedback",
  "ai_test_cases",
  // llm.ts
  "llm_connections",
  "llm_profiles",
  // deliverables.ts
  "deliverables",
];

async function tableExists(name: string): Promise<boolean> {
  const res = await db.execute(
    sql`SELECT to_regclass(${"public." + name}) AS reg;`,
  );
  // drizzle/neon retorna { rows: [...] }
  const rows = (res as any).rows ?? res;
  const reg = Array.isArray(rows) ? rows[0]?.reg : undefined;
  return reg != null;
}

async function run() {
  console.log("🚀 Fase 1 — redesenho multiusuário (org-scoped)\n");

  // ─── 1. organizations ────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      is_active  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✅  organizations");

  // ─── 2. organization_members ─────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organization_members (
      id         SERIAL PRIMARY KEY,
      org_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'comercial',
      is_active  BOOLEAN NOT NULL DEFAULT TRUE,
      invited_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS organization_members_org_user_idx
    ON organization_members (org_id, user_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
    ON organization_members (user_id);
  `);
  console.log("✅  organization_members");

  // ─── 3. Insere a organização única ───────────────────────────────────────
  await db.execute(sql`
    INSERT INTO organizations (id, name, slug)
    VALUES (${ORG_ID}, ${ORG_NAME}, ${ORG_SLUG})
    ON CONFLICT (id) DO NOTHING;
  `);
  // Garante que a sequence não colida com o id=1 fixo.
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('organizations', 'id'),
      GREATEST((SELECT MAX(id) FROM organizations), 1)
    );
  `);
  console.log(`✅  organização #${ORG_ID} "${ORG_NAME}"`);

  // ─── 4. Adiciona org_id + backfill em cada tabela de tenant ──────────────
  for (const table of TENANT_TABLES) {
    if (!(await tableExists(table))) {
      console.log(`⏭️   ${table} (não existe, pulando)`);
      continue;
    }
    await db.execute(
      sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS org_id INTEGER;`),
    );
    const upd = await db.execute(
      sql.raw(
        `UPDATE ${table} SET org_id = ${ORG_ID} WHERE org_id IS NULL;`,
      ),
    );
    const count = (upd as any).rowCount ?? 0;
    await db.execute(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS idx_${table}_org_id ON ${table} (org_id);`,
      ),
    );
    console.log(`✅  ${table}.org_id (backfill ${count} linhas)`);
  }

  // ─── 5. Semeia membros a partir de app_users ─────────────────────────────
  const usersRes = await db.execute(
    sql`SELECT id, email FROM app_users WHERE is_active = TRUE;`,
  );
  const users: Array<{ id: number; email: string }> =
    (usersRes as any).rows ?? usersRes;

  let seeded = 0;
  for (const u of users) {
    const role = ADMIN_EMAILS.includes((u.email || "").toLowerCase())
      ? "admin"
      : "comercial";
    await db.execute(sql`
      INSERT INTO organization_members (org_id, user_id, role)
      VALUES (${ORG_ID}, ${u.id}, ${role})
      ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    `);
    console.log(`   • ${u.email} → ${role}`);
    seeded++;
  }
  console.log(`✅  organization_members semeados (${seeded} usuários)`);

  console.log("\n🎉 Fase 1 concluída. org_id continua nullable (expand-only).");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migração falhou:", err);
  process.exit(1);
});
