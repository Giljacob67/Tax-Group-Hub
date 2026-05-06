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
  const id = (req.headers["x-request-id"] as string) || uuidv4();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
};
