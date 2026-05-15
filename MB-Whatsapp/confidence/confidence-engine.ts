import { createConfidenceAuditEvent, InMemoryConfidenceAuditSink } from "./confidence-audit";
import { explainConfidence } from "./confidence-explainer";
import { DEFAULT_CLINICAL_CONFIDENCE_FLAGS } from "./confidence-flags";
import { DEFAULT_CONFIDENCE_POLICY } from "./confidence-policy";
import { calculateConfidenceScore } from "./confidence-score";
import { buildEscalationRecommendation } from "./escalation-recommendation";
import { evaluateEvidence } from "./evidence-evaluator";
import { estimateHallucinationRisk } from "./hallucination-risk";
import { detectMultimodalConflict } from "./multimodal-conflict";
import { evaluateProviderConsistency } from "./provider-consistency";
import { evaluateSafeDisplay } from "./safe-display";
import { calculateUncertaintyScore } from "./uncertainty-score";
import type { ClinicalConfidenceFlags, ClinicalConfidenceInput, ClinicalConfidenceResult, ConfidencePolicy } from "./types";

export class ClinicalConfidenceEngine {
  constructor(
    private readonly flags: ClinicalConfidenceFlags = DEFAULT_CLINICAL_CONFIDENCE_FLAGS,
    private readonly policy: ConfidencePolicy = DEFAULT_CONFIDENCE_POLICY,
    private readonly auditSink = new InMemoryConfidenceAuditSink(),
  ) {}

  evaluate(input: ClinicalConfidenceInput): ClinicalConfidenceResult {
    const evidence = evaluateEvidence(input);
    const providerConsistency = this.flags.providerConsistencyEnabled
      ? evaluateProviderConsistency(input.provider_outputs)
      : { providers_compared: 0, consistency_score: 1, conflicts_detected: false, unresolved_conflicts: [] };
    const multimodal = this.flags.multimodalEnabled
      ? detectMultimodalConflict(input)
      : { multimodal_conflict_detected: false, conflicts: [] };
    const hallucinationRisk = this.flags.hallucinationCheckEnabled
      ? estimateHallucinationRisk({
          evidence,
          providerConsistency,
          multimodalConflictDetected: multimodal.multimodal_conflict_detected,
        })
      : {
          risk_level: "low" as const,
          unsupported_claims_detected: false,
          evidence_missing: false,
          multimodal_inconsistency: false,
          provider_divergence: false,
          escalation_required: false,
        };
    const uncertaintyScore = calculateUncertaintyScore({ evidence, providerConsistency, hallucinationRisk });
    const confidenceScore = calculateConfidenceScore({
      evidence,
      providerConsistency,
      uncertaintyScore,
      hallucinationRisk,
    });
    const escalation = buildEscalationRecommendation({
      confidenceScore,
      uncertaintyScore,
      hallucinationRisk,
      evidenceCompleteness: evidence.evidence_completeness,
      providerConflicts: providerConsistency.unresolved_conflicts,
      multimodalConflicts: multimodal.conflicts,
      policy: this.policy,
    });
    const safeDisplay = evaluateSafeDisplay({
      confidenceScore,
      uncertaintyScore,
      hallucinationRisk,
      escalationRecommended: escalation.escalation_recommended,
      flags: this.flags,
      policy: this.policy,
    });
    const baseResult = {
      trace_id: input.trace_id,
      confidence_score: confidenceScore,
      uncertainty_score: uncertaintyScore,
      hallucination_risk: hallucinationRisk,
      evidence_completeness: evidence.evidence_completeness,
      provider_consistency: providerConsistency,
      multimodal_conflict_detected: multimodal.multimodal_conflict_detected,
      escalation_recommended: this.flags.enabled && this.flags.autoEscalationEnabled ? escalation.escalation_recommended : false,
      escalation_reason: escalation.escalation_reason,
      safe_to_display: safeDisplay.safe_to_display,
      display_restrictions: safeDisplay.display_restrictions,
      audit_ref: `${input.trace_id}:clinical-confidence`,
      created_at: new Date().toISOString(),
    };
    const result: ClinicalConfidenceResult = {
      ...baseResult,
      confidence_explanation: explainConfidence({ result: baseResult, evidence }),
    };
    this.auditSink.append(createConfidenceAuditEvent(result));
    return result;
  }

  auditEvents() {
    return this.auditSink.list();
  }
}
