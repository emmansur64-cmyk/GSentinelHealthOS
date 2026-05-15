# ARCHITECTURE GAP ANALYSIS

## Estado

FASE 1 - Auditoria arquitectonica real completada sin modificar codigo.

Este documento analiza el estado actual de GSentinelHealthOS / MetaBrain como base para una transicion controlada desde heuristicas y modelos generales hacia una plataforma medica multimodal mas real, auditable y reversible.

## Alcance Auditado

Raices revisadas:

- `MetaBrain/`
- `MetaBrain/src/`
- `MetaBrain/cerebro_ai_med/`
- `MetaBrain/services/`
- `medical-agenda-saas/src/`
- `medical-agenda-saas/prisma/schema.prisma`

No se reiniciaron servicios. No se modificaron contratos API. No se toco Docker/compose. No se activo ningun feature experimental.

## Mapa Actual Real

### 1. MetaBrain Nest/TypeScript

Entry points y modulos principales:

- `MetaBrain/src/app.module.ts`
- `MetaBrain/src/ingress/incident.controller.ts`
- `MetaBrain/src/brain/brain.service.ts`
- `MetaBrain/src/medical-assistant/medical-assistant.controller.ts`
- `MetaBrain/src/medical-assistant/medical-assistant.service.ts`

Capas existentes:

- `brain`: orquestacion principal de incidentes operativos.
- `guard`: validacion de input y decision.
- `action-engine`: construccion de acciones.
- `execution`: gate de ejecucion.
- `audit`: auditoria en memoria y persistencia.
- `memory`: memoria reciente de incidentes.
- `ml` / `ml-core`: inferencia ONNX y feature builder.
- `dl`: deteccion secuencial/anomalias.
- `knowledge`: retrieval medico con documentos Mongo + embeddings hash.
- `ai`: provider Groq + fallback.
- `medical-assistant`: endpoint de asistencia medica para WhatsApp.
- `events`: productores/consumidores y puente Rabbit/Kafka.

### 2. Python `cerebro_ai_med`

Entry points:

- `MetaBrain/cerebro_ai_med/api/routes.py`
- `MetaBrain/cerebro_ai_med/api/app.py`
- `MetaBrain/cerebro_ai_med/models/service.py`
- `MetaBrain/cerebro_ai_med/decision/hybrid_decision.py`
- `MetaBrain/cerebro_ai_med/memory/store.py`
- `MetaBrain/cerebro_ai_med/vision/image_model.py`

Capacidades reales:

- API FastAPI con `/analyze`.
- Validacion de texto e imagen.
- Triage por modelo `ProductionMedicalTriageModel`.
- Decision hibrida entre reglas `cerebro` y pipeline Groq.
- Audit metadata basica.
- JSONL append-only memory.
- Vision CNN pequena o MONAI DenseNet si disponible.

### 3. Microservicios Python bajo `MetaBrain/services`

Servicios presentes:

- `api_gateway`
- `inference_service`
- `decision_service`
- `dialogue_engine`
- `nlg_service`

Contratos tipados:

- `MetaBrain/services/shared/contracts.py`

Flujo distribuido real:

`api_gateway -> inference_service -> decision_service -> nlg_service`

Fallback real:

- Si NLG falla, `api_gateway/orchestrator.py` genera salida estructurada segura.
- `inference_service` tiene timeout por `INFERENCE_TIMEOUT_SECONDS`.
- `api_gateway` tiene retries, timeout interno y circuit breaker Redis.

### 4. Next.js `medical-agenda-saas`

Chat medico profesional:

- `medical-agenda-saas/src/app/chat/doctor/route.ts`
- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- `medical-agenda-saas/src/lib/brain-client.ts`
- `medical-agenda-saas/src/lib/metabrain.ts`

Capas agregadas recientemente:

- `src/lib/medical-runtime-context/`
- `src/lib/medical-web-retrieval/`
- `src/lib/medical-conversation-memory/`
- `src/lib/medical-reasoning/`
- `src/lib/medical-specialty-protocols/`
- `src/lib/doctor-context/`

