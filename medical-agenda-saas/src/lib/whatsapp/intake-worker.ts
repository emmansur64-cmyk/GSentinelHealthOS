/**
 * Intake Worker: Primera etapa del pipeline de procesamiento.
 *
 * Responsabilidades:
 * - Validar que el mensaje existe en DB
 * - Marcar como "processing"
 * - Extraer datos necesarios
 * - Pasar a la cola de processing
 *
 * Este worker es stateless y puede escalarse horizontalmente.
 */
import { Worker, type Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";
import { logServer, logServerError } from "@/lib/server-logger";
import { getRedisConnection } from "./redis";
import {
  QUEUE_NAMES,
  type IntakeJobData,
  enqueueProcessing,
} from "./queues";
import {
  trackJobStart,
  trackJobComplete,
  workerHeartbeat,
} from "./worker-metrics";
import { acquireMessageLock, confirmMessageProcessed, releaseMessageLock } from "./idempotency";
import { runWithObservabilityContext, createTraceId } from "@/lib/observability/context";
import { withSpan } from "@/lib/observability/tracing";
import { observeStageLatency } from "@/lib/observability/metrics";

// ─── Configuración ───────────────────────────────────────────────────────────

export type IntakeWorkerConfig = {
  /** Número de jobs concurrentes (default: 20) */
  concurrency?: number;
  /** ID único del worker (auto-generado si no se provee) */
  workerId?: string;
  /** Intervalo de heartbeat en ms (default: 10000) */
  heartbeatIntervalMs?: number;
};

const DEFAULT_CONFIG: Required<IntakeWorkerConfig> = {
  concurrency: 20,
  workerId: `intake-${uuidv4().slice(0, 8)}`,
  heartbeatIntervalMs: 10000,
};

// ─── Worker ──────────────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startIntakeWorker(config: IntakeWorkerConfig = {}): Worker {
  if (_worker) return _worker;

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const connection = getRedisConnection();

  logServer("info", "intake_worker.starting", {
    workerId: cfg.workerId,
    concurrency: cfg.concurrency,
  });

  _worker = new Worker<IntakeJobData>(
    QUEUE_NAMES.INTAKE,
    async (job: Job<IntakeJobData>) => {
      const startTime = await trackJobStart("intake", job.id!);
      let success = false;

      try {
        await processIntakeJob(job);
        success = true;
      } finally {
        await trackJobComplete("intake", job.id!, startTime, success);
      }
    },
    {
      connection,
      concurrency: cfg.concurrency,
      // Rate limiter global del worker
      limiter: {
        max: 100,
        duration: 1000,
      },
    },
  );

  // Heartbeat para tracking de workers activos
  _heartbeatInterval = setInterval(() => {
    workerHeartbeat(cfg.workerId, "intake").catch(() => {
      // Ignorar error de heartbeat
    });
  }, cfg.heartbeatIntervalMs);

  // Heartbeat inicial
  workerHeartbeat(cfg.workerId, "intake").catch(() => {});

  _worker.on("failed", (job, error) => {
    logServerError("intake_worker.job_failed", error, {
      jobId: job?.id,
      messageId: job?.data.messageId,
      attempt: job?.attemptsMade,
    });
  });

  _worker.on("error", (error) => {
    logServerError("intake_worker.error", error, { workerId: cfg.workerId });
  });

  return _worker;
}

export async function stopIntakeWorker(): Promise<void> {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
}

// ─── Job Handler ─────────────────────────────────────────────────────────────

async function processIntakeJob(job: Job<IntakeJobData>): Promise<void> {
  const { messageId, receivedAt } = job.data;

  await runWithObservabilityContext({ traceId: createTraceId(), messageId }, async () => {

  logServer("debug", "intake.start", { messageId, jobId: job.id });

  // 0. Idempotencia: verificar si ya fue procesado (previene duplicados en reintentos)
  const acquired = await acquireMessageLock(messageId);
  if (!acquired) {
    logServer("info", "intake.skip_idempotent", { messageId });
    return;
  }

  let processingStarted = false;

  try {
    // 1. Buscar mensaje y marcar como processing (idempotente en DB)
    let message;
    try {
      message = await withSpan(
        "db_operation",
        { model: "incomingMessage", operation: "update" },
        async () => prisma.incomingMessage.update({
          where: { message_id: messageId, status: "pending" },
          data: { status: "processing" },
        }),
      );
    } catch (error) {
      // P2025 = Record not found (ya procesado o no existe)
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2025"
      ) {
        logServer("info", "intake.skip_already_processed", { messageId });
        await confirmMessageProcessed(messageId);
        return; // Idempotente: ya procesado, exit cleanly
      }
      throw error;
    }

    processingStarted = true;

    // 2. Extraer datos del payload
    const payload = message.payload_json as Record<string, unknown>;
    const text = (payload.text as string) ?? "";

    // 3. Encolar para processing
    await enqueueProcessing({
      messageId,
      tenantId: message.tenant_id,
      phone: message.from_phone,
      text,
      payload,
      receivedAt,
      intakeCompletedAt: Date.now(),
    });

    await confirmMessageProcessed(messageId);

    logServer("debug", "intake.complete", {
      messageId,
      phone: message.from_phone,
      latencyMs: Date.now() - receivedAt,
    });

    observeStageLatency("webhook_receive", Date.now() - receivedAt);
  } catch (error) {
    if (processingStarted) {
      // Si empezamos pero fallamos → liberar lock para que se pueda reintentar
      await releaseMessageLock(messageId);
    }
    throw error;
  }
  });
}
