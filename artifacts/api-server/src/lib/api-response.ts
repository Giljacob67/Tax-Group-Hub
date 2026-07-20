import type { Response } from "express";
import logger from "./logger.js";

/**
 * Standardized JSON error response.
 * Use instead of inline res.status(x).json({ error: "..." }) to keep
 * the error shape consistent across all routes.
 */
export function apiError(res: Response, status: number, message: string): void {
  // Send both keys: `error` is the historical shape some callers still read;
  // `message` is what the auth pages (login, 2FA, forgot/reset-password) read.
  // Without both, frontend error handling silently falls back to a generic
  // string and the real reason (invalid credentials, misconfig, etc) is lost.
  res.status(status).json({ error: message, message });
}

/**
 * Error helper that ALWAYS logs the underlying cause before returning a
 * user-facing message. Use this in any `catch` block that wraps a DB
 * query or external call so a 500 response never silently swallows the
 * real failure (cf. dashboards/contacts/deals).
 *
 * @param res        Express response
 * @param err        The original error (may be a DrizzleQueryError, etc)
 * @param status     HTTP status code (default 500)
 * @param genericMessage  Public-facing message; the original `err.message` is logged, not sent
 * @param context    Optional structured log fields (route name, userId, etc)
 */
export function logAndApiError(
  res: Response,
  err: unknown,
  status = 500,
  genericMessage = "Internal server error",
  context: Record<string, any> = {},
): void {
  const e: any = err;
  logger.error(
    {
      ...context,
      errMessage: e?.message,
      errCode: e?.code,
      errCause: e?.cause?.message,
      errStack: e?.stack?.split("\n").slice(0, 4).join(" | "),
    },
    `[${status}] ${genericMessage}`,
  );
  apiError(res, status, genericMessage);
}
