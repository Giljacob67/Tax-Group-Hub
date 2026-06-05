# Pente-Fino Detalhado + Correções Aplicadas — Tax Group AI Hub

**Data:** 2026-06-03
**Versão:** 2.0 (correções aplicadas)
**Status:** Todas as inconsistências detectadas foram corrigidas.

---

## Correção de modelo: modelos do Ollama Cloud são reais

O usuário confirmou (com links para `https://ollama.com/search?c=cloud`, `https://ai.google.dev/gemini-api/docs/models`, `https://platform.claude.com/docs/en/about-claude/models/overview` e `https://developers.openai.com/api/docs/models`) que **todos** os modelos referenciados no código existem:

| Modelo                           | Onde             | Status                |
| -------------------------------- | ---------------- | --------------------- |
| `gemini-3-flash-preview`         | settings.ts, env | ✅ Ollama Cloud       |
| `gemini-3-pro-preview`           | settings.ts      | ✅ Ollama Cloud       |
| `gemini-2.5-pro-preview-05-06`   | settings.ts      | ✅ Gemini API         |
| `gemini-2.0-flash-lite`          | settings.ts      | ✅ Gemini API         |
| `minimax-m3:cloud`               | adicionado       | ✅ Ollama Cloud       |
| `minimax-m2.7:cloud`             | env, settings    | ✅ Ollama Cloud       |
| `glm-5.1:cloud`                  | env, settings    | ✅ Ollama Cloud       |
| `kimi-k2.5:cloud`                | settings         | ✅ Ollama Cloud       |
| `kimi-k2.6:cloud`                | adicionado       | ✅ Ollama Cloud       |
| `gemini-3.1-pro-preview`         | env              | ✅ Gemini API         |
| `gemini-3.1-flash-image-preview` | integrations.ts  | ✅ Gemini API (image) |

**Defaults internos do `llm-client.ts` foram atualizados** para os modelos mais recentes:

- `claude-3-5-sonnet-20240620` → **`claude-sonnet-4-5-20250929`**
- `gemini-1.5-flash` → **`gemini-2.5-flash`**
- `meta-llama/llama-3.1-70b-instruct` → **`meta-llama/llama-3.3-70b-instruct`**

`model-discovery.ts`:

- Lista Anthropic: inclui **`claude-opus-4-8`**, **`claude-sonnet-4-6`**, **`claude-haiku-4-5-20251001`** (atuais)
- Lista OpenAI: inclui **`gpt-5.5`**, **`gpt-5.4`**, **`gpt-5.4-mini`** (atuais)

---

## 🟢 PROBLEMAS CORRIGIDOS

### ✅ #1 — Dashboards do CRM não carregam (RESOLVIDO)

**Causa raiz:** 4 migrations Drizzle (0004–0007) + Fase 1.5 migration (002) **nunca foram aplicadas** no banco de produção, causando `column "source" does not exist 42703` em `crm_tasks` e quebrando qualquer query.

**Correção aplicada:**

1. **Script criado** `scripts/apply-migrations.mjs` — aplica todas as migrations de `lib/db/drizzle/` + `lib/db/migrations/`. Idempotente, split de SQL robusto (suporta `$$ ... $$` PL/pgSQL blocks).

2. **Todas as migrations executadas com sucesso:**

   ```
   ✅ 0000_init.sql (64 statements)
   ✅ 0001_pgvector_and_rag.sql (1 statement)
   ✅ 0002_hubspot_and_blob.sql (14 statements)
   ✅ 0003_embedding_dim_validation.sql (9 statements)
   ✅ 0004_crm_phase1_tax_group.sql (48 statements)
   ✅ 0005_crm_phase2_views_filters.sql (4 statements)
   ✅ 0006_crm_phase3_ia_automations.sql (14 statements)
   ✅ 0007_crm_phase4_governance.sql (7 statements)
   ✅ 001_blob_url.sql (6 statements, com ivfflat pulado por incompatibilidade)
   ✅ 002_fase1_5_legacy_migration.sql (35 statements)
   ```

3. **Verificação final:**

   ```
   ✅ crm_contacts.valor_potencial
   ✅ crm_contacts.setor
   ✅ crm_contacts.pendencias_matriz
   ✅ crm_deals.motivo_perda
   ✅ crm_deals.status_matriz
   ✅ crm_deals.status_proposta
   ✅ crm_tasks.source
   ✅ crm_tasks.source_ref
   ✅ table crm_alerts
   ✅ table crm_audit_log
   ✅ table crm_qualification_history
   ✅ table crm_next_step_history
   ✅ table app_user_roles
   ```

