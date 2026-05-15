# OBSERVABILITY VALIDATION

## Estado anterior

MetaBrain ya tenia logging, health checks y metricas distribuidas en servicios Nest/Python, pero no existia una capa transversal formal para trace, correlation, lineage, metric contracts, drift y auditoria clinica unificada.

No existia `MetaBrain/observability` ni `MetaBrain/observability_py`.

## Estado nuevo

Se creo una capa paralela y no invasiva:

- `MetaBrain/observability`: contratos TypeScript.
- `MetaBrain/observability_py`: contratos Python equivalentes.

La capa no esta conectada al runtime, no exporta telemetry externa y no reemplaza logging actual.

## Architecture

La arquitectura incluye:

- trace engine,
- trace context,
- correlation ids,
- structured events,
- request lineage,
- metric contracts,
- drift signals,
- health snapshot,
- observability audit.

## Trace model

`TraceContext` define:

- `trace_id`
- `correlation_id`
- `parent_trace_id`
- `tenant_id`
- `request_type`
- `source_layer`
- `created_at`

## Lineage model

`RequestLineage` reconstruye:

- providers usados,
- memoria accedida,
- imaging usado,
- review activado,
- confidence generado,
- escalaciones,
- fallbacks,
- bloqueos,
- estado final.

## Metrics model

Se crearon contratos para:

- provider metrics,
- confidence metrics,
- review metrics,
- imaging metrics,
- memory metrics,
- safety metrics,
- escalation metrics,
- performance metrics.

## Drift model

El detector defensivo identifica:

- aumento de fallbacks,
- baja confianza repetida,
- providers degradados,
- picos de escalacion humana,
- conflictos multimodales.

No usa ML real ni toma decisiones autonomas.

## Structured logging

`buildStructuredLog` y `build_structured_log` producen eventos JSON estructurados con:

- severity,
- trace_id,
- correlation_id,
- safety_flags,
- payload sanitizado.

No reemplazan `console`, logger Nest ni logger Python existente.

## Telemetry safety

`telemetry-sanitizer` y `telemetry_sanitizer` redactan:

- API keys,
- tokens,
- passwords,
- secrets,
- emails,
- telefonos,
- imagenes o payloads visuales,
- objetos complejos como summary-only.

## Flags documentados

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

No se modificaron archivos `.env`.

## Archivos creados

- `MetaBrain/observability/*`
- `MetaBrain/observability_py/*`
- `OBSERVABILITY_VALIDATION.md`
- `OBSERVABILITY_SAFETY_MODEL.md`
- `OBSERVABILITY_ROLLBACK_PLAN.md`

## Archivos modificados

Ningun archivo existente de runtime fue modificado.

## Validaciones ejecutadas

- `rg` sobre `MetaBrain` para revisar logging/tracing/telemetry/metrics/health/fallback existentes.
- `python -m compileall MetaBrain\observability_py` OK.
- Typecheck focal TS con `tsc --noEmit` sobre `MetaBrain\observability` OK.
- `npm run build` en `MetaBrain` OK.
- `git diff --name-only -- MetaBrain\observability MetaBrain\observability_py OBSERVABILITY_VALIDATION.md OBSERVABILITY_SAFETY_MODEL.md OBSERVABILITY_ROLLBACK_PLAN.md` ejecutado. No mostro salida porque los archivos de Fase 8 estan sin trackear.
- `git status --short -- ...` ejecutado y mostro los archivos nuevos/no trackeados de Fase 8.

## Riesgos pendientes

- Sin persistencia durable de eventos.
- Sin dashboards.
- Sin exporters externos.
- Sin integracion runtime.
- Drift detector basado en reglas simples.

## Rollback

Como la capa no esta conectada al runtime, rollback seguro:

1. Mantener flags apagados.
2. Eliminar `MetaBrain/observability`.
3. Eliminar `MetaBrain/observability_py`.
4. Eliminar documentos Fase 8.
