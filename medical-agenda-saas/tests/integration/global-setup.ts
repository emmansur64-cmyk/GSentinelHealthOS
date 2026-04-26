/**
 * Global Setup for Integration Tests
 *
 * Valida infraestructura LOCAL (PostgreSQL y Redis) usando el módulo @/lib/infra.
 *
 * MODO ESTRICTO:
 * - Si PostgreSQL o Redis no están disponibles → ABORTA todos los tests
 * - No se permiten skips ni degradación silenciosa
 * - Proporciona diagnóstico detallado en caso de falla
 *
 * REQUISITOS:
 * - PostgreSQL corriendo en localhost:5432
 * - Redis corriendo en localhost:6379
 * - DATABASE_URL configurado correctamente
 *
 * OPCIONAL (solo desarrollo):
 * - ENABLE_LOCAL_INFRA_BOOTSTRAP=true para auto-iniciar servicios
 */
import { execSync } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import {
  requireInfrastructure,
  bootstrapLocalInfra,
  isBootstrapEnabled,
  generateDiagnosticReport,
  infraLog,
  logDbConnection,
  measureAsync,
  TIMEOUTS,
} from "../../src/lib/infra";

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/test_db";
const DEFAULT_REDIS_URL = "redis://localhost:6379";

// ─── Global Setup ────────────────────────────────────────────────────────────

export async function setup(): Promise<void> {
  const startTime = performance.now();

  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("           INTEGRATION TEST ENVIRONMENT SETUP                   ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  // ── 1. Set Environment Variables ────────────────────────────────────────────
  process.env.DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  process.env.REDIS_URL = process.env.REDIS_URL || DEFAULT_REDIS_URL;
  (process.env as Record<string, string>).NODE_ENV = "test";

  // Generate unique TEST_RUN_ID for isolation
  if (!process.env.TEST_RUN_ID) {
    process.env.TEST_RUN_ID = uuidv4();
    console.log(`[SETUP] Generated TEST_RUN_ID: ${process.env.TEST_RUN_ID}`);
  } else {
    console.log(`[SETUP] Using TEST_RUN_ID: ${process.env.TEST_RUN_ID}`);
  }
  console.log("");

  // ── 2. Optional Bootstrap (Dev Only) ────────────────────────────────────────
  if (isBootstrapEnabled()) {
    console.log("[BOOTSTRAP] Local infrastructure bootstrap enabled");
    try {
      const results = await bootstrapLocalInfra();
      for (const result of results) {
        const status = result.started
          ? `STARTED (PID: ${result.pid})`
          : result.error
            ? `FAILED: ${result.error}`
            : "ALREADY RUNNING";
        console.log(`  ${result.service}: ${status}`);
      }
    } catch (error) {
      console.warn("[BOOTSTRAP] Failed:", error);
    }
    console.log("");
  }

  // ── 3. Validate Infrastructure (STRICT MODE) ────────────────────────────────
  console.log("[VALIDATION] Checking infrastructure availability...");

  try {
    const config = await requireInfrastructure();
    console.log("[VALIDATION] Infrastructure check PASSED");
    console.log(`  Database: ${maskConnectionString(config.DATABASE_URL)}`);
    console.log(`  Redis: ${config.REDIS_URL}`);
    console.log("");
  } catch (error) {
    // STRICT MODE: Print diagnostic and abort
    console.error("");
    console.error("╔═══════════════════════════════════════════════════════════════╗");
    console.error("║         INFRASTRUCTURE VALIDATION FAILED                       ║");
    console.error("║         ABORTING ALL TESTS (STRICT MODE)                       ║");
    console.error("╚═══════════════════════════════════════════════════════════════╝");
    console.error("");

    try {
      const report = await generateDiagnosticReport();
      console.error(report);
    } catch {
      console.error(error instanceof Error ? error.message : String(error));
    }

    console.error("");
    console.error("To run tests, ensure:");
    console.error("  1. PostgreSQL is running on localhost:5432");
    console.error("  2. Redis is running on localhost:6379");
    console.error("  3. DATABASE_URL environment variable is set correctly");
    console.error("");
    console.error("For auto-bootstrap in development:");
    console.error("  Set ENABLE_LOCAL_INFRA_BOOTSTRAP=true");
    console.error("");

    process.exit(1);
  }

  // ── 4. Run Prisma Migrations ────────────────────────────────────────────────
  console.log("[MIGRATION] Running Prisma migrations...");

  try {
    const { durationMs } = await measureAsync(async () => {
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        env: { ...process.env },
        stdio: "pipe",
      });
    });
    logDbConnection("connected", durationMs);
    console.log(`[MIGRATION] Database schema ready (${durationMs}ms)`);
  } catch (error) {
    console.error("[MIGRATION] Failed:", (error as Error).message);
    console.error("");
    console.error("Ensure the database user has CREATE/ALTER permissions.");
    process.exit(1);
  }

  // ── 5. Log Completion ───────────────────────────────────────────────────────
  const totalDurationMs = Math.round(performance.now() - startTime);
  console.log("");
  console.log(`[SETUP] Environment ready (${totalDurationMs}ms)`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n");
}

// ─── Global Teardown ─────────────────────────────────────────────────────────

export async function teardown(): Promise<void> {
  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("           INTEGRATION TEST ENVIRONMENT TEARDOWN                ");
  console.log("═══════════════════════════════════════════════════════════════");

  // Cleanup is handled by each test file using namespace isolation.
  // Redis keys with prefix test:{TEST_RUN_ID}:* are cleaned per-test.
  // No global cleanup needed.

  console.log("[TEARDOWN] Complete (local infrastructure persists)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskConnectionString(url: string | undefined): string {
  if (!url) return "undefined";
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:[^:@]+@/, ":****@");
  }
}

export default setup;
