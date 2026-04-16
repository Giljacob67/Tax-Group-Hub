import { db } from "./index.js";
import { sql } from "drizzle-orm";

async function executeMigration() {
  console.log("Iniciando migração manual...");

  try {
    // 1. Criar pipeline_executions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pipeline_executions (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        steps JSONB NOT NULL,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        total_time_ms INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela 'pipeline_executions' verificada/criada.");

    // 2. Criar content_performance
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS content_performance (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        user_id TEXT,
        channel TEXT NOT NULL,
        content_type TEXT NOT NULL,
        generated_content TEXT NOT NULL,
        published_at TIMESTAMP,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        score INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela 'content_performance' verificada/criada.");

    // 3. Adicionar campos em knowledge_documents (ignorando erros se as colunas já existirem)
    const newColumns = [
      "category TEXT",
      "tags JSONB",
      "valid_until TIMESTAMP",
      "priority INTEGER DEFAULT 5"
    ];

    for (const colDef of newColumns) {
      try {
        const colName = colDef.split(' ')[0];
        await db.execute(sql.raw(`ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS ${colName} ${colDef.slice(colName.length + 1)};`));
        console.log(`✅ Coluna '${colName}' verificada/adicionada.`);
      } catch (e: any) {
        // Fallback: se o banco não suportar IF NOT EXISTS em ADD COLUMN
        if (!e.message.includes("already exists")) {
          throw e;
        }
      }
    }

    console.log("🎉 Migração finalizada com sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro durante a migração:", err);
    process.exit(1);
  }
}

executeMigration();
