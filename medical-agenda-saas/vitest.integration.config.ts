/**
 * Vitest Configuration for Integration Tests
 *
 * Usa infraestructura LOCAL (PostgreSQL y Redis).
 * MODO ESTRICTO: Tests abortan si la infraestructura no está disponible.
 *
 * Requiere:
 * - PostgreSQL corriendo en localhost:5432
 * - Redis corriendo en localhost:6379
 *
 * Opcional (solo desarrollo):
 * - ENABLE_LOCAL_INFRA_BOOTSTRAP=true para auto-iniciar servicios
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],

    // Global setup/teardown para verificar infraestructura
    globalSetup: ["tests/integration/global-setup.ts"],

    // Timeouts controlados para evitar tests colgados
    testTimeout: 30000, // 30s por test
    hookTimeout: 15000, // 15s para setup/teardown

    // Ejecutar tests secuencialmente para evitar race conditions
    fileParallelism: false,

    // No usar cache para asegurar ejecución limpia
    cache: false,

    // Reportar tests lentos
    slowTestThreshold: 5000,

    // Fail fast en modo CI
    bail: process.env.CI ? 1 : 0,

    // Environment
    env: {
      NODE_ENV: "test",
      // Modo estricto: abortar si infra falla
      INFRA_STRICT_MODE: "true",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
