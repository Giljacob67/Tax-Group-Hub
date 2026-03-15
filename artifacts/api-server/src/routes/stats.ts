import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversationsTable } from "@workspace/db";
import { sql, gte, desc } from "drizzle-orm";
import { AGENTS } from "../lib/agents-data.js";

const router: IRouter = Router();

router.get("/stats", async (_req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const convsByAgent = await db
      .select({
        agentId: conversationsTable.agentId,
        count: sql<number>`count(*)::int`,
      })
      .from(conversationsTable)
      .where(gte(conversationsTable.createdAt, sevenDaysAgo))
      .groupBy(conversationsTable.agentId)
      .orderBy(desc(sql`count(*)`));

    const totalConvsAllTime = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversationsTable);

    const agentUsage = convsByAgent.map((row) => {
      const agent = AGENTS.find((a) => a.id === row.agentId);
      return {
        agentId: row.agentId,
        name: agent?.name || row.agentId,
        icon: agent?.icon || "🤖",
        block: agent?.block || "unknown",
        conversations7d: row.count,
      };
    });

    const fiscalDates = getFiscalDates();
    const weeklyFocus = getWeeklyFocus();
    const funnel = buildFunnel(agentUsage);

    res.json({
      totalAgents: AGENTS.length,
      totalConversations: totalConvsAllTime[0]?.count || 0,
      agentUsage,
      fiscalDates,
      weeklyFocus,
      funnel,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  color: string;
  agentIds: string[];
}

function buildFunnel(agentUsage: { agentId: string; conversations7d: number }[]): FunnelStage[] {
  const usageMap: Record<string, number> = {};
  for (const a of agentUsage) {
    usageMap[a.agentId] = a.conversations7d;
  }

  const stages: FunnelStage[] = [
    {
      stage: "prospeccao",
      label: "Prospecção",
      count: 0,
      color: "#3B82F6",
      agentIds: ["prospeccao-tax-group", "inteligencia-prospects-tax-group"],
    },
    {
      stage: "qualificacao",
      label: "Qualificação",
      count: 0,
      color: "#8B5CF6",
      agentIds: ["qualificacao-leads-tax-group", "followup-tax-group"],
    },
    {
      stage: "reuniao",
      label: "Reunião",
      count: 0,
      color: "#F59E0B",
      agentIds: ["roteiro-reuniao-tax-group", "objecoes-tax-group"],
    },
    {
      stage: "proposta",
      label: "Proposta",
      count: 0,
      color: "#10B981",
      agentIds: ["proposta-comercial-tax-group", "materiais-comerciais-tax-group"],
    },
    {
      stage: "fechamento",
      label: "Fechamento",
      count: 0,
      color: "#EF4444",
      agentIds: ["gestao-pipeline-tax-group"],
    },
  ];

  for (const stage of stages) {
    stage.count = stage.agentIds.reduce((sum, id) => sum + (usageMap[id] || 0), 0);
  }

  return stages;
}

function getFiscalDates(): { name: string; date: string; urgency: string }[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const allDates = [
    { name: "DCTF Mensal", day: 15, months: [0,1,2,3,4,5,6,7,8,9,10,11] },
    { name: "EFD-Contribuições", day: 15, months: [0,1,2,3,4,5,6,7,8,9,10,11] },
    { name: "EFD-Reinf", day: 15, months: [0,1,2,3,4,5,6,7,8,9,10,11] },
    { name: "SPED Fiscal (ICMS/IPI)", day: 25, months: [0,1,2,3,4,5,6,7,8,9,10,11] },
    { name: "DIRF (Anual)", day: 28, months: [1] },
    { name: "ECF (Anual)", day: 31, months: [6] },
    { name: "ECD (Anual)", day: 31, months: [5] },
    { name: "DCTF Web", day: 15, months: [0,1,2,3,4,5,6,7,8,9,10,11] },
  ];

  const upcoming: { name: string; date: string; urgency: string }[] = [];

  for (const fd of allDates) {
    for (let mOffset = 0; mOffset <= 2; mOffset++) {
      const m = (currentMonth + mOffset) % 12;
      const y = currentYear + (currentMonth + mOffset >= 12 ? 1 : 0);
      if (fd.months.includes(m)) {
        const d = new Date(y, m, fd.day);
        if (d > now) {
          const daysUntil = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          upcoming.push({
            name: fd.name,
            date: d.toISOString().split("T")[0],
            urgency: daysUntil <= 7 ? "urgent" : daysUntil <= 15 ? "soon" : "normal",
          });
        }
      }
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return upcoming.slice(0, 5);
}

function getWeeklyFocus(): { title: string; description: string; agentId: string; agentName: string } {
  const now = new Date();
  const month = now.getMonth();

  const focuses: { months: number[]; title: string; description: string; agentId: string; agentName: string }[] = [
    { months: [0, 1], title: "Planejamento Tributário 2026", description: "Início de ano: momento ideal para prospectar empresas que querem revisar sua estratégia tributária. CBS (0,9%) e IBS (0,1%) já em vigor.", agentId: "reformatributaria-insight", agentName: "Reforma Tributária" },
    { months: [2, 3], title: "Reforma Tributária é a Pauta Quente", description: "Empresas estão fechando Q1 — use o impacto da Reforma para abordar CFOs preocupados com Split Payment e transição.", agentId: "inteligencia-prospects-tax-group", agentName: "Inteligência de Prospects" },
    { months: [4, 5], title: "Revisão de Meio de Ano", description: "Empresas revisando resultados do semestre. Momento perfeito para apresentar AFD e recuperação de créditos dos últimos 60 meses.", agentId: "prospeccao-tax-group", agentName: "Prospecção" },
    { months: [6, 7], title: "ECF e Compliance em Foco", description: "Prazo da ECF se aproxima — empresas preocupadas com compliance. Prospectar com foco em ADT e conformidade tributária.", agentId: "cmo-maestro-tax-group", agentName: "CMO Maestro" },
    { months: [8, 9], title: "Sprint de Fim de Ano", description: "Últimos meses para fechar projetos antes do exercício. Pipeline precisa converter leads em negócios.", agentId: "gestao-pipeline-tax-group", agentName: "Pipeline" },
    { months: [10, 11], title: "Planejamento e Fechamento", description: "Empresas planejando o próximo ano fiscal. RTI e AFD são os produtos-chave para fechar o ano com resultados.", agentId: "proposta-comercial-tax-group", agentName: "Proposta Comercial" },
  ];

  const match = focuses.find(f => f.months.includes(month)) || focuses[0];
  return { title: match.title, description: match.description, agentId: match.agentId, agentName: match.agentName };
}

export default router;
