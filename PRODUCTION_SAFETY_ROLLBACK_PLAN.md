# PRODUCTION SAFETY ROLLBACK PLAN

## Rollback global

Mantener o restaurar:

- `AI_RUNTIME_ENABLED=false`
- `AI_RUNTIME_KILL_SWITCH=true`
- `AI_RUNTIME_DRY_RUN=true`
- `AI_RUNTIME_SAFE_FALLBACK=true`
- `AI_RUNTIME_BLOCKING_ENABLED=false`

No modificar `.env` desde esta fase.

## Rollback por capa

- Semantic memory: `MEMORY_ROLLBACK_PLAN.md`
- Imaging: `IMAGE_ROLLBACK_PLAN.md`
- Provider router: `PROVIDER_ROLLBACK_PLAN.md`
- Human review: `HUMAN_REVIEW_ROLLBACK_PLAN.md`
- Clinical confidence: `CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md`
- Observability: `OBSERVABILITY_ROLLBACK_PLAN.md`
- Production safety: eliminar capa Fase 9 si no esta conectada.

## Flags a apagar

- `SEMANTIC_MEMORY_ENABLED=false`
- `MEDICAL_VISION_ENABLED=false`
- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `HUMAN_REVIEW_ENABLED=false`
- `CLINICAL_CONFIDENCE_ENABLED=false`
- `OBSERVABILITY_ENABLED=false`

## Archivos nuevos

- `MetaBrain/production-safety/`
- `MetaBrain/production_safety_py/`
- `PRODUCTION_SAFETY_VALIDATION.md`
- `PRODUCTION_SAFETY_MODEL.md`
- `PRODUCTION_SAFETY_ROLLBACK_PLAN.md`
- `GLOBAL_AI_FLAGS_REFERENCE.md`

## Archivos modificados

Ninguno existente de runtime.

## Comandos seguros de revision

```powershell
git status --short
git diff --name-only
python -m compileall MetaBrain\production_safety_py
```

## Advertencias

No ejecutar deploy, reinicios, migraciones, Docker, providers reales ni modificaciones `.env` para rollback documental.