Imagen medica:

- `medical-agenda-saas/src/medical-imaging/imaging.service.ts`
- `medical-agenda-saas/src/medical-imaging/predictor.service.ts`
- `medical-agenda-saas/src/medical-imaging/vision-ai.service.ts`
- `medical-agenda-saas/src/server/ai/groqImageAnalysis.ts`
- `medical-agenda-saas/src/app/api/imaging/analyze/route.ts`
- `medical-agenda-saas/src/app/api/ai/image-analysis/route.ts`

Observabilidad:

- `medical-agenda-saas/src/lib/observability/metrics.ts`
- `medical-agenda-saas/src/app/api/metrics/route.ts`

## Capacidades Reales Confirmadas

### Orquestacion

MetaBrain TS ya funciona como orquestador de incidentes:

- normaliza input,
- aplica guardrails,
- calcula fingerprint,
- enruta estrategia,
- combina reglas + ML + learning,
- aplica DL override,
- audita,
- ejecuta solo si pasa gate.

Esto es util como `orchestration layer` y no debe ser reemplazado abruptamente.

### Provider abstraction parcial

Existe provider Groq con:

- cadena de modelos,
- timeout por modelo,
- circuit breaker por modelo,
- cache bounded por prompt,
- fallback seguro `AI_SAFE_FALLBACK`,
- validacion JSON parcial para `runAnalysis`.

Limitacion: no es una abstraccion multimodal general. Esta centrado en Groq y no modela OpenAI/Gemini/local como providers intercambiables con health scoring comun.

### Retrieval medico

Hay dos caminos:

1. MetaBrain Nest:
   - `KnowledgeRetriever`
   - `KnowledgeIndexService`
   - `MedicalSourcesService`
   - `EmbeddingService`

2. Next doctor chat:
   - `medical-web-retrieval`
   - allowlist, sanitizer, timeout, audit, context builder.

Capacidad real:

- fuentes WHO/CDC/PubMed/ClinicalTrials/RSS configurables,
- reindexacion oportunista,
- cache en memoria,
- priorizacion de guidelines.

Limitacion critica:

- embeddings de MetaBrain Nest son hash vectors locales de 256 dimensiones, no embeddings medicos reales.
- busqueda vectorial en app layer sobre hasta 2500 documentos, no pgvector/Qdrant.
- no hay lineage clinico completo ni scoring de calidad de evidencia interoperable entre capas.

### Memoria

Hay varias memorias:

- `MetaBrain/src/memory/memory.service.ts`: incident memory en memoria + Mongo.
- `MetaBrain/cerebro_ai_med/memory/store.py`: JSONL append-only + buffer en memoria.
- `medical-agenda-saas/src/lib/medical-conversation-memory/`: resumen conversacional reciente por conversacion/paciente/tenant.
- `api_gateway` puede mezclar `memory_history` en `conversation_history`.

Capacidad real:

- memoria reciente y auditada para incidentes.
- memoria conversacional segura en Next con TTL y sanitizacion.

Limitacion critica:

- no existe semantic medical memory real con vector store, contradiction detection, lineage fuerte, expiracion persistente por paciente/medico y aislamiento PHI formal.
- `api_gateway` usa memoria global JSONL reciente y puede mezclar historial no scoped por paciente/tenant si se usara en modo distribuido sin endurecimiento adicional.

### Imagen medica

Capacidades reales:

- deteccion de imagen medica por extension/mime/nombre/tamano.
- pipeline ONNX si existe modelo.
- fallback `structured-v1`.
- vision Groq en `groqImageAnalysis.ts` con JSON schema, sanitizacion de contexto, control de mime, role/tenant/source y consentimiento cuando hay paciente.
- `AiImageAnalysisLog` y `ClinicalRecord` para draft AI triage.

Limitaciones criticas:

