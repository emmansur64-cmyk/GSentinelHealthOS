import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { autoAssignAppointment } from "@/services/appointmentEngine";
import { disconnectPrisma, getTestPrisma } from "../integration/test-isolation";

const DOC_PREFIX = "AUTOENG-";

async function cleanupAutoEngineData() {
  const prisma = getTestPrisma();

  const doctors = await prisma.doctorProfile.findMany({
    where: { matricula: { startsWith: DOC_PREFIX } },
    select: { user_id: true },
  });

  if (doctors.length === 0) {
    await prisma.patient.deleteMany({ where: { notes: "auto-engine-test" } });
    return;
  }

  const doctorIds = doctors.map((doctor) => doctor.user_id);

  await prisma.$transaction([
    prisma.appointment.deleteMany({ where: { doctor_id: { in: doctorIds } } }),
    prisma.availabilityRule.deleteMany({ where: { doctor_id: { in: doctorIds } } }),
    prisma.agendaSettings.deleteMany({ where: { user_id: { in: doctorIds } } }),
    prisma.doctorProfile.deleteMany({ where: { user_id: { in: doctorIds } } }),
    prisma.user.deleteMany({ where: { id: { in: doctorIds } } }),
    prisma.patient.deleteMany({ where: { notes: "auto-engine-test" } }),
  ]);
}

async function createDoctorWithRules(input: {
  suffix: string;
  specialty: string;
  date: string;
  blocks: Array<{ start: string; end: string }>;
}) {
  const prisma = getTestPrisma();

  const user = await prisma.user.create({
    data: {
      name: `Dr Auto ${input.suffix}`,
      email: `dr.auto.${input.suffix.toLowerCase()}@test.local`,
      password_hash: "hash",
      role: "doctor",
    },
  });

  await prisma.doctorProfile.create({
    data: {
      user_id: user.id,
      specialty: input.specialty,
      matricula: `${DOC_PREFIX}${input.suffix}`,
      ai_tag: `auto_${input.suffix.toLowerCase()}`,
    },
  });

  await prisma.agendaSettings.create({
    data: {
      user_id: user.id,
      appointment_duration: 30,
      buffer_minutes: 10,
      start_time: "08:00",
      end_time: "18:00",
      working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    },
  });

  const dayDate = new Date(`${input.date}T00:00:00.000Z`);

  await prisma.availabilityRule.createMany({
    data: input.blocks.map((block) => ({
      doctor_id: user.id,
      day_of_week: dayDate.getUTCDay(),
      specific_date: dayDate,
      start_time: block.start,
      end_time: block.end,
      slot_duration: 30,
    })),
  });

  return user.id;
}

describe("DB Integration: appointmentEngine", () => {
  beforeAll(async () => {
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
    await cleanupAutoEngineData();
  });

  afterAll(async () => {
    await cleanupAutoEngineData();
    await disconnectPrisma();
  });

  it("asigna turno real en DB y crea paciente si no existe", async () => {
    await createDoctorWithRules({
      suffix: "A1",
      specialty: "Cardiologia",
      date: "2099-02-03",
      blocks: [{ start: "08:00", end: "09:00" }],
    });

    const result = await autoAssignAppointment({
      patient: { nombre: "juan perez", documento: "30111222" },
      filters: {
        especialidad: "cardiologia",
        fecha_desde: "2099-02-03",
        fecha_hasta: "2099-02-03",
        preferencia_horaria: "indiferente",
      },
    });

    expect(result.status).toBe("assigned");
    if (result.status !== "assigned") return;

    const prisma = getTestPrisma();
    const created = await prisma.appointment.findUnique({ where: { id: result.appointment.id } });
    expect(created).not.toBeNull();

    const patient = await prisma.patient.findFirst({ where: { phone: "pending-30111222" } });
    expect(patient).not.toBeNull();
  });

  it("retorna no_availability cuando no hay huecos", async () => {
    const result = await autoAssignAppointment({
      patient: { nombre: "ana", documento: "30111999" },
      filters: {
        especialidad: "Traumatologia",
        fecha_desde: "2099-02-03",
        fecha_hasta: "2099-02-03",
        preferencia_horaria: "indiferente",
      },
    });

    expect(result.status).toBe("no_availability");
  });

  it("maneja concurrencia: una asigna y otra queda sin disponibilidad en un unico slot", async () => {
    const doctorId = await createDoctorWithRules({
      suffix: "C1",
      specialty: "Dermatologia",
      date: "2099-02-04",
      blocks: [{ start: "09:00", end: "09:30" }],
    });

    const input = {
      patient: { nombre: "mario", documento: "30222000" },
      filters: {
        especialidad: "Dermatologia",
        doctor_id: doctorId,
        fecha_desde: "2099-02-04",
        fecha_hasta: "2099-02-04",
        preferencia_horaria: "indiferente" as const,
      },
    };

    const [r1, r2] = await Promise.all([autoAssignAppointment(input), autoAssignAppointment(input)]);

    const assignedCount = [r1, r2].filter((result) => result.status === "assigned").length;
    expect(assignedCount).toBe(1);

    const prisma = getTestPrisma();
    const appointments = await prisma.appointment.findMany({
      where: {
        datetime: {
          gte: new Date("2099-02-04T00:00:00.000Z"),
          lte: new Date("2099-02-04T23:59:59.999Z"),
        },
      },
    });

    expect(appointments).toHaveLength(1);
  });
});
