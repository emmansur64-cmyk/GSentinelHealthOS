const REDACTED = '[REDACTED]';

const SECRET_KEY_RE = /(authorization|bearer|token|api[_-]?key|apikey|secret|password|passwd|cookie|set-cookie)/i;
const IMAGE_KEY_RE = /(image[_-]?base64|base64[_-]?image|raw[_-]?image|image_bytes|dicom_bytes)/i;
const SECRET_VALUE_RE = /\b(?:api[_-]?key|secret|token|password|passwd|authorization|bearer)\s*[:=]\s*["']?[^"'\s,;]{4,}/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const DOCUMENT_RE = /\b(?:dni|documento|passport|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b/gi;

export function sanitizeForPersistence<T>(value: T): T {
  return sanitizeUnknown(value) as T;
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key] = shouldRedactByKey(key) ? REDACTED : sanitizeUnknown(child);
    }
    return output;
  }

  return value;
}

function shouldRedactByKey(key: string): boolean {
  return SECRET_KEY_RE.test(key) || IMAGE_KEY_RE.test(key);
}

function sanitizeString(value: string): string {
  return value
    .replace(JWT_RE, REDACTED)
    .replace(SECRET_VALUE_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED)
    .replace(DOCUMENT_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}
