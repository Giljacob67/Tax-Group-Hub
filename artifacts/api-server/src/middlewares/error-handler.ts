import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Standardized global error handler for the API.
 * Returns formatted JSON for internal errors and Zod validation errors.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = (req as any).id || "unknown";

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: (err as ZodError).format(),
      requestId,
    });
    return;
  }

  // Log critical error
  console.error(`[Error] (${requestId}) ${err.name}: ${err.message}`, err.stack);

  const isProduction = process.env.NODE_ENV === "production";

  res.status(500).json({
    error: isProduction ? "Internal server error" : err.message,
    requestId,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
