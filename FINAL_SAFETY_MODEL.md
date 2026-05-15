# FINAL SAFETY MODEL

## Limites clinicos

MetaBrain/GSentinelHealthOS no debe:

- diagnosticar definitivamente,
- prescribir automaticamente,
- reemplazar criterio medico,
- tomar decisiones clinicas autonomas,
- interpretar imagenes como radiologo IA real,
- activar aprendizaje continuo sin control humano.

## Human review

Requerido para:

- imagenes medicas,
- multimodalidad,
- baja confianza,
- alto riesgo,
- conflictos provider,
- hallucination risk,
- outputs bloqueables futuros.

## PHI restrictions

Por defecto:

- no PHI a providers externos,
- no PHI en telemetry externa,
- no imagenes originales almacenadas,
- sanitizacion conservadora.

## Provider restrictions

- Providers externos apagados por default.
- Router apagado.
- Multimodal externo apagado.
- Imagen externa apagada.
- PHI a provider apagado.

## Multimodal restrictions

- No inference visual real.
- No DICOM activo.
- Metadata-only es auxiliar y no diagnostico.
- Human review obligatoria antes de interpretacion clinica.

## Observability restrictions

- No export externo.
- Payload summary-only.
- Secrets y PHI redactados.
- No dashboards reales conectados.

## Runtime restrictions

- `AI_RUNTIME_ENABLED=false`.
- `AI_RUNTIME_KILL_SWITCH=true`.
- `AI_RUNTIME_DRY_RUN=true`.
- `AI_RUNTIME_BLOCKING_ENABLED=false`.

## Activation restrictions

Ninguna capa debe activarse sin:

- validation report,
- safety model,
- rollback plan,
- PHI review,
- clinical safety review,
- shadow deployment,
- rollback drill.

## Escalation rules

Escalar a revision humana ante:

- uncertainty alta,
- confidence baja,
- evidencia insuficiente,
- conflicto multimodal,
- provider divergence,
- hallucination risk,
- salida insegura.
