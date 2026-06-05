import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import multer from "multer";
import logger from "../lib/logger.js";

/**
 * Standardized global error handler for the API.
 * Returns formatted JSON for internal errors and Zod validation errors.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = (req as any).id || "unknown";

  if (err instanceof ZodError) {
    logger.warn({ requestId, details: err.format() }, "Zod validation failed");
    res.status(400).json({
      error: "Validation failed",
      details: (err as ZodError).format(),
      requestId,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res
        .status(413)
        .json({ error: "Arquivo excede o limite de 50MB.", requestId });
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        error: "Campo de arquivo inesperado. Use o campo 'file'.",
        requestId,
      });
    } else {
      res.status(400).json({ error: err.message, requestId });
    }
    return;
  }

  // Log critical error
  logger.error(
    {
      err,
      requestId,
      url: req.url,
      method: req.method,
    },
    "unhandled_exception",
  );

  const isProduction = process.env.NODE_ENV === "production";

  res.status(500).json({
    error: isProduction ? "Internal server error" : err.message,
    requestId,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