- `imaging.service.ts` aun depende de heuristicas como nombre, extension, tamano, quality por bytes y defaults clinicos.
- parte del pipeline declara hallazgos genericos para MRI/CT/XRAY/DICOM sin inferencia visual real.
- `cerebro_ai_med/vision/image_model.py` puede usar CNN pequena no necesariamente entrenada clinicamente o MONAI si disponible.
- no hay `ImageAnalysisResult` unificado con `trace_id`, `requires_human_review`, `uncertainty`, `provider`, `modality` para todas las rutas.
- DICOM esta detectado pero no hay pipeline DICOM clinico completo ni almacenamiento seguro especializado.

### Auditoria y compliance

Capacidades:

- `AuditService` en MetaBrain.
- `PersistenceService` con Mongo/Mongoose para incidentes, decisiones, features, audits y online training buffer.
- `medical-agenda-saas` tiene `auditLog`, `ClinicalRecord`, `AiImageAnalysisLog`, consentimientos y registros hash-chain para clinical records.
- AI image route exige consentimiento activo si hay `patientId`.

Limitaciones:

- audit schemas estan fragmentados entre Mongo MetaBrain, Postgres/Prisma Next y JSONL Python.
- no hay `trace_id` unico obligatorio end-to-end entre chat, retrieval, provider, imaging, decision y audit.
- PHI safety depende de cada ruta; no hay policy engine unico para redactar/loggear.

### Observabilidad

Capacidades:

- Prometheus en Next con request/db/redis/queue/medical imaging/doctor chat counters.
- `cerebro_ai_med` tiene JSON logging y metric recording.
- `api_gateway` registra Redis circuit health y service metrics.
- MetaBrain provider Groq tiene logs de fallback/circuit breaker.

Limitaciones:

- no hay reporte unificado de provider metrics, confidence metrics, fallback metrics y escalation metrics por `trace_id`.
- las metricas de confianza clinica estan distribuidas y no convergen en un `ClinicalConfidenceEngine`.

### Feature flags y rollback

Capacidades:

- doctor chat retrieval y runtime context usan flags.
- Brain client tiene timeout/retry/fallback.
- MetaBrain handler tiene shadow mode.
- `api_gateway` tiene async enabled y Redis circuit.
- medical conversation memory tiene config TTL y limites.

Limitaciones:

- no hay kill switch global por modulo IA.
- imaging legacy no esta detras de `MEDICAL_VISION_ENABLED=false` como contrato central.
- online learning puede correr por cron y ejecutar retraining con script Python si hay datos suficientes; esto requiere gate humano/operacional mas explicito antes de considerarse production-safe.

## Acoplamientos Peligrosos Detectados

1. `BrainService` concentra demasiadas responsabilidades:
   - reglas,
   - ML,
   - DL,
   - learning,
   - audit,
   - memoria,
   - accion,
   - ejecucion.

   Riesgo: dificil introducir clinical confidence, human review o provider router sin tocar un punto central critico.

2. `AiService.answerMedicalQuestion` mezcla:
   - role classification,
   - imaging,
   - retrieval,
   - prompt,
   - provider call,
   - JSON parsing,
   - patient safety enforcement.

   Riesgo: provider, retrieval y clinical answer policy no estan aislados.

3. Imagen medica esta duplicada:
   - Next structured/ONNX/vision pipeline,
   - MetaBrain `MedicalImagingService`,
   - Python `cerebro_ai_med` image model.

   Riesgo: resultados y disclaimers pueden divergir; no hay contrato unico.

4. Memoria esta fragmentada:
   - Mongo incident memory,
   - JSONL memory history,
   - Next conversation memory,
   - gateway conversation merge.

   Riesgo: contaminacion contextual y falta de aislamiento paciente/tenant si se conectan sin governance.

5. Provider Groq existe en varias capas:
   - MetaBrain TS provider,
   - Next doctor chat,
   - WhatsApp assistant,
   - document AI,
   - image analysis,
   - Python NLG/reformulator.

   Riesgo: timeouts, prompts, JSON parsing, fallback y safety policies inconsistentes.

