#!/usr/bin/env node
// scripts/migrate-009.js
// Roda: node scripts/migrate-009.js
// Necessita: DATABASE_URL no .env ou como variável de ambiente

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não encontrada. Defina no .env ou exporte como variável de ambiente.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const migrationPath = join(__dirname, "..", "lib", "db", "migrations", "009_backup_codes_and_indexes.sql");
  const sqlText = readFileSync(migrationPath, "utf-8");

  // Split por statements (ignora comentários e linhas vazias)
  const statements = sqlText
    .split(";")
    .map(s => s.replace(/--.*$/gm, "").trim())
    .filter(s => s.length > 0);

  console.log(`📦 Migration 009: ${statements.length} statements\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const label = stmt.slice(0, 60).replace(/\n/g, " ");
    try {
      await sql(stmt + ";");
      console.log(`  ✅ ${i + 1}/${statements.length} — ${label}...`);
    } catch (err) {
      if (err.message?.includes("already exists")) {
        console.log(`  ⏭️  ${i + 1}/${statements.length} — ${label}... (já existe)`);
      } else {
        console.error(`  ❌ ${i + 1}/${statements.length} — ${label}...`);
        console.error(`     ${err.message}`);
      }
    }
  }

  console.log("\n✨ Migration concluída!");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
