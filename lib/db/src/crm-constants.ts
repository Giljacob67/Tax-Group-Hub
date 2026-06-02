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
