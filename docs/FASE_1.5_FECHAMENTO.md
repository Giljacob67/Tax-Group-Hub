# Fase 1.5 — Complemento de Fechamento da Fase 1

> **Status:** ✅ Concluído
> **Escopo:** Rota `/crm` — Tax Group AI Hub
> **Foco:** Fechar pontos pendentes da Fase 1 sem antecipar Fases 2/3/4.

---

## 1. Diagnóstico técnico

### 1.1 Onde estava faltando

| Item                               | Estado antes da Fase 1.5                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pipeline legado**                | `SUGGESTED_STAGES` em `PipelineManager.tsx` continha 12 valores hardcoded (Prospecção, Contato Inicial, Qualificação, …, Renovação). `DEFAULT_PIPELINE` no mesmo arquivo usava chaves em inglês (`prospecting`, `discovery`, `proposal`, `negotiation`, `closing`, `won`, `lost`) em vez das 16 etapas Tax Group.                                                                            |
| **Campos Matriz no DEAL**          | Schema `crmDealsTable` já tinha `motivoPerda`, `statusProposta`, `dataEnvioMatriz`, `prazoRetornoMatriz`, `dataRetornoMatriz`, `retornoMatriz`, `documentosEnviados`, `responsavelEnvioMatriz`, `pendenciasMatriz`, mas o form `DealEditModal` ignorava todos esses campos, e `allowedDealFields` na rota rejeitava `motivoPerda`, `dataRetornoMatriz`, `retornoMatriz`, `pendenciasMatriz`. |
| **Campos CONTATO**                 | Schema já tinha `valorPotencial`, `pendenciasCliente`, `pendenciasUnidade`, `pendenciasMatriz`, `responsavelUnidade`, `proximoFollowup`, mas o `AddLeadDialog` enviava só o payload antigo. `allowedContactFields` rejeitava `pendenciasCliente`, `pendenciasUnidade`, `pendenciasMatriz`, `proximoFollowup`.                                                                                |
| **Etapas deal vs contato**         | Pipeline Tax Group do contato tinha 16 etapas; `DEAL_STAGES` só 12. Pós-fechamento (onboarding, execução, acompanhamento, pós-venda, encerrado) ficavam sem etapa correspondente no deal.                                                                                                                                                                                                    |
| **Migração legada**                | `LEGACY_CONTACT_STATUS_MAP` e `LEGACY_DEAL_STAGE_MAP` estavam definidos em `crm-constants.ts` mas nunca eram aplicados nem em runtime nem em migração SQL.                                                                                                                                                                                                                                   |
| **Eventos de timeline Matriz**     | Rota de update do deal disparava `evaluateEventAutomations` para `matriz_aguardando`, `matriz_pendencia`, `proposta_pronta`, `proposta_enviada`, mas **não gravava entradas na timeline** com o tipo semântico esperado. A Fase 1 pediu rastreamento de envio/retorno, mas o histórico ficava disperso.                                                                                      |
| **Comparações de status_proposta** | Backend comparava `deal.statusProposta === "proposta_enviada"` (formato antigo), enquanto o `PROPOSTA_STATUS` recém-corrigido usa `enviada` direto — gerando queries que nunca batiam.                                                                                                                                                                                                       |
| **Comparações de stage em inglês** | Backend ainda comparava `stage === "won"` / `stage === "lost"` em vários endpoints, ignorando os valores canônicos `fechado_ganho` / `perdido`.                                                                                                                                                                                                                                              |

### 1.2 O que foi corrigido

1. Pipeline legado removido/desativado no `PipelineManager`.
2. Formulário do deal agora persiste os 8 campos faltantes da Matriz + Proposta + Perda.
3. Formulário de criação de contato agora envia os 6 campos faltantes.
4. Detalhe do contato exibe bloco de Pendências e Valor Potencial / Responsável / Próximo Follow-up.
5. `DEAL_STAGES` alinhado ao `PIPELINE_TAX_GROUP_STAGES` (16 + 3 sub-etapas de proposta).
6. `LEGACY_CONTACT_STATUS_MAP` e `LEGACY_DEAL_STAGE_MAP` aplicados em runtime no GET de contatos, GET de deals e GET de pipeline. Migração SQL adicional criada.
7. Eventos `matriz_event` gravados na timeline com transição detectada por `oldDeal.statusMatriz` vs `deal.statusMatriz`.
8. Comparações antigas (`won`, `lost`, `proposta_enviada`) substituídas pelos canônicos.
9. Typecheck de `tax-group-hub` e `api-server` passa.

### 1.3 O que ficou como item futuro

