import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = {
  doctorProfile: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  agendaSettings: {
    upsert: vi.fn(),
    create: vi.fn(),
  },
  availabilityRule: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

const mockPrisma = {
  $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(async () => "hashed-password"),
}));

vi.mock("@/lib/db-locks", () => ({
  lockDoctorSchedule: vi.fn(async () => undefined),
}));

describe("aiIntakeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_INTAKE_DOCTOR_EMAIL_DOMAIN = "example.com";
    process.env.AI_INTAKE_DEFAULT_APPOINTMENT_DURATION = "30";

    mockTx.doctorProfile.findFirst.mockResolvedValue(null);
    mockTx.user.findFirst.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue({ id: "doctor-new-1" });
    mockTx.doctorProfile.create.mockResolvedValue({ user_id: "doctor-new-1" });
    mockTx.agendaSettings.create.mockResolvedValue({ user_id: "doctor-new-1" });
    mockTx.agendaSettings.upsert.mockResolvedValue({ appointment_duration: 30 });
    mockTx.availabilityRule.findMany.mockResolvedValue([]);
    mockTx.availabilityRule.createMany.mockResolvedValue({ count: 0 });
    mockTx.doctorProfile.update.mockResolvedValue({ user_id: "doctor-existing-1" });
    mockTx.user.update.mockResolvedValue({ id: "doctor-existing-1" });
  });

  it("rechaza payload invalido con error de dominio", async () => {
    const { processAiIntake, AiIntakeServiceError } = await import("@/services/aiIntakeService");

    await expect(processAiIntake({ doctor: { nombre: "A" }, schedule: [] })).rejects.toBeInstanceOf(AiIntakeServiceError);
    await expect(processAiIntake({ doctor: { nombre: "A" }, schedule: [] })).rejects.toMatchObject({ statusCode: 422 });
  });

  it("crea medico nuevo por matricula inexistente y persiste slots", async () => {
    const { processAiIntake } = await import("@/services/aiIntakeService");

    const payload = {
      doctor: {
        nombre: "  maria  perez  ",
        especialidad: "cardiologia",
        matricula: " mp 1234 ",
      },
      schedule: [
        {
          fecha: "2026-05-01",
          bloques: [{ inicio: "08:00", fin: "09:00" }],
        },
      ],
    };

    const result = await processAiIntake(payload);

    expect(result.status).toBe("success");
    expect(result.doctor_id).toBe("doctor-new-1");
    expect(result.doctors_created).toBe(1);
    expect(result.slots_created).toBe(2);
    expect(result.slots_skipped).toBe(0);
    expect(mockTx.user.create).toHaveBeenCalledTimes(1);
    expect(mockTx.doctorProfile.create).toHaveBeenCalledTimes(1);
    expect(mockTx.availabilityRule.createMany).toHaveBeenCalledTimes(1);
  });

  it("actualiza medico existente por matricula y deduplica contra reglas existentes", async () => {
    const { processAiIntake } = await import("@/services/aiIntakeService");

    mockTx.doctorProfile.findFirst.mockResolvedValueOnce({
      user_id: "doctor-existing-1",
    });

    mockTx.agendaSettings.upsert.mockResolvedValue({ appointment_duration: 30 });
    mockTx.availabilityRule.findMany.mockResolvedValue([
      {
        specific_date: new Date("2026-05-02T00:00:00.000Z"),
        start_time: "08:00",
        end_time: "08:30",
        slot_duration: 30,
      },
    ]);

    const payload = {
      doctor: {
        nombre: "Juan Gomez",
        especialidad: "Clinica Medica",
        matricula: "MP-999",
      },
      schedule: [
        {
          fecha: "2026-05-02",
          bloques: [{ inicio: "08:00", fin: "09:00" }],
        },
      ],
    };

    const result = await processAiIntake(payload);

    expect(mockTx.user.create).not.toHaveBeenCalled();
    expect(mockTx.doctorProfile.update).toHaveBeenCalledTimes(1);
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
    expect(result.doctor_id).toBe("doctor-existing-1");
    expect(result.doctors_created).toBe(0);
    expect(result.slots_created).toBe(1);
    expect(result.slots_skipped).toBeGreaterThanOrEqual(1);
  });

  it("propaga error si falla persistencia para garantizar rollback transaccional", async () => {
    const { processAiIntake } = await import("@/services/aiIntakeService");

    mockTx.availabilityRule.createMany.mockRejectedValueOnce(new Error("db exploded"));

    const payload = {
      doctor: {
        nombre: "Laura Paz",
        especialidad: "Neurologia",
        matricula: "MP-404",
      },
      schedule: [
        {
          fecha: "2026-05-03",
          bloques: [{ inicio: "10:00", fin: "11:00" }],
        },
      ],
    };

    await expect(processAiIntake(payload)).rejects.toThrow("db exploded");
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
