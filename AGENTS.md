# AGENTS.md - Tax Group AI Hub

## Monorepo Layout

- `artifacts/api-server` - Express backend and Vercel serverless build.
- `artifacts/tax-group-hub` - React + Vite frontend.
- `lib/db` - Drizzle schema and migrations for Neon/Postgres.
- `lib/api-spec` - OpenAPI/spec generation.
- `lib/api-client-react` - Generated React API client.
- `lib/api-zod` - Shared Zod schemas.
- `lib/integrations/empresaqui` - Shared external integration client.
- `api/index.js` - Vercel function wrapper.
- `docs/` - Audit reports, roadmap, and project documentation.

## Package Manager

- Use `pnpm@10.33.2`.
- `packageManager` is defined in root `package.json`.
- Use `corepack pnpm` in Vercel and CI contexts.

## Install

```bash
corepack pnpm install --frozen-lockfile
```

## Typecheck

```bash
corepack pnpm run typecheck
corepack pnpm run typecheck:libs
```

## Build

```bash
corepack pnpm -r --if-present run build
corepack pnpm run build
```

## Test

- There is no full test suite yet.
- Add tests per PR when changing auth, SSRF, tenancy, BYOK, or document processing.
- When tests exist, run them through pnpm and keep them scoped to the changed area.

## Backend

```bash
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run typecheck
```

Backend entrypoints:

- `artifacts/api-server/src/index.ts`
- `artifacts/api-server/src/vercel.ts`
- `api/index.js`

## Frontend

```bash
corepack pnpm --filter @workspace/tax-group-hub run build
corepack pnpm --filter @workspace/tax-group-hub run typecheck
```

Frontend entrypoint:

- `artifacts/tax-group-hub/src/main.tsx`

## Database and Migrations

```bash
corepack pnpm --filter @workspace/db run push
```

- Keep `lib/db/src/schema/*` and migrations aligned.
- Prefer incremental migrations.
- Do not assume schema changes are applied until the migration has been run.

## Vercel Validation

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/tax-group-hub run build
```

- `vercel.json` uses `corepack pnpm`.
- The backend build must produce `artifacts/api-server/dist/vercel.cjs`.

## Environment Variables

### Required in production

- `DATABASE_URL`
- `API_KEY` or `JWT_SECRET` for protected routes
- `ENCRYPTION_KEY` for BYOK writes

### Common LLM vars

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `TAVILY_API_KEY`
- `RESEND_API_KEY`
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `OLLAMA_CLOUD_URL`

### App and deploy vars

- `APP_URL`
- `PORT`
- `CORS_ORIGINS`
- `ALLOW_PRIVATE_OLLAMA`

## Security Rules

- Do not commit secrets.
- Do not print tokens or API keys in logs.
- Treat tenant scoping as mandatory for persisted user data.
- Treat outbound URLs as untrusted input.
- Keep public routes explicit and minimal.
- Prefer hard failure in production when auth or encryption prerequisites are missing.

## Working Rules

- Prefer small, reversible PRs.
- Preserve backward compatibility unless a break is documented.
- Run typecheck/build after code changes.
- Update `graphify-out/` with `graphify update .` after modifying code files.
- Use `Graphify` for codebase navigation and architecture questions, not `Graphity` or `Graphiti`.

