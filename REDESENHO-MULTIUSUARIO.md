# Redesenho Multiusuário — Tax Group Hub

**Documento técnico de arquitetura · v1 · 2026-06-17**
Autor: assistente técnico · Para validação de Gilberto antes de qualquer alteração de código.

---

## 1. Diagnóstico (problema confirmado)

Hoje o sistema **não tem multiusuário real**. A fronteira de isolamento de dados é o campo `userId` (texto) presente em praticamente toda tabela. Cada query do CRM filtra por `where(eq(tabela.userId, userId))`, e o `userId` vem do JWT de cada pessoa.

Consequência prática observada: quando o Felipe logou, o `GET /api/crm/pipelines` retornou os funis dele (zero), e a tela só exibiu o "Tax Group" porque o frontend injeta um default fixo (`PipelineManager.tsx:391` — `const allPipelines = [DEFAULT_PIPELINE, ...pipelines]`). Os funis, contatos e deals que você criou pertencem ao **seu** `userId` e são invisíveis para qualquer colega. Não existe camada de organização, nem mecanismo de compartilhamento — portanto não há o que "autorizar".

Isso inviabiliza o uso por equipe: SDRs, closers e gestores operam em silos isolados, ninguém compartilha base, e gestor não enxerga o pipeline do time.

---

## 2. Decisões aprovadas (base deste desenho)

| Decisão | Escolha |
|---|---|
| Modelo de visibilidade | **Compartilhamento total** — todos do escritório veem tudo |
| Estrutura | **Organização única** (Tax Group / JGG Maringá) |
| Configurações/integrações | **Compartilhadas** (conexões, BYOK, branding, WhatsApp, HubSpot) |
| Entrega atual | **Documento primeiro**, código depois da validação |

---

## 3. Modelo-alvo

**Princípio central:** a fronteira de tenancy deixa de ser o `userId` e passa a ser a **Organização** (`orgId`). Todo dado pertence à organização, não à pessoa.

Os campos `userId` e `assignedTo` **não somem** — eles mudam de papel:

- Antes: `userId` = *dono exclusivo e filtro de visibilidade*.
- Depois: `userId`/`createdBy` = *autoria* (quem criou, para auditoria e relatório); `assignedTo` = *responsável comercial* (para "meus deals", métricas por SDR, distribuição). **Nenhum dos dois filtra visibilidade** — quem filtra é o `orgId`.

Com compartilhamento total, a regra fica simples:

> **Visibilidade = pertencer à organização. Permissão de escrita/config = papel (RBAC).**

O sistema **já tem a base de RBAC**: a tabela `app_user_roles` (papéis `admin | coordenador | comercial | marketing | leitura`) e o componente `<Can permission="...">` no frontend. Hoje ele governa só botões de edição; no modelo novo ele passa a governar **quem pode editar/excluir/configurar**, enquanto o `orgId` governa **quem vê**.

---

## 4. Mudanças de schema

### 4.1 Tabelas novas

```ts
// organizations — a entidade de tenancy
export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// organization_members — vínculo usuário↔organização (+ papel principal)
export const organizationMembersTable = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => appUsersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("comercial"), // admin | coordenador | comercial | marketing | leitura
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("org_members_org_user_idx").on(t.orgId, t.userId)]);
```

> **Decisão (item 3):** `organization_members.role` será a **fonte única de verdade** de papéis. Manter duas tabelas de papéis é risco de segurança (checagens divergentes). Transição em fase: na Fase 1 copiamos os papéis de `app_user_roles` para `organization_members`; nas Fases 2–4 toda checagem (`<Can>`, backend) passa a ler de `organization_members`; ao final `app_user_roles` é desativada (mantida só como histórico read-only até a limpeza).

### 4.2 Coluna `org_id` em toda tabela de tenant

Adicionar `orgId: integer("org_id").references(() => organizationsTable.id)` (inicialmente nullable para backfill, depois `notNull`) nas seguintes tabelas:

**CRM (schema/crm.ts):**
`crm_contacts`, `crm_pipelines`, `crm_deals`, `crm_activities`, `crm_attachments`, `crm_tasks`, `crm_qualification_history`, `crm_alerts`, `crm_next_step_history`, `crm_saved_views`, `crm_automations`, `crm_audit_log`

