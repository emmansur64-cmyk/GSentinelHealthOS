/**
 * Circuit Breaker para el outgoing consumer (response-worker).
 *
 * Estados:
 *   CLOSED    → operación normal, errores se acumulan
 *   OPEN      → bloquea envíos, espera ventana de reset
 *   HALF_OPEN → permite 1 sonda; si pasa → CLOSED, si falla → OPEN
 *
 * Estado persistido en Redis para que múltiples réplicas del worker
 * compartan el mismo breaker.
 *
 * Claves Redis:
 *   cb:wa:outgoing:state        → "CLOSED" | "OPEN" | "HALF_OPEN"
 *   cb:wa:outgoing:failures     → contador de fallos en la ventana
 *   cb:wa:outgoing:opened_at    → timestamp de apertura (unix ms)
 */
import { getRedisConnection } from "./redis";
import { logServer } from "@/lib/server-logger";

// ─── Configuración ───────────────────────────────────────────────────────────

const CB_FAILURE_THRESHOLD = (() => {
  const v = parseInt(process.env.CB_WA_FAILURE_THRESHOLD ?? "5", 10);
  return Number.isFinite(v) && v > 0 ? v : 5;
})();

const CB_OPEN_DURATION_MS = (() => {
  const v = parseInt(process.env.CB_WA_OPEN_DURATION_MS ?? "60000", 10);
  return Number.isFinite(v) && v > 0 ? v : 60_000; // 60 s por defecto
})();

const CB_FAILURE_WINDOW_SECONDS = (() => {
  const v = parseInt(process.env.CB_WA_FAILURE_WINDOW_SECONDS ?? "120", 10);
  return Number.isFinite(v) && v > 0 ? v : 120; // 2 min ventana de conteo
})();

const KEY_STATE = "cb:wa:outgoing:state";
const KEY_FAILURES = "cb:wa:outgoing:failures";
const KEY_OPENED_AT = "cb:wa:outgoing:opened_at";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Evalúa si el circuit breaker permite ejecutar la operación.
 *
 * @returns true → permitido (CLOSED o HALF_OPEN en sonda)
 * @returns false → bloqueado (OPEN)
 */
export async function canSend(): Promise<boolean> {
  const redis = getRedisConnection();

  try {
    const state = (await redis.get(KEY_STATE)) as CircuitState | null;

    if (!state || state === "CLOSED") return true;

    if (state === "OPEN") {
      // Verificar si venció la ventana de apertura → transicionar a HALF_OPEN
      const openedAt = await redis.get(KEY_OPENED_AT);
      const elapsed = Date.now() - parseInt(openedAt ?? "0", 10);

      if (elapsed >= CB_OPEN_DURATION_MS) {
        await redis.set(KEY_STATE, "HALF_OPEN");
        logServer("info", "circuit_breaker.half_open", {
          elapsed_ms: elapsed,
          open_duration_ms: CB_OPEN_DURATION_MS,
        });
        return true; // Permitir sonda
      }

      logServer("warn", "circuit_breaker.blocked", {
        state: "OPEN",
        remaining_ms: CB_OPEN_DURATION_MS - elapsed,
      });
      return false;
    }

    // HALF_OPEN: permitir exactamente 1 sonda
    return true;
  } catch {
    // Fail-open si Redis no responde
    return true;
  }
}

/**
 * Registra un envío exitoso.
 * Si estábamos en HALF_OPEN → cierra el circuito.
 */
export async function recordSuccess(): Promise<void> {
  const redis = getRedisConnection();

  try {
    const state = (await redis.get(KEY_STATE)) as CircuitState | null;

    if (state === "HALF_OPEN" || state === "OPEN") {
      await redis.del(KEY_STATE, KEY_FAILURES, KEY_OPENED_AT);
      logServer("info", "circuit_breaker.closed", { previously: state });
    } else {
      // En CLOSED sólo resetear contador de fallos
      await redis.del(KEY_FAILURES);
    }
  } catch {
    // Best-effort
  }
}

/**
 * Registra un fallo de envío.
 * Si los fallos superan el umbral → abre el circuito.
 */
export async function recordFailure(errorMsg: string): Promise<void> {
  const redis = getRedisConnection();

  try {
    const state = (await redis.get(KEY_STATE)) as CircuitState | null;

    // Si ya está abierto o en HALF_OPEN → reabrir
    if (state === "OPEN") return;

    if (state === "HALF_OPEN") {
      await _openCircuit(errorMsg);
      return;
    }

    // CLOSED: incrementar contador con TTL de ventana
    const failures = await redis.incr(KEY_FAILURES);
    if (failures === 1) {
      // Primera vez → establecer TTL de la ventana
      await redis.expire(KEY_FAILURES, CB_FAILURE_WINDOW_SECONDS);
    }

    logServer("debug", "circuit_breaker.failure_counted", {
      failures,
      threshold: CB_FAILURE_THRESHOLD,
    });

    if (failures >= CB_FAILURE_THRESHOLD) {
      await _openCircuit(errorMsg);
    }
  } catch {
    // Best-effort
  }
}

/** Devuelve el estado actual para observabilidad. */
export async function getCircuitState(): Promise<CircuitState> {
  const redis = getRedisConnection();
  try {
    const state = await redis.get(KEY_STATE);
    return (state as CircuitState) ?? "CLOSED";
  } catch {
    return "CLOSED";
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────────

async function _openCircuit(reason: string): Promise<void> {
  const redis = getRedisConnection();
  await redis.set(KEY_STATE, "OPEN");
  await redis.set(KEY_OPENED_AT, String(Date.now()));
  await redis.del(KEY_FAILURES);

  logServer("error", "circuit_breaker.opened", {
    reason,
    open_duration_ms: CB_OPEN_DURATION_MS,
    failure_threshold: CB_FAILURE_THRESHOLD,
  });
}
