import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock heavy transitive deps ──────────────────────────────────────────────
vi.mock("@workspace/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
  integrationLogsTable: {
    userId: "user_id",
    integrationKey: "integration_key",
    integrationName: "integration_name",
    eventType: "event_type",
    direction: "direction",
    status: "status",
    durationMs: "duration_ms",
    httpStatus: "http_status",
    requestUrl: "request_url",
    requestMethod: "request_method",
    payloadPreview: "payload_preview",
    errorMessage: "error_message",
    technicalDetails: "technical_details",
    correlationId: "correlation_id",
    createdAt: "created_at",
  },
}));

// ── Imports under test ──────────────────────────────────────────────────────
import {
  maskUrl,
  safePayloadPreview,
  writeIntegrationLog,
  listIntegrationLogs,
} from "../lib/integration-logger.js";
import { db } from "@workspace/db";

// ═══════════════════════════════════════════════════════════════════════════════
// maskUrl
// ═══════════════════════════════════════════════════════════════════════════════
describe("maskUrl", () => {
  it("strips query params and auth tokens", () => {
    const masked = maskUrl(
      "https://api.example.com/v1/users?token=secret123&page=1",
    );
    expect(masked).toBe("https://api.example.com/v1/users");
  });

  it("preserves scheme, host, and path", () => {
    const masked = maskUrl("http://localhost:3000/api/webhook");
    expect(masked).toBe("http://localhost:3000/api/webhook");
  });

  it("handles URLs without query params", () => {
    const masked = maskUrl("https://example.com/path");
    expect(masked).toBe("https://example.com/path");
  });

  it("handles URLs with only query params", () => {
    const masked = maskUrl("https://example.com?token=abc");
    expect(masked).toBe("https://example.com/");
  });

  it("truncates invalid URLs to 80 chars", () => {
    const invalid = "not-a-url-but-very-long-".repeat(10);
    const masked = maskUrl(invalid);
    expect(masked.length).toBeLessThanOrEqual(80);
    expect(masked).toBe(invalid.substring(0, 80));
  });

  it("handles empty string", () => {
    const masked = maskUrl("");
    expect(masked).toBe("");
  });

  it("preserves port in host", () => {
    const masked = maskUrl("https://api.example.com:8443/v1/data?key=val");
    expect(masked).toBe("https://api.example.com:8443/v1/data");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// safePayloadPreview
// ═══════════════════════════════════════════════════════════════════════════════
describe("safePayloadPreview", () => {
  it("returns formatted JSON for simple objects", () => {
    const preview = safePayloadPreview({ name: "test", value: 42 });
    expect(preview).toContain("test");
    expect(preview).toContain("42");
  });

  it("redacts keys containing 'secret'", () => {
    const preview = safePayloadPreview({ apiSecret: "s3cr3t", name: "keep" });
    expect(preview).toContain("REDACTED");
    expect(preview).toContain("keep");
    expect(preview).not.toContain("s3cr3t");
  });

  it("redacts keys containing 'token'", () => {
    const preview = safePayloadPreview({ bearerToken: "tok123" });
    expect(preview).toContain("REDACTED");
    expect(preview).not.toContain("tok123");
  });

  it("redacts keys containing 'password'", () => {
    const preview = safePayloadPreview({ userPassword: "pass123" });
    expect(preview).toContain("REDACTED");
    expect(preview).not.toContain("pass123");
  });

  it("redacts keys containing 'key'", () => {
    const preview = safePayloadPreview({ apiKey: "key123" });
    expect(preview).toContain("REDACTED");
    expect(preview).not.toContain("key123");
  });

  it("redacts keys containing 'auth'", () => {
    const preview = safePayloadPreview({ authorization: "Bearer xyz" });
    expect(preview).toContain("REDACTED");
    expect(preview).not.toContain("Bearer xyz");
  });

  it("redacts keys containing 'credential'", () => {
    const preview = safePayloadPreview({ userCredentials: { pass: "x" } });
    expect(preview).toContain("REDACTED");
  });

  it("truncates long payloads to 500 chars", () => {
    const big = { data: "x".repeat(600) };
    const preview = safePayloadPreview(big);
    expect(preview.length).toBeLessThanOrEqual(510); // 500 + "…"
    expect(preview).toContain("…");
  });

  it("respects custom maxLen", () => {
    const preview = safePayloadPreview({ a: 1, b: 2, c: 3 }, 10);
    expect(preview.length).toBeLessThanOrEqual(15);
  });

  it("returns [parse error] for non-serializable input", () => {
    const circular: any = {};
    circular.self = circular;
    const preview = safePayloadPreview(circular);
    expect(preview).toBe("[parse error]");
  });

  it("handles null and undefined", () => {
    expect(safePayloadPreview(null)).toContain("null");
    // JSON.stringify(undefined) returns undefined, which triggers the catch block
    expect(safePayloadPreview(undefined)).toBe("[parse error]");
  });

  it("handles nested secret-like keys", () => {
    const preview = safePayloadPreview({
      user: { name: "John", authToken: "nested-secret" },
    });
    expect(preview).toContain("REDACTED");
    expect(preview).toContain("John");
    expect(preview).not.toContain("nested-secret");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// writeIntegrationLog
// ═══════════════════════════════════════════════════════════════════════════════
describe("writeIntegrationLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a correlationId (UUID) after writing", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    (db.insert as any).mockReturnValue(chain);

    const id = await writeIntegrationLog({
      integrationKey: "nfe",
      integrationName: "NFe",
      eventType: "issue",
      direction: "outbound",
      status: "success",
    });

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("masks requestUrl before storing", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    (db.insert as any).mockReturnValue(chain);

    await writeIntegrationLog({
      integrationKey: "nfe",
      integrationName: "NFe",
      eventType: "issue",
      direction: "outbound",
      status: "success",
      requestUrl: "https://api.nfe.example.com/v1/send?token=secret123",
    });

    const storedValues = chain.values.mock.calls[0][0];
    expect(storedValues.requestUrl).toBe("https://api.nfe.example.com/v1/send");
    expect(storedValues.requestUrl).not.toContain("secret123");
  });

  it("uses provided correlationId when given", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    (db.insert as any).mockReturnValue(chain);

    const customId = "custom-correlation-123";
    const id = await writeIntegrationLog({
      integrationKey: "nfe",
      integrationName: "NFe",
      eventType: "issue",
      direction: "outbound",
      status: "success",
      correlationId: customId,
    });

    expect(id).toBe(customId);
  });

  it("defaults requestMethod to POST", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    (db.insert as any).mockReturnValue(chain);

    await writeIntegrationLog({
      integrationKey: "nfe",
      integrationName: "NFe",
      eventType: "issue",
      direction: "outbound",
      status: "success",
    });

    const storedValues = chain.values.mock.calls[0][0];
    expect(storedValues.requestMethod).toBe("POST");
  });

  it("handles DB insert failure gracefully (no throw)", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockRejectedValue(new Error("DB down")),
    };
    (db.insert as any).mockReturnValue(chain);

    // Should not throw
    const id = await writeIntegrationLog({
      integrationKey: "nfe",
      integrationName: "NFe",
      eventType: "issue",
      direction: "outbound",
      status: "success",
    });

    expect(id).toBeTruthy();
  });

  it("stores all provided fields", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };
    (db.insert as any).mockReturnValue(chain);

    await writeIntegrationLog({
      userId: "u1",
      integrationKey: "nfe",
      integrationName: "NFe",
      eventType: "issue",
      direction: "outbound",
      status: "success",
      durationMs: 1234,
      httpStatus: 200,
      requestUrl: "https://example.com/v1/nfe",
      requestMethod: "POST",
      payloadPreview: "{ ... }",
      errorMessage: undefined,
      technicalDetails: "resolved in 200ms",
    });

    const storedValues = chain.values.mock.calls[0][0];
    expect(storedValues.userId).toBe("u1");
    expect(storedValues.integrationKey).toBe("nfe");
    expect(storedValues.durationMs).toBe(1234);
    expect(storedValues.httpStatus).toBe(200);
    expect(storedValues.technicalDetails).toBe("resolved in 200ms");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// listIntegrationLogs
// ═══════════════════════════════════════════════════════════════════════════════
describe("listIntegrationLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries logs with default options", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 1 }]),
      where: vi.fn().mockReturnThis(),
    };
    (db.select as any).mockReturnValue(chain);

    const results = await listIntegrationLogs();
    expect(results).toHaveLength(1);
    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it("filters by userId", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 1, userId: "u1" }]),
    };
    (db.select as any).mockReturnValue(chain);

    const results = await listIntegrationLogs({ userId: "u1" });
    expect(results).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });

  it("filters by integrationKey", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 2, integrationKey: "nfse" }]),
    };
    (db.select as any).mockReturnValue(chain);

    const results = await listIntegrationLogs({ integrationKey: "nfse" });
    expect(results).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });

  it("filters by status", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 3, status: "error" }]),
    };
    (db.select as any).mockReturnValue(chain);

    const results = await listIntegrationLogs({ status: "error" });
    expect(results).toHaveLength(1);
  });

  it("filters by direction", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 4, direction: "inbound" }]),
    };
    (db.select as any).mockReturnValue(chain);

    const results = await listIntegrationLogs({ direction: "inbound" });
    expect(results).toHaveLength(1);
  });

  it("applies custom limit", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
    };
    (db.select as any).mockReturnValue(chain);

    await listIntegrationLogs({ limit: 5 });
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it("combines multiple filters", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    (db.select as any).mockReturnValue(chain);

    await listIntegrationLogs({
      userId: "u1",
      integrationKey: "nfe",
      status: "success",
      direction: "outbound",
    });

    expect(chain.where).toHaveBeenCalled();
  });
});
