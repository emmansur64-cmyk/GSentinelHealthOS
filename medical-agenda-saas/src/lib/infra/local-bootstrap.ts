/**
 * Local Infrastructure Bootstrap (Development Only)
 *
 * Intenta levantar servicios locales automáticamente en entorno de desarrollo.
 * PROHIBIDO en producción.
 *
 * Habilitado con: ENABLE_LOCAL_INFRA_BOOTSTRAP=true
 */
import { spawn, ChildProcess } from "child_process";
import { infraLog } from "./infra-logger";
import { isRedisPortOpen } from "./redis-health";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BootstrapResult {
  service: string;
  started: boolean;
  pid?: number;
  error?: string;
}

export interface LocalInfraConfig {
  redisHost?: string;
  redisPort?: number;
  startupTimeoutMs?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_STARTUP_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 200;

// Track spawned processes for cleanup
const spawnedProcesses: ChildProcess[] = [];

// ─── Guards ──────────────────────────────────────────────────────────────────

/**
 * Verifica si el bootstrap está habilitado
 */
export function isBootstrapEnabled(): boolean {
  return (
    process.env.ENABLE_LOCAL_INFRA_BOOTSTRAP === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

/**
 * Verifica que NO estamos en producción
 */
function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[INFRA] Local bootstrap is FORBIDDEN in production. " +
        "Use proper infrastructure management.",
    );
  }
}

// ─── Redis Bootstrap ─────────────────────────────────────────────────────────

/**
 * Detecta el comando de Redis según el OS
 */
function getRedisCommand(): { command: string; args: string[] } {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: buscar redis-server en PATH
    return { command: "redis-server", args: [] };
  }

  // Unix: usar redis-server directamente
  return { command: "redis-server", args: [] };
}

/**
 * Intenta iniciar Redis localmente si no está corriendo.
 *
 * Solo funciona en desarrollo (ENABLE_LOCAL_INFRA_BOOTSTRAP=true).
 */
export async function bootstrapRedis(
  config: LocalInfraConfig = {},
): Promise<BootstrapResult> {
  assertNotProduction();

  const host = config.redisHost || "localhost";
  const port = config.redisPort || 6379;
  const timeoutMs = config.startupTimeoutMs || DEFAULT_STARTUP_TIMEOUT_MS;

  infraLog("info", `Attempting to bootstrap Redis on ${host}:${port}`);

  // Verificar si ya está corriendo
  if (await isRedisPortOpen(host, port)) {
    infraLog("info", "Redis already running, skipping bootstrap");
    return { service: "redis", started: false };
  }

  // Intentar iniciar
  const { command, args } = getRedisCommand();

  try {
    const process = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    process.unref();
    spawnedProcesses.push(process);

    // Esperar a que esté disponible
    const ready = await waitForPort(host, port, timeoutMs);

    if (ready) {
      infraLog("info", `Redis started successfully (PID: ${process.pid})`);
      return {
        service: "redis",
        started: true,
        pid: process.pid,
      };
    }

    return {
      service: "redis",
      started: false,
      error: `Redis did not become available within ${timeoutMs}ms`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    infraLog("error", `Failed to start Redis: ${errorMsg}`);

    return {
      service: "redis",
      started: false,
      error: errorMsg,
    };
  }
}

// ─── Port Polling ────────────────────────────────────────────────────────────

/**
 * Espera hasta que un puerto esté disponible
 */
async function waitForPort(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isRedisPortOpen(host, port)) {
      return true;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Limpia procesos spawneados (llamar en cleanup de tests)
 */
export function cleanupBootstrappedProcesses(): void {
  for (const proc of spawnedProcesses) {
    try {
      if (proc.pid && !proc.killed) {
        proc.kill("SIGTERM");
      }
    } catch {
      // Ignorar errores de cleanup
    }
  }
  spawnedProcesses.length = 0;
}

// ─── Combined Bootstrap ──────────────────────────────────────────────────────

/**
 * Bootstrap completo de infraestructura local para desarrollo.
 *
 * Solo se ejecuta si ENABLE_LOCAL_INFRA_BOOTSTRAP=true y NODE_ENV !== 'production'
 */
export async function bootstrapLocalInfra(
  config: LocalInfraConfig = {},
): Promise<BootstrapResult[]> {
  if (!isBootstrapEnabled()) {
    infraLog("debug", "Local infra bootstrap disabled");
    return [];
  }

  assertNotProduction();

  infraLog("info", "Starting local infrastructure bootstrap...");

  const results: BootstrapResult[] = [];

  // Bootstrap Redis
  const redisResult = await bootstrapRedis(config);
  results.push(redisResult);

  // Resumen
  const started = results.filter((r) => r.started);
  const failed = results.filter((r) => r.error);

  if (started.length > 0) {
    infraLog(
      "info",
      `Bootstrapped ${started.length} service(s): ${started.map((r) => r.service).join(", ")}`,
    );
  }

  if (failed.length > 0) {
    infraLog(
      "warn",
      `Failed to bootstrap ${failed.length} service(s): ${failed.map((r) => `${r.service}: ${r.error}`).join("; ")}`,
    );
  }

  return results;
}

// Register cleanup on process exit
process.on("exit", cleanupBootstrappedProcesses);
process.on("SIGINT", () => {
  cleanupBootstrappedProcesses();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanupBootstrappedProcesses();
  process.exit(0);
});
