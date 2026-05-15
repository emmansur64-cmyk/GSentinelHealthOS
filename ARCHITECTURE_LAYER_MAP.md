# ARCHITECTURE LAYER MAP

## Estado

FASE 2 - Aislamiento formal de capas IA.

Este mapa documenta las carpetas creadas en `MetaBrain/` como fronteras arquitectonicas no destructivas. No reemplazan los modulos actuales ni cambian comportamiento runtime.

## Principio de Compatibilidad

Las capas nuevas viven fuera de `MetaBrain/src/`. El `tsconfig.json` actual compila solo `src/**/*.ts`, por lo que las nuevas carpetas no entran en el build Nest existente y no alteran imports actuales.

Se agregaron contratos y adapters declarativos para preparar migracion incremental.

## Capas Creadas

### 1. Clinical Rules Engine

Ruta:

- `MetaBrain/rules/`

Responsabilidad:

- reglas clinicas defensivas,
- no diagnostico definitivo,
- decisiones seguras,
- derivacion futura a revision humana.

Codigo actual relacionado:

- `MetaBrain/src/guard/`
- `MetaBrain/src/brain/strategies/`
- `MetaBrain/services/decision_service/app/rules.py`
- `medical-agenda-saas/src/lib/metabrain.ts`

Estado:

- adapter declarativo creado,
- sin cambio funcional.

### 2. Retrieval Engine

Ruta:

- `MetaBrain/retrieval/`

Responsabilidad:

- recuperar evidencia/contexto,
- preparar documentos/citas,
- no modificar modelos.

Codigo actual relacionado:

- `MetaBrain/src/knowledge/`
- `medical-agenda-saas/src/lib/medical-web-retrieval/`

Estado:

- contrato `RetrievalEngine`,
- adapter declarativo,
- sin cambios en retrieval actual.

### 3. Semantic Memory

Ruta:

- `MetaBrain/memory/`

Responsabilidad:

- encapsular memoria actual,
- preparar interfaz para pgvector/Qdrant futuro,
- aislar tenant/doctor/paciente/conversacion.

Codigo actual relacionado:

- `MetaBrain/src/memory/`
- `MetaBrain/cerebro_ai_med/memory/store.py`
- `MetaBrain/services/api_gateway/main.py`
- `medical-agenda-saas/src/lib/medical-conversation-memory/`

Estado:

- contrato `SemanticMemory`,
- no se implementa vector DB en esta fase.

### 4. Image Intelligence

Ruta:

- `MetaBrain/imaging/`

Responsabilidad:

- encapsular pipeline actual de imagen,
- declarar salida futura `ImageAnalysisResult`,
- separar metadata/structured legacy de vision medica real.

Codigo actual relacionado:

- `medical-agenda-saas/src/medical-imaging/`
- `medical-agenda-saas/src/server/ai/groqImageAnalysis.ts`
- `MetaBrain/src/ai/medical-imaging.service.ts`
- `MetaBrain/cerebro_ai_med/vision/`

Estado:

- contrato `ImageIntelligence`,
- feature flags propuestos/documentados: `MEDICAL_VISION_ENABLED=false`, `DICOM_ENABLED=false`,
- no se activa vision experimental.

### 5. LLM Orchestrator

Ruta:

- `MetaBrain/providers/llm-orchestrator.ts`

Responsabilidad:

- coordinar providers IA,
- timeouts/fallbacks,
- structured output futuro,
- mantener logica clinica fuera de providers.

Codigo actual relacionado:

