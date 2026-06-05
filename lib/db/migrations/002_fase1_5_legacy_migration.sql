-- Migration 002: Fase 1.5 — Migração de dados legados
-- Aplica o LEGACY_CONTACT_STATUS_MAP e LEGACY_DEAL_STAGE_MAP em
-- registros que ainda contenham valores antigos. Garante retrocompatibilidade
-- sem perda de dados: valores desconhecidos são preservados.
--
-- Estratégia (Fase 1.5):
--   1. Para cada valor legado, atualiza para o equivalente canônico.
--   2. Para valores sem mapeamento, marca visualmente como "legado" via
--      convenção de log no histórico de auditoria (não toca a coluna).
--   3. Sem apagar dados antigos.
--
-- Como executar:
--   psql $DATABASE_URL -f lib/db/migrations/002_fase1_5_legacy_migration.sql
--   OU usar drizzle-kit push para sincronizar o schema automaticamente.

BEGIN;

-- ─── 1. Migração de status de contato ─────────────────────────────────────
-- prospect     -> nao_iniciado
-- qualified    -> qualificado
-- opportunity  -> em_negociacao
-- client       -> cliente
-- churned      -> perdido
-- lost         -> perdido

UPDATE crm_contacts SET status = 'nao_iniciado'    WHERE LOWER(status) = 'prospect';
UPDATE crm_contacts SET status = 'qualificado'     WHERE LOWER(status) = 'qualified';
UPDATE crm_contacts SET status = 'em_negociacao'   WHERE LOWER(status) = 'opportunity';
UPDATE crm_contacts SET status = 'cliente'         WHERE LOWER(status) = 'client';
UPDATE crm_contacts SET status = 'perdido'         WHERE LOWER(status) IN ('churned', 'lost');

-- Labels PT-BR legados (apenas se ainda existem como status canônico quebrado)
UPDATE crm_contacts SET status = 'nao_iniciado'   WHERE status IN ('prospecção', 'prospeccao', 'contato_inicial');
UPDATE crm_contacts SET status = 'perdido'        WHERE status IN ('perdidos');
UPDATE crm_contacts SET status = 'fechado_ganho'  WHERE status IN ('ganhos');
UPDATE crm_contacts SET status = 'em_negociacao'  WHERE status IN ('negociação', 'negociacao', 'fechamento');

-- ─── 2. Migração de stage do deal ──────────────────────────────────────────
-- prospecting  -> lead_novo
-- discovery    -> diagnostico_comercial
-- proposal     -> proposta_em_preparacao
-- negotiation  -> em_negociacao
-- closing      -> em_negociacao
-- won          -> fechado_ganho
-- lost         -> perdido

UPDATE crm_deals SET stage = 'lead_novo'                WHERE LOWER(stage) = 'prospecting';
UPDATE crm_deals SET stage = 'diagnostico_comercial'    WHERE LOWER(stage) = 'discovery';
UPDATE crm_deals SET stage = 'proposta_em_preparacao'   WHERE LOWER(stage) = 'proposal';
UPDATE crm_deals SET stage = 'em_negociacao'            WHERE LOWER(stage) IN ('negotiation', 'closing');
UPDATE crm_deals SET stage = 'fechado_ganho'            WHERE LOWER(stage) = 'won';
UPDATE crm_deals SET stage = 'perdido'                  WHERE LOWER(stage) = 'lost';

-- Labels PT-BR legados para stage
UPDATE crm_deals SET stage = 'lead_novo'                WHERE stage IN ('Prospecção', 'prospecção', 'prospeccao');
UPDATE crm_deals SET stage = 'reuniao_agendada'         WHERE stage IN ('Contato Inicial', 'contato_inicial', 'Reunião Agendada');
UPDATE crm_deals SET stage = 'qualificacao_comercial'   WHERE stage IN ('Qualificação', 'qualificação');
UPDATE crm_deals SET stage = 'diagnostico_comercial'    WHERE stage IN ('Descoberta', 'descoberta');
UPDATE crm_deals SET stage = 'proposta_em_preparacao'   WHERE stage IN ('Proposta', 'proposta');
UPDATE crm_deals SET stage = 'em_negociacao'            WHERE stage IN ('Negociação', 'negociação', 'Fechamento', 'fechamento');
UPDATE crm_deals SET stage = 'fechado_ganho'            WHERE stage IN ('Ganhos', 'ganhos');
UPDATE crm_deals SET stage = 'perdido'                  WHERE stage IN ('Perdidos', 'perdidos');
UPDATE crm_deals SET stage = 'onboarding_cliente'       WHERE stage IN ('Onboarding', 'onboarding');
UPDATE crm_deals SET stage = 'pos_venda_expansao'       WHERE stage IN ('Pós-Venda', 'pós-venda', 'pos_venda', 'Renovação', 'renovacao');

-- ─── 3. Migração de status_proposta (legado) ──────────────────────────────
-- proposta_em_preparacao -> em_preparacao
-- proposta_pronta        -> pronta
-- proposta_enviada       -> enviada
-- proposta_apresentada   -> apresentada
UPDATE crm_deals SET status_proposta = 'em_preparacao' WHERE status_proposta = 'proposta_em_preparacao';
UPDATE crm_deals SET status_proposta = 'pronta'         WHERE status_proposta = 'proposta_pronta';
UPDATE crm_deals SET status_proposta = 'enviada'        WHERE status_proposta = 'proposta_enviada';
UPDATE crm_deals SET status_proposta = 'apresentada'    WHERE status_proposta = 'proposta_apresentada';
UPDATE crm_deals SET status_proposta = 'em_negociacao'  WHERE status_proposta = 'em_negociacao' AND status_proposta NOT IN ('em_preparacao', 'pronta', 'enviada', 'apresentada', 'aceita', 'recusada', 'em_renegociacao');

-- ─── 4. Migração de status_matriz legado ──────────────────────────────────
-- Padroniza variações
UPDATE crm_deals SET status_matriz = 'pendencia_documental' WHERE status_matriz IN ('pendencia', 'pendência');

COMMIT;

-- ─── 5. Verificação (somente leitura) ─────────────────────────────────────
-- Lista quaisquer status fora dos enums oficiais para revisão manual.
-- Estes casos não são apagados; recebem fallback visual "legado" no front.
SELECT 'CONTATOS COM STATUS LEGADO' AS categoria, status, COUNT(*)
FROM crm_contacts
WHERE status NOT IN (
  'nao_iniciado', 'em_abordagem', 'respondeu', 'reuniao_agendada',
  'qualificado', 'enviado_matriz', 'aguardando_matriz', 'proposta_enviada',
  'em_negociacao', 'cliente', 'sem_resposta', 'reciclar_depois',
  'stand_by', 'perdido'
)
GROUP BY status;

SELECT 'DEALS COM STAGE LEGADO' AS categoria, stage, COUNT(*)
FROM crm_deals
WHERE stage NOT IN (
  'lead_novo', 'reuniao_agendada', 'qualificacao_comercial', 'diagnostico_comercial',
  'enviado_para_matriz', 'aguardando_matriz', 'proposta_em_preparacao', 'proposta_pronta',
  'proposta_enviada', 'proposta_apresentada', 'em_negociacao', 'fechado_ganho',
  'perdido', 'stand_by', 'onboarding_cliente', 'execucao_pela_matriz',
  'acompanhamento_pendencias', 'pos_venda_expansao', 'encerrado'
)
GROUP BY stage;
