# Roadmap 30/60/90 - Tax Group AI Hub

## Status Legend

- `Done`: already applied in this branch
- `Next`: highest priority remaining work
- `Later`: important, but not the next step

## Done

- Harden auth middleware and sensitive routes.
- Fix cross-tenant data leaks in settings and conversations.
- Add SSRF validation for Ollama/provider endpoints.
- Move active LLM settings to tenant scope.
- Fix backend typecheck/runtime mismatches.
- Add CI workflow.
- Align pnpm version with the lockfile for Vercel.

## 30 Days

### Priority 1: Frontend auth/session

- Add a real auth/session layer in the frontend.
- Centralize request headers and token propagation.
- Replace direct `fetch` calls on protected routes with the shared client path.
- Add clear 401/403 handling and UX feedback.

### Priority 2: BYOK

- Require `ENCRYPTION_KEY` for BYOK writes in production.
- Never return full API keys from the API.
- Return only safe metadata such as `last4` and timestamps.

### Priority 3: Test coverage

- Add backend tests for auth, SSRF, tenant isolation, and settings.
- Add smoke tests for the frontend shell and main routes.

### Priority 4: Documentation

- Finalize `AGENTS.md`.
- Record env vars and deployment expectations.
- Document the auth model and public routes.

## 60 Days

### Priority 1: RAG jobs

- Introduce a persistent job model for document processing.
- Replace fire-and-forget document processing with durable retries.
- Add per-document status and reprocessing support.

### Priority 2: API contracts

- Align routes, Zod schemas, and generated client code.
- Reduce manual fetch usage where the generated client already exists.

### Priority 3: Observability

- Add structured logs with request id, user id, agent id, provider, and model.
- Capture usage and latency more systematically.

### Priority 4: Multi-tenancy cleanup

- Audit remaining `system` and demo fallbacks.
- Make tenant scoping explicit where data is persisted.

## 90 Days

### Priority 1: Product maturity

- Improve bundle size and route-level code splitting.
- Add better settings and health dashboards.
- Improve error UX for providers, documents, and automations.

### Priority 2: Automations and webhooks

- Add idempotency, replay, and execution logs for automation flows.
- Harden webhook signatures and tenant scoping.

### Priority 3: Knowledge graph use

- Keep `Graphify` as engineering tooling.
- If product value is proven, create a small isolated PoC for graph visualization.
- Do not wire it into runtime before there is a concrete use case.

## Suggested PR Order

1. Frontend auth/session
2. BYOK hardening
3. Tests for auth/tenancy/SSRF
4. RAG job model
5. API contract cleanup
6. Observability
7. Graph tooling PoC if justified

