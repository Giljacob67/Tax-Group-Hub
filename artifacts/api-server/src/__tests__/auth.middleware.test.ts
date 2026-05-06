import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/protected",
    method: "GET",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & typeof res;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("jsonwebtoken", () => ({
  default: { verify: vi.fn() },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("authMiddleware", () => {
  let jwt: { verify: ReturnType<typeof vi.fn> };
  let authMiddleware: typeof import("../middlewares/auth.js").authMiddleware;

  beforeEach(async () => {
    // Reset env
    delete process.env.JWT_SECRET;
    delete process.env.API_KEY;
    delete process.env.WEBHOOK_SECRET;

    // Re-import after env reset so module reads fresh env
    vi.resetModules();
    jwt = (await import("jsonwebtoken")).default as unknown as typeof jwt;
    ({ authMiddleware } = await import("../middlewares/auth.js"));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Public paths ────────────────────────────────────────────────────────────

  it("passes /healthz without credentials", () => {
    process.env.API_KEY = "secret";
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/healthz" }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes /agents without credentials", () => {
    process.env.API_KEY = "secret";
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/agents" }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes GET /agents/:id without credentials", () => {
    process.env.API_KEY = "secret";
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/agents/123", method: "GET" }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes GET /settings/integrations without credentials", () => {
    process.env.API_KEY = "secret";
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/settings/integrations", method: "GET" }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes GET /settings/active-provider without credentials", () => {
    process.env.API_KEY = "secret";
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/settings/active-provider", method: "GET" }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  // ── SEC-1 regression: /settings and /crm writes must require auth ───────────

  it("[SEC-1] POST /settings/keys requires auth when API_KEY is set", () => {
    process.env.API_KEY = "secret";
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/settings/keys", method: "POST" }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("[SEC-1] PUT /settings/active-provider requires auth when API_KEY is set", () => {
    process.env.API_KEY = "secret";
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/settings/active-provider", method: "PUT" }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("[SEC-1] DELETE /settings/keys/:provider requires auth when API_KEY is set", () => {
    process.env.API_KEY = "secret";
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/settings/keys/openai", method: "DELETE" }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("[SEC-1] GET /settings/channels requires auth when API_KEY is set", () => {
    process.env.API_KEY = "secret";
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ path: "/settings/channels", method: "GET" }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ── Webhook secret ──────────────────────────────────────────────────────────

  it("passes with valid webhook secret and sets userId from x-user-id", () => {
    process.env.API_KEY = "secret";
    process.env.WEBHOOK_SECRET = "wh-secret";
    const req = makeReq({
      path: "/automate/execute",
      headers: { "x-webhook-secret": "wh-secret", "x-user-id": "tenant-123" },
    });
    const next = vi.fn() as NextFunction;
    authMiddleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("tenant-123");
  });

  it("does not pass with wrong webhook secret", () => {
    process.env.API_KEY = "secret";
    process.env.WEBHOOK_SECRET = "wh-secret";
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    authMiddleware(
      makeReq({ path: "/automate/execute", headers: { "x-webhook-secret": "wrong" } }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ── JWT auth ────────────────────────────────────────────────────────────────

  it("passes with valid JWT and sets req.userId from sub", async () => {
    process.env.JWT_SECRET = "jwt-secret";
    vi.resetModules();
    jwt = (await import("jsonwebtoken")).default as unknown as typeof jwt;
    ({ authMiddleware } = await import("../middlewares/auth.js"));

    jwt.verify.mockReturnValueOnce({ sub: "user-abc" });

    const req = makeReq({
      headers: { authorization: "Bearer valid.jwt.token" },
    });
    const next = vi.fn() as NextFunction;
    authMiddleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("user-abc");
  });

  it("falls through to API key when JWT verification throws", async () => {
    process.env.JWT_SECRET = "jwt-secret";
    process.env.API_KEY = "api-key-123";
    vi.resetModules();
    jwt = (await import("jsonwebtoken")).default as unknown as typeof jwt;
    ({ authMiddleware } = await import("../middlewares/auth.js"));

    jwt.verify.mockImplementationOnce(() => { throw new Error("invalid signature"); });

    const req = makeReq({
      headers: { authorization: "Bearer api-key-123" },
    });
    const next = vi.fn() as NextFunction;
    authMiddleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("default");
  });

  it("returns 401 when JWT is invalid and token is not the API key", async () => {
    process.env.JWT_SECRET = "jwt-secret";
    process.env.API_KEY = "api-key-123";
    vi.resetModules();
    jwt = (await import("jsonwebtoken")).default as unknown as typeof jwt;
    ({ authMiddleware } = await import("../middlewares/auth.js"));

    jwt.verify.mockImplementationOnce(() => { throw new Error("invalid signature"); });

    const res = makeRes();
    const next = vi.fn() as NextFunction;
    authMiddleware(
      makeReq({ headers: { authorization: "Bearer wrong-token" } }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ── x-api-key header ────────────────────────────────────────────────────────

  it("passes with valid x-api-key header", () => {
    process.env.API_KEY = "my-api-key";
    const req = makeReq({
      headers: { "x-api-key": "my-api-key", "x-user-id": "tenant-xyz" },
    });
    const next = vi.fn() as NextFunction;
    authMiddleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("tenant-xyz");
  });

  // ── Demo mode ───────────────────────────────────────────────────────────────

  it("falls through to demo-user when no auth is configured", () => {
    const req = makeReq({ headers: { "x-user-id": "u1" } });
    const next = vi.fn() as NextFunction;
    authMiddleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("u1");
  });

  it("demo-user fallback does NOT apply when API_KEY is set", () => {
    process.env.API_KEY = "configured";
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({}), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
