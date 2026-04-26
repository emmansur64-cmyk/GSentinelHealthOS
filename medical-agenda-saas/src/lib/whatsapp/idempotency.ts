/**
 * Idempotencia para mensajes entrantes de WhatsApp.
 *
 * Usa Redis SETNX con TTL para garantizar que un message_id
 * se procese exactamente una vez, incluso bajo reintentos
 * concurrentes de BullMQ.
 *
 * Clave: processed:{message_id}
 * TTL:   24 h (cubre ventana de retry + holgura)
 */
import { getRedisConnection } from "./redis";
import { logServer } from "@/lib/server-logger";

const KEY_PREFIX = "processed:";
const TTL_SECONDS = 86_400; // 24 h

/**
 * Intenta marcar un message_id como "en proceso".
 *
 * @returns true  → primera vez; el caller DEBE procesar el mensaje
 * @returns false → ya procesado (o en proceso); el caller DEBE hacer skip
 */
export async function acquireMessageLock(messageId: string): Promise<boolean> {
  const redis = getRedisConnection();
  const key = `${KEY_PREFIX}${messageId}`;

  try {
    // SET NX EX: atómica — sólo setea si la clave no existe
    const result = await redis.set(key, "1", "EX", TTL_SECONDS, "NX");
    return result === "OK";
  } catch (error) {
    // Si Redis falla, dejar pasar (fail-open) para no bloquear mensajes
    logServer("warn", "idempotency.redis_error", {
      messageId,
      error: error instanceof Error ? error.message : String(error),
      action: "fail_open",
    });
    return true;
  }
}

/**
 * Confirma que el procesamiento fue exitoso.
 * Renueva el TTL para garantizar que reintentos tardíos sean descartados.
 */
export async function confirmMessageProcessed(messageId: string): Promise<void> {
  const redis = getRedisConnection();
  const key = `${KEY_PREFIX}${messageId}`;

  try {
    await redis.expire(key, TTL_SECONDS);
  } catch {
    // Best-effort — no lanzar
  }
}

/**
 * Libera el lock (e.g. si el procesamiento falló y se quiere reintentar).
 * Sólo llamar cuando el job falla definitivamente (no en retries intermedios).
 */
export async function releaseMessageLock(messageId: string): Promise<void> {
  const redis = getRedisConnection();
  const key = `${KEY_PREFIX}${messageId}`;

  try {
    await redis.del(key);
    logServer("debug", "idempotency.lock_released", { messageId });
  } catch {
    // Best-effort
  }
}
