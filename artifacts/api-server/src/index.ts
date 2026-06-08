import app from "./app.js";
import logger from "./lib/logger.js";

function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";
  const isVercel = !!process.env.VERCEL;

  if (!process.env.JWT_SECRET && !process.env.API_KEY) {
    if (isProduction || isVercel) {
      throw new Error(
        "FATAL: Neither JWT_SECRET nor API_KEY is set. Server cannot start without authentication credentials in production.",
      );
    }
    logger.warn(
      "Neither JWT_SECRET nor API_KEY is set — all requests will fall through to demo-user mode",
    );
  }
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn(
      "ENCRYPTION_KEY not set — BYOK API keys will be stored unencrypted",
    );
  }
  if (!process.env.APP_URL && isProduction) {
    logger.warn(
      "APP_URL not set in production — CORS may reject frontend requests",
    );
  }
}

validateEnv();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, `Server listening on port ${port}`);
});
