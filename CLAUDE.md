## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:

- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health

## Contexto do Projeto

**Tax Group Hub** — Plataforma operacional interna para consultoria tributária.
- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui (artifacts/tax-group-hub/)
- **Backend**: Express + TypeScript (artifacts/api-server/)
- **Banco**: PostgreSQL via Neon (serverless) + Drizzle ORM (lib/db/)
- **Deploy**: Vercel (serverless functions)
- **LLM**: Multi-provider (Gemini, Anthropic, OpenAI, OpenRouter, Ollama)

**Estrutura de rotas principais:**
- `/command-center` — Dashboard com KPIs, pipeline, agentes
- `/crm` — CRM com pipeline Kanban (16 etapas Tax Group), contatos, deals
- `/agent/:id` — Chat com agentes IA (streaming SSE, RAG, feedback)
- `/automations` — Sequências de WhatsApp/email, broadcasts
- `/knowledge` — Base de conhecimento (upload, embeddings, busca semântica)
- `/analytics` — Métricas de uso de IA (tokens, custo, latência)
- `/ai-quality` — Qualidade IA (testes, feedback, guardrails)
- `/deliverables` — Entregáveis comerciais (diagnósticos, propostas)
- `/integrations` — HubSpot, Make.com, webhooks, credenciais BYOK
- `/settings` — IA & LLM, WhatsApp, identidade visual

## Histórico de Trabalho

### Commit 361ae3e — Security Hardening
- `request-id.ts`: sanitização de `x-request-id` contra log injection (regex whitelist)
- `auth.ts`: 10 handlers pararam de vazar `err.message` em respostas 500
- `setup.ts`: `/setup/status` não expõe mais detalhes de conexão do DB
- `branding.ts`: GET `/branding/config` retorna branding default para não-autenticados
- `auth.ts`: query de audit logs usa `count(*)` em vez de `SELECT *`
- `app.ts`: CSP restringe `scriptSrc` a `'self'` em produção

### Commit 65273e8 — 10 Melhorias Operacionais
1. **Pipeline Kanban com valor por coluna** — já existia (`formatCurrencyShort`)
2. **Busca no header do CRM funcional** — sincroniza com ContactsView via `initialSearch`
3. **Botão "Gerar proposta" no card do contato** — CRM→Entregáveis com prefill
4. **Criador de sequências em Automações** — dialog completo com builder de etapas
5. **Status do sistema real no Dashboard** — `useHealthCheck()` com refetch 30s
6. **Export entregáveis em PDF/DOCX** — dropdown com 3 formatos
7. **Preview de branding ao vivo** — header + cards + botões com cor dinâmica
8. **Cmd+K para navegação rápida** — CommandPalette com busca fuzzy
9. **Notificações/badges na sidebar** — leads quentes (CRM) + tarefas vencidas (Automações)
10. **Dados reais no gráfico Atividade Semanal** — últimos 7 dias de conversas

### Estado atual
- ✅ TypeScript: 0 erros (frontend + backend)
- ✅ Builds: limpos (Vite + tsx)
- ✅ Testes: 270/271 passando (1 falha por falta de DATABASE_URL, não é bug)
- ✅ Branch `main` com 20+ commits à frente do origin
