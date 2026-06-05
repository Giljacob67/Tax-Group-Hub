/**
 * CRM Phase 4 — Dashboard Aggregator
 *
 * Gera métricas para os 4 dashboards:
 * - executive: pipeline completo, conversão, Matriz
 * - coordenador: por responsável, gargalos
 * - operacional: rotina diária
 * - pos_venda: clientes, expansão
 *
 * Mantém compatibilidade com pipeline e status da Fase 1.
 */

import { db } from "@workspace/db";
import { crmContactsTable, crmDealsTable, crmTasksTable, crmActivitiesTable } from "@workspace/db";
import { and, eq, gte, lte, sql, desc, asc, inArray, isNull, ne } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;

function periodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "7d":  return new Date(now.getTime() - 7 * DAY_MS);
    case "30d": return new Date(now.getTime() - 30 * DAY_MS);
    case "90d": return new Date(now.getTime() - 90 * DAY_MS);
    case "this_month": return new Date(now.getFullYear(), now.getMonth(), 1);
    default: return new Date(0);
  }
}

const FINALIZADO_CONTATO = new Set(["cliente", "perdido", "stand_by", "encerrado"]);
const FINALIZADO_DEAL = new Set(["fechado_ganho", "perdido", "stand_by", "encerrado"]);

// ─── Executive ──────────────────────────────────────────────────────────────

export async function getExecutiveDashboard(userId: string, period: string) {
  const start = periodStart(period);
  const [contacts, deals, tasks] = await Promise.all([
    db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
    db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
    db.select().from(crmTasksTable).where(eq(crmTasksTable.userId, userId)),
  ]);

  // Per-period metrics
  const newLeadsInPeriod = contacts.filter(c => new Date(c.createdAt) >= start).length;
  const leadsQualificados = contacts.filter(c => c.status === "qualificado").length;
  const meetingsToday = tasks.filter(t =>
    t.type === "meeting" && t.dueDate && isToday(new Date(t.dueDate)) && t.status !== "done"
  ).length;
  const meetingsThisWeek = tasks.filter(t =>
    t.type === "meeting" && t.dueDate && isThisWeek(new Date(t.dueDate)) && t.status !== "done"
  ).length;

  // Deals by stage
  const dealsByStage = groupCount(deals, d => d.stage);
  const totalDeals = deals.length;
  const wonDeals = deals.filter(d => d.stage === "fechado_ganho");
  const lostDeals = deals.filter(d => d.stage === "perdido" || d.stage === "stand_by");
  const activeDeals = deals.filter(d => !FINALIZADO_DEAL.has(d.stage));
  const wonInPeriod = wonDeals.filter(d => d.wonAt && new Date(d.wonAt) >= start);

  // Pipeline value
  const pipelineValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
  const weightedValue = activeDeals.reduce(
    (s, d) => s + (parseFloat(d.value || "0") || 0) * ((d.probability || 0) / 100), 0
  );
  const wonValue = wonDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
  const wonValueInPeriod = wonInPeriod.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);

  // Conversion rates
  const qualificationRate = contacts.length > 0
    ? Math.round((leadsQualificados / contacts.length) * 100) : 0;
  const winRate = (wonDeals.length + lostDeals.length) > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;

  // Matriz metrics
  const matrizEnviado = deals.filter(d => d.statusMatriz === "enviado" || d.statusMatriz === "aguardando").length;
  const matrizAguardando = deals.filter(d => d.statusMatriz === "aguardando").length;
  const matrizAcimaPrazo = deals.filter(d => {
    if (!d.prazoRetornoMatriz) return false;
    if (d.dataRetornoMatriz) return false;
    if (d.statusMatriz !== "enviado" && d.statusMatriz !== "aguardando") return false;
    return new Date(d.prazoRetornoMatriz) < new Date();
  }).length;
  const avgDaysAwaitingMatriz = avgDays(
    deals.filter(d => d.dataEnvioMatriz && (d.statusMatriz === "enviado" || d.statusMatriz === "aguardando") && !d.dataRetornoMatriz),
    d => Math.floor((Date.now() - new Date(d.dataEnvioMatriz!).getTime()) / DAY_MS),
  );

  // Tempo médio por estágio (proxy: updatedAt - createdAt)
  const avgDaysPerStage: Record<string, number> = {};
  for (const stage of new Set(deals.map(d => d.stage))) {
    const stageDeals = deals.filter(d => d.stage === stage);
    avgDaysPerStage[stage] = avgDays(stageDeals, d =>
      Math.floor((new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime()) / DAY_MS)
    );
  }

  // Stuck opportunities (no activity in 14+ days, active)
  const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS);
  const stuckOpportunities = activeDeals.filter(d => new Date(d.updatedAt) < fourteenDaysAgo).length;

  // Follow-ups vencidos
  const followupsVencidos = contacts.filter(c =>
    c.proximoFollowup && new Date(c.proximoFollowup) < new Date() && !FINALIZADO_CONTATO.has(c.status)
  ).length;

  return {
    period,
    leads: {
      newInPeriod: newLeadsInPeriod,
      qualificados: leadsQualificados,
      total: contacts.length,
    },
    meetings: {
      today: meetingsToday,
      thisWeek: meetingsThisWeek,
    },
    pipeline: {
      value: pipelineValue,
      weighted: weightedValue,
      wonValue,
      wonValueInPeriod,
      activeCount: activeDeals.length,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      stuckCount: stuckOpportunities,
    },
    conversion: {
      qualificationRate,
      winRate,
    },
    dealsByStage,
    matriz: {
      enviado: matrizEnviado,
      aguardando: matrizAguardando,
      acimaPrazo: matrizAcimaPrazo,
      avgDaysAwaiting: avgDaysAwaitingMatriz,
    },
    avgDaysPerStage,
    followupsVencidos,
  };
}

