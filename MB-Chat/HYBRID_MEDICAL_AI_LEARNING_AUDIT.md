# HYBRID_MEDICAL_AI_LEARNING_AUDIT

## Diagnostico real

- La respuesta Groq se generaba en [src/ai/ai.service.ts](src/ai/ai.service.ts#L254) mediante `medicalGroqProvider.run(prompt)`.
- La seguridad se decidia en dos capas: guard PHI en [src/ai/assert-groq-phi-guard.ts](src/ai/assert-groq-phi-guard.ts#L38) y politicas clinicas pre/post/error en [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts#L72).
- El aprendizaje se registraba en [src/medical-assistant/learning/medical-chat-learning.service.ts](src/medical-assistant/learning/medical-chat-learning.service.ts), pero antes guardaba hashes + turnos casi crudos y no un contrato hibrido destilado.
- `recordAndTrain` no estaba conectado al flujo real del chat; el servicio llamaba a `record` dos veces y nunca activaba entrenamiento controlado.
- No habia distincion suficiente entre respuesta, memoria reutilizable, entrenamiento y auditoria.
- La recuperacion semantica real no estaba integrada al flujo del chat; solo existia resumen de sesion local. SemanticMemoryService en `memory/` no forma parte del build Nest actual.
- Habia riesgo de contaminacion clinica: una respuesta Groq profesional podia terminar registrada sin contrato explicito de `allowedForTraining`, `validationStatus`, `reuseScope` o metricas de dependencia del teacher.

## Cambios aplicados

- Se implemento `HybridMedicalLearningRecord` dentro de [src/medical-assistant/learning/medical-chat-learning.service.ts](src/medical-assistant/learning/medical-chat-learning.service.ts#L26) con los campos requeridos: source, learningType, summaries sanitizados, safetyFlags, validationStatus, reuseScope, rawTextStored=false y metadata.
- El servicio ahora destila el aprendizaje: sanitiza PHI, resume prompt y teacher answer, extrae conceptos/frases profesionales, clasifica el tipo de aprendizaje y decide si puede reutilizarse o entrenarse.
- Se reemplazo el registro crudo por `recordAndTrain` integrado en [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts#L304) y en ramas bloqueadas/fallback [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts#L116) y [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts#L395).
- Se agrego modo de respuesta hibrida con intento local seguro mediante `attemptLocalAnswer` en [src/medical-assistant/learning/medical-chat-learning.service.ts](src/medical-assistant/learning/medical-chat-learning.service.ts#L292). Solo responde localmente para medico, con memoria validada y confianza suficiente.
- Se agregaron metricas de reduccion de dependencia con `getHybridLearningMetrics()` en [src/medical-assistant/learning/medical-chat-learning.service.ts](src/medical-assistant/learning/medical-chat-learning.service.ts#L340).
- Se reforzo persistencia JSONL para reinicio y carga de registros legacy, con recall lexical controlado por tenant/doctor/session/reuseScope.
- Se actualizaron tests del chat medico y se repararon specs de brain desfasadas que rompian `npm test -- ai` por cambios previos de constructor.

## Flujo antes / despues

### Antes

Groq -> respuesta -> refine -> `record()` usuario -> `record()` asistente -> JSONL local sin contrato hibrido -> sin metricas -> sin decision local segura.

### Despues

Intento de recall local seguro -> si confianza local suficiente y medico: respuesta local asistida por memoria validada -> si no: Groq teacher/fallback -> sanitizacion PHI -> destilacion de conceptos/estilo -> clasificacion de aprendizaje -> persistencia JSONL append-only -> recall lexical controlado -> metricas de dependencia Groq.

## Contrato implementado

Archivo principal: [src/medical-assistant/learning/medical-chat-learning.service.ts](src/medical-assistant/learning/medical-chat-learning.service.ts#L26)

Campos minimos implementados:

- `id`
- `timestamp`
- `source`
- `tenantId`
- `doctorId`
- `patientIdHash`
- `sessionId`
- `medicalDomain`
- `learningType`
- `sanitizedPromptSummary`
- `sanitizedTeacherAnswerSummary`
- `extractedClinicalConcepts`
- `extractedProfessionalPhrases`
- `officialCitations`
- `safetyFlags`
- `confidence`
- `allowedForReuse`
- `allowedForTraining`
- `validationStatus`
- `reuseScope`
- `rawTextStored: false`
- `metadata`

## Archivos modificados

- [src/medical-assistant/learning/medical-chat-learning.service.ts](src/medical-assistant/learning/medical-chat-learning.service.ts)
- [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts)
- [src/medical-assistant/medical-assistant.service.spec.ts](src/medical-assistant/medical-assistant.service.spec.ts)
- [src/medical-assistant/learning/medical-chat-learning.service.spec.ts](src/medical-assistant/learning/medical-chat-learning.service.spec.ts)
- [src/medical-assistant/learning/semantic-memory.hybrid.spec.ts](src/medical-assistant/learning/semantic-memory.hybrid.spec.ts)
- [src/brain/brain.mixed-traffic.spec.ts](src/brain/brain.mixed-traffic.spec.ts)
- [src/brain/brain.high-load.spec.ts](src/brain/brain.high-load.spec.ts)
- [src/brain/brain.db-outage.simulation.spec.ts](src/brain/brain.db-outage.simulation.spec.ts)

## Metricas agregadas

Implementadas por `getHybridLearningMetrics()`:

- `totalTeacherResponses`
- `acceptedLearningRecords`
- `rejectedLearningRecords`
- `doctorValidatedRecords`
- `reusablePatterns`
- `unsafeRejectedPatterns`
- `semanticRecallHitRate`
- `localAnswerAttempted`
- `groqFallbackUsed`
- `localAnswerConfidence`
- `teacherDependencyRatio`

## Riesgos cerrados

- No se guarda prompt completo ni respuesta completa de Groq como memoria reutilizable.
- PHI se redacta antes de persistir cualquier resumen.
- Conversacion normal del paciente no habilita entrenamiento diagnostico.
- El aprendizaje queda aislado por doctor/tenant/session o global_safe cuando corresponde.
- El fallback a Groq queda medido y ya no es invisible.
- El recall local no produce diagnostico autonomo; solo soporte no diagnostico para medico.

## Riesgos abiertos

- `memory/SemanticMemoryService` sigue fuera del root de build Nest; la memoria semantica operativa de esta fase vive en `MedicalChatLearningService` con recall lexical JSONL. Si se quiere vectorizacion real, hay que integrar esa capa al arbol compilado y al DI de Nest.
- La extraccion de conceptos y frases es heuristica; para destilacion mas fina conviene sumar un extractor estructurado o clasificador local especifico.
- `teacherDependencyRatio` hoy se calcula sobre intentos registrados en learning service, no sobre telemetria global cross-service.
- Las suites de brain aceptan routing errors acotados por el rate limiter actual; eso es consistente con el runtime, pero conviene revisar si esa simulacion debe desacoplarse del throttle para medir routing puro.

## Comandos ejecutados

- `npm test -- medical-chat-learning --runInBand`
- `npm test -- medical-assistant --runInBand`
- `npm test -- medical-chat-learning semantic-memory --runInBand`
- `npm test -- ai --runInBand`
- `npm run build`

## Tests pasados

- `medical-chat-learning`: PASS
- `semantic-memory`: PASS
- `medical-assistant`: PASS
- `ai`: PASS
- `build`: PASS (`BUILD_OK`)

## Estado final

- GO para esta fase de preproduccion controlada.
- NO-GO para declarar independencia fuerte de Groq: aun existe teacher fallback y el recall sigue siendo lexical, no vectorial.