/**
 * migrate-document-jobs.ts
 * Creates the document job tracking table for the RAG flow.
 * Execute: npx tsx lib/db/src/migrate-document-jobs.ts
 * Requires DATABASE_URL in the environment.
 */
import { db } from "./index.js";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Starting document_jobs migration...\n");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_jobs (
      id           SERIAL PRIMARY KEY,
      document_id  INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      attempts     INTEGER NOT NULL DEFAULT 0,
      error_log    TEXT,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log("document_jobs");
  process.exit(0);
}

run().catch((err) => {
  console.error("document_jobs migration failed:", err);
  process.exit(1);
});