// ─── Coordinator ────────────────────────────────────────────────────────────

export async function getCoordinatorDashboard(userId: string, period: string) {
  const start = periodStart(period);
  const [contacts, deals] = await Promise.all([
    db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
    db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
  ]);

  // By responsible
  const byResponsible = new Map<string, { contacts: number; deals: number; value: number; hot: number }>();
  for (const c of contacts) {
    const key = c.responsavelUnidade || "(sem responsável)";
    const e = byResponsible.get(key) || { contacts: 0, deals: 0, value: 0, hot: 0 };
    e.contacts++;
    if (c.temperatura === "quente" || c.temperatura === "burning") e.hot++;
    byResponsible.set(key, e);
  }
  for (const d of deals) {
    const key = d.assignedTo || "(sem responsável)";
    const e = byResponsible.get(key) || { contacts: 0, deals: 0, value: 0, hot: 0 };
    e.deals++;
    e.value += parseFloat(d.value || "0") || 0;
    byResponsible.set(key, e);
  }
  const responsibles = [...byResponsible.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value);

  // Hot leads
  const hotLeads = contacts.filter(c =>
    (c.temperatura === "quente" || c.temperatura === "burning")
    && !FINALIZADO_CONTATO.has(c.status)
  ).slice(0, 20);

  // Critical negotiations
  const criticalNegotiations = deals.filter(d =>
    d.stage === "em_negociacao" && (d.probability || 0) >= 60
  );

  // Proposals without return
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const proposalsNoReturn = deals.filter(d =>
    (d.statusProposta === "enviada" || d.statusProposta === "apresentada") && new Date(d.updatedAt) < sevenDaysAgo
  );

  // Inactive accounts
  const accountsInactive = contacts.filter(c =>
    !FINALIZADO_CONTATO.has(c.status)
    && c.ultimaInteracao
    && new Date(c.ultimaInteracao) < new Date(now.getTime() - 14 * DAY_MS)
  ).length;

  // Upcoming follow-ups
  const upcomingFollowups = contacts.filter(c =>
    c.proximoFollowup
    && new Date(c.proximoFollowup) >= now
    && new Date(c.proximoFollowup) <= new Date(now.getTime() + 7 * DAY_MS)
    && !FINALIZADO_CONTATO.has(c.status)
  ).sort((a, b) => new Date(a.proximoFollowup!).getTime() - new Date(b.proximoFollowup!).getTime());

  // Bottlenecks (deals stuck in a stage)
  const stageBreakdown: Record<string, { count: number; avgDays: number; value: number }> = {};
  for (const d of deals) {
    if (FINALIZADO_DEAL.has(d.stage)) continue;
    const days = Math.floor((now.getTime() - new Date(d.updatedAt).getTime()) / DAY_MS);
    if (!stageBreakdown[d.stage]) stageBreakdown[d.stage] = { count: 0, avgDays: 0, value: 0 };
    stageBreakdown[d.stage].count++;
    stageBreakdown[d.stage].avgDays += days;
    stageBreakdown[d.stage].value += parseFloat(d.value || "0") || 0;
  }
  for (const k of Object.keys(stageBreakdown)) {
    const b = stageBreakdown[k];
    b.avgDays = b.count > 0 ? Math.round(b.avgDays / b.count) : 0;
  }

  return {
    period,
    responsibles,
    hotLeads: hotLeads.length,
    criticalNegotiations: criticalNegotiations.length,
    proposalsNoReturn: proposalsNoReturn.length,
    accountsInactive,
    upcomingFollowups: upcomingFollowups.slice(0, 15).map(c => ({
      id: c.id, name: c.razaoSocial, followup: c.proximoFollowup, status: c.status,
    })),
    awaitingMatriz: deals.filter(d => d.statusMatriz === "enviado" || d.statusMatriz === "aguardando").length,
    awaitingAction: deals.filter(d => (d.statusMatriz === "enviado" || d.statusMatriz === "aguardando") && (!d.briefingMatriz || d.briefingMatriz.trim().length < 10)).length,
    stageBreakdown,
  };
}

