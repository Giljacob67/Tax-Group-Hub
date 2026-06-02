/**
 * CRM Constants — Tax Group Hub
 *
 * Single source of truth for all CRM enums, labels, and pipeline configuration.
 * Imported by both backend (routes) and frontend (pages/components).
 *
 * Phase 1 — Fundação operacional do CRM
 */

// ─── Pipeline Tax Group ──────────────────────────────────────────────────────

export const PIPELINE_TAX_GROUP_STAGES = [
  "lead_novo",
  "qualificacao_comercial",
  "reuniao_agendada",
  "diagnostico_comercial",
  "enviado_para_matriz",
  "aguardando_matriz",
  "proposta_pronta",
  "apresentacao_ao_cliente",
  "negociacao",
  "fechado_ganho",
  "perdido_standby",
  "onboarding_cliente",
  "execucao_pela_matriz",
  "acompanhamento_pendencias",
  "pos_venda_expansao",
  "encerrado",
] as const;

export type PipelineStage = (typeof PIPELINE_TAX_GROUP_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  lead_novo: "Lead Novo",
  qualificacao_comercial: "Qualificação Comercial",
  reuniao_agendada: "Reunião Agendada",
  diagnostico_comercial: "Diagnóstico Comercial",
  enviado_para_matriz: "Enviado p/ Matriz",
  aguardando_matriz: "Aguardando Matriz",
  proposta_pronta: "Proposta Pronta",
  apresentacao_ao_cliente: "Apresentação ao Cliente",
  negociacao: "Negociação",
  fechado_ganho: "Fechado Ganho",
  perdido_standby: "Perdido / Standby",
  onboarding_cliente: "Onboarding Cliente",
  execucao_pela_matriz: "Execução pela Matriz",
  acompanhamento_pendencias: "Acomp. Pendências",
  pos_venda_expansao: "Pós-Venda / Expansão",
  encerrado: "Encerrado",
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  lead_novo: "#6B7280",
  qualificacao_comercial: "#3B82F6",
  reuniao_agendada: "#8B5CF6",
  diagnostico_comercial: "#F59E0B",
  enviado_para_matriz: "#EC4899",
  aguardando_matriz: "#F97316",
  proposta_pronta: "#10B981",
  apresentacao_ao_cliente: "#06B6D4",
  negociacao: "#6366F1",
  fechado_ganho: "#22C55E",
  perdido_standby: "#EF4444",
  onboarding_cliente: "#14B8A6",
  execucao_pela_matriz: "#A855F7",
  acompanhamento_pendencias: "#F59E0B",
  pos_venda_expansao: "#3B82F6",
  encerrado: "#6B7280",
};

// ─── Contact Status (Comercial) ──────────────────────────────────────────────

export const CONTACT_STATUSES = [
  "nao_iniciado",
  "em_abordagem",
  "respondeu",
  "reuniao_agendada",
  "qualificado",
  "enviado_matriz",
  "aguardando_matriz",
  "proposta_enviada",
  "em_negociacao",
  "cliente",
  "sem_resposta",
  "reciclar_depois",
  "stand_by",
  "perdido",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  nao_iniciado: "Não Iniciado",
  em_abordagem: "Em Abordagem",
  respondeu: "Respondeu",
  reuniao_agendada: "Reunião Agendada",
  qualificado: "Qualificado",
  enviado_matriz: "Enviado p/ Matriz",
  aguardando_matriz: "Aguardando Matriz",
  proposta_enviada: "Proposta Enviada",
  em_negociacao: "Em Negociação",
  cliente: "Cliente",
  sem_resposta: "Sem Resposta",
  reciclar_depois: "Reciclar Depois",
  stand_by: "Stand By",
  perdido: "Perdido",
};

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  nao_iniciado: "#6B7280",
  em_abordagem: "#3B82F6",
  respondeu: "#8B5CF6",
  reuniao_agendada: "#A855F7",
  qualificado: "#10B981",
  enviado_matriz: "#EC4899",
  aguardando_matriz: "#F97316",
  proposta_enviada: "#06B6D4",
  em_negociacao: "#6366F1",
  cliente: "#22C55E",
  sem_resposta: "#EF4444",
  reciclar_depois: "#F59E0B",
  stand_by: "#9CA3AF",
  perdido: "#DC2626",
};

