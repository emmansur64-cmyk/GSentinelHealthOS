import { getMedicalWebRetrievalConfig } from "./config";
import { evaluateMedicalWebRetrievalPolicy } from "./policy";
import { MEDICAL_WEB_ALLOWLIST, isAllowedMedicalSourceUrl } from "./source-allowlist";
import { sanitizeUrlForAudit } from "./sanitizer";
import { extractEvidenceFromDocument } from "./extractor";
import { buildMedicalWebQuery } from "./query-builder";
import type {
  MedicalWebEvidenceFragment,
  MedicalWebRejectedSource,
  MedicalWebRetrievalInput,
  MedicalWebRetrievalResult,
} from "./types";

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
        "User-Agent": "GSentinelHealthOS-Lab-MedicalRetrieval/1.0",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) throw new Error(`redirect_blocked_${response.status}`);
    if (response.url && !isAllowedMedicalSourceUrl(response.url)) {
      throw new Error("redirected_to_non_allowlisted_source");
    }
    if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function retrieveMedicalWebEvidence(input: MedicalWebRetrievalInput): Promise<MedicalWebRetrievalResult | null> {
  const config = getMedicalWebRetrievalConfig();
  if (!config.enabled) return null;

  const policy = evaluateMedicalWebRetrievalPolicy(input.message);
  if (!policy.shouldRetrieve) return null;

  const query = buildMedicalWebQuery({ message: input.message, clinicalState: input.clinicalState });
  if (!query) return null;

  const sourcesConsulted: string[] = [];
  const sourcesRejected: MedicalWebRejectedSource[] = [];
  const evidence: MedicalWebEvidenceFragment[] = [];

  const sources = MEDICAL_WEB_ALLOWLIST.slice(0, Math.max(config.maxSources * 2, config.maxSources));
  for (const source of sources) {
    if (evidence.length >= config.maxSources) break;

    const url = source.searchUrl(query);
    const auditUrl = sanitizeUrlForAudit(url);
    if (!isAllowedMedicalSourceUrl(url)) {
      sourcesRejected.push({ url: auditUrl, reason: "not_allowlisted_or_not_https" });
      continue;
    }

    sourcesConsulted.push(source.domain);
    try {
      const rawText = await fetchWithTimeout(url, config.timeoutMs);
      const fragment = extractEvidenceFromDocument({
        source,
        url: auditUrl,
        fetchedAt: new Date().toISOString(),
        rawText,
      });
      if (fragment) evidence.push(fragment);
    } catch (error) {
      sourcesRejected.push({
        url: auditUrl,
        reason: error instanceof Error ? error.message.slice(0, 120) : "fetch_error",
      });
    }
  }

  return {
    used: evidence.length > 0,
    query,
    activatedBy: policy.reasons,
    sourcesConsulted,
    sourcesRejected,
    evidence,
    fallback: evidence.length === 0,
    error: evidence.length === 0 ? "no_evidence_fragments" : undefined,
  };
}
