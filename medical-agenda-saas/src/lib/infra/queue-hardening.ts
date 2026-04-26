/**
 * BullMQ Queue Hardening for Tests
 *
 * Proporciona verificación de salud de colas y workers,
 * con wait-until-ready y timeouts controlados.
 */
import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { infraLog, measureAsync } from "./infra-logger";
import { getBullMQTestOptions } from "./redis-isolation";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QueueHealthResult {
  queue: string;
  ready: boolean;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  error?: string;
}

export interface WorkerHealthResult {
  worker: string;
  running: boolean;
  processing: boolean;
  error?: string;
}

export interface QueueHardeningOptions {
  timeoutMs?: number;
  useTestNamespace?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_READY_TIMEOUT_MS = 5000;
const DEFAULT_QUEUE_TIMEOUT_MS = 2000;

// ─── Queue Health Checks ─────────────────────────────────────────────────────

/**
 * Verifica que una cola esté lista para recibir jobs.
 *
 * @example
 * const ready = await waitUntilQueueReady(queue);
 * if (!ready) throw new Error('Queue not ready');
 */
export async function waitUntilQueueReady(
  queue: Queue,
  timeoutMs: number = DEFAULT_READY_TIMEOUT_MS,
): Promise<boolean> {
  const queueName = queue.name;

  infraLog("debug", `Waiting for queue ${queueName} to be ready...`);

  try {
    const { durationMs } = await measureAsync(async () => {
      // waitUntilReady espera a que la conexión Redis esté lista
      await Promise.race([
        queue.waitUntilReady(),
        timeoutPromise(timeoutMs, `Queue ${queueName} not ready within ${timeoutMs}ms`),
      ]);
    });

    infraLog("info", `Queue ${queueName} ready`, { durationMs });
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    infraLog("error", `Queue ${queueName} not ready: ${errorMsg}`);
    return false;
  }
}

/**
 * Obtiene estadísticas de salud de una cola
 */
export async function getQueueHealth(
  queue: Queue,
  timeoutMs: number = DEFAULT_QUEUE_TIMEOUT_MS,
): Promise<QueueHealthResult> {
  const queueName = queue.name;

  try {
    const counts = await Promise.race([
      queue.getJobCounts("waiting", "active", "completed", "failed"),
      timeoutPromise(timeoutMs, `Queue ${queueName} health check timed out`),
    ]) as Record<string, number>;

    return {
      queue: queueName,
      ready: true,
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
    };
  } catch (error) {
    return {
      queue: queueName,
      ready: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Worker Health Checks ────────────────────────────────────────────────────

/**
 * Verifica que un worker esté listo para procesar jobs.
 */
export async function waitUntilWorkerReady(
  worker: Worker,
  timeoutMs: number = DEFAULT_READY_TIMEOUT_MS,
): Promise<boolean> {
  const workerName = worker.name;

  infraLog("debug", `Waiting for worker ${workerName} to be ready...`);

  try {
    const { durationMs } = await measureAsync(async () => {
      await Promise.race([
        worker.waitUntilReady(),
        timeoutPromise(timeoutMs, `Worker ${workerName} not ready within ${timeoutMs}ms`),
      ]);
    });

    infraLog("info", `Worker ${workerName} ready`, { durationMs });
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    infraLog("error", `Worker ${workerName} not ready: ${errorMsg}`);
    return false;
  }
}

/**
 * Verifica que un worker esté procesando correctamente
 */
export function getWorkerHealth(worker: Worker): WorkerHealthResult {
  return {
    worker: worker.name,
    running: worker.isRunning(),
    processing: !worker.isPaused(),
  };
}

// ─── Test Queue Factory ──────────────────────────────────────────────────────

/**
 * Crea una cola de test con namespace aislado y timeouts controlados.
 */
export function createTestQueue<T>(
  name: string,
  connection: IORedis,
  options: QueueHardeningOptions = {},
): Queue<T> {
  const prefix = options.useTestNamespace !== false
    ? getBullMQTestOptions().prefix
    : undefined;

  return new Queue<T>(name, {
    connection: connection as ConnectionOptions,
    prefix,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 500 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  });
}

/**
 * Crea un worker de test con timeouts controlados.
 */
export function createTestWorker<T>(
  queueName: string,
  connection: IORedis,
  processor: (job: Job<T>) => Promise<unknown>,
  options: QueueHardeningOptions = {},
): Worker<T> {
  const prefix = options.useTestNamespace !== false
    ? getBullMQTestOptions().prefix
    : undefined;

  return new Worker<T>(queueName, processor, {
    connection: connection as ConnectionOptions,
    prefix,
    concurrency: 1,
    lockDuration: 30000,
    stalledInterval: 10000,
  });
}

// ─── Job Processing Verification ─────────────────────────────────────────────

export interface JobCompletionResult<R = unknown> {
  completed: boolean;
  result?: R;
  error?: string;
  durationMs: number;
}

/**
 * Espera a que un job específico complete (o falle).
 *
 * @example
 * const result = await waitForJobCompletion(queue, jobId, 5000);
 * expect(result.completed).toBe(true);
 */
export async function waitForJobCompletion<R = unknown>(
  queue: Queue,
  jobId: string,
  timeoutMs: number = 10000,
  pollIntervalMs: number = 100,
): Promise<JobCompletionResult<R>> {
  const startTime = performance.now();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await queue.getJob(jobId);

    if (!job) {
      // Job puede haber sido removido después de completar
      return {
        completed: false,
        error: `Job ${jobId} not found`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    const state = await job.getState();

    if (state === "completed") {
      return {
        completed: true,
        result: job.returnvalue as R,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    if (state === "failed") {
      return {
        completed: false,
        error: job.failedReason || "Job failed without reason",
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    await sleep(pollIntervalMs);
  }

  return {
    completed: false,
    error: `Job ${jobId} did not complete within ${timeoutMs}ms`,
    durationMs: timeoutMs,
  };
}

/**
 * Verifica que un worker procesó un job correctamente (sin retry innecesario)
 */
export async function verifyJobProcessedOnce<R = unknown>(
  queue: Queue,
  jobId: string,
  timeoutMs: number = 10000,
): Promise<{ success: boolean; attempts: number; error?: string }> {
  const result = await waitForJobCompletion<R>(queue, jobId, timeoutMs);

  if (!result.completed) {
    return { success: false, attempts: 0, error: result.error };
  }

  const job = await queue.getJob(jobId);
  const attempts = job?.attemptsMade ?? 1;

  return {
    success: true,
    attempts,
    error: attempts > 1 ? `Job required ${attempts} attempts` : undefined,
  };
}

// ─── Cleanup Utilities ───────────────────────────────────────────────────────

/**
 * Limpia una cola completamente (drain + obliterate)
 */
export async function cleanupQueue(queue: Queue): Promise<void> {
  infraLog("debug", `Cleaning up queue ${queue.name}`);

  try {
    // Drain primero (espera a que jobs activos terminen)
    await queue.drain();
    // Obliterate elimina todo rastro
    await queue.obliterate({ force: true });

    infraLog("info", `Queue ${queue.name} cleaned`);
  } catch (error) {
    infraLog("warn", `Failed to cleanup queue ${queue.name}: ${error}`);
  }
}

/**
 * Cierra un worker de forma segura
 */
export async function closeWorker(worker: Worker): Promise<void> {
  infraLog("debug", `Closing worker ${worker.name}`);

  try {
    await worker.close();
    infraLog("info", `Worker ${worker.name} closed`);
  } catch (error) {
    infraLog("warn", `Failed to close worker ${worker.name}: ${error}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
