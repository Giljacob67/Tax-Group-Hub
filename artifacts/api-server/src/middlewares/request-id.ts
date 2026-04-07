import { type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Middleware to generate a unique Request-ID for tracing.
 * Assigns to 'req.id' and headers.
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers["x-request-id"] as string) || uuidv4();
  (req as any).id = id;
  res.setHeader("X-Request-ID", id);
  next();
};
