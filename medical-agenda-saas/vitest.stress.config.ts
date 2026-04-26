/**
 * Vitest Configuration for Stress Tests
 *
 * Configuración específica para tests de carga con timeouts extendidos.
 *
 * Requiere:
 * - Servidor corriendo en WEBHOOK_URL
 * - PostgreSQL y Redis disponibles
 *
 * Variables de entorno:
 * - RUN_STRESS_INTEGRATION=true para tests de integración
 * - RUN_CRITICAL_CONCURRENCY=true para test de concurrencia
 * - RUN_FULL_STRESS=true para test completo
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/stress/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],

    // Timeouts extendidos para stress tests
    testTimeout: 600000, // 10 minutos por test
    hookTimeout: 60000, // 1 minuto para setup/teardown

    // Ejecutar tests secuencialmente
    fileParallelism: false,

    // No usar cache
    cache: false,

    // Reportar tests lentos (umbral alto para stress)
    slowTestThreshold: 60000,

    // No fail fast en stress tests
    bail: 0,

    // Pool settings para tests de larga duración
    pool: "forks",
    maxWorkers: 1,

    // Environment
    env: {
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
