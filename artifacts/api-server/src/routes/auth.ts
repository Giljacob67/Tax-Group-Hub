import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import { appUsersTable, appUserRolesTable, passwordResetTokensTable, auditLogsTable } from "@workspace/db";
import { eq, and, gt, desc, count } from "drizzle-orm";
import { apiError } from "../lib/api-response.js";
import { requireUserId, isRealUser } from "../middlewares/auth.js";
import { logAudit } from "../lib/audit.js";
import logger from "../lib/logger.js";

const router = Router();

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "7d";

// ─── POST /api/auth/login — Authenticate user ──────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      apiError(res, 400, "Email e senha são obrigatórios.");
      return;
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(
        and(
          eq(appUsersTable.email, email.toLowerCase().trim()),
          eq(appUsersTable.isActive, true),
        ),
      )
      .limit(1);

    if (!user) {
      apiError(res, 401, "Credenciais inválidas.");
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      apiError(res, 401, "Credenciais inválidas.");
      return;
    }

    // Update last login
    await db
      .update(appUsersTable)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(appUsersTable.id, user.id));

    // Get user roles
    const roles = await db
      .select()
      .from(appUserRolesTable)
      .where(
        and(
          eq(appUserRolesTable.userId, String(user.id)),
          eq(appUserRolesTable.isActive, true),
        ),
      );

    // Get JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      apiError(res, 500, "JWT_SECRET não configurado no servidor.");
      return;
    }

    // Check if 2FA is enabled
    if (user.totpEnabled && user.totpSecret) {
      // Return 2FA required status with temporary token
      const tempToken = jwt.sign(
        {
          sub: String(user.id),
          userId: String(user.id),
          email: user.email,
          pending2FA: true,
        },
        jwtSecret,
        { expiresIn: "5m" }
      );

      res.json({
        success: true,
        requires2FA: true,
        tempToken,
        userId: user.id,
      });
      return;
    }

    // Generate JWT

    const token = jwt.sign(
      {
        sub: String(user.id),
        userId: String(user.id),
        email: user.email,
        roles: roles.map((r) => r.role),
      },
      jwtSecret,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: roles.map((r) => ({ role: r.role, scope: r.scope })),
      },
    });

    // Log successful login
    logAudit(req, {
      action: "user.login",
      resourceType: "auth",
      resourceId: String(user.id),
      details: { email: user.email },
    });
  } catch (err) {
    logger.error({ err }, "[auth/login]");
    apiError(res, 500, "Erro interno ao fazer login.");
  }
});

// ─── POST /api/auth/demo — Get demo token (restrito) ───────────────────────
// Endpoint exposto publicamente na internet. Para evitar que qualquer pessoa
// obtenha um token com acesso à plataforma (incl. KB organizacional e chat),
// exige a chave compartilhada DEMO_ACCESS_KEY via header "x-demo-key".
// Sem a env var configurada, o endpoint fica desabilitado.
router.post("/demo", async (req: Request, res: Response) => {
  try {
    const demoKey = process.env.DEMO_ACCESS_KEY;
    if (!demoKey) {
      apiError(res, 403, "Endpoint demo desabilitado.");
      return;
    }
    const provided = req.headers["x-demo-key"];
    const providedBuf = Buffer.from(
      typeof provided === "string" ? provided : "",
    );
    const expectedBuf = Buffer.from(demoKey);
    const keyOk =
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf);
    if (!keyOk) {
      logger.warn(
        { ip: req.ip },
        "[auth/demo] tentativa com chave ausente ou inválida",
      );
      apiError(res, 403, "Chave de acesso demo inválida.");
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      apiError(res, 500, "JWT_SECRET não configurado no servidor.");
      return;
    }

    // Create anonymous demo user with read-only access
    const demoUser = {
      id: 0,
      email: "demo@taxgroup.com",
      name: "Demo User",
      roles: ["demo"],
    };

    const token = jwt.sign(
      {
        sub: "demo",
        userId: "0",
        email: "demo@taxgroup.com",
        roles: ["demo"],
      },
      jwtSecret,
      { expiresIn: "4h" },
    );

    res.json({
      success: true,
      token,
      user: {
        id: 0,
        email: "demo@taxgroup.com",
        name: "Demo User",
        roles: [{ role: "demo", scope: null }],
      },
    });
  } catch (err) {
    logger.error({ err }, "[auth/demo]");
    apiError(res, 500, "Erro ao gerar token demo.");
  }
});

