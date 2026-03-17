import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times without risking some
// packages that are not bundle compatible
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cookie-parser",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "mammoth",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pdf-parse",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("building server...");
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter(
    (dep) =>
      !allowlist.includes(dep) &&
      !(pkg.dependencies?.[dep]?.startsWith("workspace:")),
  );

  const sharedOptions = {
    platform: "node" as const,
    bundle: true,
    format: "cjs" as const,
    define: {
      "process.env.NODE_ENV": '"production"',
      // In CJS output, import.meta.url is empty — define it via __filename
      "import.meta.url": "__importMetaUrl__",
    },
    banner: {
      // Polyfill import.meta.url for CJS bundles (needed by createRequire in knowledge.ts)
      js: 'var __importMetaUrl__ = require("url").pathToFileURL(__filename).href;',
    },
    minify: true,
    external: externals,
    logLevel: "info" as const,
  };

  // Standalone server (self-hosted / Railway)
  await esbuild({
    ...sharedOptions,
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    outfile: path.resolve(distDir, "index.cjs"),
  });

  // Vercel Serverless Function entry (exports Express app, no app.listen)
  await esbuild({
    ...sharedOptions,
    entryPoints: [path.resolve(__dirname, "src/vercel.ts")],
    outfile: path.resolve(distDir, "vercel.cjs"),
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
