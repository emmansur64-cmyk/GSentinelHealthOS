import type { DoctorContextInput, DoctorProfileContext } from "./types";

export function buildDoctorContextFallback(input: DoctorContextInput, error: unknown): DoctorProfileContext {
  return {
    instruction:
      "Usar contexto medico general. No asumir especialidad, region ni preferencias no provistas. Mantener aislamiento por tenant y medico.",
    scope: {
      tenantId: input.tenantId,
      doctorUserId: input.doctorUserId,
    },
    doctor: {
      name: null,
      specialty: "medicina general",
      experience: null,
    },
    clinic: {
      name: null,
    },
    locale: {
      country: "AR",
      region: null,
      language: "es-AR",
      timezone: "America/Argentina/Buenos_Aires",
    },
    specialtyContext: ["Mantener enfoque clinico general y explicitar limites."],
    regionalGuidelines: ["No inventar guias regionales ni disponibilidad institucional."],
    preferences: {
      clinicalStyle: null,
      preferredProtocols: [],
      evidencePreference: null,
    },
    compatibility: {
      retrieval: input.hasRetrievalEvidence ? "available" : "not_available",
      runtimeContext: input.hasRuntimeContext ? "available" : "not_available",
    },
    isolation: {
      tenantScoped: true,
      doctorScoped: true,
      sharesAcrossTenants: false,
    },
    fallback: true,
    errors: [error instanceof Error ? error.message.slice(0, 120) : "doctor_context_failed"],
  };
}
