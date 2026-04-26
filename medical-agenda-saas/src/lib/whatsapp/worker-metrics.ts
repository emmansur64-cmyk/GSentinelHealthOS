/**
 * Métricas de throughput para workers de WhatsApp.
 * Usa Redis para métricas distribuidas y soporta múltiples instancias.
 */
import { getRedisConnection } from "./redis";
import { incQueueFailed, incQueueProcessed, observeStageLatency } from "@/lib/observability/metrics";
import { logServer } from "@/lib/server-logger";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type WorkerMetrics = {
  processed: number;
  failed: number;
  avgDurationMs: number;
  jobsPerSecond: number;
  jobsPerHour: number;
  activeWorkers: number;
  queueLength: number;
};

export type WorkerStage = "intake" | "processing" | "response";

// ─── Constantes ──────────────────────────────────────────────────────────────

const METRICS_KEY_PREFIX = "wa:metrics:";
const WORKER_HEARTBEAT_PREFIX = "wa:worker:";
const HEARTBEAT_TTL_SECONDS = 30;
const METRICS_WINDOW_SECONDS = 60; // ventana de 1 minuto para calcular rates

// ─── Helpers ─────────────────────────────────────────────────────────────────

function metricsKey(stage: WorkerStage, field: string): string {
  return `${METRICS_KEY_PREFIX}${stage}:${field}`;
}

function timestampKey(stage: WorkerStage): string {
  return `${METRICS_KEY_PREFIX}${stage}:timestamps`;
}

function workerKey(workerId: string): string {
  return `${WORKER_HEARTBEAT_PREFIX}${workerId}`;
}

// ─── Tracking de Jobs ────────────────────────────────────────────────────────

/**
 * Registra el inicio de un job para calcular duración.
 */
