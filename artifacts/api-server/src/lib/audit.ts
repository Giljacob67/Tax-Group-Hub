import { db } from "@workspace/db";
import { auditLogsTable, appUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

export type AuditAction =
  | "user.created"
  | "user.deactivated"
  | "user.password_reset"
  | "user.login"
  | "user.login_failed"
  | "user.2fa_enabled"
  | "user.2fa_disabled"
  | "admin.user_created"
  | "admin.user_deactivated"
  | "admin.password_reset"
  | "crm.sensitive_change";

export interface AuditLogData {
  action: AuditAction;
  resourceType: "user" | "auth" | "system" | "crm";
  resourceId?: string;
  details?: Record<string, any>;
}

interface LegacyAuditLogData {
  userId?: string;
  actorType?: string;
  entityType?: string;
  entityId?: string | number;
  action: string;
  fieldName?: string;
  oldValue?: any;
  newValue?: any;
  context?: Record<string, any>;
}

export async function logAudit(
  reqOrData: Request | LegacyAuditLogData,
  data?: AuditLogData
): Promise<void> {
  try {
    // Handle legacy signature (single object argument)
    if (!("headers" in reqOrData)) {
      const legacy = reqOrData;
      const ipAddress = null;
      const userAgent = null;

      await db.insert(auditLogsTable).values({
        actorId: legacy.userId && legacy.userId !== "service" && legacy.userId !== "dev-user" ? Number(legacy.userId) : null,
        actorEmail: null,
        action: `${legacy.actorType || "system"}.${legacy.action}`,
        resourceType: (legacy.entityType as any) || "system",
        resourceId: legacy.entityId ? String(legacy.entityId) : null,
        details: {
          fieldName: legacy.fieldName,
          oldValue: legacy.oldValue,
          newValue: legacy.newValue,
          ...legacy.context,
        },
        ipAddress,
        userAgent,
      });
      return;
    }

    // Handle new signature (req, data)
    const req = reqOrData;
    if (!data) return;

    const userId = req.userId;
    let actorEmail: string | null = null;

    if (userId && userId !== "service" && userId !== "dev-user") {
      const [user] = await db
        .select({ email: appUsersTable.email })
        .from(appUsersTable)
        .where(eq(appUsersTable.id, Number(userId)))
        .limit(1);
      actorEmail = user?.email || null;
    }

    const ipAddress =
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      null;

    const userAgent = req.headers["user-agent"] || null;

    await db.insert(auditLogsTable).values({
      actorId: userId && userId !== "service" && userId !== "dev-user" ? Number(userId) : null,
      actorEmail,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      details: data.details,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export async function logSensitiveChanges(
  req: Request,
  changes: Array<{ field: string; oldValue: any; newValue: any }>
): Promise<void> {
  try {
    const userId = req.userId;
    let actorEmail: string | null = null;

    if (userId && userId !== "service" && userId !== "dev-user") {
      const [user] = await db
        .select({ email: appUsersTable.email })
        .from(appUsersTable)
        .where(eq(appUsersTable.id, Number(userId)))
        .limit(1);
      actorEmail = user?.email || null;
    }

    const ipAddress =
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      null;

    const userAgent = req.headers["user-agent"] || null;

    await db.insert(auditLogsTable).values({
      actorId: userId && userId !== "service" && userId !== "dev-user" ? Number(userId) : null,
      actorEmail,
      action: "crm.sensitive_change",
      resourceType: "crm",
      details: { changes },
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error("Failed to write sensitive changes audit log:", err);
  }
}
