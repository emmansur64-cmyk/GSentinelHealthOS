import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthenticatedUser = vi.fn();
const mockHasRole = vi.fn();
const mockRequireTenant = vi.fn();
const mockPredictNoShowByAppointmentId = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  hasRole: mockHasRole,
}));

vi.mock("@/services/predictionEngine", () => ({
  predictNoShowByAppointmentId: mockPredictNoShowByAppointmentId,
}));

vi.mock("@/middleware/tenantMiddleware", () => ({
  requireTenant: mockRequireTenant,
}));

describe("GET /api/predictions/no-show/:appointment_id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ userId: "u1", tenantId: "default", role: "doctor", sessionId: "s1" });
    mockHasRole.mockReturnValue(true);
    mockRequireTenant.mockResolvedValue({ ok: true, tenant: { id: "default", estado: "active" } });
    mockPredictNoShowByAppointmentId.mockResolvedValue({
      probability: 0.72,
      riskLevel: "alto",
      modelVersion: "heuristic-logit-v1",
      features: {
        dayOfWeek: 2,
        hourOfDay: 9,
        leadTimeDays: 7,
        timeBucket: "manana",
        patientNoShowRate: 0.5,
        doctorNoShowRate: 0.3,
      },
    });
  });

  it("retorna 401 sin autenticacion", async () => {
    const { GET } = await import("@/app/api/predictions/no-show/[appointment_id]/route");
    mockGetAuthenticatedUser.mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/predictions/no-show/a1"), {
      params: Promise.resolve({ appointment_id: "a1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna prediccion formateada", async () => {
    const { GET } = await import("@/app/api/predictions/no-show/[appointment_id]/route");

    const response = await GET(new Request("http://localhost/api/predictions/no-show/a1"), {
      params: Promise.resolve({ appointment_id: "a1" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      data: { probabilidad_no_show: number; risk_level: string };
    };

    expect(body.ok).toBe(true);
    expect(body.data.probabilidad_no_show).toBe(0.72);
    expect(body.data.risk_level).toBe("alto");
  });
});
