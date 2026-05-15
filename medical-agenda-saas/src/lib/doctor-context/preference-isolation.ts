import { sanitizeDoctorContextString, sanitizeStringList } from "./sanitizer";
import type { DoctorContextPreferences } from "./types";

export function buildIsolatedPreferences(metadata?: Record<string, unknown> | null): DoctorContextPreferences {
  const source = metadata?.doctor_context;
  const record = source && typeof source === "object" ? (source as Record<string, unknown>) : {};

  return {
    clinicalStyle: sanitizeDoctorContextString(record.clinicalStyle ?? record.clinical_style, 120),
    preferredProtocols: sanitizeStringList(record.preferredProtocols ?? record.preferred_protocols, 8, 100),
    evidencePreference: sanitizeDoctorContextString(record.evidencePreference ?? record.evidence_preference, 120),
  };
}
