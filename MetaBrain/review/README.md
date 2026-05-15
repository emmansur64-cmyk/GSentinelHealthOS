# Human Review Layer

Fase 6 adds a formal, non-invasive clinical human review layer for MetaBrain.

## Scope

- Typed clinical review cases and statuses.
- In-memory review queue contract for controlled integration tests and future adapters.
- Confidence gating for low confidence, image, multimodal, high risk, provider conflict, and hallucination risk signals.
- Escalation, routing, blocking recommendation, decision, and audit primitives.
- No runtime enforcement is connected in this phase.

## Feature flags

Required defaults, documented only:

- `HUMAN_REVIEW_ENABLED=false`
- `HUMAN_REVIEW_SHADOW_MODE=true`
- `HUMAN_REVIEW_BLOCKING_ENABLED=false`
- `HUMAN_REVIEW_IMAGE_REQUIRED=true`
- `HUMAN_REVIEW_LOW_CONFIDENCE_REQUIRED=true`
- `HUMAN_REVIEW_MULTIMODAL_REQUIRED=true`
- `HUMAN_REVIEW_HIGH_RISK_REQUIRED=true`
- `HUMAN_OVERRIDE_ENABLED=false`

## Safety posture

This layer can describe what should be reviewed or blocked, but does not block production output by itself. Any future integration must keep AI, human review, audit, and clinical rules separated.

## Rollback

Because the layer is not connected to runtime code, rollback is removal of `MetaBrain/review`, `MetaBrain/review_py`, and Fase 6 documentation, or leaving flags disabled.