## Logica Medica Hardcodeada

Ejemplos confirmados:

- `medical-agenda-saas/src/lib/metabrain.ts`: term lists para urgencias, dolor toracico, TCE, follow-up y respuestas.
- `medical-agenda-saas/src/medical-imaging/imaging.service.ts`: findings por tipo/region y recomendaciones por region.
- `MetaBrain/cerebro_ai_med/api/routes.py`: recomendaciones por riesgo hardcodeadas en `_build_medical_audit`.
- `MetaBrain/services/decision_service/app/rules.py`: reglas de decision deterministicas.
- `MetaBrain/src/medical-assistant/medical-assistant.service.ts`: warnings por rol y comportamiento si no hay citas.

Valor actual: defensivo y util para fallback.

Riesgo: si se presenta como inferencia clinica real, puede inducir falsa precision. Debe etiquetarse como rules/fallback y separarse de inferencia/modelos.

## Componentes Simulados, Heuristicos o "Fake AI"

No se detecta intencion de engaño deliberado, pero si componentes que pueden ser malinterpretados como IA clinica real:

- `EmbeddingService`: hash token embedding, semantic-ish, no embedding medico real.
- `imaging.service.ts structured-v1`: imagen por metadatos/nombre/tamano + hallazgos genericos.
- `cerebro_ai_med/vision/image_model.py`: CNN pequena fallback si MONAI no esta disponible; sin evidencia en esta auditoria de validacion clinica.
- `MedicalImagingService` Nest: delega a API externa si esta configurada; si no, devuelve no configurado.
- `decision_service`: motor de reglas, no razonamiento medico autonomo.

Recomendacion: etiquetar cada salida con `provider`, `inference_mode`, `model_version`, `confidence`, `requires_human_review` y `clinical_limitations`.

## Puntos Unicos de Fallo

- Mongo/Mongoose para MetaBrain persistence, audit, knowledge index y memory.
- Groq API para refinamiento NLG/assistant si se usa como primary.
- `BrainService` como orchestrator monolitico.
- `medical-agenda-saas/src/lib/brain-client.ts` depende de `BRAIN_API_URL` y key valida; falla a local rules.
- JSONL memory path en gateway si se usa como memoria operacional.
- Python retraining script externo llamado por cron.

## Riesgo de Memory Leaks / Growth

Mitigado parcialmente:

- `MemoryService` tiene max 1000 entradas.
- `AuditService` tiene max 2000 entradas.
- Groq provider cache max 256.
- retrieval cache TTL.

Pendiente:

- JSONL append-only sin rotacion formal.
- Mongo collections de audit/incidents/features pueden crecer sin retention policy visible.
- `KnowledgeIndexService` upsert por URL, pero corpus puede crecer sin versionado/curation policy.
- online training buffer requiere politica de retencion y aprobacion humana.

## Inferencia Insegura o No Suficientemente Auditada

Riesgos principales:

- Imagen legacy puede generar hallazgos genericos no derivados de pixeles reales.
- Groq medical assistant puede elevar riesgo en decision hibrida, pero no hay `ClinicalConfidenceEngine` formal que integre retrieval quality, provider consistency, hallucination risk, memory conflicts e image quality.
- Online learning se dispara por cron con threshold de registros; tiene deployment gate, pero no evidencia de aprobacion humana obligatoria antes de reload.
- No existe cola formal `ClinicalReviewQueue` para bloquear/escalar todo resultado sensible.

## Readiness Score

Escala: 0 a 5.

- Orquestacion operacional: 4/5
- Backward compatibility: 4/5
- Provider isolation: 2/5
- Retrieval medico: 2.5/5
- Semantic memory: 1.5/5
- Imaging real multimodal: 2/5
- Human review: 1.5/5
- Clinical confidence engine: 1/5
- Observabilidad IA end-to-end: 2.5/5
- PHI/HIPAA-ready architecture: 2.5/5
- Rollback/feature flags: 3/5

