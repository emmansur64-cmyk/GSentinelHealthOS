import { describe, expect, it } from "vitest";

import { buildMedicalReasoningContext } from "@/lib/medical-reasoning";

describe("buildMedicalReasoningContext", () => {
  it("no estructura mensajes no clinicos", () => {
    const context = buildMedicalReasoningContext({
      message: "hola sabes que dia es hoy",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasPatientContext: false,
    });

    expect(context).toBeNull();
  });

  it("estructura una consulta clinica de baja complejidad", () => {
    const context = buildMedicalReasoningContext({
      message: "paciente con resfrio leve, que conducta inicial sugieres?",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasPatientContext: false,
    });

    expect(context?.severity).toBe("low");
    expect(context?.specialty).toBe("general");
    expect(context?.requiredSections).toContain("Resumen clinico");
    expect(context?.requiredSections).toContain("Disclaimer clinico");
  });

  it("aplica formato de urgencia ante red flags", () => {
    const context = buildMedicalReasoningContext({
      message: "paciente con dolor toracico, disnea y sudoracion",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasPatientContext: false,
    });

    expect(context?.severity).toBe("urgent");
    expect(context?.specialty).toBe("emergency");
    expect(context?.emergencyEscalation).toContain("evaluacion presencial/guardia");
  });

  it("adapta psiquiatria sin convertirla automaticamente en urgencia", () => {
    const context = buildMedicalReasoningContext({
      message: "paciente con ansiedad persistente e insomnio, orientar evaluacion",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasPatientContext: false,
    });

    expect(context?.specialty).toBe("psychiatry");
    expect(context?.specialtyGuidance.join(" ")).toContain("riesgo suicida");
  });

  it("adapta pediatria", () => {
    const context = buildMedicalReasoningContext({
      message: "nino de 5 anos con fiebre y tos, orientar conducta",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasPatientContext: false,
    });

    expect(context?.specialty).toBe("pediatrics");
    expect(context?.specialtyGuidance.join(" ")).toContain("edad");
  });

  it("adapta medicina interna", () => {
    const context = buildMedicalReasoningContext({
      message: "paciente con diabetes e hipertension, revisar factores de riesgo",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasPatientContext: false,
    });

    expect(context?.specialty).toBe("internal_medicine");
    expect(context?.specialtyGuidance.join(" ")).toContain("comorbilidades");
  });

  it("distingue politica de evidencia con retrieval ON/OFF", () => {
    const withoutRetrieval = buildMedicalReasoningContext({
      message: "paciente con fiebre, hipotesis y conducta",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasPatientContext: false,
    });
    const withRetrieval = buildMedicalReasoningContext({
      message: "paciente con fiebre, hipotesis y conducta",
      clinicalState: null,
      hasRetrievalEvidence: true,
      hasPatientContext: false,
    });

    expect(withoutRetrieval?.evidencePolicy).toContain("No afirmar que se consulto evidencia externa");
    expect(withRetrieval?.evidencePolicy).toContain("EVIDENCIA MEDICA EXTERNA CONTROLADA");
  });
});
