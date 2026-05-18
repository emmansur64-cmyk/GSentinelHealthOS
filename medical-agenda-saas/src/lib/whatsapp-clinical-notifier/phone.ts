export function extractE164(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  return `${plus}${digits}`;
}

export function isValidArMobileE164(raw: string): boolean {
  const normalized = extractE164(raw);
  return /^\+549\d{8,12}$/.test(normalized);
}
