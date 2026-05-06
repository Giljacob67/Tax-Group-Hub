import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Each test file gets a clean module registry — prevents env pollution between suites
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
    },
  },
  resolve: {
    // Map workspace packages to their source so vitest doesn't need a built dist
    alias: {
      "@workspace/db": new URL("../../lib/db/src/index.ts", import.meta.url).pathname,
    },
  },
});
