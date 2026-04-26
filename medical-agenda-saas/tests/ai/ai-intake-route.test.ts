import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogAudit = vi.fn(async () => undefined);
const mockGetAuthenticatedUser = vi.fn();
const mockHasRole = vi.fn();
const mockProcessAiIntake = vi.fn();

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
  requestMeta: vi.fn(() => ({ ipAddress: "127.0.0.1", userAgent: "vitest" })),
}));

vi.mock("@/lib/server-auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  hasRole: mockHasRole,
}));

vi.mock("@/services/aiIntakeService", async () => {
  const actual = await vi.importActual<typeof import("@/services/aiIntakeService")>("@/services/aiIntakeService");
  return {
    ...actual,
    processAiIntake: mockProcessAiIntake,
  };
});

describe("POST /api/ai/intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ userId: "u1", tenantId: "default", role: "admin", sessionId: "s1" });
    mockHasRole.mockReturnValue(true);
    mockProcessAiIntake.mockResolvedValue({
      status: "success",
      doctor_id: "doctor-1",
      doctors_created: 1,
      slots_created: 3,
      slots_skipped: 1,
    });
  });

  it("retorna 401 cuando no hay autenticacion", async () => {
    const { POST } = await import("@/app/api/ai/intake/route");
    mockGetAuthenticatedUser.mockResolvedValueOnce(null);

    const response = await POST(new Request("http://localhost/api/ai/intake", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("retorna 403 cuando el rol no tiene permisos", async () => {
    const { POST } = await import("@/app/api/ai/intake/route");
    mockHasRole.mockReturnValueOnce(false);

    const response = await POST(new Request("http://localhost/api/ai/intake", { method: "POST", body: "{}" }));
    expect(response.status).toBe(403);
  });

  it("retorna 400 para JSON invalido", async () => {
    const { POST } = await import("@/app/api/ai/intake/route");

    const response = await POST(
      new Request("http://localhost/api/ai/intake", {
        method: "POST",
        body: "{ invalid json",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error?: { message?: string } };
    expect(body.ok).toBe(false);
  });

  it("retorna 201 con resultado de procesamiento", async () => {
    const { POST } = await import("@/app/api/ai/intake/route");

    const response = await POST(
      new Request("http://localhost/api/ai/intake", {
        method: "POST",
        body: JSON.stringify({
          doctor: { nombre: "Ana", especialidad: "Clinica", matricula: "MP-1" },
          schedule: [{ fecha: "2026-05-01", bloques: [{ inicio: "08:00", fin: "09:00" }] }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      ok: boolean;
      data: { status: string; doctor_id: string; doctors_created: number; slots_created: number; slots_skipped: number };
    };

    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("success");
    expect(body.data.doctor_id).toBe("doctor-1");
    expect(body.data.doctors_created).toBe(1);
    expect(mockProcessAiIntake).toHaveBeenCalledTimes(1);
  });
});
