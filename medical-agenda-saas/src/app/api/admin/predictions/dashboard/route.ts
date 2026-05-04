import { fail, ok } from "@/lib/api-response";
import { getShadowModeStrategySnapshot } from "@/lib/ai/shadowModeStrategy";
import { auditLog } from "@/lib/compliance/audit-log";
import { requireRole, requireSessionWithTenant } from "@/lib/compliance/access";
import { prisma } from "@/lib/prisma";
import { ensurePredictionTables, getDoctorScoreSnapshot } from "@/services/predictionEngine";

type DailyMetricRow = {
  metric_date: Date;
  total_predictions: number;
  resolved_predictions: number;
  accuracy: number | null;
  brier_score: number | null;
  no_show_rate: number | null;
  occupancy_rate: number | null;
};

type DistributionRow = {
  key: string;
  total: number;
};

function toPct(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number((value * 100).toFixed(2));
}

function toNum(value: number | null | undefined, decimals = 4): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

export async function GET(request: Request): Promise<Response> {
  const session = await requireSessionWithTenant();
  if (!session.ok) return session.response;
  const role = await requireRole(session.authUser, ["CLINIC_ADMIN", "AUDITOR"]);
  if (!role.ok) return role.response;

  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "14");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.floor(daysRaw), 3), 90) : 14;

  try {
    await ensurePredictionTables();

    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [dailyMetrics, riskDistribution, modelDistribution, topDoctors, observationCounts] = await Promise.all([
      prisma.$queryRaw<DailyMetricRow[]>`
        SELECT
          DATE(o.created_at) AS metric_date,
          COUNT(*)::int AS total_predictions,
          SUM(CASE WHEN o.outcome_no_show IS NOT NULL THEN 1 ELSE 0 END)::int AS resolved_predictions,
          CASE
            WHEN SUM(CASE WHEN o.outcome_no_show IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN NULL
            ELSE AVG(
              CASE
                WHEN o.outcome_no_show IS NOT NULL AND ((o.predicted_probability >= 0.6) = o.outcome_no_show) THEN 1.0
                WHEN o.outcome_no_show IS NOT NULL THEN 0.0
                ELSE NULL
              END
            )
          END AS accuracy,
          CASE
            WHEN SUM(CASE WHEN o.outcome_no_show IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN NULL
            ELSE AVG(
              CASE
                WHEN o.outcome_no_show IS NOT NULL THEN POWER(o.predicted_probability - CASE WHEN o.outcome_no_show THEN 1 ELSE 0 END, 2)
                ELSE NULL
              END
            )
          END AS brier_score,
          AVG(CASE WHEN o.outcome_no_show IS NOT NULL THEN CASE WHEN o.outcome_no_show THEN 1 ELSE 0 END ELSE NULL END) AS no_show_rate,
          NULL::double precision AS occupancy_rate
        FROM prediction_observations o
        INNER JOIN appointments a ON a.id = o.appointment_id
        WHERE o.created_at >= ${fromDate}
          AND a.tenant_id = ${session.tenantId}
        GROUP BY DATE(o.created_at)
        ORDER BY metric_date ASC
      `,
      prisma.$queryRaw<DistributionRow[]>`
        SELECT o.risk_level AS key, COUNT(*)::int AS total
        FROM prediction_observations o
        INNER JOIN appointments a ON a.id = o.appointment_id
        WHERE o.created_at >= ${fromDate}
          AND a.tenant_id = ${session.tenantId}
        GROUP BY risk_level
      `,
      prisma.$queryRaw<DistributionRow[]>`
        SELECT o.model_version AS key, COUNT(*)::int AS total
        FROM prediction_observations o
        INNER JOIN appointments a ON a.id = o.appointment_id
        WHERE o.created_at >= ${fromDate}
          AND a.tenant_id = ${session.tenantId}
        GROUP BY model_version
        ORDER BY COUNT(*) DESC
      `,
      getDoctorScoreSnapshot({ limit: 8, tenantId: session.tenantId }),
      prisma.$queryRaw<Array<{ total: number; resolved: number }>>`
        SELECT
          COUNT(*)::int AS total,
          SUM(CASE WHEN o.outcome_no_show IS NOT NULL THEN 1 ELSE 0 END)::int AS resolved
        FROM prediction_observations o
        INNER JOIN appointments a ON a.id = o.appointment_id
        WHERE o.created_at >= ${fromDate}
          AND a.tenant_id = ${session.tenantId}
      `,
    ]);

    const latest = dailyMetrics[dailyMetrics.length - 1] ?? null;
    const totalPredictions = dailyMetrics.reduce((acc, row) => acc + Number(row.total_predictions ?? 0), 0);
    const resolvedPredictions = dailyMetrics.reduce((acc, row) => acc + Number(row.resolved_predictions ?? 0), 0);
    const avgAccuracy =
      dailyMetrics.length > 0
        ? dailyMetrics.reduce((acc, row) => acc + Number(row.accuracy ?? 0), 0) / dailyMetrics.length
        : null;

    const observationTotal = Number(observationCounts[0]?.total ?? 0);
    const observationResolved = Number(observationCounts[0]?.resolved ?? 0);

    await auditLog({
      tenantId: session.tenantId,
      actorUserId: session.authUser.userId,
      entityType: "prediction_dashboard",
      action: "READ",
      metadata: {
        endpoint: "/api/admin/predictions/dashboard",
        window_days: days,
      },
    });

    return ok({
      window_days: days,
      generated_at: new Date().toISOString(),
      strategy: getShadowModeStrategySnapshot(),
      summary: {
        total_predictions: totalPredictions,
        resolved_predictions: resolvedPredictions,
        resolved_ratio_pct: toPct(observationTotal > 0 ? observationResolved / observationTotal : null),
        avg_accuracy_pct: toPct(avgAccuracy),
        latest_brier_score: toNum(latest?.brier_score, 5),
        latest_no_show_rate_pct: toPct(latest?.no_show_rate),
        latest_occupancy_rate_pct: toPct(latest?.occupancy_rate),
      },
      trend: dailyMetrics.map((row) => ({
        date: row.metric_date.toISOString().slice(0, 10),
        total_predictions: Number(row.total_predictions ?? 0),
        resolved_predictions: Number(row.resolved_predictions ?? 0),
        accuracy_pct: toPct(row.accuracy),
        brier_score: toNum(row.brier_score, 5),
        no_show_rate_pct: toPct(row.no_show_rate),
        occupancy_rate_pct: toPct(row.occupancy_rate),
      })),
      distributions: {
        risk_level: riskDistribution.map((row) => ({ key: row.key, total: Number(row.total ?? 0) })),
        model_version: modelDistribution.map((row) => ({ key: row.key, total: Number(row.total ?? 0) })),
      },
      top_doctors_low_no_show: topDoctors,
    });
  } catch (error) {
    return fail("No se pudo generar el dashboard predictivo", 500, error instanceof Error ? error.message : null);
  }
}
