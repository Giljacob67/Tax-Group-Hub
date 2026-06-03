/**
 * CRM Phase 4 — Audit Logger
 *
 * Grava eventos sensíveis em crm_audit_log. Diferencia origem
 * (manual | ia | automation | integration) e registra antes/depois.
 *
 * Falha silenciosamente para não bloquear a operação principal.
 */

import { db } from "@workspace/db";
import { crmAuditLogTable } from "@workspace/db";
import type { AuditAction, AuditActorType, AuditEntityType } from "@workspace/db/crm-constants";

export type AuditInput = {
  userId: string;
  actorId?: string;
  actorType?: AuditActorType;
  entityType: AuditEntityType;
  entityId: number;
  action: AuditAction;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  context?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
};

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(crmAuditLogTable).values({
      userId: input.userId,
      actorId: input.actorId || null,
      actorType: input.actorType || "user",
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      fieldName: input.fieldName || null,
      oldValue: input.oldValue != null ? String(input.oldValue) : null,
      newValue: input.newValue != null ? String(input.newValue) : null,
      context: input.context || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    });
  } catch (err) {
    console.error("[audit] failed to log:", err);
  }
}

/**
 * Compara objeto antigo com novo e gera entradas de auditoria para
 * os campos sensíveis que mudaram.
 */
export async function logSensitiveChanges(opts: {
  userId: string;
  actorType?: AuditActorType;
  entityType: AuditEntityType;
  entityId: number;
  oldObj: Record<string, any> | null;
  newObj: Record<string, any>;
  sensitiveFields: string[];
  action?: AuditAction;
  context?: Record<string, any>;
}): Promise<void> {
  const { userId, actorType, entityType, entityId, oldObj, newObj, sensitiveFields, action, context } = opts;
  const oldVal = oldObj || {};

  for (const field of sensitiveFields) {
    const oldV = oldVal[field];
    const newV = newObj[field];
    if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
      await logAudit({
        userId,
        actorType: actorType || "user",
        entityType,
        entityId,
        action: action || (field === "status" ? "status_change" : field === "stage" ? "stage_change" : "update"),
        fieldName: field,
        oldValue: oldV != null ? String(oldV) : null,
        newValue: newV != null ? String(newV) : null,
        context,
      });
    }
  }
}
