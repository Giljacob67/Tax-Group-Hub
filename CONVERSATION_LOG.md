# Log da Sessão — Tax Group AI Hub

**Data:** 2026-05-15  
**Contexto:** Sistema reiniciou. Este arquivo resume todo o trabalho realizado até o momento.

---

## Resumo do Projeto

- **Frontend:** `artifacts/tax-group-hub/` — React 19 + Vite 7 + TailwindCSS 4 + shadcn/ui + wouter + framer-motion
- **Backend:** `artifacts/api-server/` — Express 5 + Drizzle ORM + PostgreSQL/Neon
- **Type Generation:** Orval v8.5.3
- **Deploy:** Vercel (SPA com rewrites para `/index.html`)

**Design Tokens:**

- Primary: `#107EC2` (HSL 200 76% 41%)
- Background: `#07111F`
- Surface: `#0B1220` / `#111827`
- Border: `#1E293B`
- Gold accent: `#D6A847`

---

## Etapas Concluídas

### 13/05 — Fundação e Remodelagem

- **Etapa 1:** Remodelagem do frontend como "Command Center" (dashboard, sidebar, CRM, chat)
- **Etapa 2:** Sincronia de types com OpenAPI + Orval + migration no Neon PostgreSQL
- **Etapa 3:** Modo Demo criado (`?demo=1`) com dados de fallback
- **Etapa 4:** QA visual — padronização de cores, fix do placeholder "undefined", badge pending
- **Etapa 5:** Landing page institucional em `/` + Command Center movido para `/command-center`
- **Extras:** Code splitting (React.lazy + Vite manual chunks), SEO meta tags, hook `usePageTitle`, AlertDialog no lugar de `confirm()`, animações parallax

### 14/05 — Funcionalidades Avançadas

- **`2a90dd2`** — Fix de type errors backend, code-split do CRM, mobile QA, onboarding tour
- **`ee02d50`** — Remodelagem Central de Modelos IA (Model Hub V2)
- **`94f0a1d`** — Analytics de Uso de LLM
- **`72d5d99`** — Security hardening e correções de produção (revisão end-to-end)
- **`d7fb4c4`** — Pente fino de segurança (SSRF, timing attacks, integridade de dados)
- **`fa0f168`** — Central de Integrações (remodelagem completa)
- **`8a65eb2`** — Camada operacional de Webhooks, Make.com e Logs
- **`cc3dbd9`** — CRM dispara eventos de integração automaticamente
- **`132378d`** — Operationalize knowledge base com pipeline RAG
- **`9fd289d`** — Central de Qualidade IA (avaliação e rastreabilidade de respostas)
- **`342ad63`** — Central de Entregáveis Comerciais
- **Sequência de fixes no upload KB:** pdf-parse v1↔v2, memoryStorage, busboy, JSON+base64

### 15/05 — Correções Críticas (Sessão Atual)

- **`f5c5acb`** — Correções de upload, types, console cleanup, chunks:
  1. **Upload KB travado em "processando":**
     - Processamento agora é **síncrono antes da resposta HTTP** (evita morte do worker serverless da Vercel)
     - Timeout de 15s no `pdf2json` e `mammoth` (evita travamento eterno)
     - Timeout de 25s/45s no processamento total (arquivos < 1MB / >= 1MB)
     - Se timeout: doc marcado como `error` com mensagem descritiva; frontend avisa usuário
     - Frontend: `FileReader.readAsDataURL()` substitui `btoa()` (suporta bytes > 127)
     - Frontend: polling reduzido para 6s; detecção de docs "stuck" (> 2 min em processing)
  2. **Type errors backend (AI SDK v6):**
     - `textEmbeddingModel()` → `embeddingModel()` (deprecation)
     - Removido import não utilizado `generateObject`
  3. **Console errors/warn frontend:**
     - Removidos 6× `console.*` de `agent-chat.tsx`
     - Fix de datas inválidas em `agent-chat.tsx` (try-catch em `format()`)
     - Fix de datas inválidas em `knowledge-base.tsx` (LogsTab, SemanticSearchTab)
  4. **Otimização de chunks:**
     - Adicionado `"vendor-charts": ["recharts"]` ao `manualChunks` do Vite
     - Removido `src/components/ui/chart.tsx` (código morto, importava recharts inteiro)
     - Chunk `vendor-charts` nomeado previsivelmente (~424KB raw / ~114KB gzip)

---

## Estado Atual do Build

```
✓ npx tsc --noEmit     (frontend) — PASSA
✓ npx vite build       (frontend) — PASSA
✓ npx tsc --noEmit     (backend)  — PASSA
```

**Chunks do build:**

- `index-*.js` — 322 KB gzip:102KB
- `vendor-motion-*.js` — 132 KB gzip:44KB
- `vendor-charts-*.js` — 424 KB gzip:114KB (recharts isolado)
- `crm-*.js` — 137 KB gzip:34KB
- `knowledge-base-*.js` — 102 KB gzip:27KB

