import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(dbUrl);

async function main() {
  await sql`
    ALTER TABLE usage_logs 
      ADD COLUMN IF NOT EXISTS connection_id INTEGER,
      ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'chat',
      ADD COLUMN IF NOT EXISTS cost INTEGER,
      ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS error_message TEXT;
  `;
  await sql`
    ALTER TABLE llm_connections 
      ADD COLUMN IF NOT EXISTS price_per_1m_input INTEGER,
      ADD COLUMN IF NOT EXISTS price_per_1m_output INTEGER;
  `;
  console.log("✅ Migration applied successfully");
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
