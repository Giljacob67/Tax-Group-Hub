import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
  },
  llmConnectionsTable: {
    id: "id",
    userId: "user_id",
    provider: "provider",
    modelId: "model_id",
    baseUrl: "base_url",
    apiKey: "api_key",
    usageType: "usage_type",
    isDefault: "is_default",
    isActive: "is_active",
    name: "name",
    lastTestStatus: "last_test_status",
    lastError: "last_error",
    lastTestedAt: "last_tested_at",
  },
  llmProfilesTable: {
    id: "id",
    userId: "user_id",
    isActive: "is_active",
    chatConnectionId: "chat_connection_id",
    fastConnectionId: "fast_connection_id",
    reasoningConnectionId: "reasoning_connection_id",
    visionConnectionId: "vision_connection_id",
    embeddingConnectionId: "embedding_connection_id",
    imageConnectionId: "image_connection_id",
    transcriptionConnectionId: "transcription_connection_id",
  },
}));

vi.mock("../lib/llm-client.js", () => ({
  callLLM: vi.fn(),
}));

vi.mock("../lib/crypto.js", () => ({
  decrypt: vi.fn((s: string) => `decrypted:${s}`),
}));

vi.mock("../lib/logger.js", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { callLLMViaConnection, healthCheckConnections } from "../lib/llm-router.js";
import { callLLM } from "../lib/llm-client.js";
import { db } from "@workspace/db";

/**
 * Build a chain that supports `.from().where().limit(n)` and resolves to `rows`.
 * Every intermediate call returns `this` so the full Drizzle chain works.
 */
function chainWithLimit(rows: any[]) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.from = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockResolvedValue(rows);
  return c;
}

/**
 * Build a chain that supports `.from().where()` (no `.limit()`) and resolves
 * to `rows` when the promise is awaited. Used by buildFallbackChain and
 * healthCheckConnections.
 */
function chainNoLimit(rows: any[]) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.from = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockResolvedValue(rows);
  return c;
}

/**
 * Build a chain for `db.update(table).set({...}).where(...)`.
 */
