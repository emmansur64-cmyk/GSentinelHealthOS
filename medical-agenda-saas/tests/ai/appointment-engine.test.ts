import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  $transaction: vi.fn(),
};

const mockFindDoctorCandidates = vi.fn();
const mockGetAvailabilityRulesForRange = vi.fn();
const mockGetOccupiedIntervalsForRange = vi.fn();

const mockLockDoctorForScheduling = vi.fn();
const mockVerifySlotCoverageInRules = vi.fn();
const mockFindOverlappingAppointment = vi.fn();
const mockUpsertPatientByDocument = vi.fn();
const mockCreateAppointmentRecord = vi.fn();
const mockPredictNoShowForSlot = vi.fn();
const mockPredictNoShowByAppointmentId = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/repositories/availabilityRepository", () => ({
  findDoctorCandidates: mockFindDoctorCandidates,
  getAvailabilityRulesForRange: mockGetAvailabilityRulesForRange,
  getOccupiedIntervalsForRange: mockGetOccupiedIntervalsForRange,
}));

vi.mock("@/repositories/appointmentRepository", () => ({
  lockDoctorForScheduling: mockLockDoctorForScheduling,
  verifySlotCoverageInRules: mockVerifySlotCoverageInRules,
  findOverlappingAppointment: mockFindOverlappingAppointment,
  upsertPatientByDocument: mockUpsertPatientByDocument,
  createAppointmentRecord: mockCreateAppointmentRecord,
}));

vi.mock("@/services/predictionEngine", () => ({
  getHighRiskThreshold: vi.fn(() => 0.7),
  getOverbookingMaxConcurrent: vi.fn(() => 2),
  isOverbookingEnabled: vi.fn(() => true),
  predictNoShowForSlot: mockPredictNoShowForSlot,
  predictNoShowByAppointmentId: mockPredictNoShowByAppointmentId,
}));

describe("appointmentEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ total: 1 }]),
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (txInput: unknown) => Promise<unknown>) => fn(tx));

    mockFindDoctorCandidates.mockResolvedValue([
      {
        user_id: "doctor-1",
        specialty: "Cardiologia",
        user: { name: "Dr. Uno" },
      },
    ]);

    mockGetAvailabilityRulesForRange.mockResolvedValue([
      {
        doctor_id: "doctor-1",
        day_of_week: 2,
        specific_date: new Date("2099-01-06T00:00:00.000Z"),
        start_time: "08:00",
        end_time: "09:00",
        slot_duration: 30,
      },
    ]);

    mockGetOccupiedIntervalsForRange.mockResolvedValue([]);

    mockLockDoctorForScheduling.mockResolvedValue(undefined);
    mockVerifySlotCoverageInRules.mockResolvedValue(true);
    mockFindOverlappingAppointment.mockResolvedValue(null);
    mockUpsertPatientByDocument.mockResolvedValue({ id: "patient-1", name: "Juan Perez" });
    mockPredictNoShowForSlot.mockResolvedValue({
      probability: 0.22,
      riskLevel: "bajo",
      modelVersion: "heuristic-logit-v1",
      features: {},
    });
    mockPredictNoShowByAppointmentId.mockResolvedValue({
      probability: 0.22,
      riskLevel: "bajo",
      modelVersion: "heuristic-logit-v1",
      features: {},
    });
    mockCreateAppointmentRecord.mockResolvedValue({
      id: "apt-1",
      datetime: new Date("2099-01-06T08:00:00.000Z"),
      doctor: { user: { name: "Dr. Uno" } },
    });
  });

  it("devuelve invalid payload ante esquema invalido", async () => {
    const { autoAssignAppointment } = await import("@/services/appointmentEngine");

    await expect(autoAssignAppointment({})).rejects.toThrow("INVALID_PAYLOAD");
  });

  it("asigna turno cuando encuentra slot valido", async () => {
    const { autoAssignAppointment } = await import("@/services/appointmentEngine");

    const result = await autoAssignAppointment({
      patient: {
        nombre: " juan  perez ",
        documento: "  30111222 ",
        telefono: "+5492634723151",
      },
      filters: {
        especialidad: "cardiologia",
        fecha_desde: "2099-01-06",
        fecha_hasta: "2099-01-06",
        preferencia_horaria: "indiferente",
        tipo_consulta: "control",
      },
    });

    expect(result.status).toBe("assigned");
    if (result.status !== "assigned") return;

    expect(result.appointment.id).toBe("apt-1");
    expect(result.appointment.doctor).toBe("Dr. Uno");
    expect(result.appointment.tipo_consulta).toBe("control");
    expect(result.appointment.duracion).toBe(20);
    expect(mockCreateAppointmentRecord).toHaveBeenCalledTimes(1);
    expect(mockUpsertPatientByDocument).toHaveBeenCalledWith(expect.anything(), {
      nombre: "Juan Perez",
      documento: "30111222",
      telefono: "+5492634723151",
    });
    expect(mockCreateAppointmentRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: 20,
      notes: expect.stringContaining("tipo_consulta=control"),
    }));
  });

  it("usa 45 minutos para primera vez", async () => {
    const { autoAssignAppointment } = await import("@/services/appointmentEngine");

    await autoAssignAppointment({
      patient: {
        nombre: "Clara Ruiz",
        documento: "77888999",
      },
      filters: {
        especialidad: "cardiologia",
        fecha_desde: "2099-01-06",
        fecha_hasta: "2099-01-06",
        preferencia_horaria: "indiferente",
        tipo_consulta: "primera vez",
      },
    });

    expect(mockCreateAppointmentRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: 45,
      notes: expect.stringContaining("tipo_consulta=primera_vez"),
    }));
  });

  it("retorna no_availability cuando no hay medicos candidatos", async () => {
    const { autoAssignAppointment } = await import("@/services/appointmentEngine");
    mockFindDoctorCandidates.mockResolvedValueOnce([]);

    const result = await autoAssignAppointment({
      patient: {
        nombre: "Ana Rios",
        documento: "12345678",
      },
      filters: {
        especialidad: "Neurologia",
        fecha_desde: "2099-01-06",
        fecha_hasta: "2099-01-07",
        preferencia_horaria: "manana",
      },
    });

    expect(result.status).toBe("no_availability");
  });

  it("reintenta con siguiente slot cuando el primero entra en conflicto concurrente", async () => {
    const { autoAssignAppointment } = await import("@/services/appointmentEngine");

    mockFindOverlappingAppointment
      .mockResolvedValueOnce({ id: "occupied-1" })
      .mockResolvedValueOnce(null);

    const result = await autoAssignAppointment({
      patient: {
        nombre: "Pablo Salas",
        documento: "44555666",
      },
      filters: {
        especialidad: "Cardiologia",
        fecha_desde: "2099-01-06",
        fecha_hasta: "2099-01-06",
        preferencia_horaria: "indiferente",
      },
    });

    expect(result.status).toBe("assigned");
    if (result.status !== "assigned") return;

    expect(result.attempts.some((attempt) => attempt.result === "conflict_overlap")).toBe(true);
    expect(result.attempts[result.attempts.length - 1]?.result).toBe("assigned");
    expect(mockCreateAppointmentRecord).toHaveBeenCalledTimes(1);
  });
});
