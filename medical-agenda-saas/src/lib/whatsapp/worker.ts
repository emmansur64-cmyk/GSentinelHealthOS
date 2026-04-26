/**
 * BullMQ Worker para procesar mensajes entrantes de WhatsApp.
 *
 * Ejecutar como proceso independiente:
 *   npx tsx src/lib/whatsapp/worker.ts
 *
 * O importar startWorker() en el bootstrap de la app.
 */
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "./redis";
import { WHATSAPP_QUEUE_NAME, type WhatsAppJobData } from "./queue";
import { processIncomingMessage } from "./conversation-engine";
import { moveToDeadLetter, markAsResolvedIfRetry } from "./dead-letter";

let _worker: Worker | null = null;

export function startWhatsAppWorker(): Worker {
  if (_worker) return _worker;

  const connection = getRedisConnection();

  _worker = new Worker<WhatsAppJobData>(
    WHATSAPP_QUEUE_NAME,
    async (job: Job<WhatsAppJobData>) => {
      const { messageId } = job.data;

      console.info(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          message: "worker.job.start",
          messageId,
          jobId: job.id,
          attempt: job.attemptsMade,
        }),
      );

      await processIncomingMessage(messageId);

      // Si era un reintento de DLQ, marcarlo como resuelto
      await markAsResolvedIfRetry(messageId);

      console.info(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          message: "worker.job.done",
          messageId,
          jobId: job.id,
        }),
      );
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 1000,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  // Handler para jobs fallidos
  _worker.on("failed", async (job, error) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        message: "worker.job.failed",
        messageId: job?.data.messageId,
        jobId: job?.id,
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts?.attempts,
        error: error.message,
        stack: error.stack,
      }),
    );

    // Si agotó todos los reintentos, mover a DLQ
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          message: "worker.job.exhausted_retries",
          messageId: job.data.messageId,
          jobId: job.id,
          attempts: job.attemptsMade,
        }),
      );

      try {
        await moveToDeadLetter(job, error);
      } catch (dlqError) {
        // CRÍTICO: Log con máximo detalle para recuperación manual
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            level: "critical",
            message: "worker.dlq.failed",
            messageId: job.data.messageId,
            jobId: job.id,
            originalError: error.message,
            dlqError: dlqError instanceof Error ? dlqError.message : "Unknown",
            jobData: JSON.stringify(job.data),
            MANUAL_RECOVERY_NEEDED: true,
          }),
        );
      }
    }
  });

  _worker.on("error", (error) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        message: "worker.error",
        error: error.message,
      }),
    );
  });

  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      message: "worker.started",
      queue: WHATSAPP_QUEUE_NAME,
      concurrency: 5,
    }),
  );

  return _worker;
}

export async function stopWhatsAppWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
}

// Ejecución standalone
if (typeof require !== "undefined" && require.main === module) {
  startWhatsAppWorker();

  const shutdown = async () => {
    console.info("Worker shutting down...");
    await stopWhatsAppWorker();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
