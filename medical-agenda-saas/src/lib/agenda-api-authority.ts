export type AgendaWriteOperation = "appointment.create" | "appointment.cancel" | "appointment.reschedule";
export type AgendaReadOperation = "availability.lookup";

export type AuthorityAssistantMode =
  | "appointment_booking"
  | "doctor_professional"
  | "secretary_ingestion"
  | "generic_non_clinical";

export type AuthorityDecision = {
  allowed: boolean;
  reason: string;
  requiresLegacyBypassWarning: boolean;
};

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function evaluateAgendaWriteAuthority(input: {
  operation: AgendaWriteOperation;
  assistantMode: AuthorityAssistantMode;
  viaAgendaApi: boolean;
}): AuthorityDecision {
  if (input.assistantMode !== "appointment_booking") {
    return {
      allowed: false,
      reason: `assistant_mode ${input.assistantMode} no autorizado para ${input.operation}`,
      requiresLegacyBypassWarning: false,
    };
  }

  if (input.viaAgendaApi) {
    return {
      allowed: true,
      reason: "ok_via_agenda_api",
      requiresLegacyBypassWarning: false,
    };
  }

  const allowLegacyBypass = envFlag("AGENDA_API_ALLOW_LEGACY_WRITE_BYPASS", true);
  if (allowLegacyBypass) {
    return {
      allowed: true,
      reason: "legacy_write_bypass_temporal",
      requiresLegacyBypassWarning: true,
    };
  }

  return {
    allowed: false,
    reason: "agenda_api_authority_enforced",
    requiresLegacyBypassWarning: false,
  };
}

export function evaluateAgendaReadAuthority(input: {
  operation: AgendaReadOperation;
  viaAgendaApi: boolean;
}): AuthorityDecision {
  if (input.viaAgendaApi) {
    return {
      allowed: true,
      reason: "ok_via_agenda_api",
      requiresLegacyBypassWarning: false,
    };
  }

  return {
    allowed: true,
    reason: "legacy_read_allowed_temporarily",
    requiresLegacyBypassWarning: true,
  };
}
