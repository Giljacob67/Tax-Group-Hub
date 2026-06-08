import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { appUsersTable, appUserRolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { apiError } from "../lib/api-response.js";
import { requireUserId, isRealUser } from "../middlewares/auth.js";

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

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      apiError(res, 500, "JWT_SECRET não configurado no servidor.");
      return;
    }

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
  } catch (err: any) {
    apiError(res, 500, `Erro ao fazer login: ${err.message}`);
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
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao criar usuário: ${err.message}`);
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
    apiError(res, 500, `Erro ao buscar usuário: ${err.message}`);
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
    apiError(res, 500, `Erro ao listar usuários: ${err.message}`);
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
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao desativar usuário: ${err.message}`);
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
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao resetar senha: ${err.message}`);
  }
});

export default router;
