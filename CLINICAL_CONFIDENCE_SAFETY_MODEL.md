# CLINICAL CONFIDENCE SAFETY MODEL

## Principio central

El Clinical Confidence Engine no produce certeza medica ni diagnostico definitivo. Solo estima confiabilidad operacional de una respuesta o resultado con base en senales disponibles.

## No diagnostico definitivo

La capa no:

- diagnostica,
- prescribe,
- interpreta imagenes como especialista,
- reemplaza criterio medico,
- toma decisiones autonomas,
- bloquea runtime real en Fase 7.

## Explainability

Cada resultado incluye `confidence_explanation` con razones no diagnosticas, por ejemplo:

- baja consistencia entre providers,
- evidencia retrieval insuficiente,
- conflictos multimodales,
- claims sin soporte suficiente,
- incertidumbre alta.

## Hallucination handling

El riesgo de hallucination se estima por senales defensivas:

- evidencia faltante,
- provider divergence,
- multimodal inconsistency,
- conflictos declarados por capas,
- completitud baja.

No inspecciona contenido clinico para afirmar verdad medica.

## Provider conflict handling

La capa marca conflicto si:

- un provider falla,
- un output esta vacio,
- un output esta malformado,
- los resumenes de providers divergen de forma importante.

No ejecuta llamadas reales a providers.

## Multimodal restrictions

Con `CLINICAL_CONFIDENCE_MULTIMODAL_ENABLED=false`, la evaluacion multimodal avanzada queda apagada. Si se activa en fases futuras, imagenes o multimodalidad deben requerir revision humana.

## Safe display

`safe_to_display` es una evaluacion controlada, no enforcement real. Con defaults actuales:

- `CLINICAL_CONFIDENCE_SAFE_DISPLAY_ENABLED=false`
- `CLINICAL_CONFIDENCE_BLOCKING_ENABLED=false`

Por lo tanto, no se bloquean respuestas reales.

## Escalation rules

La capa recomienda escalacion si:

- confidence baja,
- uncertainty alta,
- evidencia insuficiente,
- hallucination risk alto o critico,
- provider conflict,
- multimodal conflict.

Con `CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED=false`, no se activa escalacion automatica real.

## Limites

- No usa embeddings.
- No usa modelos externos.
- No consulta providers.
- No persiste auditoria durable.
- No contiene policy clinica especifica por enfermedad.
- No reemplaza human review.