// ─── Deal Stage ──────────────────────────────────────────────────────────────

export const DEAL_STAGES = [
  "qualificacao_comercial",
  "diagnostico_comercial",
  "enviado_para_matriz",
  "aguardando_matriz",
  "proposta_em_preparacao",
  "proposta_pronta",
  "proposta_enviada",
  "proposta_apresentada",
  "em_negociacao",
  "fechado_ganho",
  "perdido",
  "stand_by",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  qualificacao_comercial: "Qualificação Comercial",
  diagnostico_comercial: "Diagnóstico Comercial",
  enviado_para_matriz: "Enviado p/ Matriz",
  aguardando_matriz: "Aguardando Matriz",
  proposta_em_preparacao: "Proposta em Preparação",
  proposta_pronta: "Proposta Pronta",
  proposta_enviada: "Proposta Enviada",
  proposta_apresentada: "Proposta Apresentada",
  em_negociacao: "Em Negociação",
  fechado_ganho: "Fechado Ganho",
  perdido: "Perdido",
  stand_by: "Stand By",
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  qualificacao_comercial: "#3B82F6",
  diagnostico_comercial: "#F59E0B",
  enviado_para_matriz: "#EC4899",
  aguardando_matriz: "#F97316",
  proposta_em_preparacao: "#8B5CF6",
  proposta_pronta: "#10B981",
  proposta_enviada: "#06B6D4",
  proposta_apresentada: "#6366F1",
  em_negociacao: "#A855F7",
  fechado_ganho: "#22C55E",
  perdido: "#EF4444",
  stand_by: "#9CA3AF",
};

// ─── Matrix Status ───────────────────────────────────────────────────────────

export const MATRIX_STATUSES = [
  "nao_enviado",
  "enviado",
  "aguardando",
  "pendencia_documental",
  "retorno_recebido",
  "proposta_liberada",
] as const;

export type MatrixStatus = (typeof MATRIX_STATUSES)[number];

export const MATRIX_STATUS_LABELS: Record<MatrixStatus, string> = {
  nao_enviado: "Não Enviado",
  enviado: "Enviado",
  aguardando: "Aguardando",
  pendencia_documental: "Pendência Documental",
  retorno_recebido: "Retorno Recebido",
  proposta_liberada: "Proposta Liberada",
};

export const MATRIX_STATUS_COLORS: Record<MatrixStatus, string> = {
  nao_enviado: "#6B7280",
  enviado: "#3B82F6",
  aguardando: "#F97316",
  pendencia_documental: "#EF4444",
  retorno_recebido: "#10B981",
  proposta_liberada: "#22C55E",
};

// ─── Contact Status → Deal Stage mapping ─────────────────────────────────────

/**
 * When a contact status changes, suggests the corresponding deal stage.
 * A deal is only created when the contact reaches "qualificado" or later.
 */
export const CONTACT_STATUS_TO_DEAL_STAGE: Partial<Record<ContactStatus, DealStage>> = {
  qualificado: "qualificacao_comercial",
  reuniao_agendada: "qualificacao_comercial",
  enviado_matriz: "enviado_para_matriz",
  aguardando_matriz: "aguardando_matriz",
  proposta_enviada: "proposta_enviada",
  em_negociacao: "em_negociacao",
  cliente: "fechado_ganho",
  perdido: "perdido",
};

// ─── Deal Stage → Contact Status mapping ─────────────────────────────────────

/**
 * When a deal stage changes, suggests the corresponding contact status.
 */
export const DEAL_STAGE_TO_CONTACT_STATUS: Partial<Record<DealStage, ContactStatus>> = {
  qualificacao_comercial: "qualificado",
  diagnostico_comercial: "qualificado",
  enviado_para_matriz: "enviado_matriz",
  aguardando_matriz: "aguardando_matriz",
  proposta_em_preparacao: "proposta_enviada",
  proposta_pronta: "proposta_enviada",
  proposta_enviada: "proposta_enviada",
  proposta_apresentada: "em_negociacao",
  em_negociacao: "em_negociacao",
  fechado_ganho: "cliente",
  perdido: "perdido",
  stand_by: "stand_by",
};

