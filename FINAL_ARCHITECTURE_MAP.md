# FINAL ARCHITECTURE MAP

## Estado final

La etapa arquitectonica creo capas formales paralelas para evolucionar MetaBrain/GSentinelHealthOS hacia una plataforma IA clinica controlada. Ninguna capa nueva esta conectada al runtime real.

## Runtime actual

El runtime actual sigue compuesto por:

- servicios Nest/Python existentes de MetaBrain,
- reglas y guardrails actuales,
- fallback defensivo,
- pipelines existentes de memoria, observabilidad y health,
- integraciones existentes de panel/chat cuando aplican.

No se cambiaron endpoints ni contratos API en Fases 1 a 10.

## Capas creadas

| Capa | Ruta TS | Ruta Python | Responsabilidad | Estado |
| --- | --- | --- | --- | --- |
| Semantic Memory | `MetaBrain/memory` | `MetaBrain/memory_py` | Contrato de memoria semantica, adapter JSONL, sanitizer, audit | Paralela, apagada |
| Image Intelligence | `MetaBrain/imaging` | `MetaBrain/imaging_py` | Ingestion, metadata, modality, confidence, legacy adapter | Paralela, apagada |
| Provider Router | `MetaBrain/providers` | `MetaBrain/providers_py` | Provider contracts, router, fallback, sanitizer, health | Paralela, apagada |
| Human Review | `MetaBrain/review` | `MetaBrain/review_py` | Queue, estados, escalation, audit, blocking recommendation | Paralela, apagada |
| Clinical Confidence | `MetaBrain/confidence` | `MetaBrain/confidence_py` | Confidence, uncertainty, hallucination risk, safe display | Paralela, apagada |
| Observability | `MetaBrain/observability` | `MetaBrain/observability_py` | Trace, lineage, metrics, drift, telemetry sanitizer | Paralela, apagada |
| Production Safety | `MetaBrain/production-safety` | `MetaBrain/production_safety_py` | Kill switch, dry-run, startup guard, rollback registry | Paralela, apagada |

## Runtime futuro previsto

La integracion futura deberia seguir esta secuencia:

1. Production Safety como guard global.
2. Observability en shadow mode.
3. Provider Router en shadow sin llamadas externas nuevas.
4. Clinical Confidence en shadow.
5. Human Review no bloqueante.
6. Semantic Memory en read-only/shadow.
7. Imaging metadata-only compatible.
8. Activaciones parciales con rollback por capa.

## Feature flags

Todos los flags experimentales quedan documentados con default seguro en `GLOBAL_AI_FLAGS_REFERENCE.md`.

Flags globales criticos:

- `AI_RUNTIME_ENABLED=false`
- `AI_RUNTIME_KILL_SWITCH=true`
- `AI_RUNTIME_DRY_RUN=true`
- `AI_RUNTIME_SHADOW_MODE=true`
- `AI_RUNTIME_BLOCKING_ENABLED=false`

## Safety boundaries

- No diagnostico definitivo.
- No aprendizaje autonomo.
- No multimodalidad medica activa.
- No DICOM activo.
- No vector DB activo.
- No enforcement clinico activo.
- No telemetry externa activa.
- No PHI a providers externos.

## Trust boundaries

- Providers externos son no confiables por defecto.
- PHI no puede salir sin politica explicita.
- Imagen medica requiere revision humana antes de interpretacion clinica.
- Confidence score no equivale a certeza medica.
- Observability solo debe transportar summaries sanitizados.

## Adapters

Adapters creados o preparados:

- JSONL memory adapter.
- Legacy image metadata adapter.
- Provider adapters disabled-by-default.
- Human review in-memory queue.
- Confidence engine in-memory audit.
- Observability in-memory event bus.
- Production safety registry.

## Acoplamientos pendientes detectados

- `MetaBrain/core/layer-registry.ts` conserva algunos nombres de flags de Fase 2 que no coinciden con flags consolidados posteriores:
  - `AI_PROVIDER_ROUTER_ENABLED` vs `LLM_PROVIDER_ROUTER_ENABLED`
  - `CLINICAL_REVIEW_QUEUE_ENABLED` vs `HUMAN_REVIEW_ENABLED`
  - `CLINICAL_CONFIDENCE_ENGINE_ENABLED` vs `CLINICAL_CONFIDENCE_ENABLED`
- Existe observabilidad Python operativa bajo `MetaBrain/metabrain/observability`, separada de la capa formal `MetaBrain/observability`.
- Las capas formales no estan registradas en DI/runtime.
- La carpeta `MetaBrain/imaging` aparece sin trackear en Git en esta sesion; el cierre solo ajusto un guard de typecheck en `image-metadata-extractor.ts`.

## Roadmap de integracion futura

Ver `FINAL_RUNTIME_INTEGRATION_ROADMAP.md`.