Readiness global estimado: 2.5/5.

Interpretacion: plataforma operacionalmente valiosa y defensiva, apta para evolucion modular en LAB/DEV; no lista aun como plataforma de inferencia clinica multimodal real sin capas adicionales de confianza, review, provider router y memoria semantica segura.

## Evolucion Recomendada

### Paso 1 - Congelar contratos existentes

Antes de modificar arquitectura:

- documentar endpoints publicos actuales,
- declarar payloads y responses,
- agregar tests de contrato para chat, brain, imaging, metrics y assistant,
- establecer `feature_flags.md` central.

### Paso 2 - Crear adapters, no reemplazos

Agregar nueva estructura sin romper imports:

- `MetaBrain/core/`
- `MetaBrain/providers/`
- `MetaBrain/memory/`
- `MetaBrain/imaging/`
- `MetaBrain/confidence/`
- `MetaBrain/review/`
- `MetaBrain/audit/`

Debe empezar como adapters sobre servicios existentes, no como rewrite.

### Paso 3 - Clinical Confidence Engine primero

Antes de mas IA:

- definir `ClinicalConfidenceInput`,
- integrar retrieval quality,
- provider status,
- hallucination risk,
- memory conflicts,
- image quality,
- rule conflicts,
- salida `safe_to_display` y `escalation_required`.

### Paso 4 - Human Review Queue antes de vision avanzada

Crear `ClinicalReviewQueue` con estados y auditoria antes de habilitar vision o decisiones sensibles.

### Paso 5 - Semantic Memory shadow mode

Implementar pgvector/Qdrant en shadow mode:

- tenant-scoped,
- doctor-scoped,
- patient-scoped,
- encryption/redaction policy,
- lineage,
- TTL,
- contradiction detection.

No reemplazar JSONL/Mongo hasta validacion.

### Paso 6 - Imaging pipeline V2 paralelo

Mantener compatibilidad legacy pero crear contrato nuevo:

`ImageAnalysisResult`

Campos minimos:

- `findings`
- `confidence`
- `requires_human_review`
- `modality`
- `uncertainty`
- `provider`
- `trace_id`

Flags iniciales:

- `MEDICAL_VISION_ENABLED=false`
- `DICOM_ENABLED=false`

### Paso 7 - Provider Router

Unificar Groq/OpenAI/Gemini/local bajo interface comun:

- timeout,
- retry,
- rate limit,
- structured output validation,
- health scoring,
- fallback chain,
- provider-specific telemetry.

### Paso 8 - Observabilidad unificada

Propagar `trace_id` desde request hasta:

- retrieval,
- provider,
- memory,
- imaging,
- confidence,
- review,
- audit.

Generar `AI_OBSERVABILITY_REPORT.md` cuando exista instrumentacion real.

## Bloqueadores Para Fases Siguientes

1. Definir contratos canonicos antes de escribir modulos nuevos.
2. Decidir store semantico: pgvector vs Qdrant.
3. Definir PHI policy para embeddings.
4. Definir retention de JSONL/Mongo/audit.
5. Definir quien aprueba human review y estados operativos.
6. Definir kill switches globales por modulo.
7. Definir estrategia de versionado de modelos y promotion gates con aprobacion humana.

## Conclusion

La arquitectura actual no debe destruirse. Ya cumple un rol valioso como gateway clinico defensivo, orquestador, rules engine, audit layer, retrieval parcial y provider abstraction inicial.

La brecha principal no es falta de codigo, sino falta de separacion formal entre inferencia, memoria, reglas, diagnostico, auditoria, confianza clinica y revision humana.

La evolucion debe hacerse por adapters y feature flags, manteniendo rutas actuales y dejando toda capacidad experimental en shadow/dry-run hasta que tenga:

- contrato tipado,
- trazabilidad,
- fallback,
- confidence scoring,
- human review,
- rollback,
- auditabilidad clinica.
