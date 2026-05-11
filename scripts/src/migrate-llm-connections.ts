/**
 * Migration script: converts legacy app_config LLM settings into the new
 * llm_connections and llm_profiles tables.
 *
 * Run with: pnpm --filter scripts tsx src/migrate-llm-connections.ts
 */

import { db, appConfigTable, llmConnectionsTable, llmProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encrypt } from "../../artifacts/api-server/src/lib/crypto.js";

async function migrate() {
  console.log("🔧 Migrating legacy LLM settings to Model Hub...\n");

  // Read legacy configs
  const configs = await db.select().from(appConfigTable).where(eq(appConfigTable.key, "ACTIVE_LLM_PROVIDER"));
  const activeProvider = configs[0]?.value || process.env.ACTIVE_LLM_PROVIDER || "auto";
  const activeModel = (await db.select().from(appConfigTable).where(eq(appConfigTable.key, "ACTIVE_LLM_MODEL")))[0]?.value || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const activeUrl = (await db.select().from(appConfigTable).where(eq(appConfigTable.key, "ACTIVE_LLM_URL")))[0]?.value || null;

  const ollamaUrl = (await db.select().from(appConfigTable).where(eq(appConfigTable.key, "OLLAMA_URL")))[0]?.value || process.env.OLLAMA_URL || null;
  const ollamaModel = (await db.select().from(appConfigTable).where(eq(appConfigTable.key, "OLLAMA_MODEL")))[0]?.value || process.env.OLLAMA_MODEL || "llama3.2";

  // Check if already migrated
  const existing = await db.select().from(llmConnectionsTable).limit(1);
  if (existing.length > 0) {
    console.log("⚠️  llm_connections already has data. Skipping migration.");
    return;
  }

  // Map env vars to provider keys
  const envKeys: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    ollama_cloud: process.env.OLLAMA_CLOUD_API_KEY,
  };

  const providerToUse = activeProvider === "auto" ? (ollamaUrl ? "ollama" : "google") : activeProvider;
  const key = envKeys[providerToUse];

  if (!key && providerToUse !== "ollama") {
    console.log("⚠️  No API key found in env for provider:", providerToUse);
    console.log("   Migration skipped — user will need to set up connections manually in the UI.");
    return;
  }

  // Create connection from legacy settings
  const connectionData = {
    userId: null,
    name: `${providerToUse} — ${activeModel}`,
    provider: providerToUse === "ollama_cloud" ? "ollama" : providerToUse,
    baseUrl: activeUrl || ollamaUrl || null,
    apiKey: encrypt(key || "ollama"),
    modelId: activeModel || ollamaModel,
    modelName: activeModel || ollamaModel,
    usageType: "chat" as const,
    isDefault: true,
    isActive: true,
  };

  const [conn] = await db.insert(llmConnectionsTable).values(connectionData).returning();
  console.log(`✅ Created connection: ${conn.name} (id=${conn.id})`);

  // Create default profile
  const [profile] = await db
    .insert(llmProfilesTable)
    .values({
      userId: "system",
      name: "Padrão",
      description: "Perfil migrado automaticamente das configurações legadas.",
      chatConnectionId: conn.id,
      fastConnectionId: conn.id,
      reasoningConnectionId: conn.id,
      visionConnectionId: conn.id,
      embeddingConnectionId: conn.id,
      isDefault: true,
      isActive: true,
    })
    .returning();

  console.log(`✅ Created profile: ${profile.name} (id=${profile.id})`);
  console.log("\n🎉 Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
