import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "@workspace/db";
import { appUsersTable, appUserRolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { apiError } from "../lib/api-response.js";
import { requireUserId } from "../middlewares/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const JWT_EXPIRES_IN = "7d";

// Configure authenticator
authenticator.options = {
  window: 1,
  step: 30,
};

// ─── POST /api/auth/2fa/setup — Generate 2FA secret and QR code ─────────────
router.post("/2fa/setup", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);

    // Get user
    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, Number(userId)))
      .limit(1);

    if (!user) {
      apiError(res, 404, "Usuário não encontrado.");
      return;
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    const appName = "TaxGroupHub";
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not enabled yet)
    await db
      .update(appUsersTable)
      .set({ totpSecret: secret, updatedAt: new Date() })
      .where(eq(appUsersTable.id, Number(userId)));

    res.json({
      success: true,
      secret,
      qrCode,
      otpauthUrl,
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao configurar 2FA: ${err.message}`);
  }
});

// ─── POST /api/auth/2fa/verify — Verify 2FA token and enable ────────────────
router.post("/2fa/verify", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { token } = req.body as { token?: string };

    if (!token) {
      apiError(res, 400, "Token é obrigatório.");
      return;
    }

    // Get user with secret
    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, Number(userId)))
      .limit(1);

    if (!user || !user.totpSecret) {
      apiError(res, 400, "2FA não configurado. Faça o setup primeiro.");
      return;
    }

    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: user.totpSecret,
    });

    if (!isValid) {
      apiError(res, 400, "Token inválido. Tente novamente.");
      return;
    }

    // Enable 2FA
    await db
      .update(appUsersTable)
      .set({
        totpEnabled: true,
        totpVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appUsersTable.id, Number(userId)));

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    res.json({
      success: true,
      message: "2FA ativado com sucesso!",
      backupCodes,
    });

    // Log 2FA enabled
    logAudit(req, {
      action: "user.2fa_enabled",
      resourceType: "auth",
      resourceId: String(userId),
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao verificar 2FA: ${err.message}`);
  }
});

// ─── POST /api/auth/2fa/disable — Disable 2FA ───────────────────────────────
router.post("/2fa/disable", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { password } = req.body as { password?: string };

    if (!password) {
      apiError(res, 400, "Senha é obrigatória para desativar 2FA.");
      return;
    }

    // Get user
    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, Number(userId)))
      .limit(1);

    if (!user) {
      apiError(res, 404, "Usuário não encontrado.");
      return;
    }

    // Verify password
    const bcrypt = await import("bcryptjs");
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      apiError(res, 400, "Senha incorreta.");
      return;
    }

    // Disable 2FA
    await db
      .update(appUsersTable)
      .set({
        totpEnabled: false,
        totpSecret: null as any,
        totpVerifiedAt: null as any,
        updatedAt: new Date(),
      })
      .where(eq(appUsersTable.id, Number(userId)));

    res.json({
      success: true,
      message: "2FA desativado com sucesso.",
    });

    // Log 2FA disabled
    logAudit(req, {
      action: "user.2fa_disabled",
      resourceType: "auth",
      resourceId: String(userId),
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao desativar 2FA: ${err.message}`);
  }
});

// ─── GET /api/auth/2fa/status — Check 2FA status ────────────────────────────
router.get("/2fa/status", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);

    const [user] = await db
      .select({
        totpEnabled: appUsersTable.totpEnabled,
        totpVerifiedAt: appUsersTable.totpVerifiedAt,
      })
      .from(appUsersTable)
      .where(eq(appUsersTable.id, Number(userId)))
      .limit(1);

    if (!user) {
      apiError(res, 404, "Usuário não encontrado.");
      return;
    }

    res.json({
      success: true,
      enabled: user.totpEnabled,
      verifiedAt: user.totpVerifiedAt,
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao verificar status 2FA: ${err.message}`);
  }
});

// ─── POST /api/auth/2fa/validate — Validate 2FA token during login ──────────
router.post("/2fa/validate", async (req: Request, res: Response) => {
  try {
    const { userId, token } = req.body as { userId?: number; token?: string };

    if (!userId || !token) {
      apiError(res, 400, "userId e token são obrigatórios.");
      return;
    }

    // Get user with secret
    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, userId))
      .limit(1);

    if (!user || !user.totpSecret || !user.totpEnabled) {
      apiError(res, 400, "2FA não está ativo para este usuário.");
      return;
    }

    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: user.totpSecret,
    });

    if (!isValid) {
      apiError(res, 400, "Token inválido.");
      return;
    }

    res.json({ success: true, valid: true });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao validar 2FA: ${err.message}`);
  }
});

// ─── POST /api/auth/2fa/complete-login — Complete login after 2FA ───────────
router.post("/2fa/complete-login", async (req: Request, res: Response) => {
  try {
    const { tempToken, token } = req.body as { tempToken?: string; token?: string };

    if (!tempToken || !token) {
      apiError(res, 400, "tempToken e token são obrigatórios.");
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      apiError(res, 500, "JWT_SECRET não configurado.");
      return;
    }

    // Verify temp token
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, jwtSecret) as any;
    } catch {
      apiError(res, 401, "Token temporário inválido ou expirado.");
      return;
    }

    if (!decoded.pending2FA || !decoded.userId) {
      apiError(res, 400, "Token temporário inválido.");
      return;
    }

    // Get user
    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, Number(decoded.userId)))
      .limit(1);

    if (!user || !user.totpSecret || !user.totpEnabled) {
      apiError(res, 400, "2FA não está ativo para este usuário.");
      return;
    }

    // Verify 2FA token
    const isValid = authenticator.verify({
      token,
      secret: user.totpSecret,
    });

    if (!isValid) {
      apiError(res, 400, "Token 2FA inválido.");
      return;
    }

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

    // Generate final JWT
    const finalToken = jwt.sign(
      {
        sub: String(user.id),
        userId: String(user.id),
        email: user.email,
        roles: roles.map((r) => r.role),
      },
      jwtSecret,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token: finalToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: roles.map((r) => ({ role: r.role, scope: r.scope })),
      },
    });
  } catch (err: any) {
    if (err.statusCode) {
      apiError(res, err.statusCode, err.message);
      return;
    }
    apiError(res, 500, `Erro ao completar login: ${err.message}`);
  }
});

export default router;
