import { sanitizeExternalMedicalText } from "./sanitizer";
import type { MedicalWebEvidenceFragment, MedicalWebRawDocument } from "./types";

function extractTitle(rawHtml: string, fallback: string): string {
  const title = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return sanitizeExternalMedicalText(title || fallback, 180) || fallback;
}

function extractPublishedDate(rawHtml: string): string | null {
  const patterns = [
    /(?:datePublished|article:published_time|citation_publication_date)["'\s:=]+([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2})/i,
    /\b(20[0-9]{2}|19[0-9]{2})\b/,
  ];
  for (const pattern of patterns) {
    const match = rawHtml.match(pattern)?.[1];
    if (match) return match;
  }
  return null;
}

function selectFragment(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((item) => item.trim().length > 40);
  const selected = sentences.slice(0, 3).join(" ");
  return (selected || text).slice(0, 700).trim();
}

export function extractEvidenceFromDocument(doc: MedicalWebRawDocument): MedicalWebEvidenceFragment | null {
  const sanitized = sanitizeExternalMedicalText(doc.rawText, 4000);
  if (sanitized.length < 80) return null;

  return {
    source: doc.source.label,
    sourceType: doc.source.type,
    title: extractTitle(doc.rawText, doc.source.label),
    url: doc.url,
    date: extractPublishedDate(doc.rawText),
    fragment: selectFragment(sanitized),
    confidence: doc.source.type === "organism" || doc.source.type === "science" ? "high" : "medium",
  };
}
