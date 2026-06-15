import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import express from "express";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

vi.mock("@workspace/api-zod", () => ({
  HealthCheckResponse: {
    parse: vi.fn((data: any) => data),
  },
}));

// @workspace/db lança no carregamento do módulo se DATABASE_URL não existir
// (lib/db/src/index.ts). Mockamos aqui — como o resto da suíte — para isolar o
// teste do banco. db.execute resolve, simulando conexão saudável (SELECT 1).
vi.mock("@workspace/db", () => ({
  db: {
    execute: vi.fn(() => Promise.resolve({ rows: [] })),
  },
}));

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Routes: /api/healthz", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: healthRouter }] = await Promise.all([
      import("../routes/health.js"),
    ]);
    app = createApp();
    app.use("/api", healthRouter);
  });

  it("GET /api/healthz returns 200 with status ok", async () => {
    const res = await supertest(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
