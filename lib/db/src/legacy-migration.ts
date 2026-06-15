/**
 * CRM — Fase 1.5 — Migração de Dados Legados
 *
 * Aplica LEGACY_CONTACT_STATUS_MAP e LEGACY_DEAL_STAGE_MAP em runtime
 * durante listagens. Garante que:
 *   - Registros antigos não quebrem a UI (todos os valores recebem fallback
 *     visual "legado" se não houver mapeamento).
 *   - Sem apagar dados: o valor original é preservado, mas o valor canônico
 *     é derivado para exibição e filtros.
 *
 * Como usar:
 *   import { normalizeContactStatus, normalizeDealStage } from "@workspace/db/legacy-migration";
 *   const display = normalizeContactStatus(row.status);
 */

import {
  LEGACY_CONTACT_STATUS_MAP,
  LEGACY_DEAL_STAGE_MAP,
  CONTACT_STATUS_TO_DEAL_STAGE,
  type ContactStatus,
  type DealStage,
} from "./crm-constants.js";

const SENTINEL_LEGACY = "__legacy__";

/**
 * Normaliza um status de contato possivelmente legado para o enum atual.
 * Se não houver mapeamento, devolve null e a UI deve aplicar fallback visual.
 */
export function normalizeContactStatus(
  raw: string | null | undefined,
): ContactStatus | null {
  if (!raw) return null;
  if (Object.values(LEGACY_CONTACT_STATUS_MAP).includes(raw as ContactStatus)) {
    return raw as ContactStatus;
  }
  const mapped = LEGACY_CONTACT_STATUS_MAP[raw.toLowerCase?.() ?? raw];
  return mapped || null;
}

/**
 * Normaliza um stage de deal possivelmente legado para o enum atual.
 */
export function normalizeDealStage(
  raw: string | null | undefined,
): DealStage | null {
  if (!raw) return null;
  if (Object.values(LEGACY_DEAL_STAGE_MAP).includes(raw as DealStage)) {
    return raw as DealStage;
  }
  const mapped = LEGACY_DEAL_STAGE_MAP[raw.toLowerCase?.() ?? raw];
  return mapped || null;
}

/**
 * Resolve um valor bruto do campo `stage` de um deal para um DealStage canônico,
 * cobrindo o caso em que o `stage` foi gravado com um valor do vocabulário de
 * STATUS DE CONTATO (ex.: "nao_iniciado", "em_abordagem", "qualificado") — algo
 * que acontece em deals importados/criados a partir do status do contato.
 *
 * Ordem de resolução:
 *   1. normalizeDealStage  → deal-stage canônico ou legado mapeado (DL EN/PT).
 *   2. CONTACT_STATUS_TO_DEAL_STAGE → ponte status-de-contato → deal-stage.
 *   3. null (valor genuinamente desconhecido; o chamador preserva o original).
 *
 * É idempotente para valores que pertencem aos dois vocabulários
 * (reuniao_agendada, aguardando_matriz, em_negociacao, stand_by, perdido):
 * o passo 1 já os resolve, então a ponte nunca os altera.
 */
export function resolveDealStage(
  raw: string | null | undefined,
): DealStage | null {
  if (!raw) return null;
  const canonical = normalizeDealStage(raw);
  if (canonical) return canonical;
  const bridged = CONTACT_STATUS_TO_DEAL_STAGE[raw as ContactStatus];
  return bridged ?? null;
}

/**
 * Indica se um status é puramente legado (sem mapeamento canônico).
 * Usado pela UI para exibir um badge "legado" discreto.
 */
export function isLegacyStatus(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return raw === SENTINEL_LEGACY || !normalizeContactStatus(raw);
}

/**
 * Indica se um stage é puramente legado.
 */
export function isLegacyStage(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return raw === SENTINEL_LEGACY || !normalizeDealStage(raw);
}

/**
 * Wrapper seguro: devolve o status canônico ou a string original marcada
 * como legada. A UI pode usar para exibir diretamente.
 */
export function safeContactStatus(
  raw: string | null | undefined,
): ContactStatus | string {
  return (
    normalizeContactStatus(raw) || (raw ? `__legacy__:${raw}` : "nao_iniciado")
  );
}

/**
 * Wrapper seguro: devolve o stage canônico ou a string original marcada
 * como legada.
 */
export function safeDealStage(
  raw: string | null | undefined,
): DealStage | string {
  return normalizeDealStage(raw) || (raw ? `__legacy__:${raw}` : "lead_novo");
}