**Automações (schema/crm.ts):**
`automation_sequences`, `sequence_enrollments`

**Integrações (schema/crm.ts):**
`hubspot_sync_state`, `hubspot_list_mapping`

**IA / config (schema/agents.ts + schema/llm.ts):**
`llm_connections`, `llm_profiles`, `api_keys`, `channel_configs`, `tenant_branding`, `usage_logs`

**Conhecimento (schema/agents.ts) — compartilhado pela org (item 4):**
`knowledge_documents` recebe `org_id`. `knowledge_chunks` e `embedding_cache` herdam o escopo via FK `document_id` (não precisam de `org_id` próprio). A base de conhecimento passa a ser do escritório inteiro.

**Conversas — permanecem PRIVADAS por usuário (item 4):**
`conversations` e `messages` **NÃO** ganham `org_id` e **continuam filtradas por `userId`**. Cada pessoa mantém suas próprias conversas com os agentes; ninguém vê o histórico do colega. Este é o único domínio que permanece per-user de propósito.

**Auth (schema/auth.ts):**
`app_user_roles` migra para `organization_members` (fonte única — ver §4.1)

### 4.3 Índices únicos que mudam de chave

| Tabela | Hoje | Depois | Motivo |
|---|---|---|---|
| `crm_contacts` | `unique(userId, cnpj)` | `unique(orgId, cnpj)` | Um CNPJ é único **na carteira do escritório**, não por pessoa. Evita o mesmo cliente duplicado entre SDRs e vira a chave natural de dedupe da base compartilhada. |
| `hubspot_sync_state` | `unique(userId, objectType)` | `unique(orgId, objectType)` | Sync do HubSpot passa a ser do escritório. |
| `hubspot_list_mapping` | `unique(userId, tagName)` | `unique(orgId, tagName)` | idem |
| `tenant_branding` | `userId unique` | `orgId unique` | Uma identidade visual por escritório. |

> **Atenção (dedupe):** se hoje já houver o mesmo CNPJ cadastrado por dois usuários, o índice `unique(orgId, cnpj)` vai conflitar no momento de aplicar. A migração precisa de um passo de deduplicação **antes** de criar o índice (ver §7.3).

---

## 5. Configurações e integrações compartilhadas

Mapa do que muda para atender ao seu pedido de "configs/conexões/integrações compartilhadas":

| Item | Onde mora | Hoje | Depois |
|---|---|---|---|
| Make.com / HubSpot (endpoints, flags) | `app_config` (key/value) | **já é global** ✅ | permanece global/compartilhado |
| Chaves BYOK (OpenAI, Anthropic, Resend, Tavily, WhatsApp) | `api_keys.userId` | per-user | **org_id** (compartilhada) |
| Conexões LLM | `llm_connections.userId` (null=global) | per-user/global | **org_id** |
| Perfis LLM (qual modelo por função) | `llm_profiles.userId` | per-user | **org_id** |
| Branding / identidade visual | `tenant_branding.userId` | per-user | **org_id** |
| Canais WhatsApp/Telegram | `channel_configs.userId` | per-user | **org_id** |
| Estado de sync HubSpot | `hubspot_sync_state.userId` | per-user | **org_id** |

> **Decisão (item 2):** as chaves BYOK (`api_keys`) são compartilhadas pela org, mas **leitura e edição ficam restritas ao papel `admin`**. Coordenador, comercial, marketing e leitura não acessam as chaves. A UI de chaves deve mascarar o valor para não-admin.

---

## 6. Mudanças no backend

### 6.1 Resolver `req.orgId` no middleware de auth

Em `artifacts/api-server/src/middlewares/auth.ts`, depois de resolver `req.userId` (via JWT), buscar a organização do usuário em `organization_members` e anexar `req.orgId` + `req.orgRole`. Com organização única, é uma linha de lookup (cacheável). Criar um helper `requireOrgId(req)` espelhando o `requireUserId(req)` atual.

