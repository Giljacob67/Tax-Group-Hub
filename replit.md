# Tax Group AI Hub

## Overview

Full-stack AI platform for Tax Group — Brazil's largest tax consultancy. Features 15 specialized AI agents organized in 3 operational blocks (4 Prospecção, 8 Marketing, 3 Gestão), with chat via LLM (Gemini 2.5 Flash via OpenRouter), persistent conversation history, RAG with real text extraction from PDFs/Word/MD/TXT, Design Studio for marketing agents (image gen + Canva templates + gallery), conversation management (auto-title, rename, export, search, confirmation dialogs), system prompt editor, model/provider display, and cross-agent referrals (each agent suggests related agents when appropriate).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/tax-group-hub), Tailwind CSS v4, Shadcn/UI, Framer Motion
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **LLM**: Gemini 2.5 Flash via OpenRouter (Replit AI Integration), model selector with 12 models
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port 8080)
│   │   └── src/
│   │       ├── lib/agents-data.ts  # All 15 agent definitions + system prompts + cross-referrals
│   │       └── routes/
│   │           ├── agents.ts         # GET /api/agents, GET /api/agents/:id
│   │           ├── conversations.ts  # Chat conversations + message sending via LLM
│   │           ├── knowledge.ts      # Knowledge base document management
│   │           ├── settings.ts       # Integration status, model list
│   │           └── integrations.ts   # Image gen, Canva links, semantic search
│   └── tax-group-hub/      # React + Vite frontend (port 25986)
│       └── src/
│           ├── App.tsx               # Main app with wouter routing
│           ├── components/app-sidebar.tsx  # Sidebar with 15 agents in 3 blocks
│           └── pages/
│               ├── dashboard.tsx     # Main dashboard with blocks and stats
│               ├── agent-chat.tsx    # Chat interface per agent
│               ├── settings.tsx      # Settings page with integration status
│               ├── knowledge-base.tsx # Document upload/management
│               └── integrations.tsx  # Image gen, Canva, semantic search
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           └── agents.ts   # conversations, messages, knowledge_documents, app_config tables
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## 15 AI Agents

### BLOCO 1 — Prospecção e Operação Comercial (4 agents)
1. **prospeccao-tax-group** — Scripts de abordagem, SPIN Selling, cold outreach
2. **qualificacao-leads-tax-group** — Scoring HOT/WARM/COLD, ICP analysis
3. **objecoes-tax-group** — Reversão de objeções em tempo real (playbooks AFD/REP/RTI)
4. **followup-tax-group** — Cadência D1/D3/D7/D15 por canal

### BLOCO 2 — Agência Virtual de Marketing (8 agents)
5. **conteudo-linkedin-tax-group** — Posts LinkedIn educativos, provocativos, storytelling
6. **email-marketing-tax-group** — Cold email, nurturing, reativação
7. **materiais-comerciais-tax-group** — One-pagers, pitches, PDFs de ROI
8. **reformatributaria-insight** — CBS, IBS, Split Payment, IVA Dual, RTI
9. **whatsapp-tax-group** — Scripts de WhatsApp para prospecção
10. **cases-sucesso-tax-group** — Gerador de cases de sucesso
11. **script-video-tax-group** — Roteiros para vídeos de marketing
12. **calendario-editorial-tax-group** — Planejamento de calendário editorial

### BLOCO 3 — Gestão e Operação Interna (3 agents)
13. **gestao-pipeline-tax-group** — Diagnóstico de funil, gargalos, revisão semanal
14. **roteiro-reuniao-tax-group** — Roteiro completo SPIN para reuniões comerciais
15. **proposta-comercial-tax-group** — Estrutura de proposta para CFO/diretoria

## Database Schema