// ─── Operational (dia a dia) ─────────────────────────────────────────────────

export async function getOperationalDashboard(userId: string) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());

  const [contacts, deals, tasks] = await Promise.all([
    db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
    db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
    db.select().from(crmTasksTable).where(eq(crmTasksTable.userId, userId)),
  ]);

  // Today's tasks
  const todayTasks = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd && t.status !== "done"
  );
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status === "pending");

  // Today's follow-ups
  const followupsToday = contacts.filter(c => {
    if (!c.proximoFollowup) return false;
    const d = new Date(c.proximoFollowup);
    return d >= todayStart && d <= todayEnd && !FINALIZADO_CONTATO.has(c.status);
  });
  const followupsOverdue = contacts.filter(c =>
    c.proximoFollowup && new Date(c.proximoFollowup) < now && !FINALIZADO_CONTATO.has(c.status)
  );

  // This week's meetings
  const meetingsThisWeek = tasks.filter(t =>
    t.type === "meeting" && t.dueDate && new Date(t.dueDate) >= startOfWeek
    && new Date(t.dueDate) <= new Date(startOfWeek.getTime() + 7 * DAY_MS)
    && t.status !== "done"
  );

  // New leads (24h)
  const newLeads24h = contacts.filter(c => new Date(c.createdAt) >= new Date(now.getTime() - DAY_MS)).length;

  // Accounts in each state
  const inApproach = contacts.filter(c => c.status === "em_abordagem").length;
  const semResposta = contacts.filter(c => c.status === "sem_resposta").length;
  const reciclarDepois = contacts.filter(c => c.status === "reciclar_depois").length;

  // By lote (prospecção)
  const byLote = new Map<string, number>();
  for (const c of contacts) {
    const k = c.loteProspeccao || "(sem lote)";
    byLote.set(k, (byLote.get(k) || 0) + 1);
  }

  // Need follow-up (>7 days no activity)
  const needFollowup = contacts.filter(c =>
    !FINALIZADO_CONTATO.has(c.status)
    && c.ultimaInteracao
    && new Date(c.ultimaInteracao) < sevenDaysAgo
  ).slice(0, 20);

  return {
    today: {
      tasks: todayTasks.length,
      followups: followupsToday.length,
      meetings: meetingsThisWeek.filter(m => isToday(new Date(m.dueDate!))).length,
      newLeads: newLeads24h,
    },
    overdue: {
      tasks: overdueTasks.length,
      followups: followupsOverdue.length,
    },
    thisWeek: {
      meetings: meetingsThisWeek.length,
    },
    byStatus: {
      em_abordagem: inApproach,
      sem_resposta: semResposta,
      reciclar_depois: reciclarDepois,
    },
    byLote: [...byLote.entries()].map(([lote, count]) => ({ lote, count })).sort((a, b) => b.count - a.count),
    needFollowup: needFollowup.map(c => ({
      id: c.id, name: c.razaoSocial, cnpj: c.cnpj,
      daysSince: Math.floor((now.getTime() - new Date(c.ultimaInteracao!).getTime()) / DAY_MS),
    })),
  };
}