// ─── POST /api/auth/register — Create new user (admin only) ────────────────
router.post("/register", async (req: Request, res: Response) => {
  try {
    // Require authenticated admin user
    const actorId = requireUserId(req);

    // Check if actor is admin
    const actorRoles = await db
      .select()
      .from(appUserRolesTable)
      .where(
        and(
          eq(appUserRolesTable.userId, actorId),
          eq(appUserRolesTable.isActive, true),
          eq(appUserRolesTable.role, "admin" as any),
        ),
      );

    if (actorRoles.length === 0) {
      apiError(res, 403, "Apenas administradores podem criar usuários.");
      return;
    }

    const { email, name, password, roles } = req.body as {
      email?: string;
      name?: string;
      password?: string;
      roles?: string[];
    };

    if (!email || !name || !password) {
      apiError(res, 400, "Email, nome e senha são obrigatórios.");
      return;
    }

    if (password.length < 8) {
      apiError(res, 400, "Senha deve ter pelo menos 8 caracteres.");
      return;
    }

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      apiError(res, 409, "Email já cadastrado.");
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const [newUser] = await db
      .insert(appUsersTable)
      .values({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        passwordHash,
        isActive: true,
      })
      .returning();

    // Assign roles if provided
    if (roles && roles.length > 0) {
      for (const role of roles) {
        await db.insert(appUserRolesTable).values({
          userId: String(newUser.id),
          role: role as any,
          grantedBy: actorId,
          isActive: true,
        } as any);
      }
    }

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    });

    // Log user creation
    logAudit(req, {
      action: "admin.user_created",
      resourceType: "user",
      resourceId: String(newUser.id),
      details: { email: newUser.email, name: newUser.name, roles },
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, "Erro interno ao criar usuário.");
  }
});

// ─── GET /api/auth/me — Get current user info ──────────────────────────────
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);

    const [user] = await db
      .select({
        id: appUsersTable.id,
        email: appUsersTable.email,
        name: appUsersTable.name,
        isActive: appUsersTable.isActive,
        lastLoginAt: appUsersTable.lastLoginAt,
      })
      .from(appUsersTable)
      .where(eq(appUsersTable.id, Number(userId)))
      .limit(1);

    if (!user) {
      apiError(res, 404, "Usuário não encontrado.");
      return;
    }

    // Get roles
    const roles = await db
      .select()
      .from(appUserRolesTable)
      .where(
        and(
          eq(appUserRolesTable.userId, String(user.id)),
          eq(appUserRolesTable.isActive, true),
        ),
      );

    res.json({
      success: true,
      user: {
        ...user,
        roles: roles.map((r) => ({ role: r.role, scope: r.scope })),
      },
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, "Erro interno ao buscar usuário.");
  }
});

// ─── GET /api/auth/users — List all users (admin only) ─────────────────────
router.get("/users", async (req: Request, res: Response) => {
  try {
    const actorId = requireUserId(req);

    // Check if actor is admin
    const actorRoles = await db
      .select()
      .from(appUserRolesTable)
      .where(
        and(
          eq(appUserRolesTable.userId, actorId),
          eq(appUserRolesTable.isActive, true),
          eq(appUserRolesTable.role, "admin" as any),
        ),
      );

    if (actorRoles.length === 0) {
      apiError(res, 403, "Apenas administradores podem listar usuários.");
      return;
    }

    const users = await db
      .select({
        id: appUsersTable.id,
        email: appUsersTable.email,
        name: appUsersTable.name,
        isActive: appUsersTable.isActive,
        createdAt: appUsersTable.createdAt,
        lastLoginAt: appUsersTable.lastLoginAt,
      })
      .from(appUsersTable)
      .orderBy(appUsersTable.createdAt);

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roles = await db
          .select()
          .from(appUserRolesTable)
          .where(
            and(
              eq(appUserRolesTable.userId, String(user.id)),
              eq(appUserRolesTable.isActive, true),
            ),
          );
        return {
          ...user,
          roles: roles.map((r) => r.role),
        };
      }),
    );

    res.json({ success: true, users: usersWithRoles });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, "Erro interno ao listar usuários.");
  }
});

// ─── DELETE /api/auth/users/:id — Deactivate user (admin only) ─────────────
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const actorId = requireUserId(req);

    // Check if actor is admin
    const actorRoles = await db
      .select()
      .from(appUserRolesTable)
      .where(
        and(
          eq(appUserRolesTable.userId, actorId),
          eq(appUserRolesTable.isActive, true),
          eq(appUserRolesTable.role, "admin" as any),
        ),
      );

    if (actorRoles.length === 0) {
      apiError(res, 403, "Apenas administradores podem desativar usuários.");
      return;
    }

    const targetId = Number(req.params.id);

    // Prevent self-deactivation
    if (targetId === Number(actorId)) {
      apiError(res, 400, "Você não pode desativar sua própria conta.");
      return;
    }

    const [updated] = await db
      .update(appUsersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(appUsersTable.id, targetId))
      .returning();

    if (!updated) {
      apiError(res, 404, "Usuário não encontrado.");
      return;
    }

    res.json({ success: true, message: "Usuário desativado." });

    // Log user deactivation
    logAudit(req, {
      action: "admin.user_deactivated",
      resourceType: "user",
      resourceId: String(targetId),
      details: { email: updated.email, name: updated.name },
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, "Erro interno ao desativar usuário.");
  }
});

