-- 0003_embedding_dim_validation.sql
-- Idempotent. Removes the hard 768-dim pin on knowledge_chunks.embedding and
-- embedding_cache.embedding so the same tables can hold vectors from Google
-- (768), OpenAI (1536), Ollama (768/1024), etc. Dimension is enforced at the
-- application layer in llm-client.ts via validateEmbeddingDim().
--
-- Note: PostgreSQL's `vector` type can be declared with a fixed dimension
-- (`VECTOR(768)`) or without. Removing a fixed dim requires ALTER COLUMN TYPE
-- since the column type itself carries the dimension. Both target columns were
-- created with `VECTOR(768)` in 0000, so we coerce them to `vector` (no dim).

-- ─── knowledge_chunks.embedding: drop the dim pin ────────────────────────────
ALTER TABLE knowledge_chunks
  ALTER COLUMN embedding TYPE vector USING embedding::vector;

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dim   INTEGER;
CREATE INDEX IF NOT EXISTS knowledge_chunks_model_idx
  ON knowledge_chunks (document_id, embedding_model);

-- ─── embedding_cache: model-aware key + dim column ──────────────────────────
-- 0001 added a UNIQUE(text_hash) constraint named embedding_cache_hash_model_unique;
-- drop it so the composite (text_hash, model) uniqueness can take over.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embedding_cache_hash_model_unique'
      AND conrelid = 'embedding_cache'::regclass
  ) THEN
    ALTER TABLE embedding_cache DROP CONSTRAINT embedding_cache_hash_model_unique;
  END IF;
END $$;

-- The base schema also has `text_hash TEXT NOT NULL UNIQUE` from 0000.
-- Drizzle infers a constraint name; locate by column and drop it if it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embedding_cache_text_hash_unique'
      AND conrelid = 'embedding_cache'::regclass
  ) THEN
    ALTER TABLE embedding_cache DROP CONSTRAINT embedding_cache_text_hash_unique;
  END IF;
END $$;

ALTER TABLE embedding_cache
  ALTER COLUMN embedding TYPE vector USING embedding::vector;

ALTER TABLE embedding_cache
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'google/text-embedding-004',
  ADD COLUMN IF NOT EXISTS dim   INTEGER;

-- Best-effort backfill of dim for rows already in the cache.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'embedding_cache' AND column_name = 'dim'
  ) THEN
    EXECUTE $sql$UPDATE embedding_cache SET dim = vector_dims(embedding) WHERE dim IS NULL$sql$;
  END IF;
END $$;

-- Now create the composite index. IF NOT EXISTS so reruns are safe.
CREATE UNIQUE INDEX IF NOT EXISTS embedding_cache_hash_model_idx
  ON embedding_cache (text_hash, model);
