import type { Prisma } from "@prisma/client";

export async function lockDoctorSchedule(tx: Prisma.TransactionClient, doctorId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`doctor_schedule:${doctorId}`}))`;
}
