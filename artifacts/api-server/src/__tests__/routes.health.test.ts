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