Opcional/otimização: embutir `orgId` e `role` como claims no JWT no login, evitando o lookup por request. (Cuidado: troca de papel só vale no próximo login — aceitável.)

### 6.2 Trocar o filtro em todas as rotas

Substituir o padrão de tenancy em todos os handlers:

```ts
// ANTES
const userId = requireUserId(req);
...where(eq(crmPipelinesTable.userId, userId))

// DEPOIS
const orgId = requireOrgId(req);
...where(eq(crmPipelinesTable.orgId, orgId))
// userId continua sendo gravado em create() como autoria (createdBy)
```

Arquivos afetados (todos em `artifacts/api-server/src/routes/`): **`crm.ts`** (o maior — ~3.400 linhas, dezenas de queries), **`automate.ts`**, **`integrations.ts`**, **`branding.ts`**, **`knowledge.ts`**, e o que mais consultar tabelas tenant. As funções puras testáveis (ex.: `groupDealsByStage`) não mudam.

### 6.3 Seed do funil padrão real (corrige o sintoma do Felipe)

Hoje o "Tax Group" é um objeto sintético no frontend (não existe no banco). No modelo novo, ao criar a organização, **inserir uma linha real** de `crm_pipelines` com as 16 etapas Tax Group e `isDefault=true`, pertencente ao `orgId`. Assim:

- todos do time veem e compartilham **o mesmo** funil padrão, editável;
- elimina a divergência entre o default sintético e os deals reais (relacionada ao bug estrutural de `pipeline_id` já anotado em `crm.ts:1907`).

---

## 7. Estratégia de migração (zero-downtime, faseada)

Migração **aditiva** — nunca remove coluna antes de o código novo estar no ar. Ordem segura:

### 7.1 Fase A — Expandir (sem quebrar nada)
1. Criar tabelas `organizations` e `organization_members`.
2. Inserir a organização #1 ("Tax Group — Maringá").
3. Vincular todos os `app_users` ativos como membros da org #1 (papel inicial: `comercial`; você e Felipe como `admin`/`coordenador`).
4. Adicionar coluna `org_id` **nullable** em todas as tabelas tenant.

### 7.2 Fase B — Backfill
5. `UPDATE <tabela> SET org_id = 1 WHERE org_id IS NULL;` em cada tabela (todos os dados atuais são seus → vão para a org única).

### 7.3 Fase C — Deduplicar e restringir
6. Deduplicar `crm_contacts` por `(1, cnpj)` se houver CNPJ repetido entre usuários (mesclar ou sufixar antes do índice).
7. Trocar índices únicos `(userId, …)` → `(orgId, …)`.
8. `ALTER COLUMN org_id SET NOT NULL` nas tabelas tenant.

### 7.4 Fase D — Virar a chave no código
9. Deploy do backend filtrando por `orgId` + `req.orgId` no auth.
10. Frontend: remover a injeção sintética do default e passar a consumir o funil padrão real.
11. Manter `userId` gravado como autoria; **não** removê-lo.

> O projeto já tem um runner de migrações (`_schema_migrations` + `lib/db/migrate-improvements.ts`). As fases A–C entram como migrações versionadas idempotentes.

---

## 8. RBAC — matriz de permissões (com compartilhamento total)

Como todos veem tudo, o RBAC governa **ação**, não visão. Proposta de mapeamento (ajustável):

