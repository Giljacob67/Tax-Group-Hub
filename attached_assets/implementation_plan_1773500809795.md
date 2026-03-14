# Implementation Plan - Enhancing Tax Group AI Hub

This plan outlines the next steps to move the project from its current state to a more robust "v2" version, focusing on the RAG system and backend stability.

## User Review Required

> [!IMPORTANT]
> The implementation of semantic search requires a valid `GEMINI_API_KEY` to be set in the environment.

## Proposed Changes

### [Backend] API Server Improvements

#### [MODIFY] [integrations.ts](file:///Users/gilbertojacob/.gemini/antigravity/scratch/Tax-Group-Hub/artifacts/api-server/src/routes/integrations.ts)
- Replace the placeholder in `POST /api/integrations/search-knowledge` with a real implementation.
- Use `text-embedding-004` from Google Generative AI to generate embeddings for the query.
- Perform a simple vector comparison (cosine similarity) against processed documents in the database (or a simplified version if a vector DB isn't yet provisioned).

#### [MODIFY] [conversations.ts](file:///Users/gilbertojacob/.gemini/antigravity/scratch/Tax-Group-Hub/artifacts/api-server/src/routes/conversations.ts)
- Improve [buildRAGContext](file:///Users/gilbertojacob/.gemini/antigravity/scratch/Tax-Group-Hub/artifacts/api-server/src/routes/conversations.ts#46-69) to use semantic search results instead of just keyword matching.

### [Testing] Backend Quality Assurance

#### [NEW] [agents.test.ts](file:///Users/gilbertojacob/.gemini/antigravity/scratch/Tax-Group-Hub/artifacts/api-server/test/agents.test.ts)
- Add integration tests for the `/api/agents` endpoints.

#### [NEW] [conversations.test.ts](file:///Users/gilbertojacob/.gemini/antigravity/scratch/Tax-Group-Hub/artifacts/api-server/test/conversations.test.ts)
- Add integration tests for conversation creation, messaging, and deletion.

## Verification Plan

### Automated Tests
- Run backend tests using `npm test` or `pnpm test` (after creating the test setup).
- Command: `pnpm --filter @workspace/api-server run test` (I will need to add a test script to the api-server's [package.json](file:///Users/gilbertojacob/.gemini/antigravity/scratch/Tax-Group-Hub/package.json)).

### Manual Verification
- Upload a PDF document in the Knowledge Base.
- Ask a question to an agent that relies on specific information in that PDF.
- Verify that the RAG context is correctly injected and used by the agent.
