export function sanitizeRuntimeString(value: unknown, max = 500): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}\s.,:;!?%()/_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function sanitizeRuntimeUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:") return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

