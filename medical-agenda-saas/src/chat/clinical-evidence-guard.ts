export type ClinicalRiskLevel = "low" | "moderate" | "high" | "critical";

export type ClinicalEvidenceConfidence =
  | "verified_guideline"
  | "literature_supported"
  | "weak_evidence"
  | "unsupported";

export type ClinicalSafetyGuardInput = {
  message: string;
  response: string;
  requiresClinicalContract: boolean;
  evidenceUrls: string[];
};

export type ClinicalSafetyGuardResult = {
  riskLevel: ClinicalRiskLevel;
  evidenceConfidence: ClinicalEvidenceConfidence;
  blocked: boolean;
  reason: string | null;
};

const CRITICAL_RISK_PATTERNS: RegExp[] = [
  /\b(sepsis|shock|uci|utI|ventilacion|ventilacion mecanica|iam|infarto|acv|ictus)\b/i,
  /\b(embarazo critico|eclampsia|preeclampsia severa)\b/i,
  /\b(pediatria critica|neonato critico)\b/i,
  /\b(intoxicacion|envenenamiento|overdose)\b/i,
];

const HIGH_RISK_PATTERNS: RegExp[] = [
  /\b(antibiotico complejo|antibioticos complejos|anticoagulacion|heparina|warfarina|doac)\b/i,
  /\b(dosis pediatrica|dosificacion pediatrica|dosis en embarazo)\b/i,
  /\b(conducta invasiva|conducta quirurgica|procedimiento invasivo)\b/i,
];

const VERIFIED_GUIDELINE_DOMAINS = [
  "who.int",
  "cdc.gov",
  "nih.gov",
  "nice.org.uk",
  "idsociety.org",
  "escardio.org",
  "heart.org",
  "pubmed.ncbi.nlm.nih.gov",
];

function containsAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyClinicalRiskLevel(text: string): ClinicalRiskLevel {
  if (containsAny(CRITICAL_RISK_PATTERNS, text)) return "critical";
  if (containsAny(HIGH_RISK_PATTERNS, text)) return "high";
  if (/\b(paciente|diagnostico|tratamiento|farmaco|medicamento|dosis|red flags)\b/i.test(text)) {
    return "moderate";
  }
  return "low";
}

function hostFromUrl(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function classifyEvidenceConfidence(riskLevel: ClinicalRiskLevel, evidenceUrls: string[]): ClinicalEvidenceConfidence {
  if (evidenceUrls.length === 0) {
    return riskLevel === "low" ? "weak_evidence" : "unsupported";
  }

  const hosts = evidenceUrls.map(hostFromUrl).filter((host): host is string => Boolean(host));
  const hasVerifiedGuideline = hosts.some((host) =>
    VERIFIED_GUIDELINE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`)),
  );

  if (hasVerifiedGuideline) return "verified_guideline";
  if (hosts.length > 0) return "literature_supported";
  return "weak_evidence";
}

function mustBlockByPolicy(input: {
  riskLevel: ClinicalRiskLevel;
  evidenceConfidence: ClinicalEvidenceConfidence;
  requiresClinicalContract: boolean;
}): { blocked: boolean; reason: string | null } {
  if (!input.requiresClinicalContract) {
    return { blocked: false, reason: null };
  }

  if (input.riskLevel === "critical" && input.evidenceConfidence !== "verified_guideline") {
    return {
      blocked: true,
      reason: "critical_risk_without_verified_guideline",
    };
  }

  if (
    input.riskLevel === "high" &&
    (input.evidenceConfidence === "unsupported" || input.evidenceConfidence === "weak_evidence")
  ) {
    return {
      blocked: true,
      reason: "high_risk_without_strong_evidence",
    };
  }

  return { blocked: false, reason: null };
}

export function evaluateClinicalSafetyGuard(input: ClinicalSafetyGuardInput): ClinicalSafetyGuardResult {
  const text = `${input.message}\n${input.response}`;
  const riskLevel = classifyClinicalRiskLevel(text);
  const evidenceConfidence = classifyEvidenceConfidence(riskLevel, input.evidenceUrls);
  const policy = mustBlockByPolicy({
    riskLevel,
    evidenceConfidence,
    requiresClinicalContract: input.requiresClinicalContract,
  });

  return {
    riskLevel,
    evidenceConfidence,
    blocked: policy.blocked,
    reason: policy.reason,
  };
}

