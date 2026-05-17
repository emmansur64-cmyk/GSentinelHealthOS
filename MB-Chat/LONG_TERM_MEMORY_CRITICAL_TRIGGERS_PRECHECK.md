# LONG_TERM_MEMORY_CRITICAL_TRIGGERS_PRECHECK

## Estado de auditoria (FASE 1)
- Fecha: 2026-05-17
- Entorno: desarrollo/preproduccion (sin deploy, sin tocar produccion)
- Resultado clave: no existe un metodo llamado `_procesar_memoria_largo_plazo` en `MB-Chat`.

## Ubicacion equivalente funcional (memoria clinica de largo plazo)
- Archivo principal: `MB-Chat/src/medical-assistant/learning/medical-chat-learning.service.ts`
- Clase dueña: `MedicalChatLearningService`
- Metodos relevantes:
  - `recordAndTrain(input)` (entrada operativa desde chat medico)
  - `record(input)` (normaliza/sanitiza/decide y persiste JSONL)
  - `persist(record)` (append-only a archivo local de aprendizaje)

## Uso actual del flujo
- Llamadores directos identificados:
  - `MB-Chat/src/medical-assistant/medical-assistant.service.ts` (varias llamadas `recordAndTrain`)
  - Tests en `medical-chat-learning.service.spec.ts` y `semantic-memory.hybrid.spec.ts`

## Inputs actuales relevantes
- `HybridLearningInput` (interno)
  - `request`, `query`, `mode`, `modality`, `citations`, `decision`, `outcome`
  - opcionales: `sessionId`, `teacherAnswer`, `source`, flags de fallback/recall

## Outputs actuales relevantes
- `MedicalChatLearningRecord`
  - Campos sanitizados y auditables (`sanitizedPromptSummary`, `sanitizedTeacherAnswerSummary`, `queryHash`)
  - `rawTextStored: false`
  - `metadata: Record<string, unknown>` extensible

## Dependencias
- Node crypto/fs/path
- Tipos clinicos existentes (`MedicalCitation`, `MedicalAssistantRequest`, etc.)
- Persistencia append-only local (`MEDICAL_CHAT_LEARNING_PATH`)

## Formato actual de memoria
- JSONL append-only con registros `MedicalChatLearningRecord`
- No guarda query/answer crudos por contrato actual
- Incluye hash, conceptos, resumen sanitizado y citas

## Triggers actuales (antes de cambios)
- No hay detector estructurado de disparadores criticos por categoria clinica.
- Existen heuristicas de seguridad y aprendizaje:
  - `looksDiagnosticOrPatientSpecific(...)`
  - politicas de validacion/reuso
  - sanitizacion de PHI (email, telefono, documento, direccion, nombre, fecha)

## Riesgos PHI/PII observados
- Riesgo mitigado parcialmente: se sanitiza texto y no se guarda raw text.
- Riesgo residual: un resumen podria conservar informacion sensible contextual si no se detecta por regex existente.
- Riesgo funcional: ausencia de metadata clinica de relevancia critica dificulta seguimiento prudente estandarizado.

## Decision de alcance para FASE 2-4
- Sin metodo `_procesar_memoria_largo_plazo` existente, se refinara el punto equivalente (`recordAndTrain/record`) agregando un procesador interno privado con ese nombre para trazabilidad del requerimiento.
- Contrato publico se preserva: `recordAndTrain` y `record` mantienen firma y retorno.
- Integracion propuesta: metadata clinica segura en `record.metadata` (sin PHI cruda, sin diagnostico definitivo).
