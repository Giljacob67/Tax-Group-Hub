#!/usr/bin/env node
/**
 * scripts/spec-check.mjs
 *
 * Verify that every Express route in artifacts/api-server/src/routes/*.ts has
 * a corresponding entry in lib/api-spec/openapi.yaml. Exits non-zero if any
 * route is missing. Extras (documented but not in routes) are logged but not
 * fatal — renames in routes should not block CI. Run via `pnpm spec:check`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const routesDir = join(repoRoot, "artifacts", "api-server", "src", "routes");
const specPath = join(repoRoot, "lib", "api-spec", "openapi.yaml");

const routeRegex =
  /router\.(get|post|put|delete|patch|head|options)\(\s*(['"`])([^'"`]+)\2/g;
const mountRegex =
  /router\.use\(\s*(['"`])(\/[^'"`]*)?\1\s*,\s*(\w+Router)\s*\)/g;
const expressToOpenApi = (p) => p.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");

// Discover mount prefixes from routes/index.ts so the check matches
// the path the API actually serves (e.g. /crm/contacts, not /contacts).
const indexSrc = readFileSync(join(routesDir, "index.ts"), "utf8");
const mountPrefixes = {};
for (const m of indexSrc.matchAll(mountRegex)) {
  const prefix = m[2] || "";
  const routerVar = m[3];
  // routerVar is like "crmRouter" → file "crm.ts"
  const file = routerVar.replace(/Router$/, "") + ".ts";
  mountPrefixes[file] = prefix;
}

const declared = new Set();
for (const file of readdirSync(routesDir)) {
  if (!file.endsWith(".ts") || file === "index.ts") continue;
  const full = join(routesDir, file);
  if (!statSync(full).isFile()) continue;
  const src = readFileSync(full, "utf8");
  const prefix = mountPrefixes[file] || "";
  for (const m of src.matchAll(routeRegex)) {
    if (m[3].includes("(") || m[3].includes(")")) continue;
    const fullPath = prefix + expressToOpenApi(m[3]);
    declared.add(`${m[1].toLowerCase()} ${fullPath}`);
  }
}

const spec = yaml.parse(readFileSync(specPath, "utf8"));
const documented = new Set();
for (const [path, ops] of Object.entries(spec?.paths || {})) {
  for (const method of Object.keys(ops)) {
    if (["parameters", "$ref"].includes(method)) continue;
    documented.add(`${method} ${path}`);
  }
}

const missing = [...declared].filter((d) => !documented.has(d));
const extras = [...documented].filter((d) => !declared.has(d));

if (extras.length) {
  console.warn(
    `[spec-check] note — ${extras.length} documented-but-not-declared (extras):`,
  );
  for (const e of extras.slice(0, 20)) console.warn(`    - ${e}`);
  if (extras.length > 20)
    console.warn(`    ... and ${extras.length - 20} more`);
}

if (missing.length) {
  console.error(
    `[spec-check] FAIL — ${missing.length} routes missing from openapi.yaml:`,
  );
  for (const m of missing.slice(0, 50)) console.error(`    + ${m}`);
  if (missing.length > 50)
    console.error(`    ... and ${missing.length - 50} more`);
  process.exit(1);
}
console.log(
  `[spec-check] OK — ${declared.size} routes covered (missing=0, extras=${extras.length})`,
);
process.exit(0);
