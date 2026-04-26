import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthenticatedUser = vi.fn();
const mockHasRole = vi.fn();
const mockRequireTenant = vi.fn();
const mockGetRecommendations = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  hasRole: mockHasRole,
}));

vi.mock("@/services/recommendationEngine", () => ({
  getRecommendations: mockGetRecommendations,
}));

vi.mock("@/middleware/tenantMiddleware", () => ({
  requireTenant: mockRequireTenant,
}));

describe("GET /api/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ userId: "u1", tenantId: "default", role: "secretaria", sessionId: "s1" });
    mockHasRole.mockReturnValue(true);
    mockRequireTenant.mockResolvedValue({ ok: true, tenant: { id: "default", estado: "active" } });
    mockGetRecommendations.mockResolvedValue({
      generated_at: new Date().toISOString(),
      mejores_horarios_disponibles: [],
      medicos_menor_tasa_cancelacion: [],
      slots_optimos: [],
      gaps_detectados: [],
      acciones_sugeridas: [],
    });
  });

  it("retorna 422 con limit invalido", async () => {
    const { GET } = await import("@/app/api/recommendations/route");

    const response = await GET(new Request("http://localhost/api/recommendations?limit=200"));
    expect(response.status).toBe(422);
  });

  it("retorna recomendaciones", async () => {
    const { GET } = await import("@/app/api/recommendations/route");

    const response = await GET(new Request("http://localhost/api/recommendations?limit=5&horizon_days=10"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockGetRecommendations).toHaveBeenCalledWith({
      specialty: undefined,
      limit: 5,
      horizonDays: 10,
    });
  });
});
