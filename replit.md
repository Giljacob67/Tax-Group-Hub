# Tax Group AI Hub

## Overview

Full-stack AI platform for Tax Group — Brazil's largest tax consultancy. Features **23 specialized AI agents** organized in 4 operational blocks, with chat via LLM (Gemini/Ollama), persistent conversation history, RAG with real text extraction from PDFs/Word/MD/TXT, multi-agent orchestration, automation layer for Make/n8n integration, Design Studio for marketing agents, conversation management, and system prompt editor.

**Platform:** Originally created on Replit, now deployed on **Vercel**.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/tax-group-hub), Tailwind CSS v4, Shadcn/UI, Framer Motion
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **LLM**: Gemini 3 Flash via OpenAI-compatible endpoint (primary), Ollama (optional)
- **Build**: esbuild (CJS bundle)
- **Deployment**: Vercel (serverless)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (Vercel)
│   │   └── src/
│   │       ├── app.ts                # Express app with auth + rate limiting
│   │       ├── middlewares/
│   │       │   ├── auth.ts           # API key auth (Bearer, x-api-key, webhook secret)
│   │       │   └── rate-limit.ts     # Rate limiting (general + LLM-specific)
│   │       ├── lib/
│   │       │   ├── agents-data.ts    # All 23 agent definitions + system prompts
│   │       │   └── llm-client.ts     # Shared LLM client (Gemini + Ollama)
│   │       └── routes/
│   │           ├── agents.ts         # Agent listing and details
│   │           ├── conversations.ts  # Chat conversations + LLM responses
│   │           ├── knowledge.ts      # Knowledge base (validated uploads)
│   │           ├── integrations.ts   # Image gen, Canva, semantic search
│   │           ├── orchestrate.ts    # Multi-agent orchestration + coordinator
│   │           ├── automate.ts       # Make/n8n webhook triggers (execute, pipeline)
│   │           ├── settings.ts       # Model/provider configuration
│   │           └── health.ts         # Health check
│   └── tax-group-hub/      # React + Vite frontend
│       └── src/
│           ├── App.tsx               # Main app with wouter routing
│           ├── components/
│           │   ├── app-sidebar.tsx   # Sidebar with 23 agents across 4 blocks
│           │   └── orchestrate-modal.tsx  # Multi-agent orchestration UI
│           └── pages/
│               ├── dashboard.tsx     # Main dashboard with blocks and stats
│               ├── agent-chat.tsx    # Chat interface per agent
│               ├── knowledge-base.tsx # Document upload/management
│               └── integrations.tsx  # Image gen, Canva, semantic search
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── docs/
│   ├── AUTOMACAO_MAKE.md   # Make.com integration guide
│   └── make-scenario-novo-lead.json  # Importable Make.com scenario
└── vercel.json             # Vercel deployment config
```

## 23 AI Agents

### BLOCO 1 — Estratégia (6 agentes)
1. **analista-corporativo-tax-group** — Análise jurídica e compliance corporativo
2. **consultor-reforma-tributaria** — CBS, IBS, Split Payment, transição 2026-2033
3. **especialista-creditos-tributarios** — Identificação e recuperação de créditos
4. **coordenador-geral-tax-group** — Supervisão executiva e parecer consolidado
5. **auditor-fiscal-tax-group** — Auditoria preventiva de riscos fiscais
6. **planejador-tributario-tax-group** — Planejamento tributário estratégico

### BLOCO 2 — Comercial (5 agentes)
7. **prospeccao-tax-group** — Scripts de abordagem, SPIN Selling, cold outreach
8. **qualificacao-leads-tax-group** — Scoring HOT/WARM/COLD, ICP analysis
9. **objecoes-tax-group** — Reversão de objeções em tempo real (playbooks AFD/REP/RTI)
10. **followup-tax-group** — Cadência D1/D3/D7/D15 por canal
11. **proposta-comercial-tax-group** — Estrutura de proposta para CFO/diretoria

### BLOCO 3 — Marketing (6 agentes)
12. **conteudo-linkedin-tax-group** — Posts LinkedIn educativos, provocativos, storytelling
13. **email-marketing-tax-group** — Cold email, nurturing, reativação
14. **materiais-comerciais-tax-group** — One-pagers, pitches, PDFs de ROI
15. **reformatributaria-insight** — CBS, IBS, Split Payment, IVA Dual, RTI
16. **design-studio-tax-group** — Geração de imagens, templates Canva
17. **social-media-tax-group** — Gestão de redes sociais

### BLOCO 4 — Gestão e Capacitação (6 agentes)
18. **gestao-pipeline-tax-group** — Diagnóstico de funil, gargalos, revisão semanal
19. **roteiro-reuniao-tax-group** — Roteiro completo SPIN para reuniões comerciais
20. **treinamento-vendas-tax-group** — Capacitação comercial e onboarding
21. **suporte-operacional-tax-group** — Suporte interno e processos
22. **analista-dados-tax-group** — Métricas, KPIs e relatórios
23. **crm-integracao-tax-group** — Integração e gestão de CRM

## Database Schema

- **conversations** — id, agentId, title, createdAt, updatedAt
- **messages** — id, conversationId, role (user/assistant/system), content, metadata, createdAt
- **knowledge_documents** — id, agentId, filename, fileType, fileSize, storageKey, status, extractedContent, createdAt

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection (Neon)
- `GEMINI_API_KEY` — For Gemini LLM (primary provider)
- `API_KEY` — (Optional) API authentication key for all endpoints
- `WEBHOOK_SECRET` — (Optional) Secret for Make/n8n webhook authentication
- `OLLAMA_URL` — (Optional) Local Ollama for fallback LLM
- `APP_URL` — (Optional) Production URL for CORS in Vercel

## API Endpoints

### Core
- `GET /api/healthz` — Health check
- `GET /api/agents` — List all 23 agents (no systemPrompt)
- `GET /api/agents/:id` — Agent details (systemPrompt redacted if not authenticated)

### Conversations
- `GET /api/conversations?agentId=X` — List conversations
- `POST /api/conversations` — Create conversation
- `GET /api/conversations/:id` — Get conversation with messages
- `PATCH /api/conversations/:id` — Rename conversation
- `DELETE /api/conversations/:id` — Delete conversation
- `POST /api/conversations/:id/messages` — Send message (LLM response)
- `GET /api/conversations/:id/export` — Export as Markdown

### Knowledge Base
- `GET /api/knowledge?agentId=X` — List documents
- `POST /api/knowledge/upload` — Upload file (PDF, DOCX, MD, TXT only)
- `DELETE /api/knowledge/:id` — Delete document

### Orchestration
- `POST /api/orchestrate` — Run multiple agents in parallel + coordinator review

### Automation (Make/n8n)
- `POST /api/automate/execute` — Execute single agent
- `POST /api/automate/pipeline` — Chain up to 10 agents sequentially
- `POST /api/automate/trigger/{trigger}` — Named triggers (new-lead, editorial-calendar, etc.)

### Settings
- `GET /api/settings/integrations` — Integration status
- `GET /api/settings/models` — Available LLM models

## Security

- **Global auth**: All `/api` routes protected by `apiKeyAuth` middleware when `API_KEY` is set
- **Header auth**: `Authorization: Bearer <key>` or `x-api-key: <key>`
- **Webhook auth**: `x-webhook-secret` header for automate endpoints
- **No query string auth**: Prevents credential leakage in proxy/CDN logs
- **Rate limiting**: 100 req/min general, 10 req/min for LLM-heavy endpoints
- **Upload validation**: Only PDF, DOCX, MD, TXT files accepted (max 50MB)

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/tax-group-hub run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API types
- `pnpm --filter @workspace/db run push` — Push DB schema changes
