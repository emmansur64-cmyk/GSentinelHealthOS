import { logServer, logServerError } from "@/lib/server-logger";
import { runAppointmentLifecycleJobs } from "@/services/appointmentLifecycleService";

function readIntervalMs(): number {
  const raw = process.env.APPOINTMENT_LIFECYCLE_INTERVAL_MINUTES?.trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 15 * 60 * 1000;
  return Math.max(60 * 1000, Math.floor(parsed * 60 * 1000));
}

export async function runAppointmentLifecycleOnce(): Promise<void> {
  await runAppointmentLifecycleJobs();
}

export async function startAppointmentLifecycleScheduler(): Promise<void> {
  const intervalMs = readIntervalMs();

  await runAppointmentLifecycleOnce();
  logServer("info", "appointment.lifecycle.scheduler.started", { interval_ms: intervalMs });

  setInterval(async () => {
    try {
      await runAppointmentLifecycleOnce();
    } catch (error) {
      logServerError("appointment.lifecycle.scheduler.tick_failed", error, {});
    }
  }, intervalMs);
}

async function main() {
  const watchMode = process.argv.includes("--watch");

  try {
    if (watchMode) {
      await startAppointmentLifecycleScheduler();
      return;
    }

    await runAppointmentLifecycleOnce();
    process.exitCode = 0;
  } catch (error) {
    logServerError("appointment.lifecycle.scheduler.main_failed", error, {
      watch_mode: watchMode,
    });
    process.exitCode = 1;
  }
}

void main();