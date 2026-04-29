# Codex Audit Report - Tax Group AI Hub

Repo: `Giljacob67/Tax-Group-Hub`
Branch: `codex/audit-hardening-v1`
Generated: `2026-04-29`

## Scope

This report records the technical audit, the issues found, and the status of fixes already applied in this branch. It is a working document for incremental hardening, not a rewrite plan.

## Executive Summary

The repo is a pnpm monorepo with:

- backend `artifacts/api-server`
- frontend `artifacts/tax-group-hub`
- shared API/client/spec packages in `lib/*`
- shared database/schema package in `lib/db`
- serverless Vercel entrypoints in `api/index.js` and `artifacts/api-server/src/vercel.ts`

High-risk issues found and already fixed in this branch:

- auth middleware bypasses for sensitive routes
- cross-tenant leaks in settings and conversations
- SSRF risk in Ollama settings/test flows
- global active LLM settings overriding tenant context
- backend typecheck/runtime mismatches against current dependencies
- Vercel install command mismatch caused by pnpm version drift

## What Was Already Fixed

### Security and tenancy

- Removed unauthenticated bypasses for `/crm` and `/settings`.
- Kept only intentional public routes in auth middleware.
- Scoped BYOK queries and channel config lookups by tenant.
- Fixed conversation export and message posting to enforce ownership checks.
- Added shared URL validation for Ollama and custom provider endpoints.
- Added tenant-scoped active LLM preference storage with legacy fallback.

### Build and runtime

- Fixed backend typecheck errors in LLM, media, tools, and Drizzle query code.
- Added CI workflow for typecheck and builds.
- Aligned repo and CI to `pnpm@10.33.2` so Vercel frozen installs pass.

### Graph tooling

- Confirmed the installed tool is `Graphify`, not `Graphity` or `Graphiti`.
- Confirmed it is a local Python/uv tool, not an app runtime dependency.
- Added `graphify-out/` to `.gitignore`.

## Findings

### Critical

| ID | Area | File | Problem | Impact | Status |
|---|---|---|---|---|---|
| AUD-001 | Security | `artifacts/api-server/src/middlewares/auth.ts` | `/crm` and `/settings` were bypassed; `branding/config` was public | Sensitive routes exposed without auth | Fixed |
| AUD-002 | Multi-tenancy | `artifacts/api-server/src/routes/settings.ts` | `.where(undefined)` patterns allowed global reads/writes for BYOK and channels | Cross-tenant leakage and overwrite | Fixed |
| AUD-003 | Multi-tenancy | `artifacts/api-server/src/routes/conversations.ts` | Export and message posting did not enforce ownership checks | Cross-tenant data access and write | Fixed |
| AUD-004 | SSRF | `artifacts/api-server/src/routes/settings.ts` | Ollama test/save accepted arbitrary outbound URLs | Internal network access risk | Fixed |
| AUD-005 | Tenant config | `artifacts/api-server/src/routes/settings.ts` + `artifacts/api-server/src/lib/llm-client.ts` | `ACTIVE_LLM_*` was global | One tenant could affect others | Fixed |
| AUD-006 | Deploy | `package.json` + `vercel.json` | pnpm version mismatch caused frozen install failure | Vercel install failed | Fixed |

### High

| ID | Area | File | Problem | Impact | Status |
|---|---|---|---|---|---|
| AUD-101 | TypeScript | `artifacts/api-server/src/lib/llm-client.ts` | Provider URL handling and signatures were inconsistent with current deps | Backend typecheck failures | Fixed |
| AUD-102 | TypeScript | `artifacts/api-server/src/lib/media-processor.ts` | AI SDK field name mismatch | Backend typecheck failures | Fixed |
| AUD-103 | TypeScript | `artifacts/api-server/src/lib/tools/*` | Tool schemas/signatures were outdated | Backend typecheck failures | Fixed |
| AUD-104 | TypeScript | `artifacts/api-server/src/routes/system.ts` | Drizzle query chaining issue | Backend typecheck failures | Fixed |
| AUD-105 | CRM | `artifacts/api-server/src/routes/crm.ts` | Timestamp type mismatch in task creation path | Backend typecheck failures | Fixed |

### Medium

| ID | Area | File | Problem | Impact | Status |
|---|---|---|---|---|---|
| AUD-201 | Repo hygiene | `.gitignore` | `graphify-out/` was not ignored | Noise and accidental commits | Fixed |
| AUD-202 | CI | `.github/workflows/ci.yml` | No CI existed initially | Regressions could merge silently | Fixed |
| AUD-203 | Frontend | `artifacts/tax-group-hub/dist/assets/*` | Large bundle warning in build | Slower load and possible serverless pressure | Open |
| AUD-204 | Frontend auth | `artifacts/tax-group-hub/src/*` | No real login/session propagation from client | App still relies on same-origin/demo behavior | Open |

## Graphity / Graphiti

### 1. What exactly was installed?

The installed tool is `Graphify`, a local Python/uv CLI. It is not a repo dependency and it is not present in `package.json`, `pnpm-lock.yaml`, or runtime imports.

### 2. Correct name

The correct name in this workspace is `Graphify`.

### 3. Version

The installed tool reports itself as `0.5.4`.

### 4. Dependency location

It is not listed in `dependencies` or `devDependencies` of the monorepo. It is a local tool installed outside the repo.

### 5. Runtime usage

It is not used in app runtime. It only produces `graphify-out/` artifacts for engineering analysis.

### 6. Impact

No bundle/runtime/serverless impact. The only repo impact is generated artifacts and developer workflow.

### 7. Functional overlap

It overlaps with manual codebase navigation and dependency tracing. It does not replace RAG in the product.

### 8. Recommendation

Keep it isolated as engineering tooling. Do not integrate into backend or frontend runtime at this stage.

## Remaining Risks

- Frontend still lacks a true auth/session propagation layer.
- Global settings beyond LLM provider may still be tenant-ambiguous in the database.
- RAG processing remains synchronous/fire-and-forget and would benefit from a durable job queue.
- Bundle size remains above the ideal threshold.
- Test coverage is still thin for auth, tenancy, SSRF, and settings flows.

## Next Priorities

1. Frontend auth/session integration
2. BYOK hardening and production enforcement
3. Tenant-scoped global settings cleanup
4. Multi-tenant regression tests
5. Durable RAG/document job architecture
6. Frontend bundle reduction

