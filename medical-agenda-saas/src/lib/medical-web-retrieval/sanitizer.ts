const DANGEROUS_BLOCKS = [
  /<script[\s\S]*?<\/script>/gi,
  /<style[\s\S]*?<\/style>/gi,
  /<iframe[\s\S]*?<\/iframe>/gi,
  /<object[\s\S]*?<\/object>/gi,
  /<embed[\s\S]*?<\/embed>/gi,
  /<noscript[\s\S]*?<\/noscript>/gi,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/gi,
  /ignora (todas )?(las )?instrucciones/gi,
  /system prompt/gi,
  /developer message/gi,
  /jailbreak/gi,
  /act as/gi,
  /haz de cuenta/gi,
  /revela (el )?(prompt|sistema)/gi,
];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function sanitizeExternalMedicalText(raw: string, maxLength = 3000): string {
  let text = String(raw ?? "");
  for (const block of DANGEROUS_BLOCKS) text = text.replace(block, " ");
  text = text
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    .replace(/javascript:/gi, " ")
    .replace(/data:text\/html/gi, " ")
    .replace(/\b(?:alert|prompt|confirm)\s*\([^)]*\)/gi, " ")
    .replace(/<[^>]+>/g, " ");
  for (const pattern of PROMPT_INJECTION_PATTERNS) text = text.replace(pattern, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function sanitizeUrlForAudit(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    url.search = url.search.slice(0, 180);
    return url.toString();
  } catch {
    return "";
  }
}