| Item                                   | Por que ficou para frente                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtro dedicado para `motivoPerda`     | O escopo da Fase 1.5 diz: "se não houver, não criar filtros novos nesta fase". O campo é persistido e exibido, mas não há view específica de "Motivos de Perda" como há para `statusMatriz`.                  |
| View "Histórico de Matriz" consolidada | Os eventos já caem na timeline global (`/api/crm/activities` + `useListCrmActivities`), mas uma view consolidada (timeline lateral dedicada a Matriz) depende de redesign de UX. Foi documentado para Fase 2. |
| Auditoria explícita de campos legados  | A coluna `statusOriginal` / `stageOriginal` foi adicionada na resposta da API quando o valor é desconhecido, mas o registro formal em `crm_audit_log` é item natural da Fase 2.                               |

---

## 2. Alterações implementadas

### 2.1 Pipeline legado removido

**Arquivo:** `artifacts/tax-group-hub/src/components/crm/PipelineManager.tsx`

- `SUGGESTED_STAGES` agora é `[...PIPELINE_TAX_GROUP_STAGES]`.
- `STAGE_COLORS` removido (substituído por fallback neutro + uso de `PIPELINE_STAGE_LABELS`).
- `DEFAULT_PIPELINE` usa `DEFAULT_PIPELINE_NAME` ("Tax Group") e as 16 etapas oficiais.
- `PipelineForm` agora inicializa com as 16 etapas.
- Adicionado banner `Info` no formulário: "O funil operacional padrão é o Pipeline Tax Group (16 etapas)".

### 2.2 Campos adicionados no DEAL

**Schema:** `lib/db/src/schema/crm.ts` — colunas já existiam, comentário do tipo de atividade atualizado para incluir `matriz_event`.

**API allowedDealFields (POST + PUT):** `artifacts/api-server/src/routes/crm.ts` — adicionados `motivoPerda`, `dataRetornoMatriz`, `retornoMatriz`, `pendenciasMatriz`.

**Formulário:** `artifacts/tax-group-hub/src/pages/crm.tsx` (`DealEditModal`)

Novos campos exibidos com regras de visibilidade:

| Campo                    | Aparece quando                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `statusProposta`         | sempre (opcional)                                                                                    |
| `responsavelEnvioMatriz` | sempre (opcional)                                                                                    |
| `dataEnvioMatriz`        | `statusMatriz` em `[enviado, aguardando, pendencia_documental, retorno_recebido, proposta_liberada]` |
| `prazoRetornoMatriz`     | idem                                                                                                 |
| `documentosEnviados`     | idem (input de texto → array CSV)                                                                    |
| `dataRetornoMatriz`      | `statusMatriz` em `[retorno_recebido, proposta_liberada]`                                            |
| `retornoMatriz`          | idem (textarea)                                                                                      |
| `pendenciasMatriz`       | `statusMatriz === "pendencia_documental"`                                                            |
| `motivoPerda`            | `stage === "perdido"` (textarea)                                                                     |

**Tipo `Deal`:** atualizado em `crm.tsx` para incluir os 9 campos.

### 2.3 Campos adicionados no CONTATO

**API allowedContactFields (POST + PUT):** `artifacts/api-server/src/routes/crm.ts` — adicionados `pendenciasCliente`, `pendenciasUnidade`, `pendenciasMatriz`, `proximoFollowup`. (`valorPotencial` e `responsavelUnidade` já estavam.)

**Formulário:** `artifacts/tax-group-hub/src/pages/crm.tsx` (`AddLeadDialog`)

Adicionados, todos opcionais e em seção dedicada "Operação · Pendências & Acompanhamento":

- `valorPotencial` (R$)
- `responsavelUnidade`
- `proximoFollowup` (date)
- `pendenciasCliente` (textarea)
- `pendenciasUnidade` (textarea)
- `pendenciasMatriz` (textarea)

**Detalhe do contato:** novas linhas no bloco "Dados da Empresa" + bloco "Pendências" separado.

**Tipo `Contact`:** atualizado em `crm.tsx` para incluir os 6 campos.

### 2.4 Alinhamento de etapas

**`lib/db/src/crm-constants.ts`:**

- `DEAL_STAGES` agora tem 19 entradas: 16 do Pipeline Tax Group + 3 sub-etapas operacionais de proposta (`proposta_em_preparacao`, `proposta_pronta`, `proposta_apresentada`).
- `DEAL_STAGE_LABELS` e `DEAL_STAGE_COLORS` estendidos.
- `PIPELINE_TO_DEAL_STAGE` documenta o mapeamento explícito entre cada etapa do pipeline do contato e do deal.
- `CONTACT_STATUS_TO_DEAL_STAGE` cobre os 14 status do contato (estava cobrindo só 8).
- `DEAL_STAGE_TO_CONTACT_STATUS` cobre os 19 deal stages (estava cobrindo 12).

