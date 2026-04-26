/**
 * Redis Health Check & Auto-Recovery Module
 *
 * Proporciona detección de disponibilidad de Redis con:
 * - Reintentos con backoff exponencial
 * - Timeout controlado (máx 2 segundos)
 * - Mensajes de error claros con sugerencias de OS
 * - Sin fallback silencioso
 */
import IORedis from "ioredis";
import { infraLog } from "./infra-logger";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const MAX_RETRIES = 3;
const MAX_TIMEOUT_MS = 2000;
const INITIAL_BACKOFF_MS = 100;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RedisHealthResult {
  available: boolean;
  latencyMs?: number;
  error?: string;
  retriesUsed?: number;
}

export interface RedisHealthOptions {
  url?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

// ─── Helper: Detect OS ───────────────────────────────────────────────────────

function detectOS(): "windows" | "macos" | "linux" {
  const platform = process.platform;
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  return "linux";
}

function getRedisStartCommand(): string {
  const os = detectOS();
  switch (os) {
    case "windows":
      return "redis-server";
    case "macos":
      return "brew services start redis";
    case "linux":
      return "sudo systemctl start redis-server";
  }
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Espera un tiempo determinado
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula el backoff exponencial
 */
function calculateBackoff(attempt: number): number {
  return Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_TIMEOUT_MS / 2);
}

/**
 * Intenta un ping a Redis con timeout
 */
async function pingWithTimeout(
  redis: IORedis,
  timeoutMs: number,
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = performance.now();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        latencyMs: timeoutMs,
        error: `Timeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    redis
      .ping()
      .then(() => {
        clearTimeout(timeout);
        const latencyMs = Math.round(performance.now() - startTime);
        resolve({ success: true, latencyMs });
      })
      .catch((err) => {
        clearTimeout(timeout);
        const latencyMs = Math.round(performance.now() - startTime);
        resolve({
          success: false,
          latencyMs,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  });
}

/**
 * Verifica si Redis está disponible.
 *
 * - Reintenta hasta 3 veces con backoff exponencial
 * - Timeout máximo de 2 segundos
 * - NO hace fallback silencioso
 */
export async function ensureRedisAvailable(
  options: RedisHealthOptions = {},
): Promise<RedisHealthResult> {
  const url = options.url || process.env.REDIS_URL || DEFAULT_REDIS_URL;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? MAX_TIMEOUT_MS;

  infraLog("debug", `Checking Redis availability at ${url}`);

  let redis: IORedis | null = null;
  let lastError: string | undefined;

  try {
    // Crear conexión con configuración para tests
    redis = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: Math.floor(timeoutMs / 2),
      lazyConnect: true,
    });

    // Conectar explícitamente
    await redis.connect();

    // Intentar ping con reintentos
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await pingWithTimeout(redis, timeoutMs);

      if (result.success) {
        infraLog("info", `Redis connected (${result.latencyMs}ms)`);
        return {
          available: true,
          latencyMs: result.latencyMs,
          retriesUsed: attempt,
        };
      }

      lastError = result.error;
      infraLog(
        "warn",
        `Redis ping attempt ${attempt + 1}/${maxRetries} failed: ${result.error}`,
      );

      if (attempt < maxRetries - 1) {
        const backoff = calculateBackoff(attempt);
        await sleep(backoff);
      }
    }

    // Todos los reintentos fallaron
    return buildFailureResult(url, lastError || "Unknown error", maxRetries);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    infraLog("error", `Redis connection failed: ${errorMsg}`);
    return buildFailureResult(url, errorMsg, 0);
  } finally {
    if (redis) {
      try {
        redis.disconnect();
      } catch {
        // Ignorar errores de desconexión
      }
    }
  }
}

/**
 * Construye resultado de falla con mensaje útil
 */
function buildFailureResult(
  url: string,
  error: string,
  retriesUsed: number,
): RedisHealthResult {
  const parsed = parseRedisUrl(url);
  const startCommand = getRedisStartCommand();

  const message = [
    `Redis no esta disponible en ${parsed.host}:${parsed.port}`,
    `Error: ${error}`,
    "",
    `Sugerencia: ejecuta '${startCommand}' para iniciar Redis`,
  ].join("\n");

  return {
    available: false,
    error: message,
    retriesUsed,
  };
}

/**
 * Parsea la URL de Redis para extraer host y puerto
 */
function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port, 10) || 6379,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

/**
 * Verifica Redis y lanza error si no está disponible.
 * Usar en setup de tests para fail-fast.
 */
export async function requireRedis(options: RedisHealthOptions = {}): Promise<void> {
  const result = await ensureRedisAvailable(options);

  if (!result.available) {
    throw new Error(`[INFRA] Redis required but not available:\n${result.error}`);
  }
}

/**
 * Verifica si el puerto de Redis está accesible
 */
export async function isRedisPortOpen(
  host: string = "localhost",
  port: number = 6379,
): Promise<boolean> {
  const net = await import("net");

  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}
