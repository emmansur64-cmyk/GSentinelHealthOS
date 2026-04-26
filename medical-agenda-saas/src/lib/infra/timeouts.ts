/**
 * Controlled Timeouts for Infrastructure
 *
 * Configuración centralizada de timeouts para evitar tests colgados.
 */

// ─── Default Timeouts (milliseconds) ─────────────────────────────────────────

export const TIMEOUTS = {
  // Redis operations
  REDIS_CONNECT: 2000,
  REDIS_COMMAND: 2000,
  REDIS_PING: 1000,

  // Database operations  
  DB_CONNECT: 3000,
  DB_QUERY: 5000,
  DB_TRANSACTION: 10000,

  // Queue operations
  QUEUE_READY: 5000,
  QUEUE_JOB_COMPLETE: 10000,
  WORKER_READY: 5000,

  // Test operations
  TEST_SETUP: 10000,
  TEST_TEARDOWN: 5000,
  TEST_CASE_DEFAULT: 30000,

  // Health checks
  HEALTHCHECK_TOTAL: 10000,
} as const;

// ─── Environment Overrides ───────────────────────────────────────────────────

/**
 * Obtiene un timeout con posible override de variable de entorno.
 *
 * @example
 * const timeout = getTimeout('REDIS_CONNECT');
 * // Uses TIMEOUT_REDIS_CONNECT env var if set, otherwise default
 */
export function getTimeout(key: keyof typeof TIMEOUTS): number {
  const envKey = `TIMEOUT_${key}`;
  const envValue = process.env[envKey];

  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return TIMEOUTS[key];
}

// ─── Timeout Utilities ───────────────────────────────────────────────────────

/**
 * Ejecuta una operación con timeout controlado.
 *
 * @throws Error si la operación excede el timeout
 *
 * @example
 * const result = await withTimeout(
 *   () => redis.ping(),
 *   TIMEOUTS.REDIS_PING,
 *   'Redis ping'
 * );
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string = "Operation",
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Wrapper que retorna undefined en lugar de lanzar en timeout.
 */
export async function withTimeoutSafe<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  try {
    return await withTimeout(operation, timeoutMs);
  } catch {
    return undefined;
  }
}

// ─── Retry with Timeout ──────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts: number;
  timeoutPerAttempt: number;
  backoffMs?: number;
  backoffMultiplier?: number;
}

/**
 * Ejecuta una operación con reintentos y timeout por intento.
 *
 * @example
 * const result = await withRetry(
 *   () => connectToRedis(),
 *   { maxAttempts: 3, timeoutPerAttempt: 2000, backoffMs: 500 }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    timeoutPerAttempt,
    backoffMs = 100,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(
        operation,
        timeoutPerAttempt,
        `Attempt ${attempt}/${maxAttempts}`,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error(`Operation failed after ${maxAttempts} attempts`);
}

// ─── Deadline Management ─────────────────────────────────────────────────────

/**
 * Crea un controlador de deadline para operaciones complejas.
 *
 * @example
 * const deadline = createDeadline(10000);
 *
 * await step1();
 * if (deadline.isExpired()) throw new Error('Timeout');
 *
 * await withTimeout(step2(), deadline.remaining(), 'Step 2');
 */
export function createDeadline(totalMs: number): {
  remaining: () => number;
  isExpired: () => boolean;
  check: (operationName?: string) => void;
} {
  const startTime = Date.now();
  const endTime = startTime + totalMs;

  return {
    remaining: () => Math.max(0, endTime - Date.now()),
    isExpired: () => Date.now() >= endTime,
    check: (operationName?: string) => {
      if (Date.now() >= endTime) {
        throw new Error(
          `Deadline exceeded${operationName ? ` during ${operationName}` : ""} ` +
            `(${totalMs}ms elapsed)`,
        );
      }
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
