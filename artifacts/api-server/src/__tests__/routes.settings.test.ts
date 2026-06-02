import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import express from "express";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function chain(result: any = []) {
  const prom = Promise.resolve(result);
  const c: any = (..._args: any[]) => prom;
  c.then = prom.then.bind(prom);
  c.catch = prom.catch.bind(prom);
  c.from = vi.fn(() => c);
  c.where = vi.fn(() => c);
  c.leftJoin = vi.fn(() => c);
  c.innerJoin = vi.fn(() => c);
  c.orderBy = vi.fn(() => c);
  c.limit = vi.fn(() => c);
  c.values = vi.fn(() => c);
  c.set = vi.fn(() => c);
  // returning() defaults to a mock row so delete/update can detect success
  c.returning = vi.fn(() => Promise.resolve([{ id: 1 }]));
  c.execute = vi.fn(() => Promise.resolve({ rows: [] }));
  return c;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => chain()),
    insert: vi.fn(() => chain()),
    update: vi.fn(() => chain()),
    delete: vi.fn(() => chain()),
    execute: vi.fn(() => Promise.resolve({ rows: [] })),
  },
  appConfigTable: { key: "key", value: "value", updatedAt: "updated_at" },
  channelConfigsTable: {
    id: "id", userId: "user_id", platform: "platform",
    externalId: "external_id", agentId: "agent_id", config: "config",
    createdAt: "created_at", updatedAt: "updated_at",
  },
  apiKeysTable: {
    id: "id", userId: "user_id", provider: "provider",
    key: "key", createdAt: "created_at", updatedAt: "updated_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ eq: [a, b] })),
  and: vi.fn((...args: any[]) => ({ and: args })),
}));

vi.mock("../lib/crypto.js", () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => s.replace("enc:", "")),
}));

vi.mock("../lib/validation.js", () => ({
  pick: vi.fn((_obj: any, _fields: readonly string[]) => ({})),
  safeNumber: vi.fn(() => null),
  validateHttpUrl: vi.fn((u: string) => u),
  validateIdParam: vi.fn((id: string) => {
    const n = Number(id);
    return Number.isNaN(n) ? null : n;
  }),
  validateWhitelist: vi.fn((value: any, allowed: readonly string[]) => {
    if (typeof value !== "string") return null;
    return (allowed as readonly string[]).includes(value) ? value : null;
  }),
  validateSafeUrl: vi.fn((url: string) => url),
}));

vi.mock("../middlewares/auth.js", () => ({
  isRealUser: vi.fn((userId?: string) =>
    !!userId && userId !== "default" && userId !== "dev-user"
  ),
}));

vi.mock("../lib/api-response.js", () => ({
  apiError: vi.fn((res: any, code: number, message: string) => {
    res.status(code).json({ success: false, error: message });
  }),
}));

vi.mock("../lib/llm-client.js", () => ({
  callLLM: vi.fn(() => ({
    output: "OK · test-model",
    provider: "test",
    model: "test-model",
    tokensUsed: 10,
    executionTimeMs: 100,
  })),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function createApp(withAuth = true) {
  const app = express();
  app.use(express.json());
  if (withAuth) {
    app.use("/api", (req: any, _res: any, next: any) => {
      req.userId = "test-user";
      next();
    });
  }
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Routes: /api/settings/channels", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: settingsRouter }] = await Promise.all([
      import("../routes/settings.js"),
    ]);
    app = createApp();
    app.use("/api", settingsRouter);
  });

  // ── GET /api/settings/channels ────────────────────────────────────────────

  it("GET /api/settings/channels returns channels for authenticated user", async () => {
    const res = await supertest(app).get("/api/settings/channels");
    expect(res.status).toBe(200);
    expect(res.body.channels).toBeDefined();
    expect(Array.isArray(res.body.channels)).toBe(true);
  });

  it("GET /api/settings/channels requires userId (no userId = no user filter)", async () => {
    const noAuthApp = express();
    noAuthApp.use(express.json());
    const [{ default: settingsRouter }] = await Promise.all([
      import("../routes/settings.js"),
    ]);
    noAuthApp.use("/api", settingsRouter);

    // Without auth middleware, req.userId is undefined — route still works
    // but isRealUser(undefined) returns false so no user filter is applied
    const res = await supertest(noAuthApp).get("/api/settings/channels");
    expect(res.status).toBe(200);
  });

  // ── POST /api/settings/channels ───────────────────────────────────────────

  it("POST /api/settings/channels requires platform, externalId, agentId", async () => {
    const res = await supertest(app)
      .post("/api/settings/channels")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/settings/channels creates a new channel", async () => {
    const res = await supertest(app)
      .post("/api/settings/channels")
      .send({
        platform: "whatsapp",
        externalId: "12345",
        agentId: "coordenador-geral-tax-group",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── DELETE /api/settings/channels/:id ─────────────────────────────────────

  it("DELETE /api/settings/channels/:id with valid id returns success", async () => {
    const res = await supertest(app).delete("/api/settings/channels/1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("DELETE /api/settings/channels/:id with invalid id returns 400", async () => {
    const res = await supertest(app).delete("/api/settings/channels/abc");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("Routes: /api/settings (root)", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: settingsRouter }] = await Promise.all([
      import("../routes/settings.js"),
    ]);
    app = createApp();
    app.use("/api", settingsRouter);
  });

  it("GET /api/settings returns list of endpoints", async () => {
    const res = await supertest(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.endpoints).toBeInstanceOf(Array);
    expect(res.body.endpoints.length).toBeGreaterThan(0);
  });
});

describe("Routes: /api/settings/keys", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: settingsRouter }] = await Promise.all([
      import("../routes/settings.js"),
    ]);
    app = createApp();
    app.use("/api", settingsRouter);
  });

  it("GET /api/settings/keys returns keys for user", async () => {
    const res = await supertest(app).get("/api/settings/keys");
    expect(res.status).toBe(200);
    expect(res.body.keys).toBeDefined();
    expect(Array.isArray(res.body.keys)).toBe(true);
  });

  it("POST /api/settings/keys requires provider and key", async () => {
    const res = await supertest(app)
      .post("/api/settings/keys")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("DELETE /api/settings/keys/:provider returns success", async () => {
    const res = await supertest(app).delete("/api/settings/keys/openai");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