// ─── Legacy status migration map ─────────────────────────────────────────────

/**
 * Maps old contact status values to new ones for data migration.
 */
export const LEGACY_CONTACT_STATUS_MAP: Record<string, ContactStatus> = {
  prospect: "nao_iniciado",
  qualified: "qualificado",
  opportunity: "em_negociacao",
  client: "cliente",
  churned: "perdido",
  lost: "perdido",
};

/**
 * Maps old deal stage values to new ones for data migration.
 */
export const LEGACY_DEAL_STAGE_MAP: Record<string, DealStage> = {
  prospecting: "qualificacao_comercial",
  discovery: "diagnostico_comercial",
  proposal: "proposta_em_preparacao",
  negotiation: "em_negociacao",
  closing: "em_negociacao",
  won: "fechado_ganho",
  lost: "perdido",
};

// ─── Origem Lead ─────────────────────────────────────────────────────────────

export const ORIGEM_LEAD_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "empresaqui", label: "EmpresAqui" },
  { value: "webhook", label: "Webhook" },
  { value: "import", label: "Importação" },
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "eventos", label: "Eventos" },
  { value: "outbound", label: "Outbound" },
  { value: "parceiro", label: "Parceiro" },
] as const;

// ─── Temperatura ─────────────────────────────────────────────────────────────

export const TEMPERATURA_OPTIONS = [
  { value: "frio", label: "Frio", color: "#3B82F6" },
  { value: "morno", label: "Morno", color: "#F59E0B" },
  { value: "quente", label: "Quente", color: "#EF4444" },
  { value: "burning", label: "Burning", color: "#DC2626" },
] as const;

// ─── Produto de Interesse ────────────────────────────────────────────────────

export const PRODUTO_INTERESSE_OPTIONS = [
  { value: "rti", label: "RTI" },
  { value: "afd", label: "AFD" },
  { value: "rep", label: "REP" },
  { value: "reforma_tributaria", label: "Reforma Tributária" },
  { value: "consultoria", label: "Consultoria" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "outro", label: "Outro" },
] as const;

// ─── Proposta Status ─────────────────────────────────────────────────────────

export const PROPOSTA_STATUS = [
  "oportunidade_qualificada",
  "proposta_em_preparacao",
  "proposta_pronta",
  "proposta_enviada",
  "proposta_apresentada",
  "em_negociacao",
] as const;

export type PropostaStatus = (typeof PROPOSTA_STATUS)[number];

export const PROPOSTA_STATUS_LABELS: Record<PropostaStatus, string> = {
  oportunidade_qualificada: "Oportunidade Qualificada",
  proposta_em_preparacao: "Proposta em Preparação",
  proposta_pronta: "Proposta Pronta",
  proposta_enviada: "Proposta Enviada",
  proposta_apresentada: "Proposta Apresentada",
  em_negociacao: "Em Negociação",
};

// ─── Default pipeline ────────────────────────────────────────────────────────

export const DEFAULT_PIPELINE_ID = "tax-group";
export const DEFAULT_PIPELINE_NAME = "Tax Group";

// ─── Saved View Types ───────────────────────────────────────────────────────

export const SAVED_VIEW_TYPES = ["system", "user"] as const;
export type SavedViewType = (typeof SAVED_VIEW_TYPES)[number];

// ─── System Views — Tax Group Operational Views ──────────────────────────────
// These are the predefined views that ship with the CRM for daily operations.
// Each view defines a set of filter criteria that map to backend query params.

export type SystemViewDefinition = {
  id: string;
  name: string;
  emoji: string;
  category: "operacional" | "pipeline" | "matriz" | "followup" | "segmento";
  filters: Record<string, string>;
  description: string;
};

