import type { ProviderRequest } from "./types";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const DOCUMENT_RE = /\b(?:dni|documento|passport|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b/gi;
const SECRET_RE = /\b(?:api[_-]?key|secret|token|password|passwd|authorization|bearer)\s*[:=]\s*["']?[^"'\s,;]{8,}/gi;

export type ProviderSanitizationResult = {
  request: ProviderRequest;
  phi_detected: boolean;
  secrets_detected: boolean;
  blocked_by_policy: boolean;
  safety_flags: string[];
};

export function sanitizeProviderRequest(input: ProviderRequest, phiAllowed: boolean): ProviderSanitizationResult {
  const safetyFlags: string[] = [];
  let text = input.input_text ?? "";
  let phiDetected = false;
  let secretsDetected = false;

  const redact = (regex: RegExp, marker: string, isPhi: boolean, isSecret = false): void => {
    text = text.replace(regex, () => {
      safetyFlags.push(marker);
      if (isPhi) phiDetected = true;
      if (isSecret) secretsDetected = true;
      return `[REDACTED_${marker}]`;
    });
  };

  redact(SECRET_RE, "SECRET", false, true);
  redact(EMAIL_RE, "EMAIL", true);
  redact(PHONE_RE, "PHONE", true);
  redact(DOCUMENT_RE, "DOCUMENT", true);

  const metadata = sanitizeProviderMetadata(input.metadata, safetyFlags);
  const blockedByPolicy = Boolean((phiDetected || input.patient_id || input.safety_level === "phi_possible") && !phiAllowed);
  if (blockedByPolicy) safetyFlags.push("PHI_BLOCKED_BY_POLICY");

  return {
    request: {
      ...input,
      input_text: text,
      metadata,
      patient_id: phiAllowed ? input.patient_id : undefined,
    },
    phi_detected: phiDetected || Boolean(input.patient_id),
    secrets_detected: secretsDetected,
    blocked_by_policy: blockedByPolicy,
    safety_flags: [...new Set(safetyFlags)],
  };
}

function sanitizeProviderMetadata(metadata: Record<string, unknown>, safetyFlags: string[]): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    const normalized = key.toLowerCase();
    if (["token", "secret", "password", "api_key", "authorization", "cookie"].some((item) => normalized.includes(item))) {
      sanitized[key] = "[REDACTED_METADATA]";
      safetyFlags.push("SECRET_METADATA");
      continue;
    }
    if (["patient", "email", "phone", "document", "address"].some((item) => normalized.includes(item))) {
      sanitized[key] = "[REDACTED_METADATA]";
      safetyFlags.push("PHI_METADATA");
      continue;
    }
    sanitized[key] = typeof value === "string" ? value.replace(/<[^>]*>/g, "").slice(0, 1000) : value;
  }
  return sanitized;
}
