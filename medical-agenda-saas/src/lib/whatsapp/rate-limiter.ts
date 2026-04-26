/**
 * Rate limiter por teléfono usando Redis INCR + TTL.
 *
 * Algoritmo: Fixed Window Counter
 *   - Clave: rl:phone:{number}
 *   - En el primer mensaje del período → INCR crea la clave y se setea TTL
 *   - Los siguientes mensajes solo hacen INCR (atómico)
 *   - Al vencer el TTL Redis borra la clave automáticamente → ventana nueva
 *
 * Ventajas sobre la implementación Prisma anterior:
 *   - Sin contención de escritura en DB bajo alta carga
 *   - Operación INCR es O(1) atómica en Redis (sin race conditions)
 *   - Sin necesidad de tabla rateLimit en DB
 *
 * Fallback a Prisma si Redis no está disponible.
 */
import { getRedisConnection, isRedisAvailable } from "./redis";
import { prisma } from "@/lib/prisma";
import { logServer } from "@/lib/server-logger";

const MAX_MESSAGES_PER_WINDOW = (() => {
  const v = parseInt(process.env.WA_RATE_LIMIT_MAX ?? "10", 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
})();

const WINDOW_SECONDS = (() => {
  const v = parseInt(process.env.WA_RATE_LIMIT_WINDOW_SECONDS ?? "60", 10);
  return Number.isFinite(v) && v > 0 ? v : 60;
})();

const WINDOW_DURATION_MS = WINDOW_SECONDS * 1_000;
const KEY_PREFIX = "rl:phone:";
const REDIS_OPERATION_TIMEOUT_MS = 1_200;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`REDIS_TIMEOUT_${timeoutMs}MS`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Verifica y actualiza rate limit por teléfono usando Redis.
 * Retorna true si el mensaje está permitido, false si excede el límite.
 */
export async function checkRateLimit(phone: string): Promise<boolean> {
  const key = `${KEY_PREFIX}${phone}`;

  try {
    if (!isRedisAvailable()) {
      return _checkRateLimitPrisma(phone);
    }

    const redis = getRedisConnection();

    // INCR es atómica: incrementa o crea la clave en 1
    const count = await withTimeout(redis.incr(key), REDIS_OPERATION_TIMEOUT_MS);

    if (count === 1) {
      // Primera vez en esta ventana → establecer TTL
      await withTimeout(redis.expire(key, WINDOW_SECONDS), REDIS_OPERATION_TIMEOUT_MS);
    }

    if (count > MAX_MESSAGES_PER_WINDOW) {
      logServer("warn", "rate_limit.exceeded", {
        phone,
        count,
        max: MAX_MESSAGES_PER_WINDOW,
        window_seconds: WINDOW_SECONDS,
      });
      return false;
    }

    return true;
  } catch (error) {
    // Redis no disponible → fallback a Prisma
    logServer("warn", "rate_limit.redis_fallback", {
      phone,
      error: error instanceof Error ? error.message : String(error),
    });
    return _checkRateLimitPrisma(phone);
  }
}

/**
 * Devuelve cuántos mensajes quedan disponibles en la ventana actual.
 * Útil para respuestas informativas al usuario.
 */
export async function getRateLimitRemaining(phone: string): Promise<number> {
  if (!isRedisAvailable()) return MAX_MESSAGES_PER_WINDOW;

  const redis = getRedisConnection();
  const key = `${KEY_PREFIX}${phone}`;

  try {
    const raw = await withTimeout(redis.get(key), REDIS_OPERATION_TIMEOUT_MS);
    const count = parseInt(raw ?? "0", 10);
    return Math.max(0, MAX_MESSAGES_PER_WINDOW - count);
  } catch {
    return MAX_MESSAGES_PER_WINDOW;
  }
}

// ─── Fallback Prisma ─────────────────────────────────────────────────────────

async function _checkRateLimitPrisma(phone: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DURATION_MS);

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { phone } });

    if (!existing) {
      await prisma.rateLimit.create({
        data: { phone, message_count: 1, window_start: now },
      });
      return true;
    }

    if (existing.window_start < windowStart) {
      await prisma.rateLimit.update({
        where: { phone },
        data: { message_count: 1, window_start: now },
      });
      return true;
    }

    if (existing.message_count >= MAX_MESSAGES_PER_WINDOW) return false;

    await prisma.rateLimit.update({
      where: { phone },
      data: { message_count: { increment: 1 } },
    });
    return true;
  } catch {
    return true; // fail-open
  }
}

