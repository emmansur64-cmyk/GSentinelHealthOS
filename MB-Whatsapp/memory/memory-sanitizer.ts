import type { MemorySanitizationResult } from "./types";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const DOCUMENT_RE = /\b(?:dni|documento|passport|pasaporte|ssn|cuit|cuil|rut)\s*[:#-]?\s*[A-Z0-9.\-]{5,}\b/gi;
const API_KEY_RE = /\b(?:api[_-]?key|secret|token|password|passwd|authorization|bearer)\s*[:=]\s*["']?[^"'\s,;]{8,}/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const HTML_RE = /<[^>]*>/g;
const URL_WITH_QUERY_RE = /\bhttps?:\/\/[^\s?#]+(?:\?[^\s]*)?/gi;

const SENSITIVE_METADATA_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "set-cookie",
  "address",
  "street",
  "gps",
  "lat",
  "latitude",
  "lng",
  "longitude",
];

export class MemorySanitizer {
  sanitizeContent(content: string): MemorySanitizationResult {
    if (!content || !content.trim()) {
      return {
        sanitized_content: "",
        redactions: [],
        blocked: true,
        reason: "empty_content",
      };
    }

    const redactions: string[] = [];
    let sanitized = content;

    const replace = (regex: RegExp, marker: string): void => {
      sanitized = sanitized.replace(regex, () => {
        redactions.push(marker);
        return `[REDACTED_${marker}]`;
      });
    };

    replace(HTML_RE, "HTML");
    replace(JWT_RE, "JWT");
    replace(API_KEY_RE, "SECRET");
    replace(EMAIL_RE, "EMAIL");
    replace(DOCUMENT_RE, "DOCUMENT");
    replace(PHONE_RE, "PHONE");
    sanitized = sanitized.replace(URL_WITH_QUERY_RE, (url) => {
      redactions.push("URL_QUERY");
      return url.split("?")[0];
    });

    sanitized = sanitized.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

    return {
      sanitized_content: sanitized,
      redactions: [...new Set(redactions)],
      blocked: false,
    };
  }

  sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const normalizedKey = key.toLowerCase();
      if (SENSITIVE_METADATA_KEYS.some((sensitive) => normalizedKey.includes(sensitive))) {
        sanitized[key] = "[REDACTED_METADATA]";
        continue;
      }
      if (typeof value === "string") {
        sanitized[key] = this.sanitizeContent(value).sanitized_content;
        continue;
      }
      sanitized[key] = value;
    }

    return sanitized;
  }
}

export const defaultMemorySanitizer = new MemorySanitizer();
