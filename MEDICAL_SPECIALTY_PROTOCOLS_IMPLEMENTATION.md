# MEDICAL SPECIALTY PROTOCOLS IMPLEMENTATION

## Estado

SPECIALTY PROTOCOLS V1 implementado en entorno LAB/DEV.

## Objetivo

Agregar una capa auxiliar para adaptar tono, razonamiento, red flags, evidencia y estructura clinica segun especialidad medica, sin modificar produccion ni tocar infraestructura.

## Arquitectura

Nueva libreria:

`medical-agenda-saas/src/lib/medical-specialty-protocols/`

Archivos creados:

- `types.ts`: contratos de protocolos, especialidades, riesgo y contexto.
- `registry.ts`: registry de especialidades y patrones.
- `protocol-loader.ts`: loader y detector de protocolo.
- `prompt-adapters.ts`: instrucciones de prompt y politica de evidencia.
- `risk-modifiers.ts`: modificadores de riesgo.
- `emergency-modifiers.ts`: modificadores de urgencia/escalamiento.
- `fallback.ts`: fallback seguro a medicina general.
- `context-builder.ts`: builder principal sin lanzar excepciones.
- `index.ts`: exports publicos.

Especialidades V1:

- cardiologia,
- psiquiatria,
- pediatria,
- neurologia,
- endocrinologia,
- medicina general,
- urgencias,
- psicologia.

## Integracion

Archivos modificados:

- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`

Flujo:

`doctor/route.ts -> chat.service.ts -> runtime context -> conversation memory -> web retrieval -> specialty protocols -> structured reasoning -> callGroqDoctorChat`

El protocolo se agrega como metadata opcional:

`metadata.medical_specialty_protocol`

Groq recibe el bloque:

`SPECIALTY MEDICAL PROTOCOL`

Este bloque se inserta junto al runtime context, retrieval y structured reasoning, antes del mensaje final del medico.

## Compatibilidad

Retrieval:

- Si retrieval esta disponible, el protocolo permite usar evidencia externa solo desde el bloque controlado.
- Si retrieval no esta disponible, indica no afirmar que se consultaron fuentes externas.

Runtime context:

- El contexto registra si runtime context esta disponible.
- No depende de clima/fecha/hora para funcionar.

Structured reasoning:

- Specialty protocols no reemplaza `STRUCTURED MEDICAL REASONING`.
- Actua como capa de adaptacion por especialidad y riesgo.

## Fallback

- Mensajes no clinicos no reciben protocolo.
- Consultas clinicas sin especialidad clara usan medicina general.
- Si ocurre una excepcion, se devuelve fallback seguro de medicina general.
- No bloquea Groq.
- No modifica scoring clinico.
- No inventa evidencia.

## Validaciones ejecutadas

- `npx vitest run tests/nlp/medical-specialty-protocols.test.ts tests/nlp/groq-doctor-chat.test.ts` OK.
- `npm run typecheck` OK.
- `npm run build` OK.

Casos cubiertos:

- specialty switching cardiologia,
- psiquiatria,
- pediatria,
- neurologia,
- endocrinologia,
- fallback medicina general,
- mensaje no clinico sin protocolo,
- compatibilidad retrieval ON/OFF,
- compatibilidad runtime context ON/OFF,
- prompt enviado a Groq con `SPECIALTY MEDICAL PROTOCOL`.

## Validaciones finales

Typecheck y build finalizaron correctamente. `next build` reporto una advertencia no bloqueante de Turbopack sobre tracing en `next.config.ts` via `src/lib/prisma.ts` y `src/app/api/public/register-clinic/route.ts`; no fue introducida ni modificada por esta fase.

## Que NO se toco

- Produccion.
- Dockerfile.
- docker-compose.
- MetaBrain runtime.
- WhatsApp pipeline.
- Paneles.
- Dependencias.
- Lockfile.

## Riesgos pendientes

- V1 usa patrones conservadores, no clasificador clinico entrenado.
- La adherencia final al formato depende del modelo.
- No sustituye protocolos institucionales locales ni criterio medico.