**`crm.tsx`:** `STAGE_DICT` estendido para incluir as 3 sub-etapas de proposta.

### 2.5 Migração de dados legados

**SQL:** `lib/db/migrations/002_fase1_5_legacy_migration.sql` (novo)

Aplica `LEGACY_CONTACT_STATUS_MAP` e `LEGACY_DEAL_STAGE_MAP` em SQL, mais variações PT-BR e EN dos labels legados. Inclui query de verificação ao final que lista valores fora do enum canônico (legado desconhecido) — **sem apagá-los**.

**Runtime (TS):** `lib/db/src/legacy-migration.ts` (novo)

Funções exportadas:

- `normalizeContactStatus(raw)` — devolve `ContactStatus | null`.
- `normalizeDealStage(raw)` — devolve `DealStage | null`.
- `isLegacyStatus(raw)` / `isLegacyStage(raw)`.
- `safeContactStatus(raw)` / `safeDealStage(raw)` — devolvem o canônico ou `__legacy__:<original>`.

**Aplicação em runtime:**

- `GET /api/crm/contacts` — normaliza `status` e adiciona `statusOriginal` quando não há mapeamento.
- `GET /api/crm/deals` — normaliza `stage` e adiciona `stageOriginal`.
- `GET /api/crm/deals/pipeline` — normaliza `stage` antes de distribuir pelos kanban columns.

**`package.json`:** `@workspace/db` agora exporta `./legacy-migration`.

**Fallback visual:** `safeContactStatus` / `safeDealStage` retornam o `__legacy__:<valor>` para que o frontend possa detectar e mostrar um badge "legado" (item a explorar na Fase 2 — não criado nesta fase).

### 2.6 Eventos de timeline Matriz

**Arquivo:** `artifacts/api-server/src/routes/crm.ts` (rota `PUT /deals/:id`)

Quatro eventos semânticos gravados em `crm_activities` quando o `statusMatriz` transita:

| Evento                          | Transição                     | Subject (timeline)                                                       |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `deal_enviado_matriz`           | `→ enviado` ou `→ aguardando` | `📤 Deal enviado para a Matriz` / `⏳ Deal aguardando retorno da Matriz` |
| `deal_retorno_matriz_recebido`  | `→ retorno_recebido`          | `📥 Retorno da Matriz recebido`                                          |
| `deal_pendencia_matriz`         | `→ pendencia_documental`      | `📑 Pendência documental na Matriz`                                      |
| `deal_proposta_liberada_matriz` | `→ proposta_liberada`         | `✅ Proposta liberada pela Matriz`                                       |

Mais um evento genérico disparado em qualquer mudança de `statusProposta`.

Todos gravam `type: "matriz_event"` na timeline, registrando subject + content (com fallback para o que estiver disponível nos campos do deal: `retornoMatriz`, `pendenciasMatriz`, `documentosEnviados`, etc.). Falha silenciosa — não bloqueia o update do deal.

**Frontend:** `crm.tsx` (`ACTIVITY_ICONS`) e `GlobalTimeline.tsx` (`ACTIVITY_ICONS`) ganharam `matriz_event: Briefcase` para exibir o ícone correto.

### 2.7 Compatibilidade / migração

- **Não apaga dados antigos.** O `safeContactStatus` / `safeDealStage` devolvem o canônico quando há mapeamento; quando não há, prefixam `__legacy__:` para que a UI possa exibir um badge.
- **Retrocompatibilidade:** todos os campos novos são opcionais no `POST /deals` e `POST /contacts` — nenhuma criação rápida é bloqueada.
- **A correção de comparações antigas** (`stage === "won"` etc.) garante que dados em produção (possivelmente ainda com estágios em inglês) continuem sendo contabilizados em dashboards e filtros.
- **Risco residual:** registros com `statusMatriz` ou `statusProposta` que sejam uma string fora do enum são preservados como vieram; a UI exibe a string literal (sem cor) até migração manual. Aceitável segundo a estratégia de migração leve documentada.

---

## 3. Arquivos alterados

### Frontend

