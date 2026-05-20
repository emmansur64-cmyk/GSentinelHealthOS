import { describe, expect, it } from "vitest";

import {
  buildDoctorClinicalFallbackDecision,
  buildDoctorClinicalIsolatedMetadata,
  ensureDoctorClinicalDisclaimer,
  evaluateDoctorClinicalContract,
  requiresDoctorClinicalContract,
  resolveDoctorClinicalRoute,
} from "@/chat/doctor-clinical-contract";

describe("doctor clinical contract", () => {
  it("routes datetime queries to runtime path", () => {
    const route = resolveDoctorClinicalRoute("Que fecha y hora es hoy?");
    expect(route.route).toBe("datetime_runtime");
    expect(route.requiresClinicalContract).toBe(false);
  });

  it("routes weather queries to runtime path", () => {
    const route = resolveDoctorClinicalRoute("Necesito el clima y la temperatura actual");
    expect(route.route).toBe("weather_runtime");
    expect(route.requiresClinicalContract).toBe(false);
  });

  it("detects high-complexity clinical prompt as clinical-contract required", () => {
    const message = "Paciente con sospecha de encefalitis anti-NMDA, evaluar diferencial y conducta";
    expect(requiresDoctorClinicalContract(message)).toBe(true);

    const route = resolveDoctorClinicalRoute(message);
    expect(route.route).toBe("clinical_pipeline");
    expect(route.requiresClinicalContract).toBe(true);
  });

  it("rejects non-structured clinical responses", () => {
    const validation = evaluateDoctorClinicalContract({
      message: "Paciente con cefalea, red flags y plan de evaluacion",
      response: "Podria ser algo inespecifico. Sugiero controlar sintomas.",
      forceClinicalContract: true,
    });

    expect(validation.valid).toBe(false);
    expect(validation.reasons).toContain("structured_sections_missing");
    expect(validation.reasons).toContain("clinical_disclaimer_missing");
  });

  it("accepts structured clinical responses that satisfy contract", () => {
    const response = [
      "Resumen clinico: Paciente con cefalea de inicio reciente, sin trauma reportado.",
      "Hipotesis: Diferencial entre cefalea tensional, migrana y causa secundaria de riesgo.",
      "Factores de riesgo: Edad, evolucion del dolor, antecedentes y medicacion actual.",
      "Red flags: focalidad neurologica, fiebre persistente, alteracion de conciencia.",
      "Evidencia utilizada: No se uso evidencia externa, solo contexto disponible.",
      "Sugerencias de evaluacion: reevaluacion neurologica seriada y estudios dirigidos segun riesgo.",
      "Limitaciones: faltan datos del examen fisico y signos vitales para estratificar con precision.",
      "Disclaimer clinico: esta orientacion no reemplaza criterio medico ni evaluacion presencial.",
    ].join("\n\n");

    const validation = evaluateDoctorClinicalContract({
      message: "Analizar cefalea y diferenciales",
      response,
      forceClinicalContract: true,
    });

    expect(validation.valid).toBe(true);
    expect(validation.reasons).toHaveLength(0);
    expect(validation.sectionHits).toBeGreaterThanOrEqual(4);
  });

  it("appends disclaimer when clinical contract requires it", () => {
    const original = "Resumen clinico: Caso neurologico. Hipotesis: diferencial inicial.";
    const withDisclaimer = ensureDoctorClinicalDisclaimer(original, true);

    expect(withDisclaimer).toContain("Disclaimer clinico:");
    expect(withDisclaimer).toContain("no reemplaza criterio medico");
  });

  it("isolates metadata and removes agenda contamination", () => {
    const isolated = buildDoctorClinicalIsolatedMetadata({
      chat_request_id: "req-123",
      chat_session_id: "session-abc",
      doctor_context: { specialty: "neurologia" },
      agenda: { pending: 2 },
      appointment_id: "apt-1",
    });

    expect(isolated.chat_request_id).toBe("req-123");
    expect(isolated.chat_session_id).toBe("session-abc");
    expect(isolated.doctor_context).toEqual({ specialty: "neurologia" });
    expect(isolated).not.toHaveProperty("agenda");
    expect(isolated).not.toHaveProperty("appointment_id");
    expect(isolated.legacy_agenda_fallback_allowed).toBe(false);
  });

  it("builds structured clinical fallback when contract is required", () => {
    const fallback = buildDoctorClinicalFallbackDecision({
      message: "Paciente con sospecha anti-NMDA y deterioro neurologico, sin caer en agenda de turnos",
      clinicalState: "desorientacion y convulsiones",
      patientName: "Paciente Test",
      doctorSpecialty: "neurologia",
      protocolLabel: "Neurologia",
      protocolRedFlags: ["deficit focal", "alteracion de conciencia"],
      requiredSections: [
        "Resumen clinico",
        "Hipotesis",
        "Factores de riesgo",
        "Red flags",
        "Evidencia utilizada",
        "Sugerencias de evaluacion",
        "Limitaciones",
        "Disclaimer clinico",
      ],
      hasExternalEvidence: false,
      requiresClinicalContract: true,
      reason: "providers_unavailable",
    });

    expect(fallback.action).toBe("DOCTOR_CHAT_CLINICAL_FALLBACK_STRUCTURED");
    expect(fallback.response).toContain("Resumen clinico:");
    expect(fallback.response).toContain("Disclaimer clinico:");
    expect(/\b(turno|turnos|agenda|cita|reservar|disponibilidad)\b/i.test(fallback.response)).toBe(false);
  });

  it("builds safe non-clinical fallback when contract is not required", () => {
    const fallback = buildDoctorClinicalFallbackDecision({
      message: "Hola, buen dia",
      hasExternalEvidence: false,
      requiresClinicalContract: false,
      reason: "providers_unavailable",
    });

    expect(fallback.action).toBe("DOCTOR_CHAT_SAFE_GENERAL_FALLBACK");
  });
});
