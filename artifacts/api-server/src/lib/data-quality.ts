/**
 * CRM Phase 4 — Data Quality Engine
 *
 * Avalia a saúde da base de contatos e deals. Detecta:
 * - Campos obrigatórios ausentes
 * - Possíveis duplicidades (CNPJ ou razão social)
 * - Inconsistências de status (qualificado sem deal, proposta sem status, etc.)
 * - Orfãos (sem responsável, sem follow-up quando deveria ter)
 *
 * Falha silenciosamente para não bloquear a operação principal.
 */

import { db } from "@workspace/db";
import {
  crmContactsTable, crmDealsTable,
} from "@workspace/db";
import { eq, and, isNull, sql, ne, or } from "drizzle-orm";
import { QUALITY_SEVERITIES, type QualityRule } from "@workspace/db/crm-constants";

export type QualityIssue = {
  rule: QualityRule;
  severity: "info" | "warning" | "critical";
  entityType: "contact" | "deal";
  entityId: number;
  entityLabel: string;
  context: Record<string, any>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function evaluateDataQuality(userId: string): Promise<QualityIssue[]> {
  const [contacts, deals] = await Promise.all([
    db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
    db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
  ]);

  const issues: QualityIssue[] = [];
  const dealByContact = new Map<number, typeof deals[number]>();

  for (const d of deals) {
    const existing = dealByContact.get(d.contactId);
    if (!existing || new Date(d.updatedAt) > new Date(existing.updatedAt)) {
      dealByContact.set(d.contactId, d);
    }
  }

  for (const c of contacts) {
    const label = c.razaoSocial || c.nomeFantasia || c.cnpj;

    if (!c.razaoSocial) {
      issues.push(mk("missing_razao_social", "contact", c.id, label, { cnpj: c.cnpj }));
    }
    if (!c.setor) {
      issues.push(mk("missing_setor", "contact", c.id, label, {}));
    }
    if (!c.regimeTributario) {
      issues.push(mk("missing_regime_tributario", "contact", c.id, label, {}));
    }
    if (!c.telefone && !c.email) {
      issues.push(mk("missing_contato", "contact", c.id, label, {}));
    }
    if (!c.nomeDecissor && c.status === "qualificado") {
      issues.push(mk("missing_decisor", "contact", c.id, label, {}));
    }
    if (!c.responsavelUnidade && !["nao_iniciado", "perdido", "stand_by"].includes(c.status)) {
      issues.push(mk("no_responsavel", "contact", c.id, label, {}));
    }
    if (!c.proximoFollowup
        && !["cliente", "perdido", "stand_by", "encerrado"].includes(c.status)
        && new Date(c.createdAt).getTime() < Date.now() - 7 * DAY_MS) {
      issues.push(mk("no_followup", "contact", c.id, label, {}));
    }

    const deal = dealByContact.get(c.id);
    if (c.status === "qualificado" && !deal) {
      issues.push(mk("no_deal_qualificado", "contact", c.id, label, {}));
    }

    if (deal) {
      if ((deal.statusMatriz === "enviado" || deal.statusMatriz === "aguardando")
          && (!deal.briefingMatriz || deal.briefingMatriz.trim().length < 10)) {
        issues.push(mk("matriz_no_briefing", "deal", deal.id, label, {
          contactId: c.id, statusMatriz: deal.statusMatriz,
        }));
      }
      if (deal.stage === "proposta_enviada" && !deal.statusProposta) {
        issues.push(mk("proposta_no_status", "deal", deal.id, label, { contactId: c.id }));
      }
      if (deal.stage === "perdido" && !deal.motivoPerda) {
        issues.push(mk("perda_no_motivo", "deal", deal.id, label, { contactId: c.id }));
      }
    }
  }

  return issues;
}

function mk(
  rule: QualityRule,
  entityType: "contact" | "deal",
  entityId: number,
  entityLabel: string,
  context: Record<string, any>,
): QualityIssue {
  return { rule, severity: QUALITY_SEVERITIES[rule], entityType, entityId, entityLabel, context };
}

export type DuplicateCandidate = {
  field: "cnpj" | "razao_social";
  value: string;
  contactIds: number[];
  labels: string[];
};

/**
 * Encontra possíveis duplicatas por CNPJ ou razão social.
 * - CNPJ: match exato após normalização
 * - Razão social: match após lowercase + trim
 */
export async function findDuplicates(userId: string): Promise<DuplicateCandidate[]> {
  const contacts = await db.select({ id: crmContactsTable.id, cnpj: crmContactsTable.cnpj, razaoSocial: crmContactsTable.razaoSocial })
    .from(crmContactsTable)
    .where(eq(crmContactsTable.userId, userId));

  const byCnpj = new Map<string, { ids: number[]; labels: string[] }>();
  const byName = new Map<string, { ids: number[]; labels: string[] }>();

  for (const c of contacts) {
    const cnpj = (c.cnpj || "").replace(/\D/g, "");
    if (cnpj.length === 14) {
      const existing = byCnpj.get(cnpj) || { ids: [], labels: [] };
      existing.ids.push(c.id);
      existing.labels.push(c.razaoSocial || c.cnpj);
      byCnpj.set(cnpj, existing);
    }

    const name = (c.razaoSocial || "").toLowerCase().trim();
    if (name.length >= 5) {
      const existing = byName.get(name) || { ids: [], labels: [] };
      existing.ids.push(c.id);
      existing.labels.push(c.razaoSocial || c.cnpj);
      byName.set(name, existing);
    }
  }

  const result: DuplicateCandidate[] = [];
  for (const [value, { ids, labels }] of byCnpj) {
    if (ids.length > 1) {
      result.push({ field: "cnpj", value, contactIds: ids, labels });
    }
  }
  for (const [value, { ids, labels }] of byName) {
    if (ids.length > 1) {
      const alreadyAdded = result.some(d => d.field === "razao_social"
        && d.contactIds.length === ids.length
        && d.contactIds.every(id => ids.includes(id)));
      if (!alreadyAdded) {
        result.push({ field: "razao_social", value, contactIds: ids, labels });
      }
    }
  }

  return result;
}

export type CrmHealth = {
  totalContacts: number;
  totalDeals: number;
  completenessPct: number;
  withResponsiblePct: number;
  withFollowupPct: number;
  duplicates: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  issues: QualityIssue[];
  topRules: { rule: QualityRule; count: number }[];
};

export async function computeHealth(userId: string): Promise<CrmHealth> {
  const [issues, duplicates] = await Promise.all([
    evaluateDataQuality(userId),
    findDuplicates(userId),
  ]);

  const contacts = await db.select({
    id: crmContactsTable.id,
    responsavelUnidade: crmContactsTable.responsavelUnidade,
    proximoFollowup: crmContactsTable.proximoFollowup,
  }).from(crmContactsTable).where(eq(crmContactsTable.userId, userId));

  const totalContacts = contacts.length;
  const withResp = contacts.filter(c => c.responsavelUnidade).length;
  const withFollowup = contacts.filter(c => c.proximoFollowup).length;

  const deals = await db.select({ id: crmDealsTable.id })
    .from(crmDealsTable).where(eq(crmDealsTable.userId, userId));

  const ruleCount = new Map<QualityRule, number>();
  for (const i of issues) {
    ruleCount.set(i.rule, (ruleCount.get(i.rule) || 0) + 1);
  }
  const topRules = [...ruleCount.entries()]
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalContacts,
    totalDeals: deals.length,
    completenessPct: totalContacts > 0
      ? Math.round(((withResp + withFollowup) / (2 * totalContacts)) * 100)
      : 0,
    withResponsiblePct: totalContacts > 0 ? Math.round((withResp / totalContacts) * 100) : 0,
    withFollowupPct: totalContacts > 0 ? Math.round((withFollowup / totalContacts) * 100) : 0,
    duplicates: duplicates.length,
    criticalIssues: issues.filter(i => i.severity === "critical").length,
    warningIssues: issues.filter(i => i.severity === "warning").length,
    infoIssues: issues.filter(i => i.severity === "info").length,
    issues: issues.slice(0, 100),
    topRules,
  };
}
