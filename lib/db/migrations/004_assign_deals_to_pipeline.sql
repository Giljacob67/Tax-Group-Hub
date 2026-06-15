-- ════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO (TEMPLATE) — Reatribuir deals a um funil específico
-- ════════════════════════════════════════════════════════════════════════════
-- Use SOMENTE se o diagnóstico (diagnostics/kanban_pipeline_id.sql, consulta 5)
-- mostrar que o funil-alvo (ex.: "Lote 1 — Contas Piloto", id=3) tem 0 deals,
-- mas você espera que determinados deals pertençam a ele.
--
-- O fix de runtime já recupera o funil "default" (família default/tax-group/""/NULL).
-- Esta migração é necessária apenas para popular um funil NUMÉRICO específico,
-- porque a UI nunca grava o id serial do funil em crm_deals.pipeline_id.
--
-- DESTRUTIVO: faça backup / rode em transação. Ajuste o WHERE ao seu critério real.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- EXEMPLO A — mover TODOS os deals atualmente no "default-family" para o funil 3.
-- (Use se o funil 3 deve ser o funil principal de fato.)
-- UPDATE crm_deals
-- SET pipeline_id = '3'
-- WHERE pipeline_id IS NULL OR pipeline_id IN ('default', 'tax-group', '');

-- EXEMPLO B — mover apenas um conjunto explícito de deals (por id) para o funil 3.
-- UPDATE crm_deals
-- SET pipeline_id = '3'
-- WHERE id IN (/* 101, 102, 103 ... */);

-- Verificação antes de confirmar:
SELECT pipeline_id, count(*) FROM crm_deals GROUP BY pipeline_id ORDER BY 2 DESC;

-- COMMIT;   -- descomente após validar
ROLLBACK;    -- padrão seguro: nada é alterado até você trocar para COMMIT
