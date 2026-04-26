/**
 * API de métricas para workers de WhatsApp.
 * GET /api/admin/worker-metrics
 */
import { fail, ok } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { getAllMetrics, type WorkerMetrics } from "@/lib/whatsapp/worker-metrics";
import { getAllQueueStats, type QueueStats } from "@/lib/whatsapp/queues";
import { evaluateAlerts, type AlertSnapshot } from "@/lib/observability/metrics";

export type WorkerMetricsResponse = {
  timestamp: string;
  stages: {
    intake: WorkerMetrics;
    processing: WorkerMetrics;
    response: WorkerMetrics;
  };
  queues: QueueStats[];
  summary: {
    totalProcessed: number;
    totalFailed: number;
    avgLatencyMs: number;
    estimatedJobsPerHour: number;
    targetMet: boolean; // >1000 mensajes/hora
  };
  alerts: AlertSnapshot;
};

export async function GET(): Promise<Response> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (String(authUser.role).toLowerCase() !== "admin") return fail("Sin permisos", 403);

  try {
    const [metrics, queues] = await Promise.all([
      getAllMetrics(),
      getAllQueueStats(),
    ]);

    // Calcular resumen
    const totalProcessed =
      metrics.intake.processed +
      metrics.processing.processed +
      metrics.response.processed;

    const totalFailed =
      metrics.intake.failed +
      metrics.processing.failed +
      metrics.response.failed;

    // Latencia promedio = suma de latencias de cada stage
    const avgLatencyMs =
      metrics.intake.avgDurationMs +
      metrics.processing.avgDurationMs +
      metrics.response.avgDurationMs;

    // Jobs/hora basado en el stage más lento (bottleneck)
    const estimatedJobsPerHour = Math.min(
      metrics.intake.jobsPerHour || Infinity,
      metrics.processing.jobsPerHour || Infinity,
      metrics.response.jobsPerHour || Infinity,
    );

    const totalQueueActive = queues.reduce((sum, queue) => sum + queue.active, 0);
    const queueThreshold = Number(process.env.QUEUE_ALERT_THRESHOLD ?? "100");
    const alerts = evaluateAlerts({
      totalProcessed,
      totalFailed,
      p95LatencySeconds: avgLatencyMs / 1000,
      queueActive: totalQueueActive,
      queueThreshold,
    });

    const response: WorkerMetricsResponse = {
      timestamp: new Date().toISOString(),
      stages: metrics,
      queues,
      summary: {
        totalProcessed,
        totalFailed,
        avgLatencyMs: Math.round(avgLatencyMs),
        estimatedJobsPerHour:
          estimatedJobsPerHour === Infinity ? 0 : Math.round(estimatedJobsPerHour),
        targetMet: estimatedJobsPerHour >= 1000,
      },
      alerts,
    };

    return ok(response);
  } catch (error) {
    return fail(
      "Error obteniendo metricas",
      500,
      error instanceof Error ? error.message : null,
    );
  }
}
