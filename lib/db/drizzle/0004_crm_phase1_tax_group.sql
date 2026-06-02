-- Migration 0004: CRM Phase 1 — Fundação operacional Tax Group
--
-- Adds:
--   Contact: setor, segmento, origem_lead, lote_prospeccao, decisor, contato_decisor,
--            influenciadores, temperatura, dor_comercial_percebida, produto_interesse,
--            valor_potencial, responsavel_unidade, ultima_interacao, proximo_followup,
--            pendencias_cliente, pendencias_unidade, pendencias_matriz, observacoes
--   Deal: origem, resumo_diagnostico_comercial, briefing_matriz, data_envio_matriz,
--         responsavel_envio_matriz, documentos_enviados, prazo_retorno_matriz,
--         status_matriz, retorno_matriz, data_retorno_matriz, pendencias_matriz,
--         status_proposta, motivo_perda, observacoes_negociacao
--
-- Migrates:
--   contact status: prospect→nao_iniciado, qualified→qualificado, etc.
--   deal stage: prospecting→qualificacao_comercial, discovery→diagnostico_comercial, etc.
--   default pipeline: replaces generic stages with Tax Group stages

-- ─── 1. Add new columns to crm_contacts ──────────────────────────────────────

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS setor text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS segmento text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS origem_lead text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS lote_prospeccao text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS decisor text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS contato_decisor text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS influenciadores jsonb;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS temperatura text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS dor_comercial_percebida text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS produto_interesse text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS valor_potencial text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS responsavel_unidade text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS ultima_interacao timestamp;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS proximo_followup timestamp;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS pendencias_cliente text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS pendencias_unidade text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS pendencias_matriz text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS observacoes text;

-- ─── 2. Add new columns to crm_deals ─────────────────────────────────────────

ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS resumo_diagnostico_comercial text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS briefing_matriz text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS data_envio_matriz timestamp;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS responsavel_envio_matriz text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS documentos_enviados jsonb;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prazo_retorno_matriz timestamp;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS status_matriz text NOT NULL DEFAULT 'nao_enviado';
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS retorno_matriz text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS data_retorno_matriz timestamp;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS pendencias_matriz text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS status_proposta text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS motivo_perda text;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS observacoes_negociacao text;

-- ─── 3. Migrate contact statuses ─────────────────────────────────────────────

UPDATE crm_contacts SET status = 'nao_iniciado' WHERE status = 'prospect';
UPDATE crm_contacts SET status = 'qualificado' WHERE status = 'qualified';
UPDATE crm_contacts SET status = 'em_negociacao' WHERE status = 'opportunity';
UPDATE crm_contacts SET status = 'cliente' WHERE status = 'client';
UPDATE crm_contacts SET status = 'perdido' WHERE status = 'churned';
UPDATE crm_contacts SET status = 'perdido' WHERE status = 'lost';

-- ─── 4. Migrate deal stages ──────────────────────────────────────────────────

UPDATE crm_deals SET stage = 'qualificacao_comercial' WHERE stage = 'prospecting';
UPDATE crm_deals SET stage = 'diagnostico_comercial' WHERE stage = 'discovery';
UPDATE crm_deals SET stage = 'proposta_em_preparacao' WHERE stage = 'proposal';
UPDATE crm_deals SET stage = 'em_negociacao' WHERE stage = 'negotiation';
UPDATE crm_deals SET stage = 'em_negociacao' WHERE stage = 'closing';
UPDATE crm_deals SET stage = 'fechado_ganho' WHERE stage = 'won';
UPDATE crm_deals SET stage = 'perdido' WHERE stage = 'lost';

-- ─── 5. Update default pipeline stages ───────────────────────────────────────

UPDATE crm_pipelines
SET stages = '["lead_novo","qualificacao_comercial","reuniao_agendada","diagnostico_comercial","enviado_para_matriz","aguardando_matriz","proposta_pronta","apresentacao_ao_cliente","negociacao","fechado_ganho","perdido_standby","onboarding_cliente","execucao_pela_matriz","acompanhamento_pendencias","pos_venda_expansao","encerrado"]'::jsonb
WHERE is_default = true;

-- ─── 6. Set source→origem_lead mapping for existing contacts ─────────────────

UPDATE crm_contacts SET origem_lead = source WHERE origem_lead IS NULL AND source IS NOT NULL;

-- ─── 7. Create default Tax Group pipeline if none exists ─────────────────────

INSERT INTO crm_pipelines (user_id, name, stages, is_default)
SELECT
  'system',
  'Tax Group',
  '["lead_novo","qualificacao_comercial","reuniao_agendada","diagnostico_comercial","enviado_para_matriz","aguardando_matriz","proposta_pronta","apresentacao_ao_cliente","negociacao","fechado_ganho","perdido_standby","onboarding_cliente","execucao_pela_matriz","acompanhamento_pendencias","pos_venda_expansao","encerrado"]'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE is_default = true);
