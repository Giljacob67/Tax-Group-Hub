-- Migration 003: Corrige deals cujo campo `stage` foi gravado com um valor do
-- vocabulário de STATUS DE CONTATO (crm_contacts.status) em vez de um DealStage.
--
-- Sintoma: Kanban do CRM (ex.: pipeline "Lote 1 — 30 Contas Piloto") mostra as
-- colunas corretas mas sem cards, porque deals com stage = 'em_abordagem' /
-- 'nao_iniciado' / etc. não casam com nenhuma coluna de deal-stage e são
-- descartados no agrupamento (GET /api/crm/deals/pipeline).
--
-- Esta migração espelha o mapa CONTACT_STATUS_TO_DEAL_STAGE (lib/db/src/crm-constants.ts).
-- Só remapeia os valores que são EXCLUSIVOS do vocabulário de status de contato.
-- Valores que pertencem aos dois vocabulários (reuniao_agendada, aguardando_matriz,
-- proposta_enviada, em_negociacao, stand_by, perdido) já são deal-stages válidos
-- e NÃO são tocados.
--
-- Como executar:
--   psql $DATABASE_URL -f lib/db/migrations/003_deal_stage_from_contact_status.sql

BEGIN;

-- ─── Status de contato exclusivos → deal-stage canônico ────────────────────
UPDATE crm_deals SET stage = 'lead_novo'              WHERE stage = 'nao_iniciado';
UPDATE crm_deals SET stage = 'lead_novo'              WHERE stage = 'em_abordagem';
UPDATE crm_deals SET stage = 'lead_novo'              WHERE stage = 'respondeu';
UPDATE crm_deals SET stage = 'lead_novo'              WHERE stage = 'sem_resposta';
UPDATE crm_deals SET stage = 'qualificacao_comercial' WHERE stage = 'qualificado';
UPDATE crm_deals SET stage = 'enviado_para_matriz'    WHERE stage = 'enviado_matriz';
UPDATE crm_deals SET stage = 'fechado_ganho'          WHERE stage = 'cliente';
UPDATE crm_deals SET stage = 'stand_by'               WHERE stage = 'reciclar_depois';

COMMIT;

-- ─── Verificação (somente leitura) ─────────────────────────────────────────
-- Lista deals que ainda contêm stage fora do enum oficial DEAL_STAGES, para
-- revisão manual. Não são apagados; recebem fallback visual no front.
SELECT 'DEALS COM STAGE NAO-CANONICO' AS categoria, stage, COUNT(*)
FROM crm_deals
WHERE stage NOT IN (
  'lead_novo', 'reuniao_agendada', 'qualificacao_comercial', 'diagnostico_comercial',
  'enviado_para_matriz', 'aguardando_matriz', 'proposta_em_preparacao', 'proposta_pronta',
  'proposta_enviada', 'proposta_apresentada', 'em_negociacao', 'fechado_ganho',
  'perdido', 'stand_by', 'onboarding_cliente', 'execucao_pela_matriz',
  'acompanhamento_pendencias', 'pos_venda_expansao', 'encerrado'
)
GROUP BY stage;