export const SYSTEM_VIEWS: SystemViewDefinition[] = [
  // ── Operacional ──
  {
    id: "sv_todos",
    name: "Todos",
    emoji: "📋",
    category: "operacional",
    filters: {},
    description: "Todos os contatos",
  },
  {
    id: "sv_leads_novos",
    name: "Leads Novos",
    emoji: "🆕",
    category: "operacional",
    filters: { status: "nao_iniciado" },
    description: "Contatos recém-criados, sem ação iniciada",
  },
  {
    id: "sv_nao_iniciado",
    name: "Não Iniciado",
    emoji: "⏳",
    category: "operacional",
    filters: { status: "nao_iniciado" },
    description: "Contatos ainda não contatados",
  },
  {
    id: "sv_em_abordagem",
    name: "Em Abordagem",
    emoji: "📞",
    category: "operacional",
    filters: { status: "em_abordagem" },
    description: "Contatos sendo contatados agora",
  },
  {
    id: "sv_respondeu",
    name: "Respondeu",
    emoji: "💬",
    category: "operacional",
    filters: { status: "respondeu" },
    description: "Contatos que responderam ao primeiro contato",
  },
  {
    id: "sv_reuniao_agendada",
    name: "Reunião Agendada",
    emoji: "📅",
    category: "operacional",
    filters: { status: "reuniao_agendada" },
    description: "Reuniões agendadas com leads",
  },
  {
    id: "sv_qualificados",
    name: "Qualificados",
    emoji: "✅",
    category: "operacional",
    filters: { status: "qualificado" },
    description: "Leads qualificados pela IA ou pelo time",
  },
  {
    id: "sv_sem_resposta",
    name: "Sem Resposta",
    emoji: "🔴",
    category: "operacional",
    filters: { status: "sem_resposta" },
    description: "Contatos que não responderam",
  },
  {
    id: "sv_ganhos",
    name: "Ganhos",
    emoji: "🏆",
    category: "operacional",
    filters: { status: "cliente" },
    description: "Contatos que viraram clientes",
  },
  {
    id: "sv_perdidos",
    name: "Perdidos",
    emoji: "❌",
    category: "operacional",
    filters: { status: "perdido" },
    description: "Contatos perdidos",
  },
  {
    id: "sv_standby",
    name: "Stand By",
    emoji: "⏸️",
    category: "operacional",
    filters: { status: "stand_by" },
    description: "Contatos em espera",
  },
  {
    id: "sv_reciclar",
    name: "Reciclar Depois",
    emoji: "♻️",
    category: "operacional",
    filters: { status: "reciclar_depois" },
    description: "Contatos para recontatar no futuro",
  },

  // ── Pipeline ──
  {
    id: "sv_propostas_abertas",
    name: "Propostas Abertas",
    emoji: "📄",
    category: "pipeline",
    filters: { status: "proposta_enviada" },
    description: "Propostas enviadas aguardando retorno",
  },
  {
    id: "sv_em_negociacao",
    name: "Em Negociação",
    emoji: "🤝",
    category: "pipeline",
    filters: { status: "em_negociacao" },
    description: "Negociações em andamento",
  },
  {
    id: "sv_negociacoes_criticas",
    name: "Negociações Críticas",
    emoji: "🔥",
    category: "pipeline",
    filters: { status: "em_negociacao", scoreMin: "70" },
    description: "Negociações com alto score de prioridade",
  },

  // ── Matriz ──
  {
    id: "sv_enviado_matriz",
    name: "Enviado p/ Matriz",
    emoji: "📤",
    category: "matriz",
    filters: { statusMatriz: "enviado" },
    description: "Propostas enviadas para a Matriz",
  },
  {
    id: "sv_aguardando_matriz",
    name: "Aguardando Matriz",
    emoji: "⏳",
    category: "matriz",
    filters: { statusMatriz: "aguardando" },
    description: "Aguardando retorno da Matriz",
  },
  {
    id: "sv_pendencia_documental",
    name: "Pendência Documental",
    emoji: "📑",
    category: "matriz",
    filters: { statusMatriz: "pendencia_documental" },
    description: "Documentos pendentes na Matriz",
  },
  {
    id: "sv_retorno_recebido",
    name: "Retorno Recebido",
    emoji: "📥",
    category: "matriz",
    filters: { statusMatriz: "retorno_recebido" },
    description: "Retorno recebido da Matriz",
  },
  {
    id: "sv_proposta_liberada",
    name: "Proposta Liberada",
    emoji: "✅",
    category: "matriz",
    filters: { statusMatriz: "proposta_liberada" },
    description: "Propostas liberadas pela Matriz",
  },

  // ── Follow-up ──
  {
    id: "sv_followup_vencidos",
    name: "Follow-ups Vencidos",
    emoji: "⏰",
    category: "followup",
    filters: { followupVencido: "true" },
    description: "Contatos com follow-up atrasado",
  },
  {
    id: "sv_sem_atividade_7d",
    name: "Sem Atividade 7 dias",
    emoji: "📉",
    category: "followup",
    filters: { semAtividadeDias: "7" },
    description: "Contatos sem interação há 7+ dias",
  },
  {
    id: "sv_sem_atividade_14d",
    name: "Sem Atividade 14 dias",
    emoji: "📉",
    category: "followup",
    filters: { semAtividadeDias: "14" },
    description: "Contatos sem interação há 14+ dias",
  },

  // ── Segmento (examples) ──
  {
    id: "sv_leads_quentes",
    name: "Leads Quentes",
    emoji: "🔥",
    category: "segmento",
    filters: { scoreMin: "70" },
    description: "Leads com score IA >= 70",
  },
  {
    id: "sv_onboarding",
    name: "Onboarding",
    emoji: "🚀",
    category: "pipeline",
    filters: { status: "enviado_matriz" },
    description: "Contatos em processo de onboarding",
  },
  {
    id: "sv_pos_venda",
    name: "Pós-Venda / Expansão",
    emoji: "🔄",
    category: "operacional",
    filters: { status: "stand_by" },
    description: "Clientes para expansão de carteira",
  },
];

