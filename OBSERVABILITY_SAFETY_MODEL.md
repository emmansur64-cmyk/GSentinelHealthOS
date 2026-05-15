# OBSERVABILITY SAFETY MODEL

## Principio central

La observabilidad clinica debe permitir trazabilidad sin exponer PHI, secretos ni payloads clinicos completos.

## PHI restrictions

Por defecto:

- `OBSERVABILITY_PHI_ALLOWED=false`

No deben enviarse datos sensibles, imagenes, direcciones, tokens, API keys ni prompts completos a observabilidad externa.

## Telemetry restrictions

La capa solo trabaja con summaries:

- `payload_summary`,
- counters,
- flags,
- severities,
- ids de correlacion,
- referencias de trace.

No almacena imagenes ni payloads completos.

## Export restrictions

Por defecto:

- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`

No hay collectors, dashboards externos, Datadog, ELK, Jaeger ni llamadas externas.

## Structured logging rules

Todo evento debe incluir:

- `trace_id`,
- `correlation_id`,
- `layer`,
- `event_type`,
- `severity`,
- `safety_flags`,
- payload sanitizado.

## Sanitization

El sanitizer redacta:

- tokens,
- API keys,
- passwords,
- secrets,
- emails,
- telefonos,
- imagenes,
- objetos complejos inseguros.

## Drift limitations

El drift detector usa reglas defensivas simples. No usa ML, no predice diagnosticos y no bloquea runtime.

## No external telemetry

La fase no conecta exporters externos. Cualquier futuro exporter requiere revision PHI, seguridad, costos, retencion, auditoria y rollback.

## Auditability

`ObservabilityAuditEvent` permite correlacionar:

- capas tocadas,
- providers involucrados,
- confidence generado,
- review activado,
- escalacion,
- bloqueo.

No guarda contenido clinico completo.
