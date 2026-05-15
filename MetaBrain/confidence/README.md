# Clinical Confidence Layer

Fase 7 creates a controlled and auditable Clinical Confidence Engine for MetaBrain.

## Scope

- Confidence scoring.
- Uncertainty scoring.
- Evidence completeness.
- Provider consistency checks.
- Multimodal conflict detection.
- Hallucination risk estimation.
- Escalation recommendation.
- Safe-display evaluation.
- Audit events.

## Runtime status

The layer is not connected to current runtime code. It does not block responses, call providers, modify UI, or change endpoint behavior.

## Feature flags

Documented defaults:

- `CLINICAL_CONFIDENCE_ENABLED=false`
- `CLINICAL_CONFIDENCE_SHADOW_MODE=true`
- `CLINICAL_CONFIDENCE_BLOCKING_ENABLED=false`
- `CLINICAL_CONFIDENCE_MULTIMODAL_ENABLED=false`
- `CLINICAL_CONFIDENCE_PROVIDER_CONSISTENCY_ENABLED=true`
- `CLINICAL_CONFIDENCE_HALLUCINATION_CHECK_ENABLED=true`
- `CLINICAL_CONFIDENCE_SAFE_DISPLAY_ENABLED=false`
- `CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED=false`

## Safety posture

Scores are deterministic, conservative, and explainable. They do not represent diagnostic certainty and must not replace medical judgment.