export const SYSTEM_VIEW_CATEGORIES = [
  { id: "operacional", label: "Operacional", color: "#3B82F6" },
  { id: "pipeline", label: "Pipeline", color: "#8B5CF6" },
  { id: "matriz", label: "Matriz", color: "#F97316" },
  { id: "followup", label: "Follow-up", color: "#EF4444" },
  { id: "segmento", label: "Segmento", color: "#10B981" },
] as const;

// ─── Phase 3 — IA & Automações ──────────────────────────────────────────────

// ─── Qualificação IA — Estrutura de saída ────────────────────────────────────
// A qualificação IA retorna um JSON estruturado que é persistido e
// exibido de forma amigável. Diferencia fato / inferência / hipótese.

export const QUALIFICATION_TIERS = ["A", "B", "C", "D"] as const;
export type QualificationTier = (typeof QUALIFICATION_TIERS)[number];

export const TEMPERATURA_SUGERIDA = ["frio", "morno", "quente", "burning"] as const;
export type TemperaturaSugerida = (typeof TEMPERATURA_SUGERIDA)[number];

export const MATURIDADE_NIVEIS = ["baixa", "media", "alta"] as const;
export type MaturidadeNivel = (typeof MATURIDADE_NIVEIS)[number];

export const URGENCIA_NIVEIS = ["baixa", "media", "alta", "imediata"] as const;
export type UrgenciaNivel = (typeof URGENCIA_NIVEIS)[number];

export const RISCO_NIVEIS = ["baixo", "medio", "alto"] as const;
export type RiscoNivel = (typeof RISCO_NIVEIS)[number];

export type InsightItem = {
  tipo: "fato" | "inferencia" | "hipotese";
  texto: string;
  confianca: "baixa" | "media" | "alta";
};

export type QualificationResult = {
  score: number;            // 0-100
  tier: QualificationTier;
  temperatura_sugerida: TemperaturaSugerida;
  setor_inferido: string | null;
  segmento_inferido: string | null;
  potencial_comercial: string | null;   // ex: "R$ 20-50k"
  produto_recomendado: string | null;    // ex: "AFD", "RTI"
  sinais_oportunidade: string[];
  dores_percebidas: string[];
  maturidade: MaturidadeNivel;
  urgencia: UrgenciaNivel;
  risco: RiscoNivel;
  proximo_passo: string;
  observacoes_reuniao: string[];
  alerta_matriz: boolean;
  depende_validacao_matriz: boolean;
  confidence: number;        // 0-100
  facts: InsightItem[];
  inferences: InsightItem[];
  hypotheses: InsightItem[];
  reasoning: string;         // resumo em texto livre
};

