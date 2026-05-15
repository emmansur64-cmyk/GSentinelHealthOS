# LAB ENV RUNTIME CONFIG

Fecha: 2026-05-12
Archivo: `.env.runtime_lab`

## Objetivo

Configurar ejecución runtime en laboratorio aislado, sin heredar secretos ni endpoints de producción.

## Variables incluidas

- Safety runtime:
- `AI_RUNTIME_ENABLED=false`
- `AI_RUNTIME_KILL_SWITCH=true`
- `AI_RUNTIME_DRY_RUN=true`
- `AI_RUNTIME_SHADOW_MODE=true`
- `AI_RUNTIME_SAFE_FALLBACK=true`
- `AI_RUNTIME_BLOCKING_ENABLED=false`
- `AI_RUNTIME_EXTERNAL_CALLS_ALLOWED=false`
- `AI_RUNTIME_PHI_ALLOWED=false`

- Observabilidad segura:
- `OBSERVABILITY_ENABLED=true`
- `OBSERVABILITY_SHADOW_MODE=true`
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`
- `OBSERVABILITY_PHI_ALLOWED=false`
- `OBSERVABILITY_EVENT_BUS_MAX_EVENTS=1000`
- `OBSERVABILITY_EVENT_BUS_TTL_ENABLED=false`

- Features clínicas/proveedores desactivadas:
- `SEMANTIC_MEMORY_ENABLED=false`
- `MEDICAL_VISION_ENABLED=false`
- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `HUMAN_REVIEW_ENABLED=false`
- `CLINICAL_CONFIDENCE_ENABLED=false`

- Conexiones lab explícitas:
- `DATABASE_URL=postgresql://gsentinel_lab:gsentinel_lab@127.0.0.1:55432/gsentinel_runtime_lab`
- `REDIS_URL=redis://127.0.0.1:56379/0`

- Secretos sintéticos mínimos para startup de settings:
- `JWT_SECRET=runtime-lab-jwt-secret-not-prod`
- `GATEWAY_API_KEY=runtime-lab-gateway-key-not-prod`
- `BRAIN_API_KEY=runtime-lab-brain-key-not-prod`

## Garantías de seguridad

- No se modificó `.env` existente.
- No se incluyeron tokens reales ni API keys reales.
- Host/puertos fijados a loopback y no estándar (`127.0.0.1:55432`, `127.0.0.1:56379`).
- TTL del event bus se mantiene inicialmente apagado.
