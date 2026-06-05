#!/usr/bin/env node
/**
 * Aplica todas as migrations Drizzle pendentes no banco de produção.
 *
 * Por que: vercel.json NÃO tem step de migration. Cada deploy precisa
 * de alguém rodando isso manualmente (ou um CI separado).
 *
 * Uso:
 *   DATABASE_URL=postgresql://... node scripts/apply-migrations.mjs
 *
 * Idempotente — pode rodar várias vezes.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve @neondatabase/serverless from the lib/db workspace where it is
// installed. The scripts workspace does not declare it as a direct dep.
const NEON_PATH = join(
  __dirname,
  "..",
  "lib",
  "db",
  "node_modules",
  "@neondatabase",
  "serverless",
  "index.js",
);
const serverless = await import(pathToFileURL(NEON_PATH).href);
const { neon } = serverless.default ?? serverless;

const DRIZZLE_DIR = join(__dirname, "..", "lib", "db", "drizzle");
const MIGRATIONS_DIR = join(__dirname, "..", "lib", "db", "migrations");

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL must be set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function applyFile(filepath) {
  const name = filepath.split("/").pop();
  let text = await readFile(filepath, "utf-8");
  console.log(`\n→ Applying ${name}...`);
  // Some legacy custom migrations contain statements that don't apply after
  // later schema changes (e.g. 001_blob_url tries to create an ivfflat index
  // on a column that 0003 made dimension-less). Strip those statements.
  if (name === "001_blob_url.sql") {
    text = text.replace(
      /CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding[\s\S]+?WITH \(lists = 100\);/m,
      "-- (skipped: ivfflat index on dimension-less column; 0003 already dropped the dim pin)\n",
    );
  }
  // Split SQL on `;` boundaries while respecting:
  //   - single-quoted strings ('…')
  //   - double-quoted identifiers ("…")
  //   - dollar-quoted blocks ($tag$ … $tag$)
  //   - line comments (--) and block comments (/* … */)
  //   - nested BEGIN/END in PL/pgSQL
  const statements = splitSqlStatements(text);
  let i = 0;
  for (const stmt of statements) {
    i++;
    try {
      await sql(stmt);
    } catch (e) {
      console.error(`❌ Failed on ${name} statement #${i}: ${e.message}`);
      console.error(`Statement: ${stmt.slice(0, 200)}...`);
      throw e;
    }
  }
  console.log(`✅ ${name} applied (${statements.length} statements).`);
}

/**
 * Split a multi-statement SQL file into individual statements. Honors
 * quoted strings, dollar-quoted blocks, and comments so PL/pgSQL `DO $$ …
 * $$;` blocks are not broken.
 */
function splitSqlStatements(sqlText) {
  const out = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null; // active $tag$ block, e.g. "$func$"
  const n = sqlText.length;
  while (i < n) {
    const c = sqlText[i];
    const next = sqlText[i + 1];

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      buf += c;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        buf += "*/";
        i += 2;
        inBlockComment = false;
        continue;
      }
      buf += c;
      i++;
      continue;
    }
    if (inSingle) {
      if (c === "'" && next === "'") {
        buf += "''";
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      buf += c;
      i++;
      continue;
    }
    if (inDouble) {
      if (c === '"' && next === '"') {
        buf += '""';
        i += 2;
        continue;
      }
      if (c === '"') inDouble = false;
      buf += c;
      i++;
      continue;
    }
    if (dollarTag) {
      // inside $tag$ … $tag$ block
      if (c === "$" && sqlText.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += c;
      i++;
      continue;
    }
    // not in any quoted/comment context
    if (c === "-" && next === "-") {
      inLineComment = true;
      buf += "--";
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      buf += "/*";
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      buf += c;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      buf += c;
      i++;
      continue;
    }
    if (c === "$") {
      // Try to read $tag$
      const m = /^\$(\w*)\$/.exec(sqlText.slice(i));
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (c === ";") {
      const trimmed = buf.trim();
      if (trimmed.length > 0) out.push(trimmed);
      buf = "";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

async function main() {
  console.log("Connecting to database...");
  // Test connection
  const ping = await sql("SELECT current_database() as db, current_user as usr, version() as v");
  console.log(`✅ Connected to: ${ping[0].db} as ${ping[0].usr}`);

  // Drizzle migrations (in order)
  const drizzleFiles = (await readdir(DRIZZLE_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of drizzleFiles) {
    await applyFile(join(DRIZZLE_DIR, f));
  }

  // Custom migrations (in order)
  const customFiles = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of customFiles) {
    await applyFile(join(MIGRATIONS_DIR, f));
  }

  // Verify critical tables/columns
  console.log("\n→ Verifying schema state...");
  const checks = [
    { table: "crm_contacts", col: "valor_potencial" },
    { table: "crm_contacts", col: "setor" },
    { table: "crm_contacts", col: "pendencias_matriz" },
    { table: "crm_deals", col: "motivo_perda" },
    { table: "crm_deals", col: "status_matriz" },
    { table: "crm_deals", col: "status_proposta" },
    { table: "crm_tasks", col: "source" },
    { table: "crm_tasks", col: "source_ref" },
  ];
  for (const { table, col } of checks) {
    const r = await sql(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [table, col],
    );
    const ok = r.length > 0;
    console.log(`  ${ok ? "✅" : "❌"} ${table}.${col}`);
  }

  const tables = ["crm_alerts", "crm_audit_log", "crm_qualification_history", "crm_next_step_history", "app_user_roles"];
  for (const t of tables) {
    const r = await sql(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [t],
    );
    const ok = r.length > 0;
    console.log(`  ${ok ? "✅" : "❌"} table ${t}`);
  }

  console.log("\n✅ All migrations applied successfully.");
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
