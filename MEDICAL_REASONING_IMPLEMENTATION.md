# MEDICAL REASONING IMPLEMENTATION

## Estado

STRUCTURED MEDICAL REASONING V1 implementado en entorno LAB/DEV.

## Objetivo

Agregar una capa de formato y seguridad para respuestas clinicas del chat medico profesional, sin cambiar el runtime de produccion ni la logica de retrieval, runtime context, memoria conversacional o MetaBrain.

La capa estructura respuestas clinicas en:

- Resumen clinico
- Hipotesis
- Factores de riesgo
- Red flags
- Evidencia utilizada
- Sugerencias de evaluacion
- Limitaciones
- Disclaimer clinico

## Arquitectura

Nueva libreria:

`medical-agenda-saas/src/lib/medical-reasoning/`

Archivos creados:

- `types.ts`: contratos de entrada/salida, severidad y especialidad.
- `templates.ts`: secciones e instruccion base de razonamiento estructurado.
- `specialty-adapters.ts`: adaptadores simples para general, medicina interna, psiquiatria y pediatria.
- `severity.ts`: deteccion de baja complejidad, moderada y urgente.
- `context-builder.ts`: builder seguro que decide si corresponde estructurar la respuesta clinica.
- `index.ts`: exports publicos.

## Integracion

Archivo modificado:

- `medical-agenda-saas/src/chat/chat.service.ts`

Flujo:

`doctor/route.ts -> chat.service.ts -> medical-runtime-context -> medical-conversation-memory -> medical-web-retrieval -> medical-reasoning -> callGroqDoctorChat`

El razonamiento se calcula despues de retrieval para conocer si existe evidencia externa controlada. El resultado se agrega como metadata opcional:

`metadata.medical_reasoning`

Archivo modificado:

- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`

Groq recibe un bloque explicito:

`STRUCTURED MEDICAL REASONING`

Este bloque se inserta antes del mensaje final del medico y contiene instruccion obligatoria, especialidad, severidad, secciones requeridas, guia por especialidad, escalamiento de urgencia y politica de evidencia.

## Fallback seguro

- Si el mensaje no es clinico y no hay contexto de paciente, no se agrega reasoning estructurado.
- Si falla el builder, devuelve un contexto fallback de baja severidad, sin lanzar excepcion.
- No bloquea Groq.
- No modifica retrieval.
- No modifica runtime context.
- No modifica memoria conversacional.
- No altera scoring clinico ni afirma diagnosticos absolutos.

## Seguridad clinica

La instruccion obliga a:

- no afirmar diagnosticos absolutos,
- no reemplazar criterio medico,
- no inventar evidencia,
- declarar limitaciones,
- usar evidencia externa solo si esta presente en el bloque de retrieval,
- priorizar evaluacion presencial/guardia ante urgencia.

## Validaciones ejecutadas

- `npx vitest run tests/nlp/medical-reasoning.test.ts tests/nlp/groq-doctor-chat.test.ts` OK.
- `npm run typecheck` OK.
- `npm run build` OK.

Casos cubiertos:

- consulta no clinica: no fuerza estructura,
- baja complejidad: estructura completa,
- urgencia: formato emergency y escalamiento,
- psiquiatria: adaptador especifico,
- pediatria: adaptador especifico,
- medicina interna: adaptador especifico,
- retrieval OFF: politica indica no afirmar evidencia externa,
- retrieval ON: politica permite usar evidencia externa controlada,
- Groq prompt: incluye `STRUCTURED MEDICAL REASONING`.

## Validaciones finales

Typecheck y build finalizaron correctamente. `next build` reporto una advertencia de Turbopack sobre tracing en `next.config.ts` via `src/lib/prisma.ts` y `src/app/api/public/register-clinic/route.ts`; no bloqueo compilacion y no fue modificada por esta fase.

## Que NO se toco

- Produccion.
- Dockerfile.
- docker-compose.
- MetaBrain runtime.
- WhatsApp pipeline.
- Paneles.
- medical-web-retrieval.
- medical-runtime-context.
- Dependencias.
- Lockfile.

## Riesgos pendientes

- El formato final depende de adhesion del modelo al prompt.
- La deteccion de especialidad V1 usa patrones conservadores, no clasificador clinico.
- No hay evaluacion automatica semantica de calidad clinica de la respuesta final.
