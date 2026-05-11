/**
 * Direct schema push for llm_connections and llm_profiles.
 * Uses @neondatabase/serverless to bypass drizzle-kit ESM/CJS issues.
 */

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(url);

async function push() {
  console.log("🔧 Creating llm_connections table...");
  await sql`
    CREATE TABLE IF NOT EXISTS llm_connections (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      base_url TEXT,
      api_key TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_name TEXT,
      context_window INTEGER,
      max_tokens INTEGER,
      supports_vision BOOLEAN DEFAULT false,
      supports_tools BOOLEAN DEFAULT false,
      supports_json BOOLEAN DEFAULT false,
      price_input TEXT,
      price_output TEXT,
      provider_metadata JSONB,
      usage_type TEXT NOT NULL DEFAULT 'chat',
      is_default BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      last_tested_at TIMESTAMP,
      last_test_status TEXT DEFAULT 'untested',
      last_error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  console.log("🔧 Creating llm_profiles table...");
  await sql`
    CREATE TABLE IF NOT EXISTS llm_profiles (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      chat_connection_id INTEGER,
      fast_connection_id INTEGER,
      reasoning_connection_id INTEGER,
      vision_connection_id INTEGER,
      embedding_connection_id INTEGER,
      image_connection_id INTEGER,
      transcription_connection_id INTEGER,
      is_default BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  console.log("✅ Schema pushed successfully!");
}

push().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
