# Observability Layer

Fase 8 creates a controlled observability and clinical traceability layer.

## Scope

- Trace context and correlation identifiers.
- In-memory trace engine and request lineage.
- Structured log event contracts with PHI/secret sanitization.
- Provider, confidence, review, imaging, memory, safety, escalation, and performance metric contracts.
- Defensive drift signals.
- Health snapshot and observability audit events.

## Runtime status

This layer is not connected to current runtime logging, dashboards, collectors, providers, or production telemetry.

## Feature flags

- `OBSERVABILITY_ENABLED=false`
- `OBSERVABILITY_SHADOW_MODE=true`
- `OBSERVABILITY_STRUCTURED_LOGGING_ENABLED=false`
- `OBSERVABILITY_TRACE_ENGINE_ENABLED=false`
- `OBSERVABILITY_PROVIDER_METRICS_ENABLED=false`
- `OBSERVABILITY_CONFIDENCE_METRICS_ENABLED=false`
- `OBSERVABILITY_REVIEW_METRICS_ENABLED=false`
- `OBSERVABILITY_MULTIMODAL_METRICS_ENABLED=false`
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`
- `OBSERVABILITY_PHI_ALLOWED=false`

## Safety

Telemetry payloads are summary-only by default. Secrets, tokens, API keys, images, and likely PHI are redacted.
