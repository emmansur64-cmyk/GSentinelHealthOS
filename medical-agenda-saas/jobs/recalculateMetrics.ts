import { runPredictionMetricsRecalculation } from "@/services/predictionEngine";
import { logServer, logServerError } from "@/lib/server-logger";

function readIntervalMs(): number {
  const raw = process.env.PREDICTION_RECALC_INTERVAL_HOURS?.trim();
  if (!raw) return 24 * 60 * 60 * 1000;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) return 24 * 60 * 60 * 1000;
  return Math.max(30 * 60 * 1000, Math.floor(hours * 60 * 60 * 1000));
}

export async function recalculateMetricsOnce(): Promise<void> {
  await runPredictionMetricsRecalculation();
}

export async function startMetricsScheduler(): Promise<void> {
  const intervalMs = readIntervalMs();

  await recalculateMetricsOnce();

  logServer("info", "prediction.scheduler.started", {
    interval_ms: intervalMs,
  });

  setInterval(async () => {
    try {
      await recalculateMetricsOnce();
    } catch (error) {
      logServerError("prediction.scheduler.tick_failed", error, {});
    }
  }, intervalMs);
}

async function main() {
  const watchMode = process.argv.includes("--watch");

  try {
    if (watchMode) {
      await startMetricsScheduler();
      return;
    }

    await recalculateMetricsOnce();
    process.exitCode = 0;
  } catch (error) {
    logServerError("prediction.scheduler.main_failed", error, {
      watch_mode: watchMode,
    });
    process.exitCode = 1;
  }
}

void main();
