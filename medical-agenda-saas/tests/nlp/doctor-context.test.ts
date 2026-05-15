import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("loadDoctorContext", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.user.findFirst.mockReset();
  });

  it("carga contexto aislado por tenant y medico", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "doctor-a",
      name: "Dra Test",
      tenant: { nombre: "Clinica Norte" },
      doctorProfile: { specialty: "Cardiologia" },
    });

    const { loadDoctorContext } = await import("@/lib/doctor-context");
    const context = await loadDoctorContext({
      tenantId: "tenant-a",
      doctorUserId: "doctor-a",
      metadata: {
        doctor_context: {
          country: "AR",
          region: "Buenos Aires",
          language: "es-AR",
          timezone: "America/Argentina/Buenos_Aires",
          experience: "10 anos",
          preferredProtocols: ["dolor toracico"],
        },
      },
      hasRetrievalEvidence: true,
      hasRuntimeContext: true,
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "doctor-a", tenant_id: "tenant-a", active: true }),
      }),
    );
    expect(context.scope).toEqual({ tenantId: "tenant-a", doctorUserId: "doctor-a" });
    expect(context.doctor.specialty).toBe("Cardiologia");
    expect(context.clinic.name).toBe("Clinica Norte");
    expect(context.locale.region).toBe("Buenos Aires");
    expect(context.preferences.preferredProtocols).toContain("dolor toracico");
    expect(context.compatibility).toEqual({ retrieval: "available", runtimeContext: "available" });
    expect(context.isolation.sharesAcrossTenants).toBe(false);
  });

  it("mantiene multiples medicos separados por scope", async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: "doctor-a",
        name: "Dra A",
        tenant: { nombre: "Clinica A" },
        doctorProfile: { specialty: "Pediatria" },
      })
      .mockResolvedValueOnce({
        id: "doctor-b",
        name: "Dr B",
        tenant: { nombre: "Clinica B" },
        doctorProfile: { specialty: "Psiquiatria" },
      });

    const { loadDoctorContext } = await import("@/lib/doctor-context");
    const first = await loadDoctorContext({
      tenantId: "tenant-a",
      doctorUserId: "doctor-a",
      metadata: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: false,
    });
    const second = await loadDoctorContext({
      tenantId: "tenant-b",
      doctorUserId: "doctor-b",
      metadata: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: false,
    });

    expect(first.scope.tenantId).toBe("tenant-a");
    expect(first.doctor.specialty).toBe("Pediatria");
    expect(second.scope.tenantId).toBe("tenant-b");
    expect(second.doctor.specialty).toBe("Psiquiatria");
  });

  it("usa fallback seguro si el medico no existe en el tenant", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const { loadDoctorContext } = await import("@/lib/doctor-context");
    const context = await loadDoctorContext({
      tenantId: "tenant-a",
      doctorUserId: "doctor-missing",
      metadata: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: true,
    });

    expect(context.fallback).toBe(true);
    expect(context.scope).toEqual({ tenantId: "tenant-a", doctorUserId: "doctor-missing" });
    expect(context.doctor.specialty).toBe("medicina general");
    expect(context.compatibility.runtimeContext).toBe("available");
  });

  it("sanitiza preferencias y no comparte datos sensibles arbitrarios", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "doctor-a",
      name: "Dr <script>",
      tenant: { nombre: "Clinica <b>Sur</b>" },
      doctorProfile: { specialty: "Neurologia" },
    });

    const { loadDoctorContext } = await import("@/lib/doctor-context");
    const context = await loadDoctorContext({
      tenantId: "tenant-a",
      doctorUserId: "doctor-a",
      metadata: {
        doctor_context: {
          clinicalStyle: "<b>directo</b>",
          preferredProtocols: ["ACV", "<script>alert(1)</script>"],
          secret: "no debe copiarse",
        },
      },
      hasRetrievalEvidence: false,
      hasRuntimeContext: false,
    });

    expect(context.doctor.name).not.toContain("<script>");
    expect(context.clinic.name).not.toContain("<b>");
    expect(JSON.stringify(context.preferences)).not.toContain("no debe copiarse");
  });
});
