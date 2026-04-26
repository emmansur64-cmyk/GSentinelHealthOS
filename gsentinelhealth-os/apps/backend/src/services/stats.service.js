import { prisma } from "../prisma.js";

export async function getTodayStats() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: { startsAt: { gte: start, lte: end } },
    select: { status: true },
  });

  const total = appointments.length;
  const pending = appointments.filter((row) => row.status === "pending").length;
  const cancelled = appointments.filter((row) => row.status === "cancelled").length;
  const active = total - cancelled;

  return {
    turnos_hoy: total,
    pacientes_en_espera: pending,
    ocupacion_pct: total > 0 ? Math.round((active / total) * 100) : 0,
    cancelaciones: cancelled,
  };
}
