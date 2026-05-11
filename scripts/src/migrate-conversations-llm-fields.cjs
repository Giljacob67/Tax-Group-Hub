/**
 * Migration: add provider + connection_id to conversations table
 */
const { Pool } = require("pg");
require("dotenv").config({ path: "./lib/db/.env" });

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS provider text,
        ADD COLUMN IF NOT EXISTS connection_id integer;
    `);
    console.log("✅ Columns 'provider' and 'connection_id' added to conversations.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
