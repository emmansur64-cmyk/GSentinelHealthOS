import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthenticatedUser = vi.fn();
const mockHasRole = vi.fn();
const mockRequireTenant = vi.fn();
const mockLogAudit = vi.fn(async () => undefined);
const mockAutoAssignAppointment = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  hasRole: mockHasRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
  requestMeta: vi.fn(() => ({ ipAddress: "127.0.0.1", userAgent: "vitest" })),
}));

vi.mock("@/middleware/tenantMiddleware", () => ({
  requireTenant: mockRequireTenant,
}));

vi.mock("@/services/appointmentEngine", () => ({
  autoAssignAppointment: mockAutoAssignAppointment,
}));

describe("POST /api/appointments/auto-assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ userId: "u1", tenantId: "default", role: "secretaria", sessionId: "s1" });
    mockHasRole.mockReturnValue(true);
    mockRequireTenant.mockResolvedValue({ ok: true, tenant: { id: "default", estado: "active" } });
    mockAutoAssignAppointment.mockResolvedValue({
      status: "assigned",
      appointment: {
        id: "apt-1",
        doctor: "Dr. Uno",
        fecha: "2099-01-06",
        hora: "08:00",
      },
      attempts: [],
    });
  });

  it("retorna 401 sin autenticacion", async () => {
    const { POST } = await import("@/app/api/appointments/auto-assign/route");
    mockGetAuthenticatedUser.mockResolvedValueOnce(null);

    const response = await POST(new Request("http://localhost/api/appointments/auto-assign", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("retorna 403 sin rol permitido", async () => {
    const { POST } = await import("@/app/api/appointments/auto-assign/route");
    mockHasRole.mockReturnValueOnce(false);

    const response = await POST(new Request("http://localhost/api/appointments/auto-assign", { method: "POST", body: "{}" }));
    expect(response.status).toBe(403);
  });

  it("retorna no_availability cuando motor no encuentra slot", async () => {
    const { POST } = await import("@/app/api/appointments/auto-assign/route");
    mockAutoAssignAppointment.mockResolvedValueOnce({ status: "no_availability", attempts: [] });

    const response = await POST(
      new Request("http://localhost/api/appointments/auto-assign", {
        method: "POST",
        body: JSON.stringify({
          patient: { nombre: "Juan", documento: "123" },
          filters: {
            especialidad: "Cardiologia",
            fecha_desde: "2099-01-01",
            fecha_hasta: "2099-01-02",
            preferencia_horaria: "indiferente",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; data: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("no_availability");
  });

  it("retorna 201 con appointment cuando motor asigna", async () => {
    const { POST } = await import("@/app/api/appointments/auto-assign/route");

    const response = await POST(
      new Request("http://localhost/api/appointments/auto-assign", {
        method: "POST",
        body: JSON.stringify({
          patient: { nombre: "Juan", documento: "12345678" },
          filters: {
            especialidad: "Cardiologia",
            fecha_desde: "2099-01-01",
            fecha_hasta: "2099-01-02",
            preferencia_horaria: "indiferente",
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      ok: boolean;
      data: {
        status: string;
        appointment: { id: string; doctor: string; fecha: string; hora: string };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("assigned");
    expect(body.data.appointment.id).toBe("apt-1");
  });
});
