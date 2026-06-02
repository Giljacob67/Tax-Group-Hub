import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Server } from "node:http";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTestServer(
  limiter: express.RequestHandler,
  opts?: { trustProxy?: boolean }
): { app: express.Express; server: Server; port: number } {
  const app = express();
  if (opts?.trustProxy !== undefined) {
    app.set("trust proxy", opts.trustProxy);
  }
  app.use(limiter);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return { app, server: null as any, port: 0 };
}

async function startServer(info: { app: express.Express; server: Server; port: number }) {
  return new Promise<void>((resolve) => {
    info.server = info.app.listen(0, () => {
      info.port = (info.server.address() as any).port;
      resolve();
    });
  });
}

async function stopServer(info: { app: express.Express; server: Server; port: number }) {
  return new Promise<void>((resolve) => {
    info.server.close(() => resolve());
  });
}

async function request(port: number, ip = "127.0.0.1"): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}/test`, {
    headers: { "x-forwarded-for": ip },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("rate-limit configuration", () => {
  let apiLimiter: typeof import("../middlewares/rate-limit.js").apiLimiter;
  let uploadLimiter: typeof import("../middlewares/rate-limit.js").uploadLimiter;
  let llmLimiter: typeof import("../middlewares/rate-limit.js").llmLimiter;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../middlewares/rate-limit.js");
    apiLimiter = mod.apiLimiter;
    uploadLimiter = mod.uploadLimiter;
    llmLimiter = mod.llmLimiter;
  });

  describe("apiLimiter", () => {
    it("allows a request within the limit", async () => {
      const info = createTestServer(apiLimiter);
      await startServer(info);
      try {
        const res = await request(info.port);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
      } finally {
        await stopServer(info);
      }
    });

    it("returns 429 when limit is exceeded", async () => {
      const info = createTestServer(apiLimiter);
      await startServer(info);
      try {
        // Send 301 requests to exceed the 300 limit
        for (let i = 0; i < 300; i++) {
          await request(info.port);
        }
        const res = await request(info.port);
        expect(res.status).toBe(429);
        expect(res.body.error).toBe("Too Many Requests");
      } finally {
        await stopServer(info);
      }
    });
  });

  describe("uploadLimiter", () => {
    it("allows a request within the limit", async () => {
      const info = createTestServer(uploadLimiter);
      await startServer(info);
      try {
        const res = await request(info.port);
        expect(res.status).toBe(200);
      } finally {
        await stopServer(info);
      }
    });

    it("returns 429 when limit is exceeded", async () => {
      const info = createTestServer(uploadLimiter);
      await startServer(info);
      try {
        for (let i = 0; i < 30; i++) {
          await request(info.port);
        }
        const res = await request(info.port);
        expect(res.status).toBe(429);
        expect(res.body.message).toContain("Upload");
      } finally {
        await stopServer(info);
      }
    });
  });

  describe("llmLimiter", () => {
    it("allows a request within the limit", async () => {
      const info = createTestServer(llmLimiter);
      await startServer(info);
      try {
        const res = await request(info.port);
        expect(res.status).toBe(200);
      } finally {
        await stopServer(info);
      }
    });

    it("returns 429 when limit is exceeded", async () => {
      const info = createTestServer(llmLimiter);
      await startServer(info);
      try {
        for (let i = 0; i < 10; i++) {
          await request(info.port);
        }
        const res = await request(info.port);
        expect(res.status).toBe(429);
        expect(res.body.message).toContain("LLM");
      } finally {
        await stopServer(info);
      }
    });
  });

  describe("429 response format", () => {
    it("apiLimiter returns the expected error body", async () => {
      const info = createTestServer(apiLimiter);
      await startServer(info);
      try {
        for (let i = 0; i < 300; i++) {
          await request(info.port);
        }
        const res = await request(info.port);
        expect(res.status).toBe(429);
        expect(res.body).toEqual(
          expect.objectContaining({
            error: "Too Many Requests",
            message: expect.stringContaining("300"),
          }),
        );
      } finally {
        await stopServer(info);
      }
    });
  });

  describe("window reset behavior", () => {
    it("resets counter after window expires", async () => {
      const shortLimiter = (await import("express-rate-limit")).default({
        windowMs: 100,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
      });

      const info = createTestServer(shortLimiter);
      await startServer(info);
      try {
        // First 2 should pass
        expect((await request(info.port)).status).toBe(200);
        expect((await request(info.port)).status).toBe(200);
        // Third should be blocked
        expect((await request(info.port)).status).toBe(429);

        // Wait for window reset
        await new Promise((r) => setTimeout(r, 150));

        // Should pass again
        expect((await request(info.port)).status).toBe(200);
      } finally {
        await stopServer(info);
      }
    });
  });
});
