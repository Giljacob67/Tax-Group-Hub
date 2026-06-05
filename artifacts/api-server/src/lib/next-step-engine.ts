/**
 * CRM Phase 3 — Motor de "Próximo Passo Recomendado"
 *
 * Lógica determinística (sem LLM) que sugere a próxima ação comercial
 * com base no estado do contato, deal, Matriz e interações.
 *
 * Vantagens de ser determinístico:
 * - Auditável
 * - Previsível
 * - Não depende de provedor LLM
 * - Reaproveitável para cadências e campanhas futuras
 */

import {
  NEXT_STEP_ACTIONS,
  NEXT_STEP_LABELS,
  NEXT_STEP_PRIORITIES,
  type NextStepAction,
  type NextStepRecommendation,
} from "@workspace/db/crm-constants";

export type ContactSnapshot = {
  status: string;
  temperatura: string | null;
  proximoFollowup: Date | string | null;
  ultimaInteracao: Date | string | null;
  pendenciasCliente: string | null;
  responsavelUnidade: string | null;
};

export type DealSnapshot = {
  stage: string;
  statusMatriz: string;
  statusProposta: string | null;
  briefingMatriz: string | null;
  dataEnvioMatriz: Date | string | null;
  prazoRetornoMatriz: Date | string | null;
};

