# Tax Group Hub - Codex instructions

## Review priorities
- Prioritize security, API consistency, validation, and maintainability.
- Inspect auth, webhook protection, CORS, upload validation, prompt exposure, and rate limiting.
- Flag inconsistencies between Express routes, OpenAPI spec, generated clients, and database schema.
- Check multi-agent orchestration, LLM provider resilience, and error handling carefully.
- Prefer small, reviewable improvements over broad rewrites.

## Implementation rules
- Preserve backward compatibility unless a breaking change is clearly justified.
- Add or update tests for meaningful behavior changes.
- Run typecheck/build/tests where available before concluding work.
- Document trade-offs and residual risks.
- Call out any assumptions explicitly.

## Product-aware focus
- This platform is an AI hub for tax consultancy operations.
- Suggested features should align with agent governance, observability, analytics, security, and operational efficiency.
- Avoid generic feature suggestions disconnected from the repository purpose.