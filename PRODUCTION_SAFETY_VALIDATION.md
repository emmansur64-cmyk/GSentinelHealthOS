# PRODUCTION SAFETY VALIDATION

## Estado anterior

Las fases 3 a 8 dejaron capas modulares con flags apagados, pero no existia una capa global de seguridad operacional para impedir activacion accidental.

La auditoria encontro flags por capa y shadow/dry-run operativos existentes en algunos flujos, pero no un kill switch global para las capas IA evolutivas.

## Estado nuevo

Se creo:

- `MetaBrain/production-safety`
- `MetaBrain/production_safety_py`

Ambas capas son paralelas, no invasivas y no conectadas al runtime.

## Global flags

- `AI_RUNTIME_ENABLED=false`
- `AI_RUNTIME_SHADOW_MODE=true`
- `AI_RUNTIME_DRY_RUN=true`
- `AI_RUNTIME_KILL_SWITCH=true`
- `AI_RUNTIME_SAFE_FALLBACK=true`
- `AI_RUNTIME_BLOCKING_ENABLED=false`
- `SEMANTIC_MEMORY_ENABLED=false`
- `MEDICAL_VISION_ENABLED=false`
- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `HUMAN_REVIEW_ENABLED=false`
- `CLINICAL_CONFIDENCE_ENABLED=false`
- `OBSERVABILITY_ENABLED=false`

No se modificaron archivos `.env`.

## Kill switch

El kill switch tiene prioridad:

- si `AI_RUNTIME_KILL_SWITCH=true`, el runtime IA queda bloqueado por contrato;
- no borra datos;
- no reinicia servicios;
- no rompe runtime actual;
- requiere safe fallback.

## Dry-run

`AI_RUNTIME_DRY_RUN=true` por defecto:

- permite evaluacion futura sin efectos;
- no escribe persistencia productiva;
- no llama providers externos;
- no bloquea respuestas reales;
- no modifica estado clinico.

## Shadow mode

`AI_RUNTIME_SHADOW_MODE=true` por defecto:

- permite evaluacion paralela futura;
- no cambia output real;
- no activa enforcement.

## Safe fallback

`buildSafeFallback` / `build_safe_fallback` devuelve:

- `continue_existing_runtime_flow`;
- no bloquea agenda;
- no bloquea WhatsApp;
- no bloquea login;
- no bloquea APIs criticas.

## Startup validation

`validateProductionSafetyStartup` / `validate_production_safety_startup` detecta:

- runtime activo sin kill switch;
- medical vision sin human review;
- confidence blocking sin review;
- observability export con PHI permitido.

No detiene runtime actual porque no esta conectado.

## Activation policy

Cada capa queda marcada como no activable en produccion desde Fase 9. La politica exige:

- flags explicitos;
- documentos de safety;
- rollback plan;
- validation report;
- clinical safety review;
- PHI review;
- rollback drill.

## Health checks

`buildProductionSafetyHealth` / `build_production_safety_health` cubre:

- memory,
- imaging,
- providers,
- review,
- confidence,
- observability,
- production-safety.

## Archivos creados

- `MetaBrain/production-safety/*`
- `MetaBrain/production_safety_py/*`
- `PRODUCTION_SAFETY_VALIDATION.md`
- `PRODUCTION_SAFETY_MODEL.md`
- `PRODUCTION_SAFETY_ROLLBACK_PLAN.md`
- `GLOBAL_AI_FLAGS_REFERENCE.md`

## Archivos modificados

Ningun archivo existente de runtime fue modificado.

## Validaciones ejecutadas

- `rg` sobre `MetaBrain` para revisar flags actuales, shadow mode, dry-run, kill switch, safe fallback y blocking.
- `python -m compileall MetaBrain\production_safety_py` OK.
- Typecheck focal TS con `tsc --noEmit` sobre `MetaBrain\production-safety` OK.
- `npm run build` en `MetaBrain` OK.
- `git diff --name-only -- MetaBrain\production-safety MetaBrain\production_safety_py PRODUCTION_SAFETY_VALIDATION.md PRODUCTION_SAFETY_MODEL.md PRODUCTION_SAFETY_ROLLBACK_PLAN.md GLOBAL_AI_FLAGS_REFERENCE.md` ejecutado. No mostro salida porque los archivos de Fase 9 estan sin trackear.
- `git status --short -- ...` ejecutado y mostro los archivos nuevos/no trackeados de Fase 9.

## Riesgos pendientes

- La capa no esta conectada al runtime por diseno.
- No hay enforcement real.
- No hay lectura centralizada de `.env` real.
- Activacion futura requiere revision formal de seguridad.

## Rollback

Mantener flags apagados o eliminar:

- `MetaBrain/production-safety`
- `MetaBrain/production_safety_py`
- documentos Fase 9
