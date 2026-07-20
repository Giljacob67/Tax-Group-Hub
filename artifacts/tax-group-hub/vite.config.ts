/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 3011;
const basePath = process.env.BASE_PATH || "/";
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@workspace/api-client-react": path.resolve(
        workspaceRoot,
        "lib",
        "api-client-react",
        "src",
        "index.ts",
      ),
      "@workspace/api-client-react/custom-fetch": path.resolve(
        workspaceRoot,
        "lib",
        "api-client-react",
        "src",
        "custom-fetch.ts",
      ),
      "@workspace/db/crm-constants": path.resolve(
        workspaceRoot,
        "lib",
        "db",
        "src",
        "crm-constants.ts",
      ),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": [
            "lucide-react",
            "clsx",
            "tailwind-merge",
            "class-variance-authority",
          ],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      allow: [workspaceRoot],
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
