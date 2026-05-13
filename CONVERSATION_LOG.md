# Log da Sessão — Tax Group AI Hub

**Data:** 2026-05-12  
**Contexto:** Reinicialização do computador solicitada. Este arquivo resume todo o trabalho realizado nesta sessão para retomada futura.

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

### Etapa 1 — Frontend Remodeling (Command Center)
- Dashboard remodelado como "Command Center" com métricas comerciais, segment cards, executive CTAs
- Sidebar unificado em português profissional
- CRM reorganizado com smart views (ícones Lucide, sem emojis)
- Chat transformado em agent workspace (3 colunas: sidebar + chat + contexto)

### Etapa 2 — Type Sync & Backend
- OpenAPI spec atualizado com `connectionId`/`provider`
- Orval types regenerados
- Colunas `conversation_id` FK adicionadas a `crm_deals` e `crm_tasks`
- Migration aplicada no Neon PostgreSQL

### Etapa 3 — Demo Mode
- `demo-data.ts` criado com 6 empresas demo, deals, segments, tasks, journey steps
- Hook `use-demo-mode.ts` criado (`?demo=1`)
- Fallback data adicionado a: dashboard, CRM, chat, automations, KB, settings, integrations

### Etapa 4 — Visual QA
- Cores hardcoded padronizadas para tokens (`primary`, `muted-foreground`)
- Bug do placeholder "undefined" no chat corrigido
- Status offline tornado discreto (`bg-muted text-muted-foreground`)
- Badge de pending no CRM ajustado para `bg-primary/20 text-primary`
- Imports não utilizados removidos
- Committed como `d755648`

### Etapa 5 — Landing Page + Route Restructure
- Landing page institucional premium criada em `/` (hero, value cards, journey 4 steps, agent blocks, flow, footer)
- Command Center movido de `/` para `/command-center`
- `app-sidebar.tsx` e `not-found.tsx` atualizados com novas rotas
- Landing sem sidebar; rotas internas mantêm Layout
- Committed como `585f323`

### Extras — Performance, UX, SEO e Animações
- **Code Splitting:** `React.lazy()` + `Suspense` para todas as páginas internas
- **Manual Chunks no Vite:** `vendor-react`, `vendor-motion`, `vendor-query`, `vendor-ui`
- **Resultado:** Chunk principal reduzido de ~1.54MB para ~316KB
- **UX:** 4× `confirm()` nativos substituídos por AlertDialog do shadcn
  - Hook `useConfirmDialog` criado (`src/hooks/use-confirm-dialog.tsx`)
  - Usado em: `crm.tsx` (2×), `AutomationsPanel.tsx`, `ModelHub.tsx`
- **SEO:** Meta tags adicionadas ao `index.html` (description, Open Graph, Twitter Card)
- **Page Titles:** Hook `usePageTitle` criado e aplicado em todas as rotas internas
- **Animações:** Parallax no hero, hover effects nos cards, pulse no badge, dividers animados
- Committed como `0649fbb`

---

## Arquivos Criados/Modificados (Sessão Atual)

### Criados
- `src/hooks/use-confirm-dialog.tsx` — Hook reutilizável de confirmação AlertDialog
- `src/hooks/use-page-title.ts` — Hook de título de página
- `src/pages/landing.tsx` — Landing page institucional
- `src/lib/demo-data.ts` — Dados de demonstração
- `src/hooks/use-demo-mode.ts` — Hook de detecção de demo mode
- `src/components/ui/delete-confirm-dialog.tsx` → **REMOVIDO** (não utilizado)

### Modificados (principais)
- `src/App.tsx` — Lazy loading + Suspense + roteamento `/` vs `/command-center`
- `vite.config.ts` — Manual chunks
- `index.html` — SEO meta tags
- `src/pages/crm.tsx` — Smart views, confirm dialogs, demo fallback
- `src/pages/dashboard.tsx` — Command Center layout, demo fallback
- `src/pages/agent-chat.tsx` — Placeholder fix, offline status, demo fallback
- `src/components/app-sidebar.tsx` — Rota `/command-center`
- `src/pages/not-found.tsx` — Redirect para `/command-center`

---

## Estado Atual do Build

```
✓ npx tsc --noEmit     (frontend) — PASSA
✓ npx vite build       (frontend) — PASSA
✗ pnpm run typecheck   (root)     — FAIL (ERR_PNPM_IGNORED_BUILDS para esbuild)
```

**Chunks do build:**
- `index.js` — 315.85 KB gzip:100KB (antes era ~1.54MB)
- `vendor-motion` — 132.31 KB
- `crm.js` — 181.46 KB
- `agent-chat.js` — 190.14 KB
- `AreaChart` — 387.20 KB (ainda pode ser otimizado)

---

## Problemas Conhecidos / Próximos Passos

### Frontend
- [ ] Chunk `AreaChart` ainda grande (387KB) — oportunidade de code-splitting
- [ ] `console.error/warn` em `agent-chat.tsx` (6×) e `knowledge-base.tsx` (3×) — debugging de API
- [ ] Sourcemap warnings em componentes UI do shadcn (pré-existentes)

### Backend
- [ ] **Erros de TypeScript pré-existentes** no backend:
  - `src/lib/llm-client.ts` — `maxTokens` não existe no tipo; `promptTokens`/`completionTokens` removidos do `LanguageModelUsage`
  - `src/lib/media-processor.ts` — `mimeType` não existe em `ImagePart`
  - `src/lib/tools/cnpj-lookup.ts`, `email.ts`, `search.ts` — overload mismatch no `tool()`
  - `src/routes/automate.ts` — overload mismatch
- [ ] Causa raiz: Mudanças de API no SDK `ai` (Vercel AI SDK) — provavelmente upgrade de versão

### Features Sugeridas
- [ ] Corrigir type errors do backend
- [ ] Code-split do AreaChart
- [ ] Testes (backend já tem vitest)
- [ ] Mobile/responsividade QA nas páginas internas
- [ ] Onboarding tour / feature highlights
- [ ] Dark mode toggle (atualmente forçado)
- [ ] Notificações persistentes/toast improvements

---

## Comandos Úteis

```bash
# Frontend build (usar estes — pnpm root build quebra por esbuild)
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
0649fbb feat: performance, UX, SEO e animações
585f323 feat(landing): premium institutional landing page + route restructure
d755648 feat(visual-qa): color standardization, chat placeholder fix, CRM polish
```

---

## Notas para Retomada

1. O hook `useConfirmDialog` retorna uma tupla `[requestConfirm, dialogJSX]` para evitar problemas de inferência de tipos do TypeScript com objetos contendo JSX.
2. O arquivo `crm.tsx` é muito grande (2400+ linhas). A função `CRMPage` termina na linha ~349; o resto são componentes auxiliares (`ContactsView`, `ContactDetailPanel`, `AddLeadDialog`, etc.). Variáveis declaradas no `CRMPage` NÃO estão acessíveis nos componentes auxiliares.
3. O modo demo é ativado via query param `?demo=1` e só aplica fallback quando APIs retornam arrays vazios.
4. O roteamento na Vercel usa SPA fallback: todas as rotas não-API vão para `index.html`.
