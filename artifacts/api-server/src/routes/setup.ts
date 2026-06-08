import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { appUsersTable, appUserRolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { apiError } from "../lib/api-response.js";
import { safeCompare } from "../middlewares/auth.js";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = join(__dirname, "..", "..", "..", "lib", "db", "drizzle");
const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "lib", "db", "migrations");

function splitSqlStatements(sqlText: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;
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

// ─── POST /api/setup — One-time setup (migrations + first admin) ────────────
router.post("/setup", async (req: Request, res: Response) => {
  try {
    // Check if setup has already been completed (admin exists)
    const existingUsers = await db.select({ id: appUsersTable.id }).from(appUsersTable).limit(1);
    if (existingUsers.length > 0) {
      apiError(res, 403, "Setup já foi realizado. Este endpoint está desabilitado.");
      return;
    }

    const { setupKey, email, name, password } = req.body as {
      setupKey?: string;
      email?: string;
      name?: string;
      password?: string;
    };

    // Verify setup key
    const expectedKey = process.env.SETUP_KEY;
    if (!expectedKey || !setupKey || typeof setupKey !== "string" || !safeCompare(setupKey, expectedKey)) {
      apiError(res, 403, "Chave de setup inválida.");
      return;
    }

    if (!email || !name || !password) {
      apiError(res, 400, "Email, nome e senha são obrigatórios.");
      return;
    }

    if (password.length < 8) {
      apiError(res, 400, "Senha deve ter pelo menos 8 caracteres.");
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      apiError(res, 500, "DATABASE_URL não configurado.");
      return;
    }

    const sql = neon(databaseUrl);
    const results: string[] = [];

    // Apply Drizzle migrations
    try {
      const drizzleFiles = (await readdir(DRIZZLE_DIR))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const f of drizzleFiles) {
        let text = await readFile(join(DRIZZLE_DIR, f), "utf-8");
        const statements = splitSqlStatements(text);
        for (const stmt of statements) {
          try {
            await sql(stmt);
          } catch (e: any) {
            // Ignore "already exists" errors
            if (!e.message.includes("already exists")) {
              results.push(`Warning in ${f}: ${e.message.slice(0, 100)}`);
            }
          }
        }
        results.push(`Applied drizzle: ${f}`);
      }
    } catch (err: any) {
      results.push(`Drizzle migrations error: ${err.message}`);
    }

    // Apply custom migrations
    try {
      const customFiles = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const f of customFiles) {
        let text = await readFile(join(MIGRATIONS_DIR, f), "utf-8");
        const statements = splitSqlStatements(text);
        for (const stmt of statements) {
          try {
            await sql(stmt);
          } catch (e: any) {
            if (!e.message.includes("already exists")) {
              results.push(`Warning in ${f}: ${e.message.slice(0, 100)}`);
            }
          }
        }
        results.push(`Applied custom: ${f}`);
      }
    } catch (err: any) {
      results.push(`Custom migrations error: ${err.message}`);
    }

    // Check if admin already exists
    const [existingAdmin] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingAdmin) {
      res.json({
        success: true,
        message: "Admin já existe.",
        results,
        user: { id: existingAdmin.id, email: existingAdmin.email },
      });
      return;
    }

    // Create admin user
    const SALT_ROUNDS = 12;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [newUser] = await db
      .insert(appUsersTable)
      .values({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        passwordHash,
        isActive: true,
      })
      .returning();

    // Assign admin role
    await db.insert(appUserRolesTable).values({
      userId: String(newUser.id),
      role: "admin" as any,
      grantedBy: String(newUser.id),
      isActive: true,
    } as any);

    results.push(`Created admin user: ${newUser.email}`);

    res.json({
      success: true,
      message: "Setup completo!",
      results,
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
    });
  } catch (err: any) {
    apiError(res, 500, `Erro no setup: ${err.message}`);
  }
});

// ─── GET /api/setup/status — Check if setup is needed ───────────────────────
router.get("/setup/status", async (req: Request, res: Response) => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      res.json({
        success: true,
        hasAdmin: false,
        needsSetup: true,
        error: "DATABASE_URL not set",
      });
      return;
    }

    const cleanUrl = databaseUrl.trim();
    const sql = neon(cleanUrl);
    
    // Test connection
    try {
      await sql`SELECT 1`;
    } catch (e: any) {
      res.json({
        success: true,
        hasAdmin: false,
        needsSetup: true,
        error: `DB connection failed: ${e.message}`,
      });
      return;
    }

    const users = await db.select({ id: appUsersTable.id }).from(appUsersTable).limit(1);
    const hasAdmin = users.length > 0;

    res.json({
      success: true,
      hasAdmin,
      needsSetup: !hasAdmin,
    });
  } catch (err: any) {
    res.json({
      success: true,
      hasAdmin: false,
      needsSetup: true,
      error: err.message,
    });
  }
});

// ─── POST /api/setup/migrate — Apply pending migrations (admin only) ────────
router.post("/setup/migrate", async (req: Request, res: Response) => {
  try {
    const { setupKey } = req.body as { setupKey?: string };

    const expectedKey = process.env.SETUP_KEY;
    if (!expectedKey || !setupKey || typeof setupKey !== "string" || !safeCompare(setupKey, expectedKey)) {
      apiError(res, 403, "Chave de setup inválida.");
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      apiError(res, 500, "DATABASE_URL não configurado.");
      return;
    }

    // Clean up DATABASE_URL (remove trailing newlines)
    const cleanUrl = databaseUrl.trim();
    
    let sql;
    try {
      sql = neon(cleanUrl);
    } catch (e: any) {
      apiError(res, 500, `Erro ao conectar ao banco: ${e.message}`);
      return;
    }

    const results: string[] = [];

    // Test connection first
    try {
      await sql`SELECT 1`;
      results.push("Database connection OK");
    } catch (e: any) {
      apiError(res, 500, `Erro de conexão: ${e.message}`);
      return;
    }

    // Migration 007: schema_migrations + CRM indexes
    const migration007 = [
      `CREATE TABLE IF NOT EXISTS _schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_migrations_name ON _schema_migrations(name)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_deals_user_id ON crm_deals(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_tasks_user_id ON crm_tasks(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_activities_user_id ON crm_activities(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_qualification_history_contact ON crm_qualification_history(contact_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_seq_enrollment_seq_contact ON sequence_enrollments(sequence_id, contact_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_contacts_hubspot_id ON crm_contacts(hubspot_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_contacts_empresaqui_id ON crm_contacts(empresaqui_id)`,
    ];

    for (const stmt of migration007) {
      try {
        await sql(stmt);
      } catch (e: any) {
        if (!e.message.includes("already exists")) {
          results.push(`Warning: ${e.message.slice(0, 100)}`);
        }
      }
    }
    results.push("Applied migration 007: schema_migrations + CRM indexes");

    res.json({
      success: true,
      message: "Migrations aplicadas.",
      results,
    });
  } catch (err: any) {
    apiError(res, 500, `Erro ao aplicar migrations: ${err.message}`);
  }
});

export default router;
