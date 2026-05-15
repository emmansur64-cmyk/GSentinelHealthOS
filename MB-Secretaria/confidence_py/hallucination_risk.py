from .types import EvidenceEvaluation, HallucinationRisk, ProviderConsistencyResult


def estimate_hallucination_risk(
    evidence: EvidenceEvaluation,
    provider_consistency: ProviderConsistencyResult,
    multimodal_conflict_detected: bool,
) -> HallucinationRisk:
    score = 0.0
    if evidence.evidence_completeness < 0.55:
        score += 0.35
    if provider_consistency.conflicts_detected:
        score += 0.25
    if provider_consistency.consistency_score < 0.5:
        score += 0.2
    if multimodal_conflict_detected:
        score += 0.25
    if evidence.conflict_signals:
        score += 0.15
    bounded = min(1.0, score)
    risk_level = "critical" if bounded >= 0.85 else "high" if bounded >= 0.65 else "medium" if bounded >= 0.35 else "low"
    return HallucinationRisk(
        risk_level=risk_level,  # type: ignore[arg-type]
        unsupported_claims_detected=evidence.evidence_completeness < 0.55,
        evidence_missing=bool(evidence.missing_evidence),
        multimodal_inconsistency=multimodal_conflict_detected,
        provider_divergence=provider_consistency.conflicts_detected,
        escalation_required=risk_level in {"high", "critical"},
    )
