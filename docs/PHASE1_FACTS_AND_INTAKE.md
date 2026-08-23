# Fase 1 - hechos, temporalidad e intake

## Resultado

La entrada clinica autoritativa pertenece al `ClinicalKernel`. El consumidor
externo entrega una estructura candidata; el Kernel valida terminologia,
procedencia, identidad, revision y temporalidad antes de acuñar el
`CaseEnvelope` que puede llegar al orquestador.

## Contratos cerrados

- `ClinicalFact`: hecho inmutable, codificado, temporal y con procedencia.
- `ClinicalFactSet`: conjunto de un solo sujeto, IDs unicos y hash canonico.
- `FactTemporalState`: proyeccion de estados explicitamente declarados.
- `GovernedTerminologyRegistry`: allow-list versionada de conceptos y clases.
- `GovernedUnitRegistry`: conversiones permitidas por release y `rule_id`.
- `ClinicalFactDelta`: adicion, reemplazo o retraccion explicita entre revisiones.
- `CaseScope`: aislamiento por tenant, profesional, conversacion y caso.
- `ClinicalStateStore`: frontera de persistencia e idempotencia.

## Reglas de autoridad

1. Un concepto desconocido o incompatible se rechaza; no se aproxima por texto.
2. La ausencia de un hecho en una nueva entrada no implica retraccion.
3. Una revision existente es inmutable y una nueva avanza exactamente una.
4. `request_id` identifica el retry. Reutilizarlo con otra entrada es conflicto.
5. Un replay antiguo devuelve el mismo plan sin hacer retroceder el estado.
6. Terminologia, unidades, conocimiento, politica y conjunto de hechos quedan versionados.
7. SQLite valida secuencia y escribe revision e idempotencia dentro de `BEGIN IMMEDIATE`.
8. Los fingerprints son hashes de JSON canonico estructurado, sin concatenacion ambigua.
9. Cada concepto gobierna el tipo de valor y si la unidad esta prohibida o es obligatoria.

## Persistencia

`InMemoryClinicalStateStore` existe para pruebas. `SQLiteClinicalStateStore` es
el adaptador durable de referencia y valida el hash al rehidratar. Una
integracion productiva podra implementar el mismo protocolo con PostgreSQL sin
cambiar la autoridad ni los contratos.

Ambos adaptadores aplican la misma maquina de transicion al estado completo:
hechos, release de conocimiento y release terminologico. Dos escritores no
pueden acuñar contenidos distintos para una misma revision.

## Limite clinico

Esta fase no extrae hechos desde narrativa, no contiene umbrales medicos y no
ejecuta los 11 motores. Solo asegura que las fases siguientes reciban estado
tipado, versionado, aislado y reproducible.
