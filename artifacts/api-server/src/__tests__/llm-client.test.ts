import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock heavy transitive deps ──────────────────────────────────────────────
vi.mock("@workspace/db", () => ({
  db: { select: vi.fn(), from: vi.fn(), where: vi.fn() },
  embeddingCacheTable: {
    textHash: "text_hash",
    model: "model",
    embedding: "embedding",
    dim: "dim",
  },
  apiKeysTable: { provider: "provider", userId: "user_id", key: "key" },
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  embedMany: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (modelId: string) => ({
    modelId,
    _type: "openai",
  })),
  openai: {},
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (modelId: string) => ({
    modelId,
    _type: "anthropic",
  })),
  anthropic: {},
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => (modelId: string) => ({
    modelId,
    _type: "google",
  })),
  google: {},
}));

vi.mock("../routes/settings.js", () => ({
  getEffectiveOllamaUrl: vi.fn().mockResolvedValue({ url: "" }),
  getEffectiveOllamaModel: vi.fn().mockResolvedValue("llama3"),
  getConfigValue: vi.fn().mockResolvedValue(null),
}));

vi.mock("../lib/crypto.js", () => ({
  decrypt: vi.fn((s: string) => `decrypted:${s}`),
}));

vi.mock("../lib/tools/registry.js", () => ({
  availableTools: {},
}));

// ── Imports under test ──────────────────────────────────────────────────────
import {
  EMBEDDING_MODELS,
  validateEmbeddingDim,
  EmbeddingDimError,
  DEFAULT_EMBEDDING_MODEL,
  getLanguageModel,
} from "../lib/llm-client.js";
import {
  getConfigValue,
  getEffectiveOllamaUrl,
  getEffectiveOllamaModel,
} from "../routes/settings.js";
import { db } from "@workspace/db";

// Helper: build a Drizzle-like chain that resolves `where(...)` to rows
function mockDbChain(rows: any[]) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