- **conversations** — id, agentId, title, createdAt, updatedAt
- **messages** — id, conversationId, role (user/assistant/system), content, metadata, createdAt
- **knowledge_documents** — id, agentId, filename, fileType, fileSize, storageKey, status, createdAt
- **app_config** — key, value, updatedAt (for runtime settings)

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection (auto-provisioned by Replit)
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL` — Replit AI Integration for OpenRouter (auto-provisioned)
- `AI_INTEGRATIONS_OPENROUTER_API_KEY` — Replit AI Integration key (auto-provisioned)
- `OPENROUTER_MODEL` — LLM model to use (default: google/gemini-2.5-flash)
- `GEMINI_API_KEY` — For Google AI: image generation (Gemini 2.0 Flash) and semantic search embeddings (Text Embeddings 004)

## LLM Provider Configuration

The platform uses Gemini 2.5 Flash via OpenRouter as the primary LLM provider:
- **Replit AI Integration (priority 1)** — Auto-provisioned via `AI_INTEGRATIONS_OPENROUTER_BASE_URL` + `AI_INTEGRATIONS_OPENROUTER_API_KEY`. No user API key needed, billed to Replit credits.
- **User's own OpenRouter key (priority 2)** — Fallback: set `OPENROUTER_API_KEY` directly.
- **Demo mode** — If neither is configured, agents respond with demo messages.

Model selector in chat UI offers 12 curated models (Gemini 2.5 Flash/Pro at top, plus Claude, GPT-4o, Llama, DeepSeek, Qwen).

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/agents` — List all 15 agents
- `GET /api/agents/:id` — Agent details
- `GET /api/conversations?agentId=X` — List conversations
- `POST /api/conversations` — Create conversation
- `GET /api/conversations/:id` — Get conversation with messages
- `DELETE /api/conversations/:id` — Delete conversation
- `POST /api/conversations/:id/messages` — Send message (LLM response)
- `PATCH /api/conversations/:id` — Rename conversation
- `GET /api/conversations/:id/export` — Export conversation as Markdown
- `GET /api/knowledge?agentId=X` — List knowledge documents
- `POST /api/knowledge/upload` — Upload file (multipart) with text extraction
- `DELETE /api/knowledge/:id` — Delete document
- `POST /api/integrations/generate-image` — Generate image (Gemini/OpenRouter)
- `GET /api/integrations/image-gallery/:agentId` — Get generated images for agent
- `POST /api/integrations/canva-link` — Generate Canva deep link (10 template types)
- `POST /api/integrations/search-knowledge` — Semantic search with embeddings
- `GET /api/settings/integrations` — Get integration status
- `GET /api/settings/models` — List available LLM models (12 curated)

## Key Features

- **Design Studio** — Integrated panel in 4 marketing agents (LinkedIn, Email Mkt, Materiais, Reforma) with image generation, 6 Canva template shortcuts, and image gallery
- **RAG Content Extraction** — Uploads extract real text from PDF (pdf-parse), DOCX (mammoth), MD/TXT and inject relevant snippets into agent system prompts
- **Auto-Title** — Conversations auto-titled from first user message (first 60 chars)
- **Conversation Management** — Rename (double-click), search/filter, export to .md, delete with confirmation dialog
- **System Prompt Editor** — Per-session editable system prompts via settings dialog
- **Model/Provider Display** — Header shows active LLM model and provider
- **OpenRouter Model Selector** — Clickable model badge in chat header opens dropdown with 12 curated models; selection persisted in localStorage and sent as model override
- **Cross-Agent Referrals** — All 15 agents have REMISSÃO ENTRE AGENTES sections suggesting related agents

## Key Integrations

1. **OpenRouter LLM (Replit AI Integration)** — Gemini 2.5 Flash as primary, 12 models available
2. **Google AI (Gemini)** — Single `GEMINI_API_KEY` for image generation and RAG semantic search
3. **Canva Deep Links** — Content creation for presentations, social posts, documents, flyers

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/tax-group-hub run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API types
- `pnpm --filter @workspace/db run push` — Push DB schema changes