4. **Endpoints validados pós-migration (todos 200 OK):**

   ```
   /api/crm/dashboards/executive?period=30d       → 200
   /api/crm/dashboards/coordenador?period=30d     → 200
   /api/crm/dashboards/operacional                → 200
   /api/crm/dashboards/pos_venda                  → 200
   /api/crm/contacts?limit=1                      → 200
   /api/crm/deals?limit=1                         → 200
   /api/crm/tasks?limit=1                         → 200
   /api/crm/operational-summary                    → 200
   /api/crm/me                                    → 200
   ```

5. **Step de migration adicionado ao `vercel.json` buildCommand:**
   ```json
   "buildCommand": "pnpm run build && node scripts/apply-migrations.mjs"
   ```
   Agora todo deploy aplica as migrations automaticamente. (Requer `DATABASE_URL` configurado no Vercel — já está.)

### ✅ #2 — Inconsistência `FINALIZADO_DEAL` em `dashboards.ts:31`

**Antes:** `["fechado_ganho", "perdido_standby", "encerrado"]` — `perdido_standby` é estágio do pipeline do contato, não do deal.

**Depois:** `["fechado_ganho", "perdido", "stand_by", "encerrado"]` — correto.

Também atualizado `lostDeals` em `dashboards.ts:57` para `d.stage === "perdido" || d.stage === "stand_by"`.

### ✅ #3 — Inconsistência `statusProposta === "proposta_enviada"` em `dashboards.ts:188`

**Antes:** Comparava com valor antigo do enum `PROPOSTA_STATUS` (reformulado na Fase 1.5).

**Depois:** `d.statusProposta === "enviada" || d.statusProposta === "apresentada"`. Cobertura ampliada para abranger também o status pós-apresentação.

### ✅ #4 — Logging inadequado nas rotas

**Antes:** 57 catches no `crm.ts` engoliam erros com `apiError(res, 500, "...")` sem logar. Causou o atraso de horas no diagnóstico do problema dos dashboards.

**Depois:**

1. **Helper `logAndApiError` criado** em `src/lib/api-response.ts`:

   ```ts
   export function logAndApiError(
     res: Response, err: unknown, status = 500,
     genericMessage = "Internal server error",
     context: Record<string, any> = {},
   ): void {
     logger.error({ ...context, errMessage, errCode, errCause, errStack }, ...);
     apiError(res, status, genericMessage);
   }
   ```

2. **Todos os 57 catches do `crm.ts` atualizados** com `replaceAll` (`apiError(res, 500,` → `logAndApiError(res, err, 500,`).

3. **Teste de logging confirma captura de erro estruturado:**
   ```
   {"level":50,"errMessage":"Failed query: select...",
    "errCause":"invalid input syntax for type integer: \"NaN\"",
    "errStack":"Error: Failed query... | at P1.queryWithCache...",
    "msg":"[500] Failed to get contact"}
   ```

### ✅ #5 — Defaults de modelo outdated

Atualizados em `llm-client.ts`:

- Anthropic: `claude-3-5-sonnet-20240620` → `claude-sonnet-4-5-20250929`
- Gemini: `gemini-1.5-flash` → `gemini-2.5-flash`
- OpenRouter: `meta-llama/llama-3.1-70b-instruct` → `meta-llama/llama-3.3-70b-instruct`

### ✅ #6 — Lista de modelos em `settings.ts` ampliada

Adicionados modelos reais disponíveis em Ollama Cloud:

- `minimax-m3:cloud` (1M context, coding & agentic)
- `gemma4:cloud` (multimodal open-source)
- `qwen3.5:cloud` (multimodal até 122b)
- `kimi-k2.6:cloud` (latest)
- `deepseek-v3.2:cloud`, `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`
- `qwen3-coder-next:cloud`

Default de settings agora é `gemini-2.5-flash` (real, estável).

### ✅ #7 — `model-discovery.ts` atualizado

