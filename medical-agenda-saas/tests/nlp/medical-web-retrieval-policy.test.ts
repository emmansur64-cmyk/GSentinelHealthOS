import { afterEach, describe, expect, it, vi } from "vitest";

describe("medical web retrieval policy", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("activa retrieval para consultas clinicas profesionales aunque no pidan buscar evidencia explicitamente", async () => {
    const { evaluateMedicalWebRetrievalPolicy } = await import("@/lib/medical-web-retrieval");

    const result = evaluateMedicalWebRetrievalPolicy("Paciente con shock septico en UTI, sugerir conducta inicial");

    expect(result.shouldRetrieve).toBe(true);
    expect(result.reasons).toContain("clinical_assessment");
    expect(result.reasons).toContain("clinical_condition");
  });

  it("no activa retrieval para saludos o agenda sin contenido clinico", async () => {
    const { evaluateMedicalWebRetrievalPolicy } = await import("@/lib/medical-web-retrieval");

    expect(evaluateMedicalWebRetrievalPolicy("hola buenas").shouldRetrieve).toBe(false);
    expect(evaluateMedicalWebRetrievalPolicy("quiero revisar un turno de agenda").shouldRetrieve).toBe(false);
  });

  it("mantiene web retrieval y runtime context activos por defecto salvo apagado explicito", async () => {
    delete process.env.MEDICAL_WEB_RETRIEVAL_ENABLED;
    delete process.env.MEDICAL_RUNTIME_CONTEXT_ENABLED;

    const { getMedicalWebRetrievalConfig } = await import("@/lib/medical-web-retrieval/config");
    const { getMedicalRuntimeContextConfig } = await import("@/lib/medical-runtime-context/config");

    expect(getMedicalWebRetrievalConfig().enabled).toBe(true);
    expect(getMedicalRuntimeContextConfig().enabled).toBe(true);

    process.env.MEDICAL_WEB_RETRIEVAL_ENABLED = "false";
    process.env.MEDICAL_RUNTIME_CONTEXT_ENABLED = "false";

    expect(getMedicalWebRetrievalConfig().enabled).toBe(false);
    expect(getMedicalRuntimeContextConfig().enabled).toBe(false);
  });
});
