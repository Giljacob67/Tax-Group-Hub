/**
 * CRM Phase 4 — Role-based access control (RBAC)
 *
 * Resolves a user's roles from the database and provides helpers
 * to check permissions. Roles default to ["comercial"] if the user
 * has no explicit role assigned.
 */

import { db } from "@workspace/db";
import { appUserRolesTable } from "@workspace/db";
import { and, eq, isNull, or, gt, sql } from "drizzle-orm";
import {
  APP_ROLES,
  ROLE_PERMISSIONS,
  type AppRole,
  type Permission,
} from "@workspace/db/crm-constants";

export type UserContext = {
  userId: string;
  roles: AppRole[];
  permissions: (typeof ROLE_PERMISSIONS)["admin"];
  authMethod: string;
};

/**
 * Carrega os papéis ativos do usuário. Considera:
 * - role não expirada (expiresAt null ou > now)
 * - role não escopada (scope null) ou escopada
 * - isActive = true
 */
export async function loadUserRoles(userId: string): Promise<AppRole[]> {
  const now = new Date();
  const rows = await db
    .select({ role: appUserRolesTable.role })
    .from(appUserRolesTable)
    .where(
      and(
        eq(appUserRolesTable.userId, userId),
        eq(appUserRolesTable.isActive, true),
        or(
          isNull(appUserRolesTable.expiresAt),
          gt(appUserRolesTable.expiresAt, now),
        ),
      ),
    );

  const roles = rows
    .map((r) => r.role as AppRole)
    .filter((r) => APP_ROLES.includes(r));
  return roles.length > 0 ? roles : ["comercial"]; // default
}

export function mergePermissions(
  roles: AppRole[],
): (typeof ROLE_PERMISSIONS)["admin"] {
  // admin > coordenador > comercial > marketing > leitura (priority order)
  const priority: AppRole[] = [
    "admin",
    "coordenador",
    "comercial",
    "marketing",
    "leitura",
  ];
  const sorted = [...new Set(roles)].sort(
    (a, b) => priority.indexOf(a) - priority.indexOf(b),
  );

  const merged: any = { ...ROLE_PERMISSIONS.leitura };
  for (const role of sorted) {
    const perms: any = ROLE_PERMISSIONS[role];
    for (const key of Object.keys(perms) as Permission[]) {
      merged[key] = perms[key] || merged[key];
    }
  }
  return merged as (typeof ROLE_PERMISSIONS)["admin"];
}

/**
 * Cria um UserContext para uso em handlers. Faz cache simples por request.
 */
export async function buildUserContext(req: {
  userId?: string;
  authMethod?: string;
}): Promise<UserContext> {
  const userId = req.userId || "system";
  const roles = await loadUserRoles(userId);
  return {
    userId,
    roles,
    permissions: mergePermissions(roles),
    authMethod: req.authMethod || "unknown",
  };
}

/**
 * Throws 403 if permission is missing.
 */
export function requirePermission(ctx: UserContext, perm: Permission): void {
  if (!ctx.permissions[perm]) {
    const err: any = new Error(`Permissão negada: ${perm} requerida.`);
    err.statusCode = 403;
    err.status = 403;
    throw err;
  }
}

/**
 * Express middleware helper — extrai UserContext e anexa em req.
 * Use após authMiddleware + body parsing.
 */
export async function attachUserContext(req: any, _res: any, next: any) {
  try {
    req.userContext = await buildUserContext(req);
    next();
  } catch (err) {
    next(err);
  }
}