// ─── Próximo Passo Recomendado ───────────────────────────────────────────────
// Motor determinístico que sugere próxima ação com base no estado.
// NÃO usa LLM — é lógica pura para previsibilidade e auditabilidade.

export const NEXT_STEP_ACTIONS = [
  "primeiro_contato",
  "cobrar_retorno",
  "agendar_reuniao",
  "pedir_documentos",
  "montar_briefing_matriz",
  "reenviar_materiais",
  "apresentar_proposta",
  "follow_up_proposta",
  "negociar_condicao",
  "cobrar_pendencia_documental",
  "reativar_lead_morno",
  "encaminhar_pos_venda",
  "criar_oportunidade",
  "atualizar_dados",
  "sem_acao_no_momento",
] as const;
export type NextStepAction = (typeof NEXT_STEP_ACTIONS)[number];

export const NEXT_STEP_LABELS: Record<NextStepAction, string> = {
  primeiro_contato: "Fazer primeiro contato",
  cobrar_retorno: "Cobrar retorno",
  agendar_reuniao: "Agendar reunião",
  pedir_documentos: "Pedir documentos",
  montar_briefing_matriz: "Montar briefing para Matriz",
  reenviar_materiais: "Reenviar materiais",
  apresentar_proposta: "Apresentar proposta",
  follow_up_proposta: "Follow-up de proposta",
  negociar_condicao: "Negociar condição",
  cobrar_pendencia_documental: "Cobrar pendência documental",
  reativar_lead_morno: "Reativar lead morno",
  encaminhar_pos_venda: "Encaminhar para pós-venda",
  criar_oportunidade: "Criar oportunidade",
  atualizar_dados: "Atualizar dados do contato",
  sem_acao_no_momento: "Sem ação no momento",
};

export const NEXT_STEP_PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
export type NextStepPriority = (typeof NEXT_STEP_PRIORITIES)[number];

export type NextStepRecommendation = {
  action: NextStepAction;
  label: string;
  reason: string;
  priority: NextStepPriority;
  taskTemplate: {
    title: string;
    type: "call" | "email" | "whatsapp" | "meeting" | "proposal" | "note";
    dueInDays: number;
  } | null;
};

// ─── Alertas Comerciais ──────────────────────────────────────────────────────

