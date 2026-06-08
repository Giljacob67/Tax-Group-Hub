import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { appUsersTable, appUserRolesTable, auditLogsTable, passwordResetTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { apiError } from "../lib/api-response.js";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = join(__dirname, "..", "..", "..", "lib", "db", "drizzle");
const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "lib", "db", "migrations");

// ─── POST /api/setup — One-time setup (migrations + first admin) ────────────
router.post("/setup", async (req: Request, res: Response) => {
  try {
    const { setupKey, email, name, password } = req.body as {
      setupKey?: string;
      email?: string;
      name?: string;
      password?: string;
    };

    // Verify setup key
    const expectedKey = process.env.SETUP_KEY;
    if (!expectedKey || !setupKey || setupKey !== expectedKey) {
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
        const text = await readFile(join(DRIZZLE_DIR, f), "utf-8");
        await sql(text);
        results.push(`Applied drizzle: ${f}`);
      }
    } catch (err: any) {
      results.push(`Drizzle migrations warning: ${err.message}`);
    }

    // Apply custom migrations
    try {
      const customFiles = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const f of customFiles) {
        const text = await readFile(join(MIGRATIONS_DIR, f), "utf-8");
        await sql(text);
        results.push(`Applied custom: ${f}`);
      }
    } catch (err: any) {
      results.push(`Custom migrations warning: ${err.message}`);
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
    const users = await db.select({ id: appUsersTable.id }).from(appUsersTable).limit(1);
    const hasAdmin = users.length > 0;

    res.json({
      success: true,
      hasAdmin,
      needsSetup: !hasAdmin,
    });
  } catch (err: any) {
    apiError(res, 500, `Erro ao verificar status: ${err.message}`);
  }
});

export default router;
