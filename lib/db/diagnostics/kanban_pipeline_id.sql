-- ════════════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO — Kanban vazio: linkagem deal ↔ funil
-- Rode no Neon (psql / console SQL). Não altera dados (apenas SELECT).
-- Substitua :uid pelo user_id em uso (ou remova os filtros de user_id).
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Funis existentes (id é serial inteiro; "Lote 1 — Contas Piloto" deve ser id=3)
SELECT id, name, jsonb_typeof(to_jsonb(stages)) AS stages_tipo
FROM crm_pipelines
ORDER BY id;

-- 2) Distribuição dos pipeline_id gravados nos deals.
--    Se aparecer "tax-group" e/ou "default" mas NUNCA "3", está confirmado:
--    nenhum deal foi atribuído ao funil 3 — o filtro antigo (= "3") dava vazio.
SELECT pipeline_id, count(*) AS qtd
FROM crm_deals
GROUP BY pipeline_id
ORDER BY qtd DESC;

-- 3) Distribuição de stage nos deals (para checar se há valores fora das 16 etapas)
SELECT stage, count(*) AS qtd
FROM crm_deals
GROUP BY stage
ORDER BY qtd DESC;

-- 4) Amostra crua dos deals (id, funil, stage)
SELECT id, pipeline_id, stage, title, value
FROM crm_deals
ORDER BY updated_at DESC
LIMIT 30;

-- 5) Quantos deals o funil 3 receberia HOJE (match exato, comportamento atual do fix
--    para funis numéricos). Se 0, os deals precisam ser REATRIBUÍDOS ao funil 3.
SELECT count(*) AS deals_no_funil_3
FROM crm_deals
WHERE pipeline_id = '3';

-- 6) Quantos deals o funil "default" passa a mostrar com o fix
--    (família: default / tax-group / "" / NULL)
SELECT count(*) AS deals_no_funil_default
FROM crm_deals
WHERE pipeline_id IS NULL
   OR pipeline_id IN ('default', 'tax-group', '');
