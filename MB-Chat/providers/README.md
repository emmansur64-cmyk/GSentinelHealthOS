# Provider Router Layer

Phase 5 introduces a controlled provider router boundary for Groq, OpenAI, Gemini, local models and future medical providers.

## Status

- Runtime connected: no
- Default enabled: no
- Shadow mode: yes
- Multimodal real inference: disabled
- External image provider calls: disabled
- PHI allowed: no
- Observable behavior change: none intended

## Responsibilities

- Keep provider adapters separate from clinical logic.
- Centralize provider capabilities, health, scoring, timeout/retry contracts and fallback responses.
- Sanitize request context before any future provider call.
- Block PHI by default.
- Prepare structured output parsing without trusting free-form LLM output.

## Flags

- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `LLM_PROVIDER_SHADOW_MODE=true`
- `LLM_PROVIDER_FALLBACK_ENABLED=false`
- `LLM_PROVIDER_HEALTHCHECK_ENABLED=true`
- `LLM_PROVIDER_STRUCTURED_OUTPUT_ENABLED=false`
- `LLM_PROVIDER_MULTIMODAL_ENABLED=false`
- `LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED=false`
- `LLM_PROVIDER_PHI_ALLOWED=false`
