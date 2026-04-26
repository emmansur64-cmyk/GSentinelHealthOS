import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockSendWhatsAppMessage = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}));

vi.mock("@/lib/server-logger", () => ({
  logServer: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppMessage: mockSendWhatsAppMessage,
}));

describe("appointmentLifecycleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockSendWhatsAppMessage.mockResolvedValue({ success: true, waMessageId: "wamid-1" });
  });

  it("envia recordatorio WA una sola vez para turnos del appointmentEngine dentro de 24h", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: "appt-1",
          datetime: new Date("2099-01-06T08:00:00.000Z"),
          notes: "Asignado automaticamente por appointmentEngine | tipo_consulta=control | duracion=20min | confirmacion=pendiente",
          patient: { name: "Juan Perez", phone: "+5492634723151" },
          doctor: { user: { name: "Dr. Uno" } },
        },
      ])
      .mockResolvedValueOnce([]);

    const { runAppointmentLifecycleJobs } = await import("@/services/appointmentLifecycleService");
    const result = await runAppointmentLifecycleJobs(new Date("2099-01-05T08:30:00.000Z"));

    expect(result.remindersSent).toBe(1);
    expect(result.autoCancelled).toBe(0);
    expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "appt-1" },
      data: expect.objectContaining({
        notes: expect.stringContaining("appointmentEngine.recordatorio_24h_enviado"),
      }),
    }));
  });

  it("cancela automaticamente turnos no confirmados dentro del umbral y libera el slot", async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "appt-2",
          datetime: new Date("2099-01-05T18:00:00.000Z"),
          notes: "Asignado automaticamente por appointmentEngine | tipo_consulta=urgencia | duracion=15min | confirmacion=pendiente",
          patient: { name: "Ana Rios", phone: "+5492634723151" },
          doctor: { user: { name: "Dr. Dos" } },
        },
      ]);

    const { runAppointmentLifecycleJobs } = await import("@/services/appointmentLifecycleService");
    const result = await runAppointmentLifecycleJobs(new Date("2099-01-05T08:30:00.000Z"));

    expect(result.remindersSent).toBe(0);
    expect(result.autoCancelled).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "appt-2" },
      data: expect.objectContaining({
        status: "cancelled",
        notes: expect.stringContaining("appointmentEngine.autocancelado_sin_confirmacion"),
      }),
    }));
    expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(1);
  });
});