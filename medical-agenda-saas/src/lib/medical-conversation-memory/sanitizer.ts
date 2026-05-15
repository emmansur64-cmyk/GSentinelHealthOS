const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const DOCUMENT_REGEX = /\b(?:dni|documento|ssn|cuil|cuit|pasaporte)\s*[:#-]?\s*[a-z0-9.-]{5,}\b/gi;
const SECRET_REGEX = /\b(?:api[_-]?key|token|secret|password|contraseña|bearer)\s*[:=]\s*\S+/gi;

export function sanitizeMedicalMemoryText(value: unknown, max = 1000): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(SECRET_REGEX, "[REDACTED_SECRET]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(PHONE_REGEX, "[REDACTED_PHONE]")
    .replace(DOCUMENT_REGEX, "[REDACTED_DOCUMENT]")
    .replace(/[^\p{L}\p{N}\s.,:;!?%()[\]/_+\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function uniqueCompact(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const normalized = sanitizeMedicalMemoryText(item, 220);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}
