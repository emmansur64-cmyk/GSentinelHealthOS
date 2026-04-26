import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    // Timeouts controlados
    testTimeout: 30000, // 30s por test
    hookTimeout: 10000, // 10s para setup/teardown
    // No permitir tests que cuelguen
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    // Reportar tests lentos
    slowTestThreshold: 5000,
    // Fail fast en modo CI
    bail: process.env.CI ? 1 : 0,
    // Configuración por entorno
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/integration/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
