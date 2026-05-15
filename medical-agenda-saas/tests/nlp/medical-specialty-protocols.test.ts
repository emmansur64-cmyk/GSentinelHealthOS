import { describe, expect, it } from "vitest";

import { buildMedicalSpecialtyProtocolContext, loadSpecialtyProtocol } from "@/lib/medical-specialty-protocols";

describe("buildMedicalSpecialtyProtocolContext", () => {
  it("cambia a cardiologia", () => {
    const context = buildMedicalSpecialtyProtocolContext({
      message: "paciente con dolor toracico y palpitaciones, orientar protocolo",
      clinicalState: null,
      hasRetrievalEvidence: true,
      hasRuntimeContext: true,
    });

    expect(context?.specialty).toBe("emergency");
    expect(context?.label).toBe("Urgencias");
    expect(context?.protocolFocus).toContain("dolor toracico");
    expect(context?.compatibility.retrieval).toBe("available");
    expect(context?.compatibility.runtimeContext).toBe("available");
  });

  it("cambia a psiquiatria", () => {
    const context = buildMedicalSpecialtyProtocolContext({
      message: "paciente con ansiedad y depresion, evaluar abordaje",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: false,
    });

    expect(context?.specialty).toBe("psychiatry");
    expect(context?.tone).toContain("no estigmatizante");
    expect(context?.evidencePolicy).toContain("No afirmar que se consultaron fuentes externas");
  });

  it("cambia a pediatria", () => {
    const context = buildMedicalSpecialtyProtocolContext({
      message: "nino con fiebre y tos, conducta inicial",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: true,
    });

    expect(context?.specialty).toBe("pediatrics");
    expect(context?.protocolFocus).toContain("edad");
  });

  it("cambia a neurologia", () => {
    const context = buildMedicalSpecialtyProtocolContext({
      message: "paciente con cefalea brusca y deficit focal",
      clinicalState: null,
      hasRetrievalEvidence: true,
      hasRuntimeContext: false,
    });

    expect(context?.specialty).toBe("emergency");
    expect(context?.redFlags.join(" ")).toContain("cefalea brusca maxima");
  });

  it("cambia a endocrinologia", () => {
    const context = buildMedicalSpecialtyProtocolContext({
      message: "paciente con diabetes e hiperglucemia, revisar conducta",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: false,
    });

    expect(context?.specialty).toBe("endocrinology");
    expect(context?.protocolFocus).toContain("diabetes");
  });

  it("usa fallback de medicina general para consulta clinica sin especialidad clara", () => {
    const context = buildMedicalSpecialtyProtocolContext({
      message: "paciente con malestar general, orientar evaluacion inicial",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: false,
    });

    expect(context?.specialty).toBe("general_medicine");
    expect(context?.fallback).toBe(false);
  });

  it("no aplica protocolos a mensajes no clinicos", () => {
    const context = buildMedicalSpecialtyProtocolContext({
      message: "hola que dia es hoy",
      clinicalState: null,
      hasRetrievalEvidence: false,
      hasRuntimeContext: true,
    });

    expect(context).toBeNull();
  });

  it("carga fallback si la especialidad no existe en registry", () => {
    const protocol = loadSpecialtyProtocol("general_medicine");

    expect(protocol.id).toBe("general_medicine");
    expect(protocol.label).toBe("Medicina general");
  });
});
