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
// Alinhado ao Pipeline Tax Group (16 etapas do contato). Adicionadas na Fase 1.5:
//   - reuniao_agendada (anterior à qualificação comercial)
//   - lead_novo (entrada do lead no funil)
//   - onboarding_cliente (após fechamento_ganho)
//   - execucao_pela_matriz (pós-fechamento)
//   - acompanhamento_pendencias (pós-fechamento)
//   - pos_venda_expansao (pós-fechamento)
//   - encerrado (final do ciclo)

export const DEAL_STAGES = [
  "lead_novo",
  "reuniao_agendada",
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
  "onboarding_cliente",
  "execucao_pela_matriz",
  "acompanhamento_pendencias",
  "pos_venda_expansao",
  "encerrado",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead_novo: "Lead Novo",
  reuniao_agendada: "Reunião Agendada",
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
  onboarding_cliente: "Onboarding Cliente",
  execucao_pela_matriz: "Execução pela Matriz",
  acompanhamento_pendencias: "Acomp. Pendências",
  pos_venda_expansao: "Pós-Venda / Expansão",
  encerrado: "Encerrado",
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  lead_novo: "#6B7280",
  reuniao_agendada: "#8B5CF6",
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
  onboarding_cliente: "#14B8A6",
  execucao_pela_matriz: "#A855F7",
  acompanhamento_pendencias: "#F59E0B",
  pos_venda_expansao: "#3B82F6",
  encerrado: "#6B7280",
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
export const CONTACT_STATUS_TO_DEAL_STAGE: Partial<
  Record<ContactStatus, DealStage>
> = {
  nao_iniciado: "lead_novo",
  em_abordagem: "lead_novo",
  respondeu: "lead_novo",
  reuniao_agendada: "reuniao_agendada",
  qualificado: "qualificacao_comercial",
  enviado_matriz: "enviado_para_matriz",
  aguardando_matriz: "aguardando_matriz",
  proposta_enviada: "proposta_enviada",
  em_negociacao: "em_negociacao",
  cliente: "fechado_ganho",
  sem_resposta: "lead_novo",
  reciclar_depois: "stand_by",
  stand_by: "stand_by",
  perdido: "perdido",
};

// ─── Deal Stage → Contact Status mapping ─────────────────────────────────────

/**
 * When a deal stage changes, suggests the corresponding contact status.
 */
export const DEAL_STAGE_TO_CONTACT_STATUS: Partial<
  Record<DealStage, ContactStatus>
> = {
  lead_novo: "nao_iniciado",
  reuniao_agendada: "reuniao_agendada",
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
  onboarding_cliente: "cliente",
  execucao_pela_matriz: "cliente",
  acompanhamento_pendencias: "cliente",
  pos_venda_expansao: "cliente",
  encerrado: "cliente",
};

/**
 * Documentação do alinhamento entre as 16 etapas do Pipeline Tax Group
 * (pipeline do contato) e as 19 etapas do Deal. O deal replica as 16
 * etapas do pipeline e adiciona 3 granularidades operacionais:
 *   - proposta_em_preparacao, proposta_pronta, proposta_apresentada
 *     (sub-etapas da fase de proposta do pipeline).
 *
 * Mapeamento de equivalência (etapas pós-fechamento foram alinhadas):
 *   lead_novo                       → lead_novo
 *   qualificacao_comercial          → qualificacao_comercial
 *   reuniao_agendada                → reuniao_agendada
 *   diagnostico_comercial           → diagnostico_comercial
 *   enviado_para_matriz             → enviado_para_matriz
 *   aguardando_matriz               → aguardando_matriz
 *   proposta_pronta                 → proposta_em_preparacao / proposta_pronta
 *   apresentacao_ao_cliente         → proposta_apresentada
 *   negociacao                      → em_negociacao
 *   fechado_ganho                   → fechado_ganho
 *   perdido_standby                 → perdido / stand_by
 *   onboarding_cliente              → onboarding_cliente
 *   execucao_pela_matriz            → execucao_pela_matriz
 *   acompanhamento_pendencias       → acompanhamento_pendencias
 *   pos_venda_expansao              → pos_venda_expansao
 *   encerrado                       → encerrado
 */
export const PIPELINE_TO_DEAL_STAGE: Record<
  PipelineStage,
  DealStage | DealStage[]
> = {
  lead_novo: "lead_novo",
  qualificacao_comercial: "qualificacao_comercial",
  reuniao_agendada: "reuniao_agendada",
  diagnostico_comercial: "diagnostico_comercial",
  enviado_para_matriz: "enviado_para_matriz",
  aguardando_matriz: "aguardando_matriz",
  proposta_pronta: ["proposta_em_preparacao", "proposta_pronta"],
  apresentacao_ao_cliente: "proposta_apresentada",
  negociacao: "em_negociacao",
  fechado_ganho: "fechado_ganho",
  perdido_standby: ["perdido", "stand_by"],
  onboarding_cliente: "onboarding_cliente",
  execucao_pela_matriz: "execucao_pela_matriz",
  acompanhamento_pendencias: "acompanhamento_pendencias",
  pos_venda_expansao: "pos_venda_expansao",
  encerrado: "encerrado",
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
 * Aplicado em runtime pelo endpoint de migração (Fase 1.5).
 */
export const LEGACY_DEAL_STAGE_MAP: Record<string, DealStage> = {
  // inglês legado
  prospecting: "lead_novo",
  discovery: "diagnostico_comercial",
  proposal: "proposta_em_preparacao",
  negotiation: "em_negociacao",
  closing: "em_negociacao",
  won: "fechado_ganho",
  lost: "perdido",
  // pt-br legado (labels humanos)
  prospecção: "lead_novo",
  "contato inicial": "reuniao_agendada",
  qualificação: "qualificacao_comercial",
  descoberta: "diagnostico_comercial",
  proposta: "proposta_em_preparacao",
  negociação: "em_negociacao",
  fechamento: "em_negociacao",
  ganhos: "fechado_ganho",
  perdidos: "perdido",
  onboarding: "onboarding_cliente",
  "pós-venda": "pos_venda_expansao",
  renovação: "pos_venda_expansao",
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
// Fase 1.5 — enum padronizado exigido pelo escopo. Inclui todos os
// estados intermediários de uma proposta, do início à renegociação.

export const PROPOSTA_STATUS = [
  "em_preparacao",
  "pronta",
  "enviada",
  "apresentada",
  "aceita",
  "recusada",
  "em_renegociacao",
] as const;

export type PropostaStatus = (typeof PROPOSTA_STATUS)[number];

export const PROPOSTA_STATUS_LABELS: Record<PropostaStatus, string> = {
  em_preparacao: "Em preparação",
  pronta: "Pronta",
  enviada: "Enviada",
  apresentada: "Apresentada",
  aceita: "Aceita",
  recusada: "Recusada",
  em_renegociacao: "Em renegociação",
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
    id: "sv_todos_matriz",
    name: "Todos na Matriz",
    emoji: "📊",
    category: "matriz",
    filters: { statusMatriz: "todos" },
    description: "Todos os deals em qualquer status da Matriz",
  },
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

export const TEMPERATURA_SUGERIDA = [
  "frio",
  "morno",
  "quente",
  "burning",
] as const;
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
  score: number; // 0-100
  tier: QualificationTier;
  temperatura_sugerida: TemperaturaSugerida;
  setor_inferido: string | null;
  segmento_inferido: string | null;
  potencial_comercial: string | null; // ex: "R$ 20-50k"
  produto_recomendado: string | null; // ex: "AFD", "RTI"
  sinais_oportunidade: string[];
  dores_percebidas: string[];
  maturidade: MaturidadeNivel;
  urgencia: UrgenciaNivel;
  risco: RiscoNivel;
  proximo_passo: string;
  observacoes_reuniao: string[];
  alerta_matriz: boolean;
  depende_validacao_matriz: boolean;
  confidence: number; // 0-100
  facts: InsightItem[];
  inferences: InsightItem[];
  hypotheses: InsightItem[];
  reasoning: string; // resumo em texto livre
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

export const NEXT_STEP_PRIORITIES = [
  "baixa",
  "media",
  "alta",
  "urgente",
] as const;
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
  {
    id: "faturamento_estimado",
    label: "Faturamento estimado",
    required: false,
  },
  { id: "decisor", label: "Decisor (nome e cargo)", required: true },
  {
    id: "contato_decisor",
    label: "Contato do decisor (telefone/e-mail)",
    required: true,
  },
  { id: "dor_comercial", label: "Dor comercial percebida", required: false },
  {
    id: "resumo_diagnostico",
    label: "Resumo do diagnóstico comercial",
    required: true,
  },
  {
    id: "expectativa_cliente",
    label: "Expectativa do cliente",
    required: false,
  },
  {
    id: "prazo_desejado",
    label: "Prazo desejado pelo cliente",
    required: false,
  },
  { id: "concorrencia", label: "Concorrência / comparação", required: false },
  {
    id: "documentos_relevantes",
    label: "Documentos relevantes anexados",
    required: false,
  },
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

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTriggerType, string> =
  {
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

export const PRIORIDADE_COMERCIAL_NIVEIS = [
  "baixa",
  "media",
  "alta",
  "critica",
] as const;
export type PrioridadeComercialNivel =
  (typeof PRIORIDADE_COMERCIAL_NIVEIS)[number];

// ─── Task Source (origem da tarefa) ─────────────────────────────────────────

export const TASK_SOURCES = [
  "manual",
  "automation",
  "ai_suggestion",
  "next_step",
] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 4 — GOVERANÇA, RBAC, AUDITORIA, DASHBOARDS
// ════════════════════════════════════════════════════════════════════════════════

// ─── Perfis (RBAC) ────────────────────────────────────────────────────────────

export const APP_ROLES = [
  "admin",
  "coordenador",
  "comercial",
  "marketing",
  "leitura",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  coordenador: "Coordenação",
  comercial: "Comercial",
  marketing: "Marketing",
  leitura: "Leitura / Consulta",
};

export const APP_ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Acesso total. Gerencia usuários, configurações e dados.",
  coordenador:
    "Visualiza dashboards executivos, gerencia equipe, edita leads/deals/automations.",
  comercial: "Edita leads, deals, tarefas e listas. Não gerencia equipe.",
  marketing: "Visualiza dados para campanhas. Cria listas. Não edita pipeline.",
  leitura: "Apenas leitura. Não edita nada.",
};

/**
 * Matriz de permissões por papel. Define o que cada papel pode fazer.
 * Backend deve verificar essas permissões antes de operações sensíveis.
 */
export const ROLE_PERMISSIONS = {
  admin: {
    canViewAll: true,
    canEditAll: true,
    canManageUsers: true,
    canManageSettings: true,
    canEditPipeline: true,
    canEditStatus: true,
    canCreateLists: true,
    canDeleteLists: true,
    canEditSystemViews: true,
    canExport: true,
    canTriggerIA: true,
    canManageAutomations: true,
    canViewDashboards: true,
    canViewAudit: true,
    canEditProposals: true,
  },
  coordenador: {
    canViewAll: true,
    canEditAll: true,
    canManageUsers: false,
    canManageSettings: false,
    canEditPipeline: true,
    canEditStatus: true,
    canCreateLists: true,
    canDeleteLists: true,
    canEditSystemViews: false,
    canExport: true,
    canTriggerIA: true,
    canManageAutomations: true,
    canViewDashboards: true,
    canViewAudit: true,
    canEditProposals: true,
  },
  comercial: {
    canViewAll: true,
    canEditAll: true,
    canManageUsers: false,
    canManageSettings: false,
    canEditPipeline: true,
    canEditStatus: true,
    canCreateLists: true,
    canDeleteLists: false,
    canEditSystemViews: false,
    canExport: true,
    canTriggerIA: true,
    canManageAutomations: false,
    canViewDashboards: true,
    canViewAudit: false,
    canEditProposals: true,
  },
  marketing: {
    canViewAll: true,
    canEditAll: false,
    canManageUsers: false,
    canManageSettings: false,
    canEditPipeline: false,
    canEditStatus: false,
    canCreateLists: true,
    canDeleteLists: false,
    canEditSystemViews: false,
    canExport: true,
    canTriggerIA: false,
    canManageAutomations: false,
    canViewDashboards: true,
    canViewAudit: false,
    canEditProposals: false,
  },
  leitura: {
    canViewAll: true,
    canEditAll: false,
    canManageUsers: false,
    canManageSettings: false,
    canEditPipeline: false,
    canEditStatus: false,
    canCreateLists: false,
    canDeleteLists: false,
    canEditSystemViews: false,
    canExport: true,
    canTriggerIA: false,
    canManageAutomations: false,
    canViewDashboards: true,
    canViewAudit: false,
    canEditProposals: false,
  },
} as const;

export type Permission = keyof (typeof ROLE_PERMISSIONS)["admin"];

// ─── Audit Log ─────────────────────────────────────────────────────────────────

export const AUDIT_ENTITY_TYPES = [
  "contact",
  "deal",
  "task",
  "view",
  "automation",
  "sequence",
  "alert",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "status_change",
  "stage_change",
  "assign",
  "qualify",
  "enrich",
  "bulk_update",
  "send_to_matriz",
  "matriz_return",
  "proposal_create",
  "proposal_send",
  "proposal_present",
  "win",
  "loss",
  "onboard_start",
  "pos_venda_start",
  "automation_fired",
  "task_auto_created",
  "task_completed",
  "alert_created",
  "alert_resolved",
  "view_saved",
  "view_deleted",
  "export",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  status_change: "Mudança de status",
  stage_change: "Mudança de etapa",
  assign: "Atribuição",
  qualify: "Qualificação IA",
  enrich: "Enriquecimento",
  bulk_update: "Atualização em massa",
  send_to_matriz: "Envio para Matriz",
  matriz_return: "Retorno da Matriz",
  proposal_create: "Proposta criada",
  proposal_send: "Proposta enviada",
  proposal_present: "Proposta apresentada",
  win: "Ganho",
  loss: "Perda",
  onboard_start: "Onboarding iniciado",
  pos_venda_start: "Pós-venda iniciado",
  automation_fired: "Automação disparada",
  task_auto_created: "Tarefa automática",
  task_completed: "Tarefa concluída",
  alert_created: "Alerta gerado",
  alert_resolved: "Alerta resolvido",
  view_saved: "View salva",
  view_deleted: "View excluída",
  export: "Exportação",
};

export const AUDIT_ACTOR_TYPES = [
  "user",
  "ia",
  "automation",
  "integration",
  "service",
] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_ACTOR_LABELS: Record<AuditActorType, string> = {
  user: "Usuário",
  ia: "IA",
  automation: "Automação",
  integration: "Integração",
  service: "Serviço",
};

// ─── Dashboards ───────────────────────────────────────────────────────────────

export const DASHBOARD_PERIODS = [
  "7d",
  "30d",
  "90d",
  "this_month",
  "all",
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  this_month: "Este mês",
  all: "Todo o período",
};

export const DASHBOARD_PERSONAS = [
  "executive",
  "coordenador",
  "operacional",
  "pos_venda",
] as const;
export type DashboardPersona = (typeof DASHBOARD_PERSONAS)[number];

export const DASHBOARD_PERSONA_LABELS: Record<DashboardPersona, string> = {
  executive: "Executivo da Unidade",
  coordenador: "Coordenador Comercial",
  operacional: "Operacional / Dia a Dia",
  pos_venda: "Pós-Venda / Expansão",
};

// ─── Queues (filas) ────────────────────────────────────────────────────────────

export const QUEUE_TYPES = [
  "my_accounts",
  "my_deals",
  "team",
  "no_responsible",
  "matriz_waiting",
  "matriz_overdue",
  "no_followup",
  "hot_leads",
  "needs_attention",
] as const;
export type QueueType = (typeof QUEUE_TYPES)[number];

export const QUEUE_LABELS: Record<QueueType, string> = {
  my_accounts: "Minhas contas",
  my_deals: "Meus negócios",
  team: "Carteira da equipe",
  no_responsible: "Sem responsável",
  matriz_waiting: "Aguardando Matriz",
  matriz_overdue: "Matriz acima do prazo",
  no_followup: "Sem follow-up definido",
  hot_leads: "Leads quentes",
  needs_attention: "Precisam de atenção",
};

// ─── Data Quality ─────────────────────────────────────────────────────────────

export const QUALITY_RULES = [
  "missing_cnpj",
  "missing_razao_social",
  "missing_contato",
  "missing_setor",
  "missing_regime_tributario",
  "missing_decisor",
  "no_responsavel",
  "no_followup",
  "no_deal_qualificado",
  "matriz_no_briefing",
  "proposta_no_status",
  "perda_no_motivo",
] as const;
export type QualityRule = (typeof QUALITY_RULES)[number];

export const QUALITY_RULE_LABELS: Record<QualityRule, string> = {
  missing_cnpj: "CNPJ ausente",
  missing_razao_social: "Razão social ausente",
  missing_contato: "Sem telefone/e-mail",
  missing_setor: "Setor não definido",
  missing_regime_tributario: "Regime tributário não definido",
  missing_decisor: "Decisor não identificado",
  no_responsavel: "Sem responsável atribuído",
  no_followup: "Sem próximo follow-up",
  no_deal_qualificado: "Lead qualificado sem negócio",
  matriz_no_briefing: "Enviado para Matriz sem briefing",
  proposta_no_status: "Proposta sem status definido",
  perda_no_motivo: "Perda sem motivo registrado",
};

export const QUALITY_SEVERITIES: Record<
  QualityRule,
  "info" | "warning" | "critical"
> = {
  missing_cnpj: "critical",
  missing_razao_social: "critical",
  missing_contato: "critical",
  missing_setor: "warning",
  missing_regime_tributario: "warning",
  missing_decisor: "warning",
  no_responsavel: "warning",
  no_followup: "info",
  no_deal_qualificado: "info",
  matriz_no_briefing: "critical",
  proposta_no_status: "warning",
  perda_no_motivo: "info",
};
