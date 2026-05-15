export type StructuredOutputResult = {
  ok: boolean;
  value?: unknown;
  error?: string;
};

export function parseStructuredJson(raw: string): StructuredOutputResult {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function validateStructuredObject(value: unknown, requiredKeys: string[] = []): StructuredOutputResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "structured_output_not_object" };
  }
  const record = value as Record<string, unknown>;
  const missing = requiredKeys.filter((key) => !(key in record));
  if (missing.length) {
    return { ok: false, error: `missing_keys:${missing.join(",")}` };
  }
  return { ok: true, value };
}
