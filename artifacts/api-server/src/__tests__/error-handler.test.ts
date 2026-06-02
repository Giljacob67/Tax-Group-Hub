import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../lib/logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ZodError, ZodIssue } from "zod";
import multer from "multer";
import { errorHandler } from "../middlewares/error-handler.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    id: "req-123",
    url: "/test",
    method: "GET",
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

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("errorHandler", () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = origEnv;
    }
  });

  // ── ZodError ─────────────────────────────────────────────────────────────

  describe("ZodError handling", () => {
    it("returns 400 with validation details", () => {
      const issues: ZodIssue[] = [
        { code: "invalid_type", expected: "string", received: "number", path: ["name"], message: "Expected string" },
      ];
      const err = new ZodError(issues);
      const res = makeRes();
      errorHandler(err, makeReq(), res, makeNext());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Validation failed",
          requestId: "req-123",
          details: expect.any(Object),
        }),
      );
    });

    it("includes requestId from req.id", () => {
      const err = new ZodError([]);
      const res = makeRes();
      errorHandler(err, makeReq({ id: "custom-id" }), res, makeNext());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "custom-id" }),
      );
    });
  });

  // ── MulterError ──────────────────────────────────────────────────────────

  describe("MulterError handling", () => {
    it("returns 413 for LIMIT_FILE_SIZE", () => {
      const err = new multer.MulterError("LIMIT_FILE_SIZE");
      const res = makeRes();
      errorHandler(err, makeReq(), res, makeNext());
      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("50MB") }),
      );
    });

    it("returns 400 for LIMIT_UNEXPECTED_FILE", () => {
      const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE");
      const res = makeRes();
      errorHandler(err, makeReq(), res, makeNext());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("campo") }),
      );
    });

    it("returns 400 for other multer errors", () => {
      const err = new multer.MulterError("LIMIT_PART_COUNT");
      const res = makeRes();
      errorHandler(err, makeReq(), res, makeNext());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: err.message }),
      );
    });
  });

  // ── Generic Error ────────────────────────────────────────────────────────

  describe("generic Error handling", () => {
    it("returns 500 with error message in non-production", () => {
      process.env.NODE_ENV = "development";
      const err = new Error("something broke");
      const res = makeRes();
      errorHandler(err, makeReq(), res, makeNext());
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "something broke",
          stack: expect.any(String),
        }),
      );
    });

    it("hides error message and stack in production", () => {
      process.env.NODE_ENV = "production";
      const err = new Error("secret internal error");
      const res = makeRes();
      errorHandler(err, makeReq(), res, makeNext());
      expect(res.status).toHaveBeenCalledWith(500);
      const body = (res.json as any).mock.calls[0][0];
      expect(body.error).toBe("Internal server error");
      expect(body).not.toHaveProperty("stack");
    });

    it("uses 'unknown' when req.id is missing", () => {
      const err = new Error("oops");
      const res = makeRes();
      errorHandler(err, makeReq({ id: undefined } as any), res, makeNext());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "unknown" }),
      );
    });
  });
});
