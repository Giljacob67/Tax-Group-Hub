import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "authorization",
      "headers.authorization",
      "req.headers.authorization",
      "x-api-key",
      "headers.x-api-key",
      "req.headers.x-api-key",
      "*.apiKey",
      "*.key",
      "*.token",
      "*.secret",
      "*.password",
    ],
    censor: "[redacted]",
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
    service: "tax-group-hub-api",
  },
});

export default logger;
