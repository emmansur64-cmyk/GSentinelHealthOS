function stripUnsafe(value: string, maxLength: number): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[{}[\]<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeDoctorContextString(value: unknown, maxLength = 160): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripUnsafe(value, maxLength);
  return cleaned || null;
}

export function sanitizeStringList(value: unknown, maxItems = 6, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeDoctorContextString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}