export async function trackJobStart(
  stage: WorkerStage,
  jobId: string,
): Promise<number> {
  const startTime = Date.now();
  try {
    const redis = getRedisConnection();
    await redis.hset(metricsKey(stage, "active"), jobId, startTime.toString());
  } catch (error) {
    logServer("warn", "worker.metrics.track_job_start_failed", {
      stage,
      job_id: jobId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
  return startTime;
}

/**
 * Registra la finalización de un job y actualiza métricas.
 */
export async function trackJobComplete(
  stage: WorkerStage,
  jobId: string,
  startTime: number,
  success: boolean,
): Promise<void> {
  const duration = Date.now() - startTime;
  const now = Date.now();

  observeStageLatency(stage, duration);
  if (success) {
    incQueueProcessed(`wa-${stage}`, stage);
  } else {
    incQueueFailed(`wa-${stage}`, stage);
  }

  try {
    const redis = getRedisConnection();
    const pipeline = redis.pipeline();

    // Remover de activos
    pipeline.hdel(metricsKey(stage, "active"), jobId);

    // Incrementar contador
    if (success) {
      pipeline.incr(metricsKey(stage, "processed"));
    } else {
      pipeline.incr(metricsKey(stage, "failed"));
    }

    // Agregar duración para promedio (lista circular de últimas 1000)
    pipeline.lpush(metricsKey(stage, "durations"), duration.toString());
    pipeline.ltrim(metricsKey(stage, "durations"), 0, 999);

    // Agregar timestamp para calcular rate (sorted set con score = timestamp)
    pipeline.zadd(timestampKey(stage), now, `${jobId}:${now}`);
    // Limpiar timestamps viejos (> 1 minuto)
    pipeline.zremrangebyscore(timestampKey(stage), 0, now - METRICS_WINDOW_SECONDS * 1000);

    await pipeline.exec();
  } catch (error) {
    logServer("warn", "worker.metrics.track_job_complete_failed", {
      stage,
      job_id: jobId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

// ─── Worker Heartbeat ────────────────────────────────────────────────────────

/**
 * Registra heartbeat de un worker para tracking de instancias activas.
 */
export async function workerHeartbeat(
  workerId: string,
  stage: WorkerStage,
): Promise<void> {
  try {
    const redis = getRedisConnection();
    const data = JSON.stringify({
      stage,
      lastSeen: Date.now(),
      pid: process.pid,
    });
    await redis.setex(workerKey(workerId), HEARTBEAT_TTL_SECONDS, data);
  } catch (error) {
    logServer("warn", "worker.metrics.heartbeat_failed", {
      worker_id: workerId,
      stage,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

/**
 * Cuenta workers activos por stage.
 */
export async function countActiveWorkers(stage?: WorkerStage): Promise<number> {
  try {
    const redis = getRedisConnection();
    const keys = await redis.keys(`${WORKER_HEARTBEAT_PREFIX}*`);
  
    if (!keys.length) return 0;
    if (!stage) return keys.length;

    let count = 0;
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.stage === stage) count++;
        } catch {
          // ignore malformed
        }
      }
    }
    return count;
  } catch (error) {
    logServer("warn", "worker.metrics.count_active_failed", {
      stage: stage ?? null,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return 0;
  }
}

// ─── Lectura de Métricas ─────────────────────────────────────────────────────

/**
 * Obtiene métricas agregadas para un stage.
 */
export async function getMetrics(stage: WorkerStage): Promise<WorkerMetrics> {
  try {
    const redis = getRedisConnection();
    const now = Date.now();

    const pipeline = redis.pipeline();
    pipeline.get(metricsKey(stage, "processed"));
    pipeline.get(metricsKey(stage, "failed"));
    pipeline.lrange(metricsKey(stage, "durations"), 0, -1);
    pipeline.zcount(timestampKey(stage), now - METRICS_WINDOW_SECONDS * 1000, now);
    pipeline.hlen(metricsKey(stage, "active"));

    const results = await pipeline.exec();
    if (!results) {
      return {
        processed: 0,
        failed: 0,
        avgDurationMs: 0,
        jobsPerSecond: 0,
        jobsPerHour: 0,
        activeWorkers: 0,
        queueLength: 0,
      };
    }

    const processed = parseInt((results[0]?.[1] as string) || "0", 10);
    const failed = parseInt((results[1]?.[1] as string) || "0", 10);
    const durations = (results[2]?.[1] as string[]) || [];
    const recentCount = (results[3]?.[1] as number) || 0;
    const activeJobs = (results[4]?.[1] as number) || 0;

    // Calcular promedio de duración
    const avgDurationMs =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + parseInt(d, 10), 0) / durations.length
        : 0;

    // Jobs por segundo y por hora
    const jobsPerSecond = recentCount / METRICS_WINDOW_SECONDS;
    const jobsPerHour = jobsPerSecond * 3600;

    // Contar workers activos
    const activeWorkers = await countActiveWorkers(stage);

    return {
      processed,
      failed,
      avgDurationMs: Math.round(avgDurationMs),
      jobsPerSecond: Math.round(jobsPerSecond * 100) / 100,
      jobsPerHour: Math.round(jobsPerHour),
      activeWorkers,
      queueLength: activeJobs,
    };
  } catch (error) {
    logServer("warn", "worker.metrics.get_metrics_failed", {
      stage,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return {
      processed: 0,
      failed: 0,
      avgDurationMs: 0,
      jobsPerSecond: 0,
      jobsPerHour: 0,
      activeWorkers: 0,
      queueLength: 0,
    };
  }
}

/**
 * Obtiene métricas agregadas de todos los stages.
 */
export async function getAllMetrics(): Promise<Record<WorkerStage, WorkerMetrics>> {
  const [intake, processing, response] = await Promise.all([
    getMetrics("intake"),
    getMetrics("processing"),
    getMetrics("response"),
  ]);

  return { intake, processing, response };
}

/**
 * Resetea todas las métricas (útil para tests).
 */
export async function resetMetrics(): Promise<void> {
  try {
    const redis = getRedisConnection();
    const keys = await redis.keys(`${METRICS_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logServer("warn", "worker.metrics.reset_failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}
