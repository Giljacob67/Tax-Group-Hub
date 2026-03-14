# Tax Group AI Hub

## Overview

Full-stack AI platform for Tax Group — Brazil's largest tax consultancy. Features 11 specialized AI agents organized in 3 operational blocks, with chat via LLM (OpenRouter), persistent conversation history, RAG with real text extraction from PDFs/Word/MD/TXT, Design Studio for marketing agents (image gen + Canva templates + gallery), conversation management (auto-title, rename, export, search, confirmation dialogs), system prompt editor, and model/provider display.

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
- **LLM**: OpenRouter (compatible with OpenAI SDK), model: google/gemini-flash-1.5
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port 8080)
│   │   └── src/
│   │       ├── lib/agents-data.ts  # All 11 agent definitions + system prompts
│   │       └── routes/
│   │           ├── agents.ts         # GET /api/agents, GET /api/agents/:id
│   │           ├── conversations.ts  # Chat conversations + message sending via LLM
│   │           ├── knowledge.ts      # Knowledge base document management
│   │           └── integrations.ts   # Image gen, Canva links, semantic search
│   └── tax-group-hub/      # React + Vite frontend (port 25986)
│       └── src/
│           ├── App.tsx               # Main app with wouter routing
│           ├── components/app-sidebar.tsx  # Sidebar with 11 agents
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
│       └── src/schema/
│           └── agents.ts   # conversations, messages, knowledge_documents tables
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## 11 AI Agents

### BLOCO 1 — Prospecção e Operação Comercial
1. **prospeccao-tax-group** — Scripts de abordagem, SPIN Selling, cold outreach
2. **qualificacao-leads-tax-group** — Scoring HOT/WARM/COLD, ICP analysis
3. **objecoes-tax-group** — Reversão de objeções em tempo real (playbooks AFD/REP/RTI)
4. **followup-tax-group** — Cadência D1/D3/D7/D15 por canal

### BLOCO 2 — Agência Virtual de Marketing
5. **conteudo-linkedin-tax-group** — Posts LinkedIn educativos, provocativos, storytelling
6. **email-marketing-tax-group** — Cold email, nurturing, reativação
7. **materiais-comerciais-tax-group** — One-pagers, pitches, PDFs de ROI
8. **reformatributaria-insight** — CBS, IBS, Split Payment, IVA Dual, RTI

### BLOCO 3 — Gestão e Operação Interna
9. **gestao-pipeline-tax-group** — Diagnóstico de funil, gargalos, revisão semanal
10. **roteiro-reuniao-tax-group** — Roteiro completo SPIN para reuniões comerciais
11. **proposta-comercial-tax-group** — Estrutura de proposta para CFO/diretoria

## Database Schema

- **conversations** — id, agentId, title, createdAt, updatedAt
- **messages** — id, conversationId, role (user/assistant/system), content, metadata, createdAt
- **knowledge_documents** — id, agentId, filename, fileType, fileSize, storageKey, status, createdAt

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection (auto-provisioned by Replit)
- `OPENROUTER_API_KEY` — For LLM chat (OpenRouter API key)
- `GEMINI_API_KEY` — For Google AI: image generation (Gemini 2.0 Flash) and semantic search embeddings (Text Embeddings 004)

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/agents` — List all 11 agents
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
- `POST /api/knowledge/upload-url` — Request upload URL (legacy)
- `DELETE /api/knowledge/:id` — Delete document
- `POST /api/integrations/generate-image` — Generate image (Gemini/OpenRouter)
- `GET /api/integrations/image-gallery/:agentId` — Get generated images for agent
- `POST /api/integrations/canva-link` — Generate Canva deep link (10 template types)
- `POST /api/integrations/search-knowledge` — Semantic search with embeddings
- `GET /api/settings/integrations` — Get integration status (no secrets exposed)
- `GET /api/settings/models` — List available LLM models with names/descriptions

## Key Features (v2)

- **Design Studio** — Integrated panel in 4 marketing agents (LinkedIn, Email Mkt, Materiais, Reforma) with image generation, 6 Canva template shortcuts, and image gallery
- **RAG Content Extraction** — Uploads extract real text from PDF (pdf-parse), DOCX (mammoth), MD/TXT and inject relevant snippets into agent system prompts
- **Auto-Title** — Conversations auto-titled from first user message (first 60 chars)
- **Conversation Management** — Rename (double-click), search/filter, export to .md, delete with confirmation dialog
- **System Prompt Editor** — Per-session editable system prompts via settings dialog
- **Model/Provider Display** — Header and footer show active LLM model and provider
- **OpenRouter Model Selector** — Clickable model badge in chat header opens dropdown with 10 curated models; selection persisted in localStorage and sent as model override in message requests
- **Confirmation Dialogs** — All destructive actions (delete conversation, delete document) require explicit confirmation via AlertDialog

## LLM Provider Configuration

The platform supports multiple LLM providers with automatic fallback:
- **Ollama (priority 1)** — Set `OLLAMA_URL` (e.g. ngrok URL pointing to local Ollama). Model via `OLLAMA_MODEL` (default: llama3.2). Falls back to OpenRouter on connection error.
- **OpenRouter (priority 2)** — Set `OPENROUTER_API_KEY`. Model via `OPENROUTER_MODEL` (default: google/gemini-flash-1.5).
- **Demo mode** — If neither is configured, agents respond with demo messages explaining how to configure.

## Key Integrations

1. **Ollama** — Local LLM via OpenAI-compatible API at `OLLAMA_URL`
2. **OpenRouter LLM** — Cloud LLM chat completions via `/api/conversations/:id/messages`
3. **Google AI (Gemini)** — Single `GEMINI_API_KEY` for both image generation (Gemini 2.0 Flash) and RAG semantic search (Text Embeddings 004)
4. **Canva Deep Links** — Content creation for presentations, social posts, documents, flyers

## Tax Group Products Knowledge Base

The agents are pre-configured with knowledge about:
- **AFD** — Análise Fiscal Digital (PIS, COFINS, ICMS, IRPJ, CSLL, 60 months, R$14B recovered)
- **REP** — Revisão dos Encargos Previdenciários
- **RTI** — Reforma Tributária Inteligente (CBS, IBS, Split Payment, 2026-2033 timeline)
- **TTR** — Tratamentos e Tributos Recuperáveis
- Full service catalog and sector expertise

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/tax-group-hub run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API types
- `pnpm --filter @workspace/db run push` — Push DB schema changes
