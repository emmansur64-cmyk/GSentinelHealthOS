import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-that-is-long-enough-for-local-tests";
process.env.GROQ_IMAGE_ANALYSIS_API_KEY = "test-key";
process.env.GROQ_IMAGE_ANALYSIS_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
process.env.GROQ_IMAGE_ANALYSIS_MAX_MB = "1";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiImageAnalysisLog: { create: vi.fn(async () => ({ id: "log-1" })) },
    activityLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
  },
}));

const authMock = vi.hoisted(() => ({
  user: null as null | { userId: string; tenantId: string; role: string; sessionId: string },
}));

vi.mock("@/lib/server-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server-auth")>("@/lib/server-auth");
  return {
    ...actual,
    getAuthenticatedUser: vi.fn(async () => authMock.user),
  };
});

const pngBytes = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

describe("Groq image analysis validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GROQ_IMAGE_ANALYSIS_MAX_MB = "1";
    process.env.GROQ_IMAGE_ANALYSIS_API_KEY = "test-key";
  });

  it("detecta MIME real y bloquea extensiones peligrosas", async () => {
    const { __aiImageAnalysisTest } = await import("@/server/ai/groqImageAnalysis");
    expect(__aiImageAnalysisTest.detectMimeType(pngBytes)).toBe("image/png");
    expect(__aiImageAnalysisTest.hasDangerousExtension("placa.svg")).toBe(true);
    expect(__aiImageAnalysisTest.hasDangerousExtension("placa.png")).toBe(false);
  });

  it("rechaza usuario sin tenant", async () => {
    const { analyzeMedicalImage } = await import("@/server/ai/groqImageAnalysis");
    await expect(
      analyzeMedicalImage({
        tenantId: "",
        userId: "user-1",
        role: "doctor",
        fileBuffer: pngBytes,
        mimeType: "image/png",
        source: "doctor_chat",
      }),
    ).rejects.toMatchObject({ code: "TENANT_REQUIRED" });
  });

  it("rechaza rol no autorizado", async () => {
    const { analyzeMedicalImage } = await import("@/server/ai/groqImageAnalysis");
    await expect(
      analyzeMedicalImage({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "guest" as "doctor",
        fileBuffer: pngBytes,
        mimeType: "image/png",
        source: "doctor_chat",
      }),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
  });

  it("rechaza archivo demasiado grande", async () => {
    process.env.GROQ_IMAGE_ANALYSIS_MAX_MB = "0.000001";
    const { analyzeMedicalImage } = await import("@/server/ai/groqImageAnalysis");
    await expect(
      analyzeMedicalImage({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "doctor",
        fileBuffer: pngBytes,
        mimeType: "image/png",
        source: "doctor_chat",
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("rechaza respuesta Groq invalida sin filtrar detalle tecnico", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{mal" } }] }), { status: 200 })),
    );
    const { analyzeMedicalImage } = await import("@/server/ai/groqImageAnalysis");
    await expect(
      analyzeMedicalImage({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "doctor",
        fileBuffer: pngBytes,
        mimeType: "image/png",
        source: "doctor_chat",
      }),
    ).rejects.toMatchObject({ code: "AI_RESPONSE_INVALID" });
  });
});

describe("POST /api/ai/image-analysis", () => {
  beforeEach(() => {
    authMock.user = null;
  });

  it("bloquea usuario sin sesión", async () => {
    const { POST } = await import("@/app/api/ai/image-analysis/route");
    const request = new NextRequest("http://localhost/api/ai/image-analysis", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
