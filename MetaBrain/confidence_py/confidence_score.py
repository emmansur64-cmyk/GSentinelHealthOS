from .types import EvidenceEvaluation, HallucinationRisk, ProviderConsistencyResult


def calculate_confidence_score(
    evidence: EvidenceEvaluation,
    provider_consistency: ProviderConsistencyResult,
    uncertainty_score: float,
    hallucination_risk: HallucinationRisk,
) -> float:
    score = evidence.evidence_completeness * 0.4 + provider_consistency.consistency_score * 0.35 + (1 - uncertainty_score) * 0.25
    if hallucination_risk.risk_level == "high":
        score -= 0.15
    if hallucination_risk.risk_level == "critical":
        score -= 0.25
    return round(max(0.0, min(1.0, score)), 3)