export type RecInput = {
  contact: ContactSnapshot;
  deal: DealSnapshot | null;
  hasProposal: boolean;
  hasOpenTasks: boolean;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(d: Date | string | null, now: Date): number {
  if (!d) return Infinity;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return Infinity;
  return (now.getTime() - date.getTime()) / DAY_MS;
}

function isOverdue(d: Date | string | null, now: Date): boolean {
  if (!d) return false;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.getTime() < now.getTime();
}

function isFinalizado(status: string): boolean {
  return ["cliente", "perdido", "stand_by", "reciclar_depois"].includes(status);
}

/**
 * Retorna a recomendação de próximo passo para o contato/deal.
 * A regra é avaliada em ordem: quanto mais cedo a condição bater, mais prioritária.
 */
export function recommendNextStep(input: RecInput): NextStepRecommendation {
  const now = input.now || new Date();
  const { contact, deal, hasProposal, hasOpenTasks } = input;

  // ─── 1. Lead nunca contatado ─────────────────────────────────────────────
  if (contact.status === "nao_iniciado" && !contact.ultimaInteracao) {
    return mk(
      "primeiro_contato",
      "Lead ainda não foi contatado. Faça o primeiro contato.",
      "alta",
      {
        title: `Primeiro contato — ${contact.status}`,
        type: "whatsapp",
        dueInDays: 1,
      },
    );
  }

  // ─── 2. Aguardando Matriz (deal) ──────────────────────────────────────────
  if (
    deal &&
    (deal.statusMatriz === "enviado" || deal.statusMatriz === "aguardando")
  ) {
    const prazoVencido = isOverdue(deal.prazoRetornoMatriz, now);
    const diasAtraso = prazoVencido
      ? Math.ceil(daysSince(deal.prazoRetornoMatriz, now))
      : 0;
    if (prazoVencido) {
      return mk(
        "cobrar_retorno",
        `Matriz está ${diasAtraso} dia(s) acima do prazo. Cobrar retorno.`,
        "urgente",
        { title: "Cobrar retorno da Matriz", type: "email", dueInDays: 0 },
      );
    }
    return mk(
      "reenviar_materiais",
      "Aguardando retorno da Matriz. Reenviar materiais complementares se útil.",
      "media",
      { title: "Revisar status na Matriz", type: "note", dueInDays: 3 },
    );
  }

  // ─── 3. Pendência documental ──────────────────────────────────────────────
  if (deal && deal.statusMatriz === "pendencia_documental") {
    return mk(
      "cobrar_pendencia_documental",
      "Pendência documental na Matriz. Acionar o cliente para enviar documentos.",
      "alta",
      { title: "Cobrar documentos pendentes", type: "whatsapp", dueInDays: 1 },
    );
  }

  // ─── 4. Proposta enviada sem retorno ──────────────────────────────────────
  if (
    deal &&
    (deal.statusMatriz === "proposta_liberada" ||
      deal.stage === "proposta_enviada")
  ) {
    return mk(
      "follow_up_proposta",
      "Proposta enviada. Fazer follow-up para verificar leitura e dúvidas.",
      "alta",
      { title: "Follow-up de proposta", type: "whatsapp", dueInDays: 2 },
    );
  }

  // ─── 5. Proposta pronta para apresentar ──────────────────────────────────
  if (
    deal &&
    (deal.stage === "proposta_pronta" ||
      deal.statusProposta === "proposta_pronta")
  ) {
    if (!hasOpenTasks) {
      return mk(
        "apresentar_proposta",
        "Proposta pronta. Agendar/apresentar ao cliente.",
        "alta",
        {
          title: "Apresentar proposta ao cliente",
          type: "meeting",
          dueInDays: 2,
        },
      );
    }
  }

  // ─── 6. Pronto para enviar à Matriz ──────────────────────────────────────
  if (deal && deal.stage === "enviado_para_matriz" && !deal.dataEnvioMatriz) {
    return mk(
      "montar_briefing_matriz",
      "Deal marcado como enviado para Matriz. Montar briefing e enviar.",
      "alta",
      { title: "Montar briefing para Matriz", type: "note", dueInDays: 1 },
    );
  }

  // ─── 7. Em negociação ─────────────────────────────────────────────────────
  if (deal && deal.stage === "em_negociacao") {
    return mk(
      "negociar_condicao",
      "Negociação em andamento. Trabalhar condições e alinhar contraproposta.",
      "alta",
      { title: "Avançar negociação", type: "meeting", dueInDays: 1 },
    );
  }

  // ─── 8. Follow-up vencido ─────────────────────────────────────────────────
  if (contact.proximoFollowup && isOverdue(contact.proximoFollowup, now)) {
    const diasAtraso = Math.ceil(daysSince(contact.proximoFollowup, now));
    return mk(
      "cobrar_retorno",
      `Follow-up vencido há ${diasAtraso} dia(s).`,
      diasAtraso > 3 ? "urgente" : "alta",
      {
        title: "Cobrar retorno / retomar contato",
        type: "whatsapp",
        dueInDays: 0,
      },
    );
  }

  // ─── 9. Sem atividade há 14+ dias ─────────────────────────────────────────
  const diasSemAtividade = daysSince(contact.ultimaInteracao, now);
  if (!isFinalizado(contact.status) && diasSemAtividade >= 14) {
    return mk(
      "reativar_lead_morno",
      `Sem atividade há ${Math.floor(diasSemAtividade)} dias. Reativar ou reciclar.`,
      "media",
      { title: "Reativar lead parado", type: "whatsapp", dueInDays: 1 },
    );
  }

  // ─── 10. Lead quente sem responsável ─────────────────────────────────────
  if (
    (contact.temperatura === "quente" || contact.temperatura === "burning") &&
    !contact.responsavelUnidade
  ) {
    return mk(
      "atualizar_dados",
      "Lead quente sem responsável atribuído. Atribuir e dar sequência.",
      "alta",
      {
        title: "Atribuir responsável ao lead quente",
        type: "note",
        dueInDays: 0,
      },
    );
  }

  // ─── 11. Status "respondeu" / "em_abordagem" sem follow-up ──────────────
  if (
    ["em_abordagem", "respondeu"].includes(contact.status) &&
    !contact.proximoFollowup
  ) {
    return mk(
      "agendar_reuniao",
      "Lead respondeu mas não tem próximo follow-up. Agendar reunião.",
      "alta",
      { title: "Agendar reunião com lead", type: "meeting", dueInDays: 2 },
    );
  }

  // ─── 12. Lead qualificado sem deal ───────────────────────────────────────
  if (contact.status === "qualificado" && !deal) {
    return mk(
      "criar_oportunidade",
      "Lead qualificado mas sem oportunidade criada. Criar negócio.",
      "media",
      { title: "Criar oportunidade", type: "note", dueInDays: 1 },
    );
  }

  // ─── 13. Default — sem ação imediata ─────────────────────────────────────
  if (isFinalizado(contact.status)) {
    if (contact.status === "cliente") {
      return mk(
        "encaminhar_pos_venda",
        "Cliente ativo. Avaliar oportunidades de expansão ou follow-up de relacionamento.",
        "baixa",
        { title: "Avaliar expansão / pós-venda", type: "note", dueInDays: 14 },
      );
    }
    return mk(
      "sem_acao_no_momento",
      `Contato em estado final (${contact.status}).`,
      "baixa",
      null,
    );
  }

  return mk(
    "sem_acao_no_momento",
    "Sem ação urgente no momento. Manter rotina de follow-up.",
    "baixa",
    null,
  );
}

function mk(
  action: NextStepAction,
  reason: string,
  priority: NextStepRecommendation["priority"],
  taskTemplate: NextStepRecommendation["taskTemplate"],
): NextStepRecommendation {
  return {
    action,
    label: NEXT_STEP_LABELS[action],
    reason,
    priority,
    taskTemplate,
  };
}

export { NEXT_STEP_ACTIONS, NEXT_STEP_LABELS, NEXT_STEP_PRIORITIES };
