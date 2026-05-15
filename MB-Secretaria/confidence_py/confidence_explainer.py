from .types import ClinicalConfidenceResult, EvidenceEvaluation


def explain_confidence(result: ClinicalConfidenceResult, evidence: EvidenceEvaluation) -> list[str]:
    explanation: list[str] = []
    if result.provider_consistency.conflicts_detected:
        explanation.append("Low provider agreement or unresolved provider conflict.")
    if "retrieval_unavailable" in evidence.missing_evidence:
        explanation.append("Insufficient retrieval evidence.")
    if result.multimodal_conflict_detected:
        explanation.append("Multimodal signals are incomplete or conflicting.")
    if result.hallucination_risk.evidence_missing:
        explanation.append("Claims require stronger supporting evidence.")
    if result.uncertainty_score >= 0.7:
        explanation.append("High uncertainty from incomplete or conflicting signals.")
    if not explanation:
        explanation.append("Available signals are consistent enough for shadow confidence scoring.")
    return explanation