---

## Problemas Conhecidos / Próximos Passos

### Resolvidos nesta sessão

- [x] Upload KB travado em "processando" → **arquitetura híbrida robusta**
  - Arquivos < 200KB: processamento síncrono com timeout de 8s (dentro do limite Hobby)
  - Arquivos ≥ 200KB: enfileirados no PostgreSQL com `fileData` (base64 persistido)
  - Cron diário (`0 8 * * *`) processa documentos pendentes e retries
  - Endpoint `POST /api/knowledge/process-queue` para o cron job
- [x] Reindexação quebrada → usa `fileData` do DB em vez de ler do disco
- [x] `btoa()` falha para bytes > 127 → `FileReader.readAsDataURL()`
- [x] `console.error/warn` em `agent-chat.tsx` → removidos
- [x] Chunk `AreaChart` sem nome → `vendor-charts` no manualChunks
- [x] Type errors backend (deprecations AI SDK v6) → `embeddingModel()`, removido `generateObject`
- [x] `chart.tsx` não utilizado → removido

### Pendentes

- [ ] Sourcemap warnings em componentes UI do shadcn (pré-existentes, não afetam runtime)
- [ ] Mobile/responsividade QA nas páginas internas
- [ ] Onboarding tour / feature highlights
- [ ] Dark mode toggle (atualmente forçado)
- [ ] Notificações persistentes/toast improvements
- [ ] Testes (backend já tem vitest)

---

## Comandos Úteis

```bash
# Frontend build
 cd artifacts/tax-group-hub
 npx tsc --noEmit
 npx vite build

# Backend typecheck
 cd artifacts/api-server
 npx tsc --noEmit

# Backend tests
 cd artifacts/api-server
 pnpm test
```

---

## Commits Recentes

```
f5c5acb fix(upload): processamento síncrono KB + timeouts, fix types AI SDK v6, console cleanup, chunk charts
268a3e3 fix(knowledge): switch upload from multipart to JSON+base64
b5fbb85 fix(knowledge): replace multer with busboy — fix serverless upload hang
b8a3c5d fix(knowledge): memoryStorage + pdf2json — elimina travamento no upload
6025ca6 fix(knowledge): downgrade pdf-parse v2→v1, fix serverless worker crash
1b31470 fix(knowledge): migrate pdf-parse usage from v1 to v2 API
342ad63 feat(deliverables): Etapa 8.6 – Central de Entregáveis Comerciais
9fd289d feat(quality): Etapa 8.5 – qualidade, avaliação e rastreabilidade de respostas IA
132378d feat(knowledge): operationalize knowledge base with RAG pipeline
fa0f168 feat: Etapa 9 – Central de Integrações (remodelagem completa)
```

---

## Notas para Retomada

### Arquitetura de Upload da Base de Conhecimento (KB)

**Plano Vercel: Hobby** (maxDuration: 10s por request, cron jobs: 1x por dia)

O upload usa uma **abordagem híbrida** para funcionar dentro das restrições do serverless:

1. **Arquivos pequenos** (< 200KB):
   - Processamento síncrono com timeout de **8s**
   - Se der timeout → marca como `pending` para o cron processar depois
   - A maioria dos PDFs de proposta/material comercial cabe aqui

2. **Arquivos grandes** (≥ 200KB):
   - Salva no DB com `status: "pending"` e `fileData` (base64 do arquivo)
   - Responde imediato: "Será processado em breve"
   - **Cron diário** (`0 8 * * *`) processa fila via `POST /api/knowledge/process-queue`
   - Processa até 5 documentos por execução (evita estourar 60s do cron)

3. **Reindexação:**
   - Usa o `fileData` persistido no PostgreSQL
   - Marca como `pending` → cron pega na próxima execução
   - Não requer novo upload do arquivo

4. **Retry automático:**
   - Documentos com `status = "error"` e `retries < 3` são retentados pelo cron
   - `extractTextContent` tem timeout de 15s (pdf2json/mammoth)
   - `embedMany` tem timeout de 30s (API de embeddings)

### Outras Notas

- O hook `useConfirmDialog` retorna uma tupla `[requestConfirm, dialogJSX]` para evitar problemas de inferência de tipos do TypeScript com objetos contendo JSX.
- O arquivo `crm.tsx` é muito grande (2400+ linhas). A função `CRMPage` termina na linha ~349; o resto são componentes auxiliares (`ContactsView`, `ContactDetailPanel`, `AddLeadDialog`, etc.). Variáveis declaradas no `CRMPage` NÃO estão acessíveis nos componentes auxiliares.
- O modo demo é ativado via query param `?demo=1` e só aplica fallback quando APIs retornam arrays vazios.
- O roteamento na Vercel usa SPA fallback: todas as rotas não-API vão para `index.html`.
