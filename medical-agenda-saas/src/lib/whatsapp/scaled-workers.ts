/**
 * Entry point para workers escalables de WhatsApp.
 *
 * Ejecutar como proceso independiente:
 *   npx tsx src/lib/whatsapp/scaled-workers.ts
 *
 * Variables de entorno:
 *   WORKER_MODE: "all" | "intake" | "processing" | "response" (default: all)
 *   WORKER_INSTANCE: identificador de instancia (default: auto-generado)
 *   INTAKE_CONCURRENCY: concurrencia del intake worker (default: 20)
 *   PROCESSING_CONCURRENCY: concurrencia del processing worker (default: 10)
 *   RESPONSE_CONCURRENCY: concurrencia del response worker (default: 15)
 *   RESPONSE_RATE_LIMIT: mensajes/segundo en response (default: 50)
 *
 * Para horizontal scaling, ejecutar múltiples instancias con diferentes WORKER_INSTANCE.
 * BullMQ distribuye jobs automáticamente entre workers conectados.
 */
import { v4 as uuidv4 } from "uuid";

import { logServer, logServerError } from "@/lib/server-logger";
import { startIntakeWorker, stopIntakeWorker } from "./intake-worker";
import { startProcessingWorker, stopProcessingWorker } from "./processing-worker";
import { startResponseWorker, stopResponseWorker } from "./response-worker";
import { closeAllQueues, getAllQueueStats } from "./queues";
import { getAllMetrics } from "./worker-metrics";
import { closeRedis } from "./redis";

// ─── Configuración ───────────────────────────────────────────────────────────

type WorkerMode = "all" | "intake" | "processing" | "response";

type ScaledWorkersConfig = {
  mode?: WorkerMode;
  instanceId?: string;
  intakeConcurrency?: number;
  processingConcurrency?: number;
  responseConcurrency?: number;
  responseRateLimit?: number;
};

function getConfigFromEnv(): ScaledWorkersConfig {
  return {
    mode: (process.env.WORKER_MODE as WorkerMode) || "all",
    instanceId: process.env.WORKER_INSTANCE || uuidv4().slice(0, 8),
    intakeConcurrency: parseInt(process.env.INTAKE_CONCURRENCY || "20", 10),
    processingConcurrency: parseInt(process.env.PROCESSING_CONCURRENCY || "10", 10),
    responseConcurrency: parseInt(process.env.RESPONSE_CONCURRENCY || "15", 10),
    responseRateLimit: parseInt(process.env.RESPONSE_RATE_LIMIT || "50", 10),
  };
}

// ─── Worker Manager ──────────────────────────────────────────────────────────

let _running = false;
let _metricsInterval: ReturnType<typeof setInterval> | null = null;

export async function startScaledWorkers(config?: ScaledWorkersConfig): Promise<void> {
  if (_running) {
    logServer("warn", "scaled_workers.already_running", {});
    return;
  }

  const cfg = { ...getConfigFromEnv(), ...config };
  _running = true;

  logServer("info", "scaled_workers.starting", {
    mode: cfg.mode,
    instanceId: cfg.instanceId,
    intakeConcurrency: cfg.intakeConcurrency,
    processingConcurrency: cfg.processingConcurrency,
    responseConcurrency: cfg.responseConcurrency,
    responseRateLimit: cfg.responseRateLimit,
  });

  // Iniciar workers según modo
  if (cfg.mode === "all" || cfg.mode === "intake") {
    startIntakeWorker({
      concurrency: cfg.intakeConcurrency,
      workerId: `intake-${cfg.instanceId}`,
    });
  }

  if (cfg.mode === "all" || cfg.mode === "processing") {
    startProcessingWorker({
      concurrency: cfg.processingConcurrency,
      workerId: `processing-${cfg.instanceId}`,
    });
  }

  if (cfg.mode === "all" || cfg.mode === "response") {
    startResponseWorker({
      concurrency: cfg.responseConcurrency,
      workerId: `response-${cfg.instanceId}`,
      maxMessagesPerSecond: cfg.responseRateLimit,
    });
  }

  // Reportar métricas cada 30 segundos
  _metricsInterval = setInterval(async () => {
    try {
      const [metrics, queueStats] = await Promise.all([
        getAllMetrics(),
        getAllQueueStats(),
      ]);

      logServer("info", "scaled_workers.metrics", {
        instanceId: cfg.instanceId,
        intake: {
          ...metrics.intake,
          queue: queueStats.find((q) => q.name.includes("intake")),
        },
        processing: {
          ...metrics.processing,
          queue: queueStats.find((q) => q.name.includes("processing")),
        },
        response: {
          ...metrics.response,
          queue: queueStats.find((q) => q.name.includes("response")),
        },
        totalJobsPerHour:
          metrics.intake.jobsPerHour +
          metrics.processing.jobsPerHour +
          metrics.response.jobsPerHour,
      });
    } catch (error) {
      logServerError("scaled_workers.metrics_error", error, {});
    }
  }, 30000);

  logServer("info", "scaled_workers.started", {
    mode: cfg.mode,
    instanceId: cfg.instanceId,
  });
}

export async function stopScaledWorkers(): Promise<void> {
  if (!_running) return;

  logServer("info", "scaled_workers.stopping", {});

  if (_metricsInterval) {
    clearInterval(_metricsInterval);
    _metricsInterval = null;
  }

  await Promise.all([
    stopIntakeWorker(),
    stopProcessingWorker(),
    stopResponseWorker(),
  ]);

  await closeAllQueues();
  await closeRedis();

  _running = false;
  logServer("info", "scaled_workers.stopped", {});
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logServer("info", "scaled_workers.shutdown_signal", { signal });
    await stopScaledWorkers();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  setupGracefulShutdown();

  startScaledWorkers().catch((error) => {
    logServerError("scaled_workers.startup_failed", error, {});
    process.exit(1);
  });
}

// ─── Exports para uso programático ───────────────────────────────────────────

export { getAllMetrics, getAllQueueStats };
export type { WorkerMode, ScaledWorkersConfig };
