import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 0.6,
        functions: 0.6,
        branches: 0.5,
        statements: 0.6,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src"),
      "better-auth/next-js": path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "src/tests/mocks/betterAuthNextIntegration.ts",
      ),
    },
  },
});
