from .types import EvidenceEvaluation, HallucinationRisk, ProviderConsistencyResult


def calculate_uncertainty_score(
    evidence: EvidenceEvaluation,
    provider_consistency: ProviderConsistencyResult,
    hallucination_risk: HallucinationRisk,
) -> float:
    uncertainty = ((1 - evidence.evidence_completeness) + (1 - provider_consistency.consistency_score)) / 2
    if hallucination_risk.risk_level == "high":
        uncertainty += 0.15
    if hallucination_risk.risk_level == "critical":
        uncertainty += 0.25
    return round(max(0.0, min(1.0, uncertainty)), 3)
