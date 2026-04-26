/**
 * DLQ Monitor: alerta cuando la cola dead-letter supera el umbral.
 *
 * Lógica:
 *   1. Cuenta jobs en la DLQ (BullMQ "failed" + "waiting")
 *   2. Si > DLQ_ALERT_THRESHOLD → log CRITICAL + webhook interno
 *   3. Throttle: no alertar más de 1 vez por ventana configurable
 *
 * Se llama desde response-worker después de cada moveToDeadLetter
 * y desde el job watchdog (jobs/appointmentLifecycle pattern).
 *
 * Clave Redis para throttle: dlq:alert:last_sent (unix ms)
 */
import { getDLQQueue } from "./dead-letter";
import { getRedisConnection } from "./redis";
import { logServer } from "@/lib/server-logger";

const DLQ_ALERT_THRESHOLD = (() => {
  const v = parseInt(process.env.DLQ_ALERT_THRESHOLD ?? "10", 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
})();

const DLQ_ALERT_THROTTLE_MS = (() => {
  const v = parseInt(process.env.DLQ_ALERT_THROTTLE_MS ?? "300000", 10);
  return Number.isFinite(v) && v > 0 ? v : 300_000; // 5 min
})();

const DLQ_WEBHOOK_URL = process.env.DLQ_ALERT_WEBHOOK_URL ?? "";

const KEY_LAST_ALERT = "dlq:alert:last_sent";

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Evalúa el tamaño de la DLQ y dispara alerta si es necesario.
 * Retorna la cantidad actual de mensajes muertos.
 */
export async function checkDLQAndAlert(): Promise<number> {
  const dlq = getDLQQueue();

  let deadCount = 0;
  try {
    // BullMQ: "failed" = jobs que agotaron reintentos; "waiting" = en DLQ sin procesar
    const [failed, waiting] = await Promise.all([
      dlq.getFailedCount(),
      dlq.getWaitingCount(),
    ]);
    deadCount = failed + waiting;
  } catch (error) {
    logServer("warn", "dlq_monitor.count_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }

  if (deadCount <= DLQ_ALERT_THRESHOLD) return deadCount;

  // Throttle: no enviar alerta si ya se envió recientemente
  const redis = getRedisConnection();
  try {
    const lastSent = await redis.get(KEY_LAST_ALERT);
    const elapsed = Date.now() - parseInt(lastSent ?? "0", 10);
    if (elapsed < DLQ_ALERT_THROTTLE_MS) return deadCount;

    await redis.set(KEY_LAST_ALERT, String(Date.now()), "EX", Math.ceil(DLQ_ALERT_THROTTLE_MS / 1000));
  } catch {
    // Si Redis falla, enviar de todos modos (fail-open para alertas)
  }

  // ── Log CRITICAL ──────────────────────────────────────────────────────────
  logServer("error", "dlq_monitor.threshold_exceeded", {
    CRITICAL: true,
    dead_count: deadCount,
    threshold: DLQ_ALERT_THRESHOLD,
    action: "manual_intervention_required",
  });

  // ── Webhook interno ───────────────────────────────────────────────────────
  await _triggerWebhook(deadCount);

  return deadCount;
}

// ─── Webhook interno ─────────────────────────────────────────────────────────

async function _triggerWebhook(deadCount: number): Promise<void> {
  if (!DLQ_WEBHOOK_URL) {
    logServer("warn", "dlq_monitor.webhook_not_configured", {
      hint: "Set DLQ_ALERT_WEBHOOK_URL env var to receive HTTP alerts",
    });
    return;
  }

  const payload = {
    event: "dlq.threshold_exceeded",
    dead_count: deadCount,
    threshold: DLQ_ALERT_THRESHOLD,
    timestamp: new Date().toISOString(),
    service: "medical-agenda-whatsapp",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(DLQ_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    logServer("info", "dlq_monitor.webhook_sent", {
      status: response.status,
      dead_count: deadCount,
    });
  } catch (error) {
    // El webhook es best-effort: no interrumpir el flujo principal
    logServer("warn", "dlq_monitor.webhook_failed", {
      error: error instanceof Error ? error.message : String(error),
      dead_count: deadCount,
    });
  }
}