export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_TYPES = [
  "followup_vencido",
  "sem_atividade_7d",
  "sem_atividade_14d",
  "matriz_acima_prazo",
  "pendencia_documental_parada",
  "proposta_sem_retorno",
  "negociacao_parada",
  "onboarding_sem_avanco",
  "conta_expansao_sem_acao",
  "lead_quente_sem_responsavel",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_LABELS: Record<AlertType, string> = {
  followup_vencido: "Follow-up vencido",
  sem_atividade_7d: "Sem atividade há 7+ dias",
  sem_atividade_14d: "Sem atividade há 14+ dias",
  matriz_acima_prazo: "Matriz acima do prazo de retorno",
  pendencia_documental_parada: "Pendência documental parada",
  proposta_sem_retorno: "Proposta sem retorno",
  negociacao_parada: "Negociação parada",
  onboarding_sem_avanco: "Onboarding sem avanço",
  conta_expansao_sem_acao: "Conta com potencial de expansão sem ação",
  lead_quente_sem_responsavel: "Lead quente sem responsável",
};

export const ALERT_SEVERITY_MAP: Record<AlertType, AlertSeverity> = {
  followup_vencido: "warning",
  sem_atividade_7d: "info",
  sem_atividade_14d: "warning",
  matriz_acima_prazo: "critical",
  pendencia_documental_parada: "critical",
  proposta_sem_retorno: "warning",
  negociacao_parada: "warning",
  onboarding_sem_avanco: "warning",
  conta_expansao_sem_acao: "info",
  lead_quente_sem_responsavel: "info",
};

export const ALERT_ICONS: Record<AlertType, string> = {
  followup_vencido: "⏰",
  sem_atividade_7d: "📉",
  sem_atividade_14d: "📉",
  matriz_acima_prazo: "🔴",
  pendencia_documental_parada: "📑",
  proposta_sem_retorno: "📄",
  negociacao_parada: "🤝",
  onboarding_sem_avanco: "🚀",
  conta_expansao_sem_acao: "🔄",
  lead_quente_sem_responsavel: "🔥",
};

// ─── Briefing Checklist — Matriz ────────────────────────────────────────────

export const MATRIZ_BRIEFING_CHECKLIST = [
  { id: "razao_social", label: "Razão social completa", required: true },
  { id: "cnpj", label: "CNPJ", required: true },
  { id: "regime_tributario", label: "Regime tributário", required: true },
  { id: "porte", label: "Porte da empresa", required: true },
  { id: "setor", label: "Setor de atuação", required: true },
  { id: "produto_interesse", label: "Produto de interesse", required: true },
  { id: "faturamento_estimado", label: "Faturamento estimado", required: false },
  { id: "decisor", label: "Decisor (nome e cargo)", required: true },
  { id: "contato_decisor", label: "Contato do decisor (telefone/e-mail)", required: true },
  { id: "dor_comercial", label: "Dor comercial percebida", required: false },
  { id: "resumo_diagnostico", label: "Resumo do diagnóstico comercial", required: true },
  { id: "expectativa_cliente", label: "Expectativa do cliente", required: false },
  { id: "prazo_desejado", label: "Prazo desejado pelo cliente", required: false },
  { id: "concorrencia", label: "Concorrência / comparação", required: false },
  { id: "documentos_relevantes", label: "Documentos relevantes anexados", required: false },
] as const;

// ─── Trigger Types (expandido) ──────────────────────────────────────────────

export const AUTOMATION_TRIGGER_TYPES = [
  "status_changed",
  "score_above",
  "score_below",
  "deal_stage_changed",
  "followup_vencido",
  "sem_atividade_7d",
  "sem_atividade_14d",
  "matriz_enviado",
  "matriz_aguardando",
  "matriz_pendencia",
  "proposta_pronta",
  "proposta_enviada",
  "proposta_sem_retorno_7d",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  status_changed: "Status do contato mudar para...",
  score_above: "Score de IA maior ou igual a...",
  score_below: "Score de IA menor ou igual a...",
  deal_stage_changed: "Etapa do deal mudar para...",
  followup_vencido: "Follow-up vencido",
  sem_atividade_7d: "Sem atividade há 7+ dias",
  sem_atividade_14d: "Sem atividade há 14+ dias",
  matriz_enviado: "Deal enviado para Matriz",
  matriz_aguardando: "Deal aguardando retorno da Matriz",
  matriz_pendencia: "Pendência documental na Matriz",
  proposta_pronta: "Proposta ficou pronta",
  proposta_enviada: "Proposta foi enviada",
  proposta_sem_retorno_7d: "Proposta sem retorno há 7+ dias",
};

// ─── Action Types (expandido) ───────────────────────────────────────────────

export const AUTOMATION_ACTION_TYPES = [
  "create_task",
  "log_activity",
  "enroll_sequence",
  "send_whatsapp",
  "add_tag",
  "set_priority",
  "set_assignee",
  "create_alert",
] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const AUTOMATION_ACTION_LABELS: Record<AutomationActionType, string> = {
  create_task: "Criar Tarefa",
  log_activity: "Registrar Atividade",
  enroll_sequence: "Enrolar em Sequência",
  send_whatsapp: "Registrar intenção WhatsApp",
  add_tag: "Adicionar Tag",
  set_priority: "Marcar prioridade",
  set_assignee: "Atribuir responsável",
  create_alert: "Criar alerta",
};

// ─── Prioridade Comercial — Score Composto ──────────────────────────────────
// Combina IA score + temperatura + urgência + atividade + etapa

export const PRIORIDADE_COMERCIAL_NIVEIS = ["baixa", "media", "alta", "critica"] as const;
export type PrioridadeComercialNivel = (typeof PRIORIDADE_COMERCIAL_NIVEIS)[number];

// ─── Task Source (origem da tarefa) ─────────────────────────────────────────

export const TASK_SOURCES = ["manual", "automation", "ai_suggestion", "next_step"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];
