/** Redacts identifiable PHI patterns before sending user text to external LLMs. */

// Standard email address pattern
const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;

// International phone numbers with explicit + prefix
const INTL_PHONE_RE = /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]\d{3,4}[\s.\-]\d{3,6}/g;

// Phone numbers explicitly labeled by the user ("tel:", "celular:", etc.)
const LABELED_PHONE_RE =
  /\b(?:tel(?:efono|éfono)?|celular|m[oó]vil|whatsapp|phone|cell?)[.:\s]+[\d\s.\-+()]{7,25}/gi;

// Document IDs only when preceded by an explicit label (avoids catching ages, bp, etc.)
const LABELED_DOC_RE =
  /\b(?:DNI|CE|CUI|RUT|CURP|SSN|NIF|CI|RG|pasaporte|passport)[.\s:#]*[\dA-Z\-]{5,15}\b/gi;

// Name declarations: "me llamo X", "mi nombre es X", etc.
const NAME_DECL_RE =
  /(?:me llamo|mi nombre es|llaman?(?:me)?|soy (?:el|la) paciente|my name is)\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{1,}(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{1,}){0,3}/gi;

export function sanitizePhiForLlm(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(LABELED_DOC_RE, '[ID]')
    .replace(INTL_PHONE_RE, '[PHONE]')
    .replace(LABELED_PHONE_RE, '[PHONE]')
    .replace(NAME_DECL_RE, 'el consultante');
}
