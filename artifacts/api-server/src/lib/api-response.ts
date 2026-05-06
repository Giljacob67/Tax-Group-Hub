import type { Response } from "express";

/**
 * Standardized JSON error response.
 * Use instead of inline res.status(x).json({ error: "..." }) to keep
 * the error shape consistent across all routes.
 */
export function apiError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}
