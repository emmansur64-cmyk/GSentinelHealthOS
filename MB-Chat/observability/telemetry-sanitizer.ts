import { DEFAULT_TELEMETRY_POLICY, type TelemetryPolicy } from "./telemetry-policy";

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]+/g,
  /(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[^"',\s]+/gi,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\+?\d[\d\s().-]{7,}\d/g,
];

function sanitizeString(value: string, policy: TelemetryPolicy): string {
  let output = value.slice(0, policy.maxStringLength);
  for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, "[REDACTED]");
  return output;
}

export function sanitizeTelemetryPayload(
  payload: Record<string, unknown>,
  policy: TelemetryPolicy = DEFAULT_TELEMETRY_POLICY,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload).slice(0, policy.maxPayloadKeys)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("image") || lowerKey.includes("password") || lowerKey.includes("token") || lowerKey.includes("secret")) {
      output[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      output[key] = sanitizeString(value, policy);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      output[key] = value;
    } else {
      output[key] = "[SUMMARY_ONLY]";
    }
  }
  return output;
}
