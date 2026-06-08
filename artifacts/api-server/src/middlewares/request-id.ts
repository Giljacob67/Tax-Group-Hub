import { type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

// Extend Express Request so req.id is typed across the codebase
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const raw = req.headers["x-request-id"];
  const id = typeof raw === "string" && /^[\w\-.]{1,64}$/.test(raw)
    ? raw
    : uuidv4();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
};
