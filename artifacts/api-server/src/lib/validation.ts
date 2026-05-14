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

/** Check if a hostname resolves to a private/internal IP range (SSRF guard) */
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "metadata.google.internal") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (h === "169.254.169.254") return true; // AWS/GCP metadata
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (/^fc00:/i.test(h) || /^fe80:/i.test(h)) return true;
  return false;
}

/** Like validateHttpUrl but also blocks private/internal IPs (use for SSRF-sensitive inputs) */
export function validateSafeUrl(url: unknown): string | null {
  const valid = validateHttpUrl(url);
  if (!valid) return null;
  try {
    const { hostname } = new URL(valid);
    if (isPrivateHostname(hostname)) return null;
    return valid;
  } catch {
    return null;
  }
}
