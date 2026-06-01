/**
 * Validation & sanitization helpers for API routes
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type LookupAddress = { address: string; family: number };

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

/**
 * Check if a numeric IP is in a private/reserved range we never want a
 * server-side request to reach: loopback, link-local (incl. cloud metadata),
 * private RFC1918, unique-local IPv6, and IPv4 broadcast. Cloud metadata is
 * 169.254.169.254 (AWS/GCP/Azure) which we refuse explicitly.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 dotted or numeric form
  if (isIP(ip) === 4) {
    const parts = ip.split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 0) return true;            // 0.0.0.0/8 — "this network"
    if (a === 10) return true;           // 10.0.0.0/8
    if (a === 127) return true;          // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;          // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;           // 224.0.0.0/4 multicast + 240/4 reserved + 255 broadcast
    return false;
  }
  // IPv6
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
    if (lower.startsWith("ff")) return true; // multicast
    return false;
  }
  return true;
}

/** Heuristic string check on a hostname; useful when DNS is unavailable. */
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "metadata.google.internal") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (h === "169.254.169.254") return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (/^fc00:/i.test(h) || /^fe80:/i.test(h)) return true;
  // IPv4 in decimal/octal/hex form attackers use to bypass string filters.
  if (/^0x[0-9a-f]+$/i.test(h)) return true;
  if (/^0[0-7]+\./.test(h)) return true;
  const numeric = Number(h);
  if (Number.isFinite(numeric) && h.replace(/\./g, "") === String(numeric).replace(/\./g, "")) {
    // Bare integer like `2130706433` (= 127.0.0.1)
    return true;
  }
  return false;
}

/**
 * Like validateHttpUrl but also blocks private/reserved IPs by string match
 * AND by DNS resolution (so DNS rebinding cannot smuggle a public hostname that
 * resolves to a private IP at request time).
 */
export async function validateSafeUrl(url: unknown): Promise<string | null> {
  const valid = validateHttpUrl(url);
  if (!valid) return null;
  let parsed: URL;
  try {
    parsed = new URL(valid);
  } catch {
    return null;
  }
  const { hostname } = parsed;
  if (isPrivateHostname(hostname)) return null;
  if (isIP(hostname) && isPrivateOrReservedIp(hostname)) return null;

  // Resolve DNS — reject if ANY returned address is private/reserved.
  try {
    const records = await lookup(hostname, { all: true });
    for (const r of records) {
      if (isPrivateOrReservedIp(r.address)) return null;
    }
  } catch {
    // DNS failure: refuse rather than risk hitting an attacker-controlled resolver.
    return null;
  }
  return valid;
}

/** Synchronous variant for places that cannot await (e.g. UI helpers). */
export function validateSafeUrlSync(url: unknown): string | null {
  const valid = validateHttpUrl(url);
  if (!valid) return null;
  let parsed: URL;
  try {
    parsed = new URL(valid);
  } catch {
    return null;
  }
  const { hostname } = parsed;
  if (isPrivateHostname(hostname)) return null;
  if (isIP(hostname) && isPrivateOrReservedIp(hostname)) return null;
  return valid;
}
