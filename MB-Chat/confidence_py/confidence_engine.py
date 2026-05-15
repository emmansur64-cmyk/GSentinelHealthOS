from __future__ import annotations

from datetime import UTC, datetime

from .confidence_audit import InMemoryConfidenceAuditSink, create_confidence_audit_event
from .confidence_explainer import explain_confidence
from .confidence_flags import load_clinical_confidence_flags
from .confidence_policy import DEFAULT_CONFIDENCE_POLICY
from .confidence_score import calculate_confidence_score
from .escalation_recommendation import build_escalation_recommendation
from .evidence_evaluator import evaluate_evidence
from .hallucination_risk import estimate_hallucination_risk
from .multimodal_conflict import detect_multimodal_conflict
from .provider_consistency import evaluate_provider_consistency
from .safe_display import evaluate_safe_display
from .types import (
    ClinicalConfidenceFlags,
    ClinicalConfidenceInput,
    ClinicalConfidenceResult,
    ConfidencePolicy,
    HallucinationRisk,
    ProviderConsistencyResult,
)
from .uncertainty_score import calculate_uncertainty_score


class ClinicalConfidenceEngine:
    def __init__(
        self,
        flags: ClinicalConfidenceFlags | None = None,
        policy: ConfidencePolicy = DEFAULT_CONFIDENCE_POLICY,
        audit_sink: InMemoryConfidenceAuditSink | None = None,
    ) -> None:
        self.flags = flags or load_clinical_confidence_flags({})
        self.policy = policy
        self.audit_sink = audit_sink or InMemoryConfidenceAuditSink()

    def evaluate(self, item: ClinicalConfidenceInput) -> ClinicalConfidenceResult:
        evidence = evaluate_evidence(item)
        provider_consistency = (
            evaluate_provider_consistency(item.provider_outputs)
            if self.flags.provider_consistency_enabled
            else ProviderConsistencyResult(0, 1.0, False, [])
        )
        multimodal = detect_multimodal_conflict(item) if self.flags.multimodal_enabled else None
        hallucination = (
            estimate_hallucination_risk(evidence, provider_consistency, multimodal.multimodal_conflict_detected if multimodal else False)
            if self.flags.hallucination_check_enabled
            else HallucinationRisk("low", False, False, False, False, False)
        )
        uncertainty = calculate_uncertainty_score(evidence, provider_consistency, hallucination)
        confidence = calculate_confidence_score(evidence, provider_consistency, uncertainty, hallucination)
        escalation = build_escalation_recommendation(
            confidence,
            uncertainty,
            hallucination,
            evidence.evidence_completeness,
            provider_consistency.unresolved_conflicts,
            multimodal.conflicts if multimodal else [],
            self.policy,
        )
        safe_display = evaluate_safe_display(
            confidence,
            uncertainty,
            hallucination,
            escalation.escalation_recommended,
            self.flags,
            self.policy,
        )
        result = ClinicalConfidenceResult(
            trace_id=item.trace_id,
            confidence_score=confidence,
            uncertainty_score=uncertainty,
            hallucination_risk=hallucination,
            evidence_completeness=evidence.evidence_completeness,
            provider_consistency=provider_consistency,
            multimodal_conflict_detected=multimodal.multimodal_conflict_detected if multimodal else False,
            escalation_recommended=bool(self.flags.enabled and self.flags.auto_escalation_enabled and escalation.escalation_recommended),
            escalation_reason=escalation.escalation_reason,
            safe_to_display=safe_display.safe_to_display,
            display_restrictions=safe_display.display_restrictions,
            confidence_explanation=[],
            audit_ref=f"{item.trace_id}:clinical-confidence",
            created_at=datetime.now(UTC).isoformat(),
        )
        result.confidence_explanation = explain_confidence(result, evidence)
        self.audit_sink.append(create_confidence_audit_event(result))
        return result

    def audit_events(self):
        return self.audit_sink.list()
