/**
 * Validation & sanitization helpers for API routes
 */

/** Pick only allowed fields from an object */
export function pick<T extends Record<string, any>>(
  obj: T,
  keys: readonly (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/** Validate a numeric route parameter; returns null if invalid */
export function validateIdParam(param: string | undefined): number | null {
  if (!param) return null;
  const num = Number(param);
  if (Number.isNaN(num)) return null;
  return num;
}

/** Validate value against a whitelist; returns null if invalid */
export function validateWhitelist<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof value !== "string") return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

/** Safe number conversion with bounds check */
export function safeNumber(
  value: unknown,
  opts?: { min?: number; max?: number }
): number | null {
  if (typeof value === "string") {
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    if (opts?.min !== undefined && num < opts.min) return null;
    if (opts?.max !== undefined && num > opts.max) return null;
    return num;
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) return null;
    if (opts?.min !== undefined && value < opts.min) return null;
    if (opts?.max !== undefined && value > opts.max) return null;
    return value;
  }
  return null;
}

/** Validate URL scheme (reject javascript:, file:, etc) */
export function validateHttpUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}