// ─── Pos-venda ───────────────────────────────────────────────────────────────

export async function getPosVendaDashboard(userId: string) {
  const now = new Date();
  const [contacts, deals] = await Promise.all([
    db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
    db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
  ]);

  const clientes = contacts.filter(c => c.status === "cliente");

  // Active clients (had activity in last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const activeClients = clientes.filter(c =>
    c.ultimaInteracao && new Date(c.ultimaInteracao) >= thirtyDaysAgo
  );

  // Open pendencias (any field with content indicating pending items)
  const openPendencias = clientes.filter(c =>
    (c.pendenciasCliente && c.pendenciasCliente.trim().length > 0)
    || (c.pendenciasUnidade && c.pendenciasUnidade.trim().length > 0)
    || (c.pendenciasMatriz && c.pendenciasMatriz.trim().length > 0)
  );

  // Ready for expansion (cliente sem ação há 30+ dias)
  const expansionCandidates = clientes.filter(c =>
    c.ultimaInteracao && new Date(c.ultimaInteracao) < thirtyDaysAgo
  );

  // By responsável
  const byResponsavel = new Map<string, { count: number; deals: number; value: number }>();
  for (const c of clientes) {
    const k = c.responsavelUnidade || "(sem responsável)";
    const e = byResponsavel.get(k) || { count: 0, deals: 0, value: 0 };
    e.count++;
    byResponsavel.set(k, e);
  }
  for (const d of deals.filter(d => d.stage === "fechado_ganho")) {
    const c = contacts.find(c => c.id === d.contactId);
    if (!c) continue;
    const k = c.responsavelUnidade || "(sem responsável)";
    const e = byResponsavel.get(k) || { count: 0, deals: 0, value: 0 };
    e.deals++;
    e.value += parseFloat(d.value || "0") || 0;
    byResponsavel.set(k, e);
  }

  // Recent wins
  const recentWins = deals
    .filter(d => d.stage === "fechado_ganho" && d.wonAt && new Date(d.wonAt) >= new Date(now.getTime() - 90 * DAY_MS))
    .sort((a, b) => new Date(b.wonAt!).getTime() - new Date(a.wonAt!).getTime())
    .slice(0, 10);

  return {
    totalClientes: clientes.length,
    activeClients: activeClients.length,
    openPendencias: openPendencias.length,
    expansionCandidates: expansionCandidates.length,
    byResponsavel: [...byResponsavel.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value),
    recentWins: recentWins.map(d => {
      const c = contacts.find(c => c.id === d.contactId);
      return {
        id: d.id,
        contactId: d.contactId,
        name: c?.razaoSocial || `Contato ${d.contactId}`,
        value: parseFloat(d.value || "0") || 0,
        wonAt: d.wonAt,
      };
    }),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupCount<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}

function avgDays<T>(arr: T[], days: (t: T) => number): number {
  if (arr.length === 0) return 0;
  const total = arr.reduce((s, t) => s + days(t), 0);
  return Math.round(total / arr.length);
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isThisWeek(d: Date): boolean {
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}
