/**
 * Bootstrap: run all Drizzle migrations on a fresh or existing database.
 * Safe to invoke from a Vercel postinstall / prebuild / pre-deploy step.
 *
 * Usage: `pnpm --filter @workspace/db run migrate`
 * Requires DATABASE_URL.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = resolve(__dirname, "..", "drizzle");
const files = readdirSync(migrationsFolder).filter((f) => f.endsWith(".sql"));
if (files.length === 0) {
  console.warn("[migrate] no .sql migrations found in", migrationsFolder);
  process.exit(0);
}

console.log(
  `[migrate] applying ${files.length} migration(s) from ${migrationsFolder}`,
);

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

await migrate(db, { migrationsFolder });
console.log("[migrate] done");
process.exit(0);
