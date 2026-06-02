#!/usr/bin/env node
/**
 * scripts/spec-gen.mjs
 *
 * Generate lib/api-spec/openapi.yaml from the actual Express routes defined in
 * artifacts/api-server/src/routes/*.ts. Regex scrape of the source; emits a
 * minimal but complete OpenAPI 3.1 document. Re-run with `pnpm spec:gen`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const routesDir = join(repoRoot, "artifacts", "api-server", "src", "routes");
const outFile = join(repoRoot, "lib", "api-spec", "openapi.yaml");

function expressToOpenApi(p) {
  return p.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
}

function methodSummary(method, path) {
  const m = method.toLowerCase();
  const seg = path.replace(/[{}]/g, "").replace(/^\/+/, "").split("/")[0] || "root";
  const verb = {
    get: "Get", post: "Create", put: "Replace", patch: "Update",
    delete: "Delete", head: "Head", options: "Options",
  }[m] || m.toUpperCase();
  return `${verb} ${seg}`;
}

function tagFor(file) {
  return file.replace(/\.ts$/, "");
}

function readPreviousTags() {
  try {
    const raw = readFileSync(outFile, "utf8");
    const parsed = yaml.parse(raw);
    return parsed?.tags || [];
  } catch { return []; }
}

const routeRegex = /router\.(get|post|put|delete|patch|head|options)\(\s*(['"`])([^'"`]+)\2/g;
const paths = {};
const tags = new Set();
let skipped = 0;

for (const file of readdirSync(routesDir)) {
  if (!file.endsWith(".ts") || file === "index.ts") continue;
  const full = join(routesDir, file);
  if (!statSync(full).isFile()) continue;
  const src = readFileSync(full, "utf8");
  for (const m of src.matchAll(routeRegex)) {
    const method = m[1].toLowerCase();
    const path = m[3];
    if (path.includes("(") || path.includes(")")) { skipped++; continue; }
    const openapiPath = expressToOpenApi(path);
    const params = [...openapiPath.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    if (!paths[openapiPath]) paths[openapiPath] = {};
    paths[openapiPath][method] = {
      summary: methodSummary(method, openapiPath),
      description: `${method.toUpperCase()} ${tagFor(file, openapiPath)} resource.`,
      tags: [tagFor(file)],
      operationId: `${tagFor(file)}_${method}_${openapiPath.replace(/[{}]/g, "").replace(/\W+/g, "_")}`,
      parameters: params,
      responses: {
        "200": { description: "OK" },
        "400": { description: "Bad request" },
        "401": { description: "Unauthorized" },
        "404": { description: "Not found" },
        "500": { description: "Internal server error" },
      },
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    };
    tags.add(tagFor(file));
  }
}

const preservedTags = readPreviousTags().filter((t) => typeof t.name === "string");
const mergedTags = [...preservedTags];
for (const t of tags) {
  if (!mergedTags.find((m) => m.name === t)) mergedTags.push({ name: t });
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Api",
    version: "0.3.0",
    description: "Tax Group AI Hub API — auto-generated from Express routes via scripts/spec-gen.mjs.",
  },
  servers: [{ url: "/api", description: "Base API path" }],
  tags: mergedTags,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      apiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      webhookSecret: { type: "apiKey", in: "header", name: "x-webhook-secret" },
      cronSecret: { type: "apiKey", in: "header", name: "x-cron-secret" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
          requestId: { type: "string" },
        },
        required: ["error"],
      },
    },
  },
  paths,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, yaml.stringify(spec, { lineWidth: 120 }), "utf8");
const total = Object.values(paths).reduce((acc, ops) => acc + Object.keys(ops).length, 0);
console.log(`[spec-gen] wrote ${total} operations across ${Object.keys(paths).length} paths to ${relative(repoRoot, outFile)}`);
if (skipped > 0) console.warn(`[spec-gen] ${skipped} routes were skipped (likely dynamic paths)`);
