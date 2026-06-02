import { describe, it, expect } from "vitest";
import {
  pick,
  validateIdParam,
  validateWhitelist,
  safeNumber,
  validateHttpUrl,
} from "../lib/validation.js";

// ── pick() ───────────────────────────────────────────────────────────────────

describe("pick", () => {
  it("picks specified keys from an object", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("ignores keys not present in the object", () => {
    const obj = { a: 1 };
    expect(pick(obj, ["a", "missing" as any])).toEqual({ a: 1 });
  });

  it("excludes keys with undefined values", () => {
    const obj = { a: 1, b: undefined };
    expect(pick(obj, ["a", "b"])).toEqual({ a: 1 });
  });

  it("returns empty object for empty keys array", () => {
    expect(pick({ a: 1 }, [])).toEqual({});
  });

  it("returns empty object for empty input object", () => {
    expect(pick({}, ["a"])).toEqual({});
  });

  it("picks non-string keys from a record", () => {
    const obj = { 1: "one", 2: "two" };
    expect(pick(obj, [1, 2])).toEqual({ 1: "one", 2: "two" });
  });
});

// ── validateIdParam() ────────────────────────────────────────────────────────

describe("validateIdParam", () => {
  it("returns the number for a valid numeric string", () => {
    expect(validateIdParam("42")).toBe(42);
  });

  it("returns 0 for '0'", () => {
    expect(validateIdParam("0")).toBe(0);
  });

  it("returns negative numbers", () => {
    expect(validateIdParam("-5")).toBe(-5);
  });

  it("returns float values", () => {
    expect(validateIdParam("3.14")).toBeCloseTo(3.14);
  });

  it("returns null for undefined", () => {
    expect(validateIdParam(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(validateIdParam("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(validateIdParam("abc")).toBeNull();
  });

  it("returns NaN-representing strings as null", () => {
    expect(validateIdParam("not-a-number")).toBeNull();
  });
});

// ── validateWhitelist() ──────────────────────────────────────────────────────

describe("validateWhitelist", () => {
  const allowed = ["openai", "anthropic", "google"] as const;

  it("returns the value when it is in the whitelist", () => {
    expect(validateWhitelist("openai", allowed)).toBe("openai");
  });

  it("returns null when value is not in the whitelist", () => {
    expect(validateWhitelist("unknown", allowed)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(validateWhitelist(42, allowed)).toBeNull();
    expect(validateWhitelist(null, allowed)).toBeNull();
    expect(validateWhitelist(undefined, allowed)).toBeNull();
    expect(validateWhitelist(true, allowed)).toBeNull();
  });

  it("is case-sensitive", () => {
    expect(validateWhitelist("OpenAI", allowed)).toBeNull();
    expect(validateWhitelist("OPENAI", allowed)).toBeNull();
  });

  it("works with empty whitelist", () => {
    expect(validateWhitelist("a", [])).toBeNull();
  });
});

// ── safeNumber() ─────────────────────────────────────────────────────────────

describe("safeNumber", () => {
  it("converts a numeric string to number", () => {
    expect(safeNumber("42")).toBe(42);
  });

  it("returns the number directly if already a number", () => {
    expect(safeNumber(7)).toBe(7);
  });

  it("returns null for NaN string", () => {
    expect(safeNumber("abc")).toBeNull();
  });

  it("returns null for NaN number", () => {
    expect(safeNumber(NaN)).toBeNull();
  });

  it("returns null for non-string/non-number types", () => {
    expect(safeNumber(null)).toBeNull();
    expect(safeNumber(undefined)).toBeNull();
    expect(safeNumber(true)).toBeNull();
    expect(safeNumber({})).toBeNull();
  });

  it("respects min bound", () => {
    expect(safeNumber("5", { min: 10 })).toBeNull();
    expect(safeNumber("10", { min: 10 })).toBe(10);
    expect(safeNumber("15", { min: 10 })).toBe(15);
  });

  it("respects max bound", () => {
    expect(safeNumber("15", { max: 10 })).toBeNull();
    expect(safeNumber("10", { max: 10 })).toBe(10);
    expect(safeNumber("5", { max: 10 })).toBe(5);
  });

  it("respects both min and max", () => {
    expect(safeNumber("0", { min: 1, max: 10 })).toBeNull();
    expect(safeNumber("1", { min: 1, max: 10 })).toBe(1);
    expect(safeNumber("5", { min: 1, max: 10 })).toBe(5);
    expect(safeNumber("10", { min: 1, max: 10 })).toBe(10);
    expect(safeNumber("11", { min: 1, max: 10 })).toBeNull();
  });

  it("handles negative numbers with bounds", () => {
    expect(safeNumber("-3", { min: -5, max: 5 })).toBe(-3);
    expect(safeNumber("-6", { min: -5, max: 5 })).toBeNull();
  });

  it("converts float strings", () => {
    expect(safeNumber("3.14")).toBeCloseTo(3.14);
  });
});

// ── validateHttpUrl() ────────────────────────────────────────────────────────

describe("validateHttpUrl", () => {
  it("accepts http URLs", () => {
    expect(validateHttpUrl("http://example.com")).toBe("http://example.com");
  });

  it("accepts https URLs", () => {
    expect(validateHttpUrl("https://example.com")).toBe("https://example.com");
  });

  it("accepts URLs with paths and query strings", () => {
    const url = "https://api.example.com/v1?key=val";
    expect(validateHttpUrl(url)).toBe(url);
  });

  it("rejects javascript: protocol", () => {
    expect(validateHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: protocol", () => {
    expect(validateHttpUrl("data:text/html,<h1>hi</h1>")).toBeNull();
  });

  it("rejects file: protocol", () => {
    expect(validateHttpUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects ftp: protocol", () => {
    expect(validateHttpUrl("ftp://example.com")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateHttpUrl("")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(validateHttpUrl(null)).toBeNull();
    expect(validateHttpUrl(undefined)).toBeNull();
    expect(validateHttpUrl(42)).toBeNull();
  });

  it("rejects plain text without protocol", () => {
    expect(validateHttpUrl("example.com")).toBeNull();
  });

  it("rejects URLs with no hostname", () => {
    expect(validateHttpUrl("https://")).toBeNull();
  });
});
