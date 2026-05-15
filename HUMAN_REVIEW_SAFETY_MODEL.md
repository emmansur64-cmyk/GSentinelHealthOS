# HUMAN REVIEW SAFETY MODEL

## Objetivo

La Fase 6 prepara una capa formal para revision humana clinica sin activar decisiones autonomas ni bloqueo real.

La IA no queda autorizada a finalizar resultados clinicos sensibles. La capa solo define como marcar, enrutar, auditar y eventualmente bloquear resultados cuando un flujo futuro la conecte explicitamente.

## Que puede bloquearse en fases futuras

- Salidas con riesgo critico.
- Salidas con riesgo de alucinacion.
- Conflictos entre providers.
- Resultados multimodales sensibles.
- Analisis de imagenes medicas.
- Baja confianza con alta incertidumbre.
- Cualquier salida marcada por politica como unsafe.

En Fase 6, el bloqueo es recomendacion o shadow evaluation, no enforcement.

## Que requiere revision

- Imagenes y multimodalidad.
- Baja confianza.
- Riesgo alto o critico.
- Incertidumbre alta.
- Provider conflict.
- Hallucination risk.
- Casos que requieran especialidad.

## Override humano

El override humano existe como contrato (`ReviewDecision`) pero esta apagado por defecto con:

- `HUMAN_OVERRIDE_ENABLED=false`

Si se activa en el futuro, debe requerir reviewer autenticado, motivo explicito, auditoria durable y trazabilidad por `trace_id`.

## Auditoria

`ReviewAuditEvent` registra:

- `review_id`
- `trace_id`
- reviewer opcional
- status anterior y posterior
- nivel de escalamiento
- uso de override
- bloqueo
- timestamp

No guarda PHI innecesaria ni contenido clinico completo.

## Separacion de responsabilidades

La capa mantiene separadas:

- IA/proveedores,
- revision humana,
- auditoria,
- reglas clinicas,
- scoring de confianza.

No contiene prompts clinicos, diagnosticos, providers LLM ni acceso a base de datos.

## Multimodal governance

Imagen y multimodalidad quedan marcadas como requeridas para revision por defecto:

- `HUMAN_REVIEW_IMAGE_REQUIRED=true`
- `HUMAN_REVIEW_MULTIMODAL_REQUIRED=true`

Esto no activa vision medica real ni envio de imagenes a providers externos.

## Limitaciones

- No hay persistencia durable.
- No hay UI de revision.
- No hay enforcement real.
- No hay aprobaciones productivas.
- No hay bloqueo conectado a respuestas reales.

Estas limitaciones son intencionales para conservar compatibilidad backward y evitar impacto clinico no auditado.
