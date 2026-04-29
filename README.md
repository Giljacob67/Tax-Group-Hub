# Tax Group AI Hub

Um sistema centralizado de agentes de Inteligência Artificial para operar no ecossistema do Tax Group. O projeto engloba automação, RAG (Retrieval-Augmented Generation), e integração com múltiplas plataformas como Telegram, Webhooks (Make.com) e aplicações internas.

## 🏗 Arquitetura do Projeto

O repositório é um **monorepo** gerenciado pelo `pnpm`, estruturado nos seguintes workspaces:

- `artifacts/api-server/`: Backend em Node.js (Express), construído para rodar de forma serverless na infraestrutura da Vercel (`api/index.js`).
- `artifacts/tax-group-hub/`: Aplicação web Frontend (React + Vite + TailwindCSS).
- `lib/api-spec/`: Definições OpenAPI da API REST. Módulos gerados a partir do Swagger (ex: orval).
- `lib/api-client-react/`: Hooks do React Client gerados dinamicamente via orval consumidos pelo Frontend.
- `lib/db/`: Esquemas de banco de dados e migrações do Drizzle ORM (PostgreSQL/Neon).
- `lib/api-zod/`: Schemas do Zod criados para ser a fonte de verdade na validação de interface/API.

A arquitetura usa design **Multi-Tenant**, onde os dados pertencem a um usuário e as integrações são customizáveis. O suporte multimodelo permite conexões simultâneas com Google Gemini, Anthropic Claude, OpenAI Ollama.

## 🚀 Setup de Desenvolvimento (Local)

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/en/) (v20 ou superior recomendado)
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- Banco de dados PostgreSQL (Ex: [Neon](https://neon.tech/), Supabase ou banco local)

### 2. Variáveis de Ambiente

Crie os arquivos `.env` na raiz dos respectivos aplicativos conforme o documento `.env.example`:

1. No root ou em `artifacts/api-server/.env`:
```env
# Banco de dados Drizzle
DATABASE_URL=postgresql://user:pass@host:5432/db_name

# Chaves de provedores de IA (Preencha as que for usar)
GEMINI_API_KEY=sua_chave_gemini_aqui
ANTHROPIC_API_KEY=sua_chave_anthropic_aqui
OPENAI_API_KEY=sua_chave_openai_aqui
TAVILY_API_KEY=sua_chave_tavily_aqui

# Configurações de Segurança
API_KEY=sua_chave_mestra_da_api  # Obrigatório em produção!
ENCRYPTION_KEY=sua_chave_aes_hex  # Chave de 32 bytes (64 chars hex) para cifrar strings
```

2. No `artifacts/tax-group-hub/.env`:
```env
VITE_API_URL=http://localhost:3000
```

### 3. Instalação e Execução

```bash
# 1. Instalar as dependências do monorepo (usar pnpm root)
pnpm install

# 2. Executar migrações do banco de dados (Drizzle)
pnpm --filter @workspace/db run push

# 3. Rodar o projeto (Front-end e Back-end simultaneamente em dev mode)
pnpm run dev
```

## 🔒 Segurança (Fatores Importantes)

- **Auth Fallback:** Se `API_KEY` e `JWT_SECRET` não estiverem configurados, a API entra em modo demo e usa o tenant `demo-user`. Em produção, configure `API_KEY` e/ou `JWT_SECRET`.
- **Read-Only FS na Vercel:** Os uploads de mídia, extração de pdfs e armazenamento persistentes operam na partição provisória `/tmp/uploads` para contornar limitações "Read Only" do ambiente *Serverless*.

## Documentação Extra
- Referencie `docs/AUTOMACAO_MAKE.md` para lidar com configurações do Webhook do sistema no Make.com e automações agendadas do Telegram.
