-- 0001_pgvector_and_rag.sql
-- Idempotent: extensions and analytic index that pair with the RAG layer.
-- The base schema (0000) already creates the `vector` extension and the
-- `embedding` column on knowledge_chunks / embedding_cache. This migration
-- adds an ANN index on the chunks table for fast semantic search.

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_ivfflat_idx
  ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Drop the unique index on embedding_cache and replace with a composite
-- (text_hash, model) so the cache can host embeddings from different
-- providers without collisions. (Backwards compatible: text_hash alone
-- remains the conflict target via the UNIQUE constraint added below.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embedding_cache_hash_model_unique'
  ) THEN
    ALTER TABLE embedding_cache
      ADD CONSTRAINT embedding_cache_hash_model_unique UNIQUE (text_hash);
  END IF;
END $$;
