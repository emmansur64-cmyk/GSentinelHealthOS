/**
 * Redis Test Isolation
 *
 * Proporciona aislamiento de datos entre tests usando prefijos únicos.
 * Evita contaminación cuando Redis es compartido.
 *
 * Todas las keys siguen el patrón: test:{TEST_RUN_ID}:*
 */
import IORedis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { infraLog } from "./infra-logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IsolatedRedisConfig {
  url?: string;
  runId?: string;
  keyPrefix?: string;
}

export interface IsolatedRedisClient {
  redis: IORedis;
  runId: string;
  keyPrefix: string;
  prefixKey: (key: string) => string;
  cleanup: () => Promise<number>;
  disconnect: () => Promise<void>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const KEY_PREFIX_BASE = "test";
const CLEANUP_BATCH_SIZE = 1000;

// ─── Run ID Management ───────────────────────────────────────────────────────

let currentRunId: string | null = null;

/**
 * Obtiene o genera el TEST_RUN_ID actual
 */
export function getTestRunId(): string {
  if (currentRunId) return currentRunId;

  currentRunId = process.env.TEST_RUN_ID || uuidv4();

  if (!process.env.TEST_RUN_ID) {
    infraLog(
      "warn",
      `TEST_RUN_ID not set, generated: ${currentRunId}. ` +
        "Set TEST_RUN_ID for reproducible test runs.",
    );
  }

  return currentRunId;
}

/**
 * Resetea el run ID (útil para tests de este módulo)
 */
export function resetTestRunId(): void {
  currentRunId = null;
}

/**
 * Construye el prefijo de key para este test run
 */
export function buildKeyPrefix(runId?: string): string {
  const id = runId || getTestRunId();
  return `${KEY_PREFIX_BASE}:${id}`;
}

// ─── Isolated Redis Client ───────────────────────────────────────────────────

/**
 * Crea un cliente Redis aislado para tests.
 *
 * Todas las operaciones usan keys con prefijo `test:{runId}:*`
 * para evitar colisiones con otros tests o datos de producción.
 *
 * @example
 * const client = await createIsolatedRedis();
 *
 * // Keys automáticamente prefijadas
 * await client.redis.set(client.prefixKey('user:123'), 'data');
 * // Almacenado como: test:{runId}:user:123
 *
 * // Limpiar al final
 * await client.cleanup();
 * await client.disconnect();
 */
export async function createIsolatedRedis(
  config: IsolatedRedisConfig = {},
): Promise<IsolatedRedisClient> {
  const url = config.url || process.env.REDIS_URL || DEFAULT_REDIS_URL;
  const runId = config.runId || getTestRunId();
  const keyPrefix = config.keyPrefix || buildKeyPrefix(runId);

  infraLog("debug", `Creating isolated Redis client with prefix: ${keyPrefix}`);

  const redis = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000,
    commandTimeout: 2000,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  // Verificar conexión
  await redis.ping();

  infraLog("info", `Isolated Redis client ready (prefix: ${keyPrefix})`);

  return {
    redis,
    runId,
    keyPrefix,
    prefixKey: (key: string) => `${keyPrefix}:${key}`,
    cleanup: () => cleanupNamespace(redis, keyPrefix),
    disconnect: async () => {
      await redis.quit();
    },
  };
}

// ─── Namespace Cleanup ───────────────────────────────────────────────────────

/**
 * Limpia todas las keys de un namespace específico.
 *
 * IMPORTANTE: Solo limpia keys que coincidan con el patrón del test.
 * NO ejecuta FLUSHDB que eliminaría todo Redis.
 */
export async function cleanupNamespace(
  redis: IORedis,
  keyPrefix: string,
): Promise<number> {
  const pattern = `${keyPrefix}:*`;
  let cleaned = 0;
  let cursor = "0";

  infraLog("debug", `Cleaning up Redis namespace: ${pattern}`);

  do {
    // Usar SCAN para evitar bloquear Redis con KEYS en bases grandes
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      CLEANUP_BATCH_SIZE,
    );

    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      cleaned += keys.length;
    }
  } while (cursor !== "0");

  if (cleaned > 0) {
    infraLog("info", `Cleaned ${cleaned} Redis keys from namespace ${keyPrefix}`);
  }

  return cleaned;
}

/**
 * Limpia el namespace del test run actual
 */
export async function cleanupCurrentTestRun(redis: IORedis): Promise<number> {
  const prefix = buildKeyPrefix();
  return cleanupNamespace(redis, prefix);
}

// ─── BullMQ Integration ──────────────────────────────────────────────────────

/**
 * Configura opciones de BullMQ para usar el namespace de test.
 *
 * Las colas de BullMQ usan prefijo `bull:` por defecto.
 * Esto lo cambia a `test:{runId}:bull:` para aislamiento.
 */
export function getBullMQTestOptions(runId?: string): { prefix: string } {
  const id = runId || getTestRunId();
  return {
    prefix: `${KEY_PREFIX_BASE}:${id}:bull`,
  };
}

/**
 * Limpia todas las colas de BullMQ del test run actual
 */
export async function cleanupBullMQQueues(redis: IORedis): Promise<number> {
  const { prefix } = getBullMQTestOptions();
  return cleanupNamespace(redis, prefix);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Obtiene todas las keys del namespace actual (para debugging)
 */
export async function listNamespaceKeys(redis: IORedis, keyPrefix?: string): Promise<string[]> {
  const prefix = keyPrefix || buildKeyPrefix();
  const pattern = `${prefix}:*`;
  const allKeys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      CLEANUP_BATCH_SIZE,
    );

    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== "0");

  return allKeys;
}

/**
 * Verifica si el namespace está vacío
 */
export async function isNamespaceEmpty(redis: IORedis, keyPrefix?: string): Promise<boolean> {
  const keys = await listNamespaceKeys(redis, keyPrefix);
  return keys.length === 0;
}

/**
 * Wrapper para ejecutar código con cleanup automático
 */
export async function withIsolatedRedis<T>(
  fn: (client: IsolatedRedisClient) => Promise<T>,
  config: IsolatedRedisConfig = {},
): Promise<T> {
  const client = await createIsolatedRedis(config);

  try {
    return await fn(client);
  } finally {
    await client.cleanup();
    await client.disconnect();
  }
}
