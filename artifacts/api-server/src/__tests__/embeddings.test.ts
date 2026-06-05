import { describe, it, expect, vi } from "vitest";

// Stub @workspace/db so the llm-client import chain doesn't reach for a real
// DATABASE_URL. The tests below only exercise validateEmbeddingDim, which is
// pure, but importing the file pulls in settings.ts -> @workspace/db.
vi.mock("@workspace/db", () => ({
  db: {},
  embeddingCacheTable: {
    textHash: "text_hash",
    model: "model",
    embedding: "embedding",
    dim: "dim",
  },
  apiKeysTable: { provider: "provider", userId: "user_id", key: "key" },
}));

import {
  EMBEDDING_MODELS,
  validateEmbeddingDim,
  EmbeddingDimError,
  DEFAULT_EMBEDDING_MODEL,
} from "../lib/llm-client.js";

describe("validateEmbeddingDim", () => {
  it("accepts a vector of the correct length", () => {
    const vec: number[] = Array.from({ length: 768 }, () => 0.1);
    const out = validateEmbeddingDim(vec, "google/text-embedding-004");
    expect(out).toBe(vec);
  });

  it("rejects a vector of the wrong length with a typed error", () => {
    const vec: number[] = Array.from({ length: 1536 }, () => 0.1);
    expect(() =>
      validateEmbeddingDim(vec, "google/text-embedding-004"),
    ).toThrow(EmbeddingDimError);
  });

  it("exposes the expected/got dimensions on the error", () => {
    const vec: number[] = Array.from({ length: 100 });
    try {
      validateEmbeddingDim(vec, "openai/text-embedding-3-large");
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EmbeddingDimError);
      const e = err as EmbeddingDimError;
      expect(e.expected).toBe(3072);
      expect(e.got).toBe(100);
    }
  });

  it("covers the canonical provider matrix", () => {
    // Sanity: every model we ship has a positive dim declared.
    for (const [key, spec] of Object.entries(EMBEDDING_MODELS)) {
      expect(spec.dimensions, key).toBeGreaterThan(0);
      expect(spec.modelId, key).toBeTruthy();
    }
  });

  it("uses a 768-dim default for backwards compatibility", () => {
    const spec = EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL];
    expect(spec.dimensions).toBe(768);
    expect(spec.provider).toBe("google");
  });
});