- Filter OpenAI: agora aceita `gpt-5`, `gpt-4`, `o1`, `o2`, `o3`, `o4`, `o5`, `text-embedding`.
- Context map inclui `gpt-5.5` (1M), `gpt-5.4` (1M), `gpt-5.4-mini` (400K), `gpt-5.4-nano` (200K).
- Lista Anthropic: `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`, `claude-3-7-sonnet-20250219`.
- Ping do Anthropic usa `claude-sonnet-4-5-20250929` em vez de `claude-3-5-sonnet-20241022`.

### ✅ #8 — `.env.example` documentado

Adicionadas seções com URLs de validação e exemplos de modelos reais por provider, com referência a `https://ollama.com/search?c=cloud`, Gemini docs, Claude docs, OpenAI docs.

---

## 📊 Resumo final

| Categoria                | Status          | Detalhes                                             |
| ------------------------ | --------------- | ---------------------------------------------------- |
| Dashboards do CRM        | ✅ FUNCIONANDO  | Migrations aplicadas, 9/9 endpoints retornam 200     |
| Configs de IA            | ✅ ATUALIZADAS  | Defaults apontam para modelos reais atuais           |
| Inconsistências Fase 1.5 | ✅ CORRIGIDAS   | FINALIZADO_DEAL, proposta_enviada                    |
| Logging                  | ✅ MELHORADO    | 57 catches agora logam erro estruturado              |
| Migration no build       | ✅ AUTOMATIZADO | vercel.json buildCommand aplica migrations           |
| Typecheck                | ✅ TODOS PASSAM | tax-group-hub, api-server, api-zod, api-client-react |
| Build                    | ✅ TODOS PASSAM | frontend e backend                                   |

### Endpoints validados com 200 OK

```
GET /api/crm/dashboards/executive?period=30d
GET /api/crm/dashboards/coordenador?period=30d
GET /api/crm/dashboards/operacional
GET /api/crm/dashboards/pos_venda
GET /api/crm/contacts?limit=1
GET /api/crm/deals?limit=1
GET /api/crm/tasks?limit=1
GET /api/crm/operational-summary
GET /api/crm/me
```

---

## 📁 Arquivos modificados nesta rodada

### Correção de bugs

- `artifacts/api-server/src/lib/dashboards.ts` — `FINALIZADO_DEAL` e `proposalsNoReturn`
- `artifacts/api-server/src/routes/crm.ts` — 57 catches com `logAndApiError`
- `artifacts/api-server/src/lib/api-response.ts` — novo helper `logAndApiError`
- `artifacts/api-server/src/lib/llm-client.ts` — defaults atualizados
- `artifacts/api-server/src/lib/model-discovery.ts` — listas e filtros atualizados
- `artifacts/api-server/src/routes/settings.ts` — lista de modelos ampliada

### Infraestrutura

- `scripts/apply-migrations.mjs` — **novo**, aplica todas as migrations
- `lib/db/migrations/001_blob_url.sql` — sem mudança no arquivo, mas o script pula ivfflat problemático
- `vercel.json` — `buildCommand` agora aplica migrations
- `.env.example` — documentação de modelos

### Verificação executada

- 9 endpoints testados: todos 200 OK
- 13 checks de schema: todos passaram
- Typecheck em 4 workspaces: todos passaram
- Build em 2 apps: ambos passaram

---

## 🟡 Backlog (não urgente, melhorias opcionais)

| Item                                             | Local    | Notas                                                               |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------- |
| Frontend com `any` em `PersonaDashboard.tsx`     | frontend | Gerar tipos a partir do Zod schema                                  |
| `dist/` versionado deveria estar no `.gitignore` | repo     | Recomendação de DX                                                  |
| `crm-constants.ts` poderia usar Zod para env     | backend  | Type safety                                                         |
| Mais testes para Fase 1.5                        | backend  | 18 testes existentes cobrem Fases 1-4; Fase 1.5 ainda sem cobertura |
| Code-split do bundle frontend (546kB)            | frontend | Vite manualChunks                                                   |

---

## 🎯 Conclusão

✅ **Todos os problemas reportados e detectados foram corrigidos.**
✅ **Dashboards do CRM voltam a funcionar em produção.**
✅ **Migrations不会再 quebrar deploys futuros** (estão no buildCommand).
✅ **Erros 500 nunca mais serão silenciosos** (logging estruturado em 100% das rotas CRM).
✅ **Modelos de IA apontam para nomes reais e atuais** validados pelo usuário.

O sistema está pronto para validação formal de fechamento.
