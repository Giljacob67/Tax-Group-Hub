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
  c.groupBy = vi.fn(() => c);
  c.values = vi.fn(() => c);
  c.set = vi.fn(() => c);
  c.returning = vi.fn(() => prom);
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
  usageLogsTable: {
    id: "id",
    userId: "user_id",
    agentId: "agent_id",
    platform: "platform",
    provider: "provider",
    model: "model",
    totalTokens: "total_tokens",
    promptTokens: "prompt_tokens",
    completionTokens: "completion_tokens",
    cost: "cost",
    latencyMs: "latency_ms",
    createdAt: "created_at",
  },
  conversationsTable: {},
  messagesTable: {},
  llmConnectionsTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ eq: [a, b] })),
  and: vi.fn((...args: any[]) => ({ and: args })),
  desc: vi.fn((a: any) => ({ desc: a })),
  asc: vi.fn((a: any) => ({ asc: a })),
  gte: vi.fn((a: any, b: any) => ({ gte: [a, b] })),
  lte: vi.fn((a: any, b: any) => ({ lte: [a, b] })),
  sql: vi.fn((_s: TemplateStringsArray, ..._args: any[]) => ({}) as any),
}));

vi.mock("../lib/api-response.js", () => ({
  apiError: vi.fn((res: any, code: number, message: string) => {
    res.status(code).json({ success: false, error: message });
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", (req: any, _res: any, next: any) => {
    req.userId = "test-user";
    next();
  });
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Routes: /api/analytics/overview", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: analyticsRouter }] = await Promise.all([
      import("../routes/analytics.js"),
    ]);
    app = createApp();
    app.use("/api", analyticsRouter);
  });

  it("GET /api/analytics/overview returns 200 with summary data", async () => {
    const res = await supertest(app).get("/api/analytics/overview");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalTokens");
    expect(res.body).toHaveProperty("messageCount");
    expect(res.body).toHaveProperty("activeAgents");
    expect(res.body).toHaveProperty("totalCostCents");
    expect(res.body).toHaveProperty("avgLatencyMs");
    expect(res.body).toHaveProperty("period");
    expect(typeof res.body.totalTokens).toBe("number");
    expect(typeof res.body.messageCount).toBe("number");
    expect(typeof res.body.period).toBe("string");
  });

  it("GET /api/analytics/overview respects period query param", async () => {
    const res = await supertest(app).get("/api/analytics/overview?period=7d");
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("7d");
  });

  it("GET /api/analytics/overview defaults to 30d period", async () => {
    const res = await supertest(app).get("/api/analytics/overview");
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("30d");
  });
});

describe("Routes: /api/analytics/daily-usage", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: analyticsRouter }] = await Promise.all([
      import("../routes/analytics.js"),
    ]);
    app = createApp();
    app.use("/api", analyticsRouter);
  });

  it("GET /api/analytics/daily-usage returns 200 with usageByDay array", async () => {
    const res = await supertest(app).get("/api/analytics/daily-usage");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("usageByDay");
    expect(Array.isArray(res.body.usageByDay)).toBe(true);
  });

  it("GET /api/analytics/daily-usage with period=24h", async () => {
    const res = await supertest(app).get(
      "/api/analytics/daily-usage?period=24h",
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.usageByDay)).toBe(true);
  });
});
