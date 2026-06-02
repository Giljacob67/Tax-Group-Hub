-- 0001_pgvector_and_rag.sql
-- Idempotent: extensions and analytic index that pair with the RAG layer.
-- The base schema (0000) already creates the `vector` extension and the
-- `embedding` column on knowledge_chunks / embedding_cache. This migration
-- adds an ANN index on the chunks table for fast semantic search.

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_ivfflat_idx
  ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
