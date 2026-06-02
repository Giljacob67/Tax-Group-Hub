/**
 * CRM Phase 3 — Score Composto de Prioridade Comercial
 *
 * Combina vários sinais para gerar um score de 0-100 e um nível
 * de prioridade (baixa | media | alta | critica).
 *
 * O objetivo é simples: ajudar o coordenador a saber quem atacar primeiro.
 */

import { PRIORIDADE_COMERCIAL_NIVEIS, type PrioridadeComercialNivel } from "@workspace/db/crm-constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PriorityInput = {
  aiScore: number | null;
  temperatura: string | null;          // 'frio' | 'morno' | 'quente' | 'burning'
  status: string;                      // contato
  dealStage: string | null;            // etapa do deal
  statusMatriz: string | null;         // status do Matriz
  hasProposal: boolean;                // existe proposta
  daysWithoutActivity: number;         // dias sem interação
  daysSinceFollowupOverdue: number;    // 0 se não vencido
  expectedCloseDays: number | null;    // dias até fechamento previsto
  hasOpenTask: boolean;
  isUrgentMatrix: boolean;             // matriz acima do prazo
};

export type PriorityResult = {
  score: number;
  nivel: PrioridadeComercialNivel;
  reasons: string[];
};

export function calculatePriority(input: PriorityInput): PriorityResult {
  let score = 0;
  const reasons: string[] = [];

  // AI score (0-100) → 0-25 pts
  if (input.aiScore != null) {
    const pts = Math.round(input.aiScore * 0.25);
    score += pts;
    if (input.aiScore >= 70) reasons.push(`Score IA alto (${input.aiScore})`);
  }

  // Temperatura
  if (input.temperatura === "burning") { score += 25; reasons.push("Temperatura burning"); }
  else if (input.temperatura === "quente") { score += 20; reasons.push("Temperatura quente"); }
  else if (input.temperatura === "morno") { score += 10; }
  else if (input.temperatura === "frio") { score += 3; }

  // Etapa do deal (proximidade de fechamento)
  if (input.dealStage === "em_negociacao" || input.dealStage === "negociacao") {
    score += 15; reasons.push("Em negociação");
  } else if (input.dealStage === "proposta_enviada" || input.dealStage === "proposta_apresentada") {
    score += 12; reasons.push("Proposta enviada/apresentada");
  } else if (input.dealStage === "aguardando_matriz") {
    score += 8;
  } else if (input.dealStage === "enviado_para_matriz") {
    score += 6;
  } else if (input.dealStage === "qualificacao_comercial" || input.dealStage === "diagnostico_comercial") {
    score += 4;
  }

  // Status do contato
  if (["cliente"].includes(input.status)) { score += 5; }
  else if (["em_negociacao", "proposta_enviada"].includes(input.status)) { score += 10; }
  else if (["qualificado", "reuniao_agendada"].includes(input.status)) { score += 6; }

  // Matriz crítica
  if (input.isUrgentMatrix) {
    score += 20; reasons.push("Matriz acima do prazo");
  }

  // Atividade recente
  if (input.daysWithoutActivity <= 1) score += 5;
  else if (input.daysWithoutActivity <= 3) score += 3;
  else if (input.daysWithoutActivity >= 14) {
    score -= 10; reasons.push("Sem atividade há 14+ dias");
  } else if (input.daysWithoutActivity >= 7) {
    score -= 5; reasons.push("Sem atividade há 7+ dias");
  }

  // Follow-up vencido
  if (input.daysSinceFollowupOverdue > 0) {
    const overduePts = Math.min(15, input.daysSinceFollowupOverdue * 2);
    score += overduePts;
    if (input.daysSinceFollowupOverdue > 3) {
      reasons.push(`Follow-up vencido há ${input.daysSinceFollowupOverdue}d`);
    }
  }

  // Proximidade de fechamento
  if (input.expectedCloseDays != null) {
    if (input.expectedCloseDays <= 7) { score += 10; reasons.push("Fechamento previsto em 7d"); }
    else if (input.expectedCloseDays <= 30) { score += 5; }
    else if (input.expectedCloseDays > 90) { score -= 3; }
  }

  // Sem tarefa aberta (pode ser esquecido)
  if (!input.hasOpenTask) score += 2;

  // Clamp 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  const nivel: PrioridadeComercialNivel =
    score >= 80 ? "critica"
    : score >= 60 ? "alta"
    : score >= 35 ? "media"
    : "baixa";

  return { score, nivel, reasons };
}
