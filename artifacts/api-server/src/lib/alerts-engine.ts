/**
 * CRM Phase 3 — Avaliador de Alertas Comerciais
 *
 * Gera alertas persistíveis baseados em regras determinísticas.
 * Cada alerta tem: tipo, severidade, contato/deal, contexto.
 *
 * Os alertas NÃO são spam: cada um é acionável e raro.
 */

import {
  ALERT_LABELS, ALERT_SEVERITY_MAP, ALERT_ICONS,
  type AlertType,
} from "@workspace/db/crm-constants";

export type AlertCandidate = {
  type: AlertType;
  contactId: number;
  dealId: number | null;
  title: string;
  description: string;
  context: Record<string, any>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(d: Date | string | null, now: Date): number {
  if (!d) return Infinity;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return Infinity;
  return (now.getTime() - date.getTime()) / DAY_MS;
}

type ContactRow = {
  id: number;
  status: string;
  proximoFollowup: Date | string | null;
  ultimaInteracao: Date | string | null;
  temperatura: string | null;
  responsavelUnidade: string | null;
};

type DealRow = {
  id: number;
  contactId: number;
  stage: string;
  statusMatriz: string;
  statusProposta: string | null;
  dataEnvioMatriz: Date | string | null;
  prazoRetornoMatriz: Date | string | null;
  dataRetornoMatriz: Date | string | null;
  updatedAt: Date | string;
};

const FINALIZADOS = new Set(["cliente", "perdido", "stand_by", "encerrado"]);

/**
 * Avalia todos os contatos e deals e retorna a lista de alertas.
 * O caller é responsável por deduplicar e persistir.
 */
export function evaluateAlerts(
  contacts: ContactRow[],
  deals: DealRow[],
  now: Date = new Date(),
): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];
  const contactById = new Map(contacts.map(c => [c.id, c]));

  for (const c of contacts) {
    // ── Follow-up vencido ──
    if (c.proximoFollowup
        && new Date(c.proximoFollowup) < now
        && !FINALIZADOS.has(c.status)) {
      const dias = Math.ceil(daysSince(c.proximoFollowup, now));
      alerts.push({
        type: "followup_vencido",
        contactId: c.id,
        dealId: null,
        title: `Follow-up vencido há ${dias}d`,
        description: `Próximo follow-up era ${new Date(c.proximoFollowup).toLocaleDateString("pt-BR")}.`,
        context: { diasAtraso: dias, proximoFollowup: c.proximoFollowup },
      });
    }

    // ── Sem atividade 7d ──
    if (!FINALIZADOS.has(c.status)) {
      const semAtividade = daysSince(c.ultimaInteracao, now);
      if (semAtividade >= 14) {
        alerts.push({
          type: "sem_atividade_14d",
          contactId: c.id,
          dealId: null,
          title: `Sem atividade há ${Math.floor(semAtividade)}d`,
          description: "Contato parado há mais de 14 dias. Reativar ou reciclar.",
          context: { diasSemAtividade: Math.floor(semAtividade) },
        });
      } else if (semAtividade >= 7) {
        alerts.push({
          type: "sem_atividade_7d",
          contactId: c.id,
          dealId: null,
          title: `Sem atividade há ${Math.floor(semAtividade)}d`,
          description: "Considere um follow-up proativo.",
          context: { diasSemAtividade: Math.floor(semAtividade) },
        });
      }
    }

    // ── Lead quente sem responsável ──
    if ((c.temperatura === "quente" || c.temperatura === "burning")
        && !c.responsavelUnidade
        && !FINALIZADOS.has(c.status)) {
      alerts.push({
        type: "lead_quente_sem_responsavel",
        contactId: c.id,
        dealId: null,
        title: "Lead quente sem responsável",
        description: "Atribua um responsável para garantir sequência comercial.",
        context: { temperatura: c.temperatura },
      });
    }
  }

  for (const d of deals) {
    const contact = contactById.get(d.contactId);
    if (!contact) continue;

    // ── Matriz acima do prazo ──
    if ((d.statusMatriz === "enviado" || d.statusMatriz === "aguardando")
        && d.prazoRetornoMatriz
        && new Date(d.prazoRetornoMatriz) < now
        && !d.dataRetornoMatriz) {
      const dias = Math.ceil(daysSince(d.prazoRetornoMatriz, now));
      alerts.push({
        type: "matriz_acima_prazo",
        contactId: d.contactId,
        dealId: d.id,
        title: `Matriz acima do prazo há ${dias}d`,
        description: "Prazo de retorno da Matriz vencido. Cobrar ou escalar.",
        context: { diasAtraso: dias, statusMatriz: d.statusMatriz },
      });
    }

    // ── Pendência documental parada (>5 dias) ──
    if (d.statusMatriz === "pendencia_documental") {
      const dias = Math.ceil(daysSince(d.updatedAt, now));
      if (dias >= 5) {
        alerts.push({
          type: "pendencia_documental_parada",
          contactId: d.contactId,
          dealId: d.id,
          title: `Pendência documental parada há ${dias}d`,
          description: "Cliente pode ter esquecido. Acione-o com cópia da lista de documentos.",
          context: { diasParada: dias },
        });
      }
    }

    // ── Proposta sem retorno (>7 dias após envio) ──
    if (d.statusMatriz === "proposta_liberada" || d.stage === "proposta_enviada") {
      const dias = Math.ceil(daysSince(d.updatedAt, now));
      if (dias >= 7) {
        alerts.push({
          type: "proposta_sem_retorno",
          contactId: d.contactId,
          dealId: d.id,
          title: `Proposta sem retorno há ${dias}d`,
          description: "Faça follow-up para verificar leitura, dúvidas e próximos passos.",
          context: { diasSemRetorno: dias },
        });
      }
    }

    // ── Negociação parada (>10 dias sem mudança) ──
    if (d.stage === "em_negociacao" || d.stage === "negociacao") {
      const dias = Math.ceil(daysSince(d.updatedAt, now));
      if (dias >= 10) {
        alerts.push({
          type: "negociacao_parada",
          contactId: d.contactId,
          dealId: d.id,
          title: `Negociação parada há ${dias}d`,
          description: "Estágio não evolui. Avalie se há bloqueio ou perda de interesse.",
          context: { diasParada: dias },
        });
      }
    }

    // ── Onboarding sem avanço (>14 dias) ──
    if (d.stage === "onboarding_cliente" || d.stage === "execucao_pela_matriz") {
      const dias = Math.ceil(daysSince(d.updatedAt, now));
      if (dias >= 14) {
        alerts.push({
          type: "onboarding_sem_avanco",
          contactId: d.contactId,
          dealId: d.id,
          title: `Onboarding sem avanço há ${dias}d`,
          description: "Cliente pode estar travado no setup. Verificar status com a Matriz.",
          context: { diasSemAvanco: dias },
        });
      }
    }

    // ── Conta com potencial de expansão sem ação (>30 dias como cliente) ──
    if (contact.status === "cliente" && d.stage === "fechado_ganho") {
      const dias = Math.ceil(daysSince(d.updatedAt, now));
      if (dias >= 30) {
        alerts.push({
          type: "conta_expansao_sem_acao",
          contactId: d.contactId,
          dealId: d.id,
          title: "Cliente sem ação recente",
          description: "Cliente ativo sem follow-up há 30+ dias. Avalie oportunidades de expansão.",
          context: { diasSemAcao: dias },
        });
      }
    }
  }

  return alerts;
}

export function getAlertMeta(type: AlertType) {
  return {
    label: ALERT_LABELS[type],
    severity: ALERT_SEVERITY_MAP[type],
    icon: ALERT_ICONS[type],
  };
}
