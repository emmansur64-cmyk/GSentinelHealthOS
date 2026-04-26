import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { processAiIntake } from "@/services/aiIntakeService";
import { disconnectPrisma, getTestPrisma } from "../integration/test-isolation";

const TEST_PREFIX = "AITEST-";
const AUTO_NAME_PREFIX = "Aitest Auto Sin Matricula";

function testPayload(matricula: string, fecha: string) {
  return {
    doctor: {
      nombre: "  laura   mendez ",
      especialidad: "clinica medica",
      matricula,
    },
    schedule: [
      {
        fecha,
        bloques: [
          { inicio: "08:00", fin: "09:00" },
          { inicio: "10:00", fin: "11:00" },
        ],
      },
    ],
  };
}

async function cleanupAiIntakeTestData() {
  const prisma = getTestPrisma();
  const doctors = await prisma.doctorProfile.findMany({
    where: {
      OR: [
        { matricula: { startsWith: TEST_PREFIX } },
        {
          ai_tag: { startsWith: "auto_created_" },
          user: {
            name: {
              startsWith: AUTO_NAME_PREFIX,
              mode: "insensitive",
            },
          },
        },
      ],
    },
    select: { user_id: true },
  });

  if (doctors.length === 0) return;

  const doctorIds = doctors.map((doctor) => doctor.user_id);

  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { doctor_id: { in: doctorIds } } }),
    prisma.agendaSettings.deleteMany({ where: { user_id: { in: doctorIds } } }),
    prisma.doctorProfile.deleteMany({ where: { user_id: { in: doctorIds } } }),
    prisma.user.deleteMany({ where: { id: { in: doctorIds } } }),
  ]);
}

describe("DB Integration: AI Intake Pipeline", () => {
  beforeAll(async () => {
    process.env.AI_INTAKE_DOCTOR_EMAIL_DOMAIN = "ai-intake.test";
    process.env.AI_INTAKE_DEFAULT_APPOINTMENT_DURATION = "30";
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
    await cleanupAiIntakeTestData();
  });

  afterAll(async () => {
    await cleanupAiIntakeTestData();
    await disconnectPrisma();
  });

  it("persiste end-to-end doctor + slots en DB", async () => {
    const prisma = getTestPrisma();
    const matricula = `${TEST_PREFIX}E2E-001`;

    const result = await processAiIntake(testPayload(matricula, "2026-06-02"));

    expect(result.status).toBe("success");
    expect(result.slots_created).toBe(4);
    expect(result.slots_skipped).toBe(0);

    const doctor = await prisma.doctorProfile.findUnique({
      where: { matricula },
      include: { user: true },
    });

    expect(doctor).not.toBeNull();
    expect(doctor?.specialty).toBe("Clinica Medica");
    expect(doctor?.user.name).toBe("Laura Mendez");

    const rules = await prisma.availabilityRule.findMany({
      where: { doctor_id: doctor!.user_id },
      orderBy: [{ start_time: "asc" }],
    });

    expect(rules).toHaveLength(4);
    expect(rules[0]?.start_time).toBe("08:00");
    expect(rules[0]?.end_time).toBe("08:30");
  });

  it("deduplica reingesta y no inserta slots redundantes", async () => {
    const prisma = getTestPrisma();
    const matricula = `${TEST_PREFIX}DEDUP-001`;
    const payload = testPayload(matricula, "2026-06-03");

    const first = await processAiIntake(payload);
    const second = await processAiIntake(payload);

    expect(first.slots_created).toBe(4);
    expect(second.slots_created).toBe(0);
    expect(second.slots_skipped).toBeGreaterThanOrEqual(4);

    const doctor = await prisma.doctorProfile.findUnique({ where: { matricula } });
    expect(doctor).not.toBeNull();

    const rulesCount = await prisma.availabilityRule.count({ where: { doctor_id: doctor!.user_id } });
    expect(rulesCount).toBe(4);
  });

  it("serializa concurrencia por medico existente y evita duplicados", async () => {
    const prisma = getTestPrisma();
    const matricula = `${TEST_PREFIX}CONC-001`;

    await processAiIntake(testPayload(matricula, "2026-06-04"));

    const payload = {
      doctor: {
        nombre: "Laura Mendez",
        especialidad: "Clinica Medica",
        matricula,
      },
      schedule: [
        {
          fecha: "2026-06-05",
          bloques: [{ inicio: "09:00", fin: "10:00" }],
        },
      ],
    };

    const [r1, r2] = await Promise.all([processAiIntake(payload), processAiIntake(payload)]);

    const createdTotal = r1.slots_created + r2.slots_created;
    expect(createdTotal).toBe(2);

    const doctor = await prisma.doctorProfile.findUnique({ where: { matricula } });
    expect(doctor).not.toBeNull();

    const rules = await prisma.availabilityRule.findMany({ where: { doctor_id: doctor!.user_id } });
    const targetDayRules = rules.filter((rule) => rule.specific_date?.toISOString().startsWith("2026-06-05"));
    expect(targetDayRules).toHaveLength(2);
  });

  it("no persiste datos cuando falla configuracion previa al commit", async () => {
    const prisma = getTestPrisma();
    const matricula = `${TEST_PREFIX}CFG-001`;
    const previousDomain = process.env.AI_INTAKE_DOCTOR_EMAIL_DOMAIN;

    process.env.AI_INTAKE_DOCTOR_EMAIL_DOMAIN = "";

    await expect(processAiIntake(testPayload(matricula, "2026-06-06"))).rejects.toThrow(
      "Falta configuracion AI_INTAKE_DOCTOR_EMAIL_DOMAIN",
    );

    if (typeof previousDomain === "undefined") {
      delete process.env.AI_INTAKE_DOCTOR_EMAIL_DOMAIN;
    } else {
      process.env.AI_INTAKE_DOCTOR_EMAIL_DOMAIN = previousDomain;
    }

    const doctor = await prisma.doctorProfile.findUnique({ where: { matricula } });
    expect(doctor).toBeNull();
  });

  it("crea medico automaticamente cuando no llega matricula y expone doctors_created", async () => {
    const prisma = getTestPrisma();
    const doctorName = `${AUTO_NAME_PREFIX} ${Date.now()}`;

    const result = await processAiIntake({
      doctor: {
        nombre: doctorName,
        especialidad: "Traumatologia",
      },
      schedule: [
        {
          fecha: "2026-06-07",
          bloques: [{ inicio: "08:00", fin: "09:00" }],
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.doctors_created).toBe(1);
    expect(result.slots_created).toBe(2);

    const doctor = await prisma.doctorProfile.findUnique({
      where: { user_id: result.doctor_id },
      include: { user: true },
    });

    expect(doctor).not.toBeNull();
    expect(doctor?.user.name).toContain(AUTO_NAME_PREFIX);
    expect(doctor?.ai_tag.startsWith("auto_created_")).toBe(true);
    expect(doctor?.matricula.startsWith("AUTO-")).toBe(true);
  });
});