// ═══════════════════════════════════════════════════════════════════════════════
// validateEmbeddingDim
// ═══════════════════════════════════════════════════════════════════════════════
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

  it("rejects an empty array", () => {
    expect(() => validateEmbeddingDim([], "google/text-embedding-004")).toThrow(
      EmbeddingDimError,
    );
  });

  it("rejects non-array input gracefully (length = 0)", () => {
    expect(() =>
      validateEmbeddingDim(null as any, "google/text-embedding-004"),
    ).toThrow(EmbeddingDimError);
  });

  it("accepts vectors for every model in EMBEDDING_MODELS", () => {
    for (const [key, spec] of Object.entries(EMBEDDING_MODELS)) {
      const vec: number[] = Array.from({ length: spec.dimensions }, () => 0.5);
      expect(() => validateEmbeddingDim(vec, key as any)).not.toThrow();
    }
  });

  it("rejects wrong dimensions for every model in EMBEDDING_MODELS", () => {
    for (const [key, spec] of Object.entries(EMBEDDING_MODELS)) {
      const vec: number[] = Array.from(
        { length: spec.dimensions + 1 },
        () => 0.5,
      );
      expect(() => validateEmbeddingDim(vec, key as any)).toThrow(
        EmbeddingDimError,
      );
    }
  });

  it("EmbeddingDimError has correct name property", () => {
    const err = new EmbeddingDimError(768, 100);
    expect(err.name).toBe("EmbeddingDimError");
    expect(err.message).toContain("768");
    expect(err.message).toContain("100");
  });

  it("returns the same array reference (no copy)", () => {
    const vec768: number[] = Array.from({ length: 768 }, (_, i) => i);
    const result = validateEmbeddingDim(vec768, "google/text-embedding-004");
    expect(result).toBe(vec768);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getLanguageModel
// ═══════════════════════════════════════════════════════════════════════════════
describe("getLanguageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no provider is available (auto mode, no keys)", async () => {
    (db.select as any).mockReturnValue(mockDbChain([]));
    (getEffectiveOllamaUrl as any).mockResolvedValue({ url: "" });
    (getConfigValue as any).mockResolvedValue(null);

    await expect(getLanguageModel("auto", undefined, "user1")).rejects.toThrow(
      "Nenhum provedor",
    );
  });

  it("selects Google when provider is 'google' and key exists", async () => {
    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-google-key", userId: null }]),
    );

    const { providerName, modelId } = await getLanguageModel(
      "google",
      undefined,
      "u1",
    );
    expect(providerName).toBe("Google");
    expect(modelId).toBe("gemini-2.5-flash");
  });

  it("selects OpenAI when provider is 'openai' and key exists", async () => {
    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-openai-key", userId: null }]),
    );

    const { providerName, modelId } = await getLanguageModel(
      "openai",
      "gpt-4o-mini",
      "u1",
    );
    expect(providerName).toBe("OpenAI");
    expect(modelId).toBe("gpt-4o-mini");
  });

  it("selects Anthropic when provider is 'anthropic' and key exists", async () => {
    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-anth-key", userId: null }]),
    );

    const { providerName, modelId } = await getLanguageModel(
      "anthropic",
      "claude-3-opus",
      "u1",
    );
    expect(providerName).toBe("Anthropic");
    expect(modelId).toBe("claude-3-opus");
  });

  it("resolves 'claude' as alias for Anthropic", async () => {
    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-anth-key", userId: null }]),
    );

    const { providerName } = await getLanguageModel("claude", undefined, "u1");
    expect(providerName).toBe("Anthropic");
  });

  it("resolves 'gpt' as alias for OpenAI", async () => {
    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-openai-key", userId: null }]),
    );

    const { providerName } = await getLanguageModel("gpt", undefined, "u1");
    expect(providerName).toBe("OpenAI");
  });

  it("falls back to Ollama when auto and Ollama URL is set", async () => {
    (getEffectiveOllamaUrl as any).mockResolvedValue({
      url: "http://localhost:11434",
    });
    (getEffectiveOllamaModel as any).mockResolvedValue("llama3.2");
    (getConfigValue as any).mockResolvedValue(null);

    const { providerName, modelId } = await getLanguageModel(
      "auto",
      undefined,
      "u1",
    );
    expect(providerName).toBe("Ollama");
    expect(modelId).toBe("llama3.2");
  });

  it("selects Ollama explicitly when provider is 'ollama'", async () => {
    (getEffectiveOllamaUrl as any).mockResolvedValue({
      url: "http://localhost:11434",
    });
    (getEffectiveOllamaModel as any).mockResolvedValue("mistral");

    const { providerName, modelId } = await getLanguageModel(
      "ollama",
      undefined,
      "u1",
    );
    expect(providerName).toBe("Ollama");
    expect(modelId).toBe("mistral");
  });

  it("normalizes trailing slashes in Ollama URL", async () => {
    (getEffectiveOllamaUrl as any).mockResolvedValue({
      url: "http://localhost:11434///",
    });
    (getEffectiveOllamaModel as any).mockResolvedValue("llama3");

    const { providerName } = await getLanguageModel("ollama", undefined, "u1");
    expect(providerName).toBe("Ollama");
  });

  it("uses DB ACTIVE_LLM_PROVIDER when no provider specified", async () => {
    (getEffectiveOllamaUrl as any).mockResolvedValue({ url: "" });
    (getEffectiveOllamaModel as any).mockResolvedValue("llama3");
    (getConfigValue as any).mockImplementation(async (key: string) => {
      if (key === "ACTIVE_LLM_PROVIDER") return "openai";
      if (key === "ACTIVE_LLM_MODEL") return "gpt-4o";
      return null;
    });

    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-openai-key", userId: null }]),
    );

    const { providerName, modelId } = await getLanguageModel(
      undefined,
      undefined,
      "u1",
    );
    expect(providerName).toBe("OpenAI");
    expect(modelId).toBe("gpt-4o");
  });

  it("does not override explicit provider with DB config", async () => {
    (getConfigValue as any).mockImplementation(async (key: string) => {
      if (key === "ACTIVE_LLM_PROVIDER") return "openai";
      return null;
    });
    (getEffectiveOllamaUrl as any).mockResolvedValue({ url: "" });

    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-anth-key", userId: null }]),
    );

    const { providerName } = await getLanguageModel(
      "anthropic",
      undefined,
      "u1",
    );
    expect(providerName).toBe("Anthropic");
  });

  it("uses custom_model for OpenRouter when specified", async () => {
    (db.select as any).mockReturnValue(
      mockDbChain([{ key: "enc-or-key", userId: null }]),
    );

    const { providerName, modelId } = await getLanguageModel(
      "openrouter",
      "anthropic/claude-3.5-sonnet",
      "u1",
    );
    expect(providerName).toBe("OpenRouter");
    expect(modelId).toBe("anthropic/claude-3.5-sonnet");
  });

  it("throws for OpenRouter when API key is missing", async () => {
    (db.select as any).mockReturnValue(mockDbChain([]));

    await expect(
      getLanguageModel("openrouter", undefined, "u1"),
    ).rejects.toThrow("OpenRouter API Key");
  });
});
