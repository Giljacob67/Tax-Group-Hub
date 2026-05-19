-- Migration 001: Add blob_url column to knowledge_documents
-- This column stores the Vercel Blob URL for direct upload support.
-- Run this in your Neon SQL console or via: psql $DATABASE_URL -f lib/db/migrations/001_blob_url.sql

-- Add blob_url column if it doesn't exist
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS blob_url TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'knowledge_documents' 
  AND column_name = 'blob_url';

-- Ensure pgvector extension is enabled (required for vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify vector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Add index for vector similarity search on knowledge_chunks
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
ON knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add index for embedding cache lookup
CREATE INDEX IF NOT EXISTS idx_embedding_cache_text_hash 
ON embedding_cache (text_hash);

-- Note: If you're using drizzle-kit push instead, it will sync the schema
-- automatically including the blob_url column. This SQL is provided as a
-- safe fallback for manual migration without drizzle-kit.