// ─── POST /api/auth/users/:id/reset-password — Admin reset password ────────
router.post("/users/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const actorId = requireUserId(req);

    // Check if actor is admin
    const actorRoles = await db
      .select()
      .from(appUserRolesTable)
      .where(
        and(
          eq(appUserRolesTable.userId, actorId),
          eq(appUserRolesTable.isActive, true),
          eq(appUserRolesTable.role, "admin" as any),
        ),
      );

    if (actorRoles.length === 0) {
      apiError(res, 403, "Apenas administradores podem resetar senhas.");
      return;
    }

    const targetId = Number(req.params.id);
    const { newPassword } = req.body as { newPassword?: string };

    if (!newPassword || newPassword.length < 8) {
      apiError(res, 400, "Senha deve ter pelo menos 8 caracteres.");
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const [updated] = await db
      .update(appUsersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(appUsersTable.id, targetId))
      .returning();

    if (!updated) {
      apiError(res, 404, "Usuário não encontrado.");
      return;
    }

    res.json({ success: true, message: "Senha resetada com sucesso." });

    // Log password reset
    logAudit(req, {
      action: "admin.password_reset",
      resourceType: "user",
      resourceId: String(targetId),
      details: { email: updated.email, name: updated.name },
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, "Erro interno ao resetar senha.");
  }
});

// ─── POST /api/auth/forgot-password — Request password reset ────────────────
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      apiError(res, 400, "Email é obrigatório.");
      return;
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(
        and(
          eq(appUsersTable.email, email.toLowerCase().trim()),
          eq(appUsersTable.isActive, true),
        ),
      )
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({
        success: true,
        message: "Se o email estiver cadastrado, você receberá instruções para resetar a senha.",
      });
      return;
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.userId, user.id));

    // Create new token
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // TODO: In production, send email with reset link
    // const resetLink = `${process.env.APP_URL || "https://tax-group-hub.vercel.app"}/reset-password?token=${token}`;
    // await sendEmail(user.email, "Reset de senha", `Clique aqui: ${resetLink}`);

    // Never return the token in the response — it should only be delivered via email
    res.json({
      success: true,
      message: "Se o email estiver cadastrado, você receberá instruções para resetar a senha.",
    });
  } catch (err: any) {
    apiError(res, 500, "Erro interno ao solicitar reset de senha.");
  }
});

// ─── POST /api/auth/reset-password — Reset password with token ──────────────
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as {
      token?: string;
      newPassword?: string;
    };

    if (!token || !newPassword) {
      apiError(res, 400, "Token e nova senha são obrigatórios.");
      return;
    }

    if (newPassword.length < 8) {
      apiError(res, 400, "Senha deve ter pelo menos 8 caracteres.");
      return;
    }

    // Find valid token
    const [resetToken] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          gt(passwordResetTokensTable.expiresAt, new Date()),
          eq(passwordResetTokensTable.usedAt, null as any),
        ),
      )
      .limit(1);

    if (!resetToken) {
      apiError(res, 400, "Token inválido ou expirado.");
      return;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update user password
    await db
      .update(appUsersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(appUsersTable.id, resetToken.userId));

    // Mark token as used
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetToken.id));

    res.json({ success: true, message: "Senha resetada com sucesso." });
  } catch (err: any) {
    apiError(res, 500, "Erro interno ao resetar senha.");
  }
});

// ─── GET /api/auth/verify-reset-token — Verify if reset token is valid ──────
router.get("/verify-reset-token", async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      apiError(res, 400, "Token é obrigatório.");
      return;
    }

    const [resetToken] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          gt(passwordResetTokensTable.expiresAt, new Date()),
          eq(passwordResetTokensTable.usedAt, null as any),
        ),
      )
      .limit(1);

    res.json({ valid: !!resetToken });
  } catch (err: any) {
    apiError(res, 500, "Erro interno ao verificar token.");
  }
});

// ─── GET /api/auth/audit-logs — List audit logs (admin only) ────────────────
router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const actorId = requireUserId(req);

    // Check if actor is admin
    const actorRoles = await db
      .select()
      .from(appUserRolesTable)
      .where(
        and(
          eq(appUserRolesTable.userId, actorId),
          eq(appUserRolesTable.isActive, true),
          eq(appUserRolesTable.role, "admin" as any),
        ),
      );

    if (actorRoles.length === 0) {
      apiError(res, 403, "Apenas administradores podem visualizar logs de auditoria.");
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const offset = Number(req.query.offset) || 0;

    const logs = await db
      .select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: count() })
      .from(auditLogsTable);
    const total = Number(countResult?.total ?? 0);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, "Erro interno ao buscar logs de auditoria.");
  }
});

export default router;