| Arquivo                                                          | Mudança                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artifacts/tax-group-hub/src/components/crm/PipelineManager.tsx` | Removido pipeline legado; badge explicativo adicionado; `SUGGESTED_STAGES` agora vem de `PIPELINE_TAX_GROUP_STAGES`.                                                                                                                                                                                                                                       |
| `artifacts/tax-group-hub/src/components/crm/GlobalTimeline.tsx`  | Adicionado ícone `Briefcase` para `matriz_event`.                                                                                                                                                                                                                                                                                                          |
| `artifacts/tax-group-hub/src/pages/crm.tsx`                      | (1) `DealEditModal` ganha 9 campos com regras de visibilidade. (2) `AddLeadDialog` ganha 6 campos. (3) Detalhe do contato exibe bloco de Pendências e campos novos. (4) `STAGE_DICT` estendido. (5) `Deal` e `Contact` types atualizados. (6) `ACTIVITY_ICONS` com `matriz_event`. (7) Comparações antigas `proposta_enviada` migradas para `enviada`/etc. |

### Backend

| Arquivo                                  | Mudança                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artifacts/api-server/src/routes/crm.ts` | (1) `allowedDealFields` (POST + PUT) com campos Matriz + Proposta + Perda. (2) `allowedContactFields` (POST + PUT) com pendências + follow-up. (3) Eventos de timeline Matriz em PUT /deals/:id. (4) Normalização de status/stage legado em GET /contacts, GET /deals, GET /deals/pipeline. (5) Comparações antigas corrigidas (`won` → `fechado_ganho`, `lost` → `perdido`, `proposta_enviada` → `enviada`). |

### Schema / constants

| Arquivo                                              | Mudança                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/db/src/crm-constants.ts`                        | (1) `DEAL_STAGES` expandido para 19. (2) `DEAL_STAGE_LABELS` e `DEAL_STAGE_COLORS` estendidos. (3) `PIPELINE_TO_DEAL_STAGE` documentado. (4) `LEGACY_DEAL_STAGE_MAP` ganha mapeamentos PT-BR. (5) `CONTACT_STATUS_TO_DEAL_STAGE` cobre 14 status. (6) `DEAL_STAGE_TO_CONTACT_STATUS` cobre 19 deal stages. (7) `PROPOSTA_STATUS` reformatado para o escopo da Fase 1.5 (`em_preparacao`, `pronta`, `enviada`, `apresentada`, `aceita`, `recusada`, `em_renegociacao`). |
| `lib/db/src/schema/crm.ts`                           | Comentário de `crmActivitiesTable.type` inclui `matriz_event`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `lib/db/src/legacy-migration.ts`                     | **Novo.** Helpers runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `lib/db/src/index.ts`                                | Re-exporta `./legacy-migration`.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lib/db/package.json`                                | Export `./legacy-migration`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `lib/db/migrations/002_fase1_5_legacy_migration.sql` | **Novo.** Migração SQL + queries de verificação.                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## 4. Critério de aceite

| Critério                              | Status                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline legado não é mais utilizável | ✅ `SUGGESTED_STAGES` agora só tem as 16 etapas Tax Group; `DEFAULT_PIPELINE` usa `DEFAULT_PIPELINE_NAME` e `PIPELINE_TAX_GROUP_STAGES`. |
| Todos os campos novos são persistidos | ✅ Backend aceita via `allowedDealFields` e `allowedContactFields`. Formulário envia.                                                    |
| Etapas do deal e do contato coerentes | ✅ `PIPELINE_TO_DEAL_STAGE` documenta equivalências; deal cobre 16 + 3 sub-etapas de proposta.                                           |
| Registros antigos não quebram a UI    | ✅ Normalização runtime em todos os GETs; SQL migration aplica mapeamentos; `safeContactStatus` / `safeDealStage` garantem fallback.     |
| Evento de timeline Matriz existe      | ✅ 4 eventos semânticos gravados em `crm_activities` com `type: "matriz_event"`. Mais um genérico para mudança de `statusProposta`.      |
| Typecheck passa                       | ✅ `tax-group-hub`, `api-server`, `api-zod`, `api-client-react` passam.                                                                  |

---

## 5. Como rodar a migração SQL (opcional)

Se quiser aplicar a migração em produção sem depender apenas do fallback runtime:

```bash
psql "$DATABASE_URL" -f lib/db/migrations/002_fase1_5_legacy_migration.sql
```

Ou, se preferir usar drizzle-kit push (recomendado para alinhar schema):

```bash
pnpm --filter @workspace/db run push
```

> A migração é **idempotente** (`UPDATE ... WHERE ...` e `ALTER TABLE ... IF NOT EXISTS`). Pode rodar quantas vezes quiser sem corromper dados.

---

## 6. Notas finais

- **Fases 2, 3 e 4 não foram tocadas.** Nenhuma dashboard, automação, agente, view ou design foi modificado além do estritamente necessário para fechar a Fase 1.
- **Sem refatoração.** Mudanças foram mínimas e cirúrgicas.
- **Foco em completar, não expandir.** A view consolidada de Histórico Matriz e o badge visual "legado" ficaram como item natural da Fase 2.
- O sistema está pronto para validação formal da Fase 1.