| Ação | admin | coordenador | comercial | marketing | leitura |
|---|:--:|:--:|:--:|:--:|:--:|
| Ver CRM/pipeline/deals | ✅ | ✅ | ✅ | ✅ | ✅ |
| Criar/editar contatos e deals | ✅ | ✅ | ✅ | ➖ | ❌ |
| Editar/excluir funil (`canEditPipeline`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar automações/sequências | ✅ | ✅ | ➖ | ✅ | ❌ |
| Configurar integrações | ✅ | ➖ | ❌ | ❌ | ❌ |
| Ler/editar chaves BYOK (item 2) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver base de conhecimento (org) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Conversas com agentes (privadas) | só as próprias | só as próprias | só as próprias | só as próprias | só as próprias |
| Branding / identidade visual | ✅ | ➖ | ❌ | ➖ | ❌ |
| Gerenciar membros e papéis | ✅ | ❌ | ❌ | ❌ | ❌ |

(➖ = opcional, decidir na implementação.)

---

## 9. Frontend

- **`PipelineManager.tsx`** — remover/condicionar a injeção sintética (`[DEFAULT_PIPELINE, ...pipelines]`, linha 391) assim que existir o funil padrão real no banco; senão você teria o default duplicado. Os botões já estão atrás de `<Can permission="canEditPipeline">`, então o RBAC novo encaixa sem reescrever a UI.
- Hooks gerados (`useListCrmPipelines`, etc.) **não mudam de assinatura** — a troca é server-side. Frontend só se beneficia: a lista passa a vir compartilhada.
- Adicionar (Fase 4, opcional) uma tela de **Membros & Papéis** em `/settings` para você promover Felipe/Reginaldo e convidar SDRs.

---

## 10. Riscos e pontos de atenção

1. **`userId` é `text`, mas `app_users.id` é `serial` (int).** Nas tabelas CRM o `user_id` é string. Precisa confirmar o que está gravado lá (id como texto? e-mail?) para o backfill e para o FK de `organization_members.userId` (que aponta para `app_users.id` int). É o primeiro item a verificar antes de migrar.
2. **`crm_deals.pipeline_id` é `text` e inconsistente** — já documentado como bug estrutural no próprio código (`crm.ts:1907`: deals gravam `DEFAULT_PIPELINE_ID`, `"default"`, `""` ou `NULL`). O seed do funil padrão real é a oportunidade de normalizar isso.
3. **`assignedTo` é texto livre, sem FK.** Funciona para "compartilhamento total" agora, mas se um dia você quiser visão por responsável, vale promover para FK de `app_users`.
4. **Dedupe de CNPJ** antes do índice `unique(orgId, cnpj)` — ver §7.3. Pode haver colisão real.
5. **Chaves BYOK compartilhadas** — confirmar restrição de leitura por papel (§5).
6. **Custo do refactor concentra-se em `crm.ts`** (arquivo gigante, dezenas de queries). É mecânico, mas extenso; cobertura de testes ajuda (o projeto tem ~270 testes; rodar a cada fase).

---

## 11. Plano de implementação em fases

| Fase | Entregável | Esforço relativo |
|---|---|---|
| 0 | Verificar conteúdo real de `crm_contacts.user_id` (texto/e-mail/id) | baixo |
| 1 | Schema: tabelas `organizations`/`organization_members` + `org_id` nullable + migração de backfill | médio |
| 2 | Backend: `req.orgId` no auth + trocar filtros em `crm.ts` e demais rotas | **alto** |
| 3 | Configs/integrações para `orgId` (BYOK, LLM, branding, WhatsApp, HubSpot) | médio |
| 4 | RBAC consolidado em `organization_members` + tela de Membros & Papéis | médio |
| 5 | Índices únicos `orgId`, `NOT NULL`, seed do funil padrão, limpeza do default sintético | médio |
| 6 | Testes + validação com Felipe logando e enxergando a base compartilhada | médio |

---

## 12. Decisões confirmadas (2026-06-17)

1. **Papéis iniciais:** Gilberto = `admin`; Felipe = `admin`. Reginaldo (MT) **não foi incluído** nesta rodada — fica fora da org por enquanto; entra depois como membro (org única se mantém).
2. **Chaves BYOK:** compartilhadas pela org, com **leitura/edição restritas a `admin`**. UI mascara o valor para os demais.
3. **Papéis:** **consolidados em `organization_members`** como fonte única de verdade. `app_user_roles` desativada ao fim da transição (ver §4.1).
4. **Conhecimento × Conversas:** base de conhecimento (`knowledge_documents`) **compartilhada pela org**; conversas com agentes (`conversations`/`messages`) **privadas por usuário** (continuam filtradas por `userId`).

Desenho validado nos pontos estruturais. Próximo passo: **Fase 0** — verificar o que está realmente gravado em `crm_contacts.user_id` (id como texto, e-mail, ou outro), que é o que determina como o backfill e o FK de `organization_members.userId` serão feitos.