- `MetaBrain/src/ai/providers/groq.provider.ts`
- `MetaBrain/src/ai/providers/fallback.provider.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- `MetaBrain/services/nlg_service/app/reformulator.py`

Estado:

- contrato `LlmOrchestrator`,
- no cambia provider actual.

### 6. Audit Layer

Ruta:

- `MetaBrain/audit/`

Responsabilidad:

- trazabilidad,
- eventos,
- decisiones,
- request lineage,
- seguridad clinica.

Codigo actual relacionado:

- `MetaBrain/src/audit/`
- `MetaBrain/src/persistence/`
- `medical-agenda-saas/src/lib/audit.ts`
- `medical-agenda-saas/src/lib/compliance/audit-log.ts`

Estado:

- contrato `ClinicalAuditLayer`,
- sin cambios en persistencia.

### 7. Risk Engine

Ruta:

- `MetaBrain/risk/`

Responsabilidad:

- scoring de riesgo,
- modelos existentes,
- reglas de riesgo operacional/clinico.

Codigo actual relacionado:

- `MetaBrain/src/ml/`
- `MetaBrain/src/ml-core/`
- `MetaBrain/src/dl/`
- `MetaBrain/cerebro_ai_med/models/`
- `MetaBrain/services/inference_service/`
- `MetaBrain/services/decision_service/`

Estado:

- contrato `RiskEngine`,
- no cambia thresholds ni modelos.

### 8. Provider Router

Ruta:

- `MetaBrain/providers/`

Responsabilidad:

- elegir provider,
- fallback,
- health score futuro,
- aislar Groq/OpenAI/Gemini/local.

Codigo actual relacionado:

- integrations Groq en Nest, Next y Python NLG.

Estado:

- contrato `ProviderRouter`,
- adapter declarativo,
- flag propuesto: `AI_PROVIDER_ROUTER_ENABLED=false`.

### 9. Human Review Layer

Ruta:

- `MetaBrain/review/`

Responsabilidad:

- interfaz futura de cola de revision humana,
- escalar, revisar, bloquear, corregir y auditar.

Codigo actual relacionado:

- `medical-agenda-saas/src/lib/compliance/clinical-records`
- `medical-agenda-saas/prisma/schema.prisma:ClinicalRecord`
- `medical-agenda-saas/prisma/schema.prisma:AiImageAnalysisLog`

Estado:

- contrato `HumanReviewLayer`,
- no se crea cola runtime,
- flag propuesto: `CLINICAL_REVIEW_QUEUE_ENABLED=false`.

### 10. Clinical Confidence Layer

Ruta:

- `MetaBrain/confidence/`

Responsabilidad:

- confidence score agregado,
- uncertainty,
- escalation_required,
- safe_to_display.

Codigo actual relacionado:

- `MetaBrain/src/guard/`
- `MetaBrain/src/brain/brain.service.ts`
- `MetaBrain/services/decision_service/app/rules.py`

Estado:

- contrato `ClinicalConfidenceEngine`,
- flag propuesto: `CLINICAL_CONFIDENCE_ENGINE_ENABLED=false`.

## Registry

Ruta:

- `MetaBrain/core/layer-registry.ts`

Responsabilidad:

- lista canonica de capas fase 2,
- directorio,
- feature flag propuesto,
- default enabled.

No se importa desde runtime actual.

## Imports Actuales

No se modificaron imports existentes. La app actual sigue usando:

- `MetaBrain/src/*`
- `MetaBrain/services/*`
- `MetaBrain/cerebro_ai_med/*`
- `medical-agenda-saas/src/*`

Las carpetas nuevas son opt-in para fases posteriores.

## Rollback

Rollback completo de Fase 2:

1. Eliminar carpetas nuevas:
   - `MetaBrain/core/`
   - `MetaBrain/providers/`
   - `MetaBrain/memory/`
   - `MetaBrain/imaging/`
   - `MetaBrain/confidence/`
   - `MetaBrain/review/`
   - `MetaBrain/audit/`
   - `MetaBrain/retrieval/`
   - `MetaBrain/risk/`
   - `MetaBrain/rules/`
2. Eliminar documentos:
   - `ARCHITECTURE_LAYER_MAP.md`
   - `PHASE_2_COMPATIBILITY_REPORT.md`

No requiere revertir imports ni migraciones porque no se integraron al runtime.

## Riesgos Pendientes

- Contratos aun no estan conectados a Nest DI.
- No hay tests de contrato automaticos para estas capas.
- La duplicacion de provider/retrieval/imaging sigue existiendo hasta fases de adapters runtime.
- Los flags propuestos no se agregaron a `.env` real ni se activaron.

## Pendientes Para Fases Siguientes

- Crear adapters runtime dentro de `src/` de forma incremental.
- Agregar contract tests.
- Definir `trace_id` end-to-end.
- Definir store semantico real.
- Definir `ClinicalReviewQueue` persistente.
- Definir `ClinicalConfidenceEngine` real.