function updateChain() {
  const c: any = {};
  c.update = vi.fn().mockReturnValue(c);
  c.set = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockResolvedValue(undefined);
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════════
// callLLMViaConnection
// ═══════════════════════════════════════════════════════════════════════════════
describe("callLLMViaConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no connection is found", async () => {
    // resolveConnection: no connId → skip; usageType → profile query (no match);
    // then default connection query (no match)
    (db.select as any)
      .mockReturnValueOnce(chainWithLimit([]))   // profile query
      .mockReturnValueOnce(chainWithLimit([]));  // default conn query

    await expect(
      callLLMViaConnection("system", "hello", { usageType: "chat", userId: "u1" })
    ).rejects.toThrow(/Nenhuma conex/);
  });

  it("calls LLM with the resolved connection and returns result", async () => {
    const conn = {
      id: 1, userId: "u1", provider: "openai", modelId: "gpt-4o",
      baseUrl: null, apiKey: "enc-key", usageType: "chat", isDefault: true,
      isActive: true, name: "Primary", lastTestStatus: "ok", lastError: null,
    };

    // resolveConnection: profile query → []; default conn query → [conn]
    // buildFallbackChain: → [conn]
    (db.select as any)
      .mockReturnValueOnce(chainWithLimit([]))   // profile query
      .mockReturnValueOnce(chainWithLimit([conn])) // default conn query
      .mockReturnValueOnce(chainNoLimit([conn]));  // fallback chain

    (callLLM as any).mockResolvedValue({
      output: "Hello!", tokensUsed: 10, promptTokens: 5, completionTokens: 5,
      executionTimeMs: 100, model: "gpt-4o", provider: "OpenAI",
    });

    const result = await callLLMViaConnection("system", "hello", {
      usageType: "chat", userId: "u1",
    });

    expect(result.output).toBe("Hello!");
    expect(result.connectionUsed).toBe(1);
    expect(result.fallbackTriggered).toBe(false);
    expect(callLLM).toHaveBeenCalledWith(
      "system", "hello",
      expect.objectContaining({ provider: "openai", model: "gpt-4o" })
    );
  });

  it("triggers fallback when primary connection fails", async () => {
    const conn1 = {
      id: 1, userId: "u1", provider: "openai", modelId: "gpt-4o",
      baseUrl: null, apiKey: "enc-1", usageType: "chat", isDefault: true,
      isActive: true, name: "Primary", lastTestStatus: "ok", lastError: null,
    };
    const conn2 = {
      id: 2, userId: null, provider: "google", modelId: "gemini-flash",
      baseUrl: null, apiKey: "enc-2", usageType: "chat", isDefault: false,
      isActive: true, name: "Fallback", lastTestStatus: "ok", lastError: null,
    };

    (db.select as any)
      .mockReturnValueOnce(chainWithLimit([]))
      .mockReturnValueOnce(chainWithLimit([conn1]))
      .mockReturnValueOnce(chainNoLimit([conn1, conn2]));

    (db as any).update = vi.fn().mockReturnValue(updateChain());

    (callLLM as any)
      .mockRejectedValueOnce(new Error("OpenAI down"))
      .mockResolvedValueOnce({
        output: "Fallback works", tokensUsed: 5, promptTokens: 2, completionTokens: 3,
        executionTimeMs: 50, model: "gemini-flash", provider: "Google",
      });

    const result = await callLLMViaConnection("system", "hello", {
      usageType: "chat", userId: "u1",
    });

    expect(result.output).toBe("Fallback works");
    expect(result.fallbackTriggered).toBe(true);
    expect(result.connectionUsed).toBe(2);
    expect(callLLM).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all fallbacks", async () => {
    const conns = [
      { id: 1, userId: "u1", provider: "openai", modelId: "gpt-4o", baseUrl: null, apiKey: "e1", usageType: "chat", isDefault: true, isActive: true, name: "A", lastTestStatus: "ok", lastError: null },
      { id: 2, userId: "u1", provider: "google", modelId: "gemini", baseUrl: null, apiKey: "e2", usageType: "chat", isDefault: false, isActive: true, name: "B", lastTestStatus: "ok", lastError: null },
    ];

    (db.select as any)
      .mockReturnValueOnce(chainWithLimit([]))
      .mockReturnValueOnce(chainWithLimit([conns[0]]))
      .mockReturnValueOnce(chainNoLimit(conns));

    (db as any).update = vi.fn().mockReturnValue(updateChain());

    (callLLM as any).mockRejectedValue(new Error("fail"));

    await expect(
      callLLMViaConnection("system", "hello", {
        usageType: "chat", userId: "u1", maxRetries: 1,
      })
    ).rejects.toThrow("Todos os provedores de LLM falharam");
  });

  it("respects custom maxRetries", async () => {
    const conns = [
      { id: 1, userId: "u1", provider: "openai", modelId: "gpt", baseUrl: null, apiKey: "e1", usageType: "chat", isDefault: true, isActive: true, name: "A", lastTestStatus: "ok", lastError: null },
      { id: 2, userId: "u1", provider: "google", modelId: "gem", baseUrl: null, apiKey: "e2", usageType: "chat", isDefault: false, isActive: true, name: "B", lastTestStatus: "ok", lastError: null },
      { id: 3, userId: "u1", provider: "anthropic", modelId: "claude", baseUrl: null, apiKey: "e3", usageType: "chat", isDefault: false, isActive: true, name: "C", lastTestStatus: "ok", lastError: null },
    ];

    (db.select as any)
      .mockReturnValueOnce(chainWithLimit([]))
      .mockReturnValueOnce(chainWithLimit([conns[0]]))
      .mockReturnValueOnce(chainNoLimit(conns));

    (db as any).update = vi.fn().mockReturnValue(updateChain());

    (callLLM as any).mockRejectedValue(new Error("fail"));

    await expect(
      callLLMViaConnection("system", "hello", {
        usageType: "chat", userId: "u1", maxRetries: 0,
      })
    ).rejects.toThrow("Todos os provedores");

    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it("fallback chain sorts ok > untested > error", async () => {
    const conn = {
      id: 1, userId: "u1", provider: "openai", modelId: "gpt", baseUrl: null, apiKey: "e1",
      usageType: "chat", isDefault: true, isActive: true, name: "Primary",
      lastTestStatus: "error", lastError: "previous error",
    };
    const fallbackOk = {
      id: 2, userId: null, provider: "google", modelId: "gem", baseUrl: null, apiKey: "e2",
      usageType: "chat", isDefault: false, isActive: true, name: "OkConn",
      lastTestStatus: "ok", lastError: null,
    };
    const fallbackUntested = {
      id: 3, userId: null, provider: "anthropic", modelId: "claude", baseUrl: null, apiKey: "e3",
      usageType: "chat", isDefault: false, isActive: true, name: "Untested",
      lastTestStatus: "untested", lastError: null,
    };
    const fallbackError = {
      id: 4, userId: null, provider: "openai", modelId: "gpt2", baseUrl: null, apiKey: "e4",
      usageType: "chat", isDefault: false, isActive: true, name: "ErrConn",
      lastTestStatus: "error", lastError: "timeout",
    };

    (db.select as any)
      .mockReturnValueOnce(chainWithLimit([]))
      .mockReturnValueOnce(chainWithLimit([conn]))
      .mockReturnValueOnce(chainNoLimit([conn, fallbackOk, fallbackUntested, fallbackError]));

    (db as any).update = vi.fn().mockReturnValue(updateChain());

    (callLLM as any)
      .mockRejectedValueOnce(new Error("primary down"))
      .mockResolvedValueOnce({
        output: "ok response", tokensUsed: 5, promptTokens: 2, completionTokens: 3,
        executionTimeMs: 50, model: "gem", provider: "Google",
      });

    const result = await callLLMViaConnection("system", "hello", {
      usageType: "chat", userId: "u1", maxRetries: 2,
    });

    expect(result.output).toBe("ok response");
    expect(result.connectionUsed).toBe(2);
    expect(result.fallbackTriggered).toBe(true);
  });

  it("passes baseUrl as customUrl to callLLM", async () => {
    const conn = {
      id: 1, userId: "u1", provider: "custom_openai", modelId: "local-model",
      baseUrl: "http://my-server:8080", apiKey: "enc-key", usageType: "chat",
      isDefault: true, isActive: true, name: "Custom", lastTestStatus: "ok", lastError: null,
    };

    (db.select as any)
      .mockReturnValueOnce(chainWithLimit([]))
      .mockReturnValueOnce(chainWithLimit([conn]))
      .mockReturnValueOnce(chainNoLimit([conn]));

    (callLLM as any).mockResolvedValue({
      output: "custom", tokensUsed: 0, promptTokens: 0, completionTokens: 0,
      executionTimeMs: 10, model: "local-model", provider: "Custom",
    });

    await callLLMViaConnection("system", "hello", {
      usageType: "chat", userId: "u1",
    });

    expect(callLLM).toHaveBeenCalledWith(
      "system", "hello",
      expect.objectContaining({ customUrl: "http://my-server:8080" })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// healthCheckConnections
// ═══════════════════════════════════════════════════════════════════════════════
describe("healthCheckConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupHealthCheck(connections: any[]) {
    (db.select as any).mockReturnValue(chainNoLimit(connections));
    (db as any).update = vi.fn().mockReturnValue(updateChain());
  }

  it("returns ok status for healthy connections", async () => {
    const conn = {
      id: 1, userId: "u1", provider: "openai", modelId: "gpt-4o",
      baseUrl: null, name: "Primary", usageType: "chat",
    };

    setupHealthCheck([conn]);

    (callLLM as any).mockResolvedValue({
      output: "OK", tokensUsed: 2, promptTokens: 1, completionTokens: 1,
      executionTimeMs: 50, model: "gpt-4o", provider: "OpenAI",
    });

    const results = await healthCheckConnections("u1");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("ok");
    expect(results[0].name).toBe("Primary");
  });

  it("returns error status for failing connections", async () => {
    const conn = {
      id: 2, userId: "u1", provider: "openai", modelId: "gpt-4o",
      baseUrl: null, name: "Broken", usageType: "chat",
    };

    setupHealthCheck([conn]);

    (callLLM as any).mockRejectedValue(new Error("Connection refused"));

    const results = await healthCheckConnections("u1");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("error");
    expect(results[0].error).toBe("Connection refused");
  });

  it("returns empty array when no active connections", async () => {
    setupHealthCheck([]);

    const results = await healthCheckConnections("u1");
    expect(results).toHaveLength(0);
  });

  it("health-checks multiple connections", async () => {
    const conns = [
      { id: 1, userId: "u1", provider: "openai", modelId: "gpt", baseUrl: null, name: "A", usageType: "chat" },
      { id: 2, userId: "u1", provider: "google", modelId: "gem", baseUrl: null, name: "B", usageType: "chat" },
    ];

    setupHealthCheck(conns);

    (callLLM as any)
      .mockResolvedValueOnce({ output: "OK", tokensUsed: 0, promptTokens: 0, completionTokens: 0, executionTimeMs: 10, model: "gpt", provider: "OpenAI" })
      .mockRejectedValueOnce(new Error("timeout"));

    const results = await healthCheckConnections("u1");
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("ok");
    expect(results[1].status).toBe("error");
  });
});
