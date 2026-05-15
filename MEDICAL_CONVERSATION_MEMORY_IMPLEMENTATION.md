# Medical Conversation Memory V1

Fecha: 2026-05-09
Entorno: LABORATORIO / DEV
Sistema: `E:\GSentinelHealthOS\medical-agenda-saas`

## Estado

MEMORIA CLINICA CONVERSACIONAL V1 IMPLEMENTADA

Se implemento una memoria conversacional clinica acotada para el chat profesional medico. No crea almacenamiento nuevo, no usa memoria infinita y no mezcla conversaciones entre tenants/pacientes porque toma como fuente unica la conversacion ya resuelta y filtrada por `chat.service.ts`.

## Arquitectura

Nueva carpeta:

```text
src/lib/medical-conversation-memory/
```

Archivos:

- `index.ts`
- `types.ts`
- `config.ts`
- `memory-manager.ts`
- `summarizer.ts`
- `token-budget.ts`
- `sanitizer.ts`
- `audit.ts`

Integracion:

```text
doctor/route.ts
-> chat.service.ts
   -> resolveClinicalContext
   -> medical-conversation-memory
   -> medical-runtime-context
   -> medical-web-retrieval
   -> callGroqDoctorChat
```

Groq recibe un bloque separado:

```text
MEMORIA CLINICA CONVERSACIONAL:
```

## Fuente de memoria

La memoria V1 usa los intercambios recientes ya disponibles en `resolved.conversationHistory`.

Esa fuente ya esta:

- filtrada por tenant;
- filtrada por `conversationId`;
- ligada al doctor;
- ligada al paciente/turno cuando existen;
- filtrada por ultimo clear/tombstone;
- limitada a intercambios recientes.

No consulta otras conversaciones. No cruza pacientes. No cruza tenants.

## Contenido recordado

- resumen comprimido de la conversacion reciente;
- decisiones/conductas recientes;
- medicamentos mencionados;
- hipotesis o diagnosticos diferenciales recientes;
- especialidad/contexto medico si aparece;
- estado de conversacion activa.

## Contenido no recordado

- secretos;
- tokens/API keys/passwords;
- emails;
- telefonos;
- documentos identificatorios;
- sesiones borradas;
- conversaciones de otros pacientes/tenants.

## Politicas

Flags:

```env
MEDICAL_CONVERSATION_MEMORY_ENABLED=true
MEDICAL_CONVERSATION_MEMORY_MAX_EXCHANGES=12
MEDICAL_CONVERSATION_MEMORY_MAX_SUMMARY_CHARS=1800
MEDICAL_CONVERSATION_MEMORY_TTL_HOURS=12
MEDICAL_CONVERSATION_MEMORY_MAX_MEDICATIONS=8
MEDICAL_CONVERSATION_MEMORY_MAX_HYPOTHESES=8
MEDICAL_CONVERSATION_MEMORY_MAX_DECISIONS=8
```

Defaults seguros si no se configuran:

- enabled: `true`
- max exchanges: `12`
- max summary chars: `1800`
- TTL: `12h`

La memoria es derivada y efimera: no se persiste como tabla nueva.

## Fallback

Si falla sanitizacion, compresion, parsing o construccion:

- se audita el incidente;
- no se rompe el chat;
- se devuelve memoria vacia segura;
- Groq/Brain/MetaBrain siguen por el flujo previo.

Si `MEDICAL_CONVERSATION_MEMORY_ENABLED=false`, el builder devuelve `null` y no agrega metadata.

## Privacidad y PHI

El sanitizador redacta:

- emails;
- telefonos;
- documentos;
- tokens/secrets/passwords/API keys;
- HTML residual/caracteres peligrosos.

La auditoria no guarda PHI ni contenido de la memoria; solo tamanos, counts, scope tecnico y fallback.

## Archivos modificados

- `src/chat/chat.service.ts`
- `src/lib/groq-doctor-chat.ts`
- `tests/nlp/groq-doctor-chat.test.ts`

## Validaciones ejecutadas

- Conversacion larga/compresion: cubierta por `medical-conversation-memory.test.ts`.
- Sanitizacion PHI: email y telefono quedan como `[REDACTED_EMAIL]` y `[REDACTED_PHONE]`.
- Aislamiento tenant/paciente: el scope queda en la memoria y se deriva desde la conversacion resuelta.
- Fallback disabled: `MEDICAL_CONVERSATION_MEMORY_ENABLED=false` devuelve `null`.
- Inyeccion a Groq: `groq-doctor-chat.test.ts` valida `MEMORIA CLINICA CONVERSACIONAL`.
- Retrieval OFF: OK.
- Runtime context: OK.
- `npm run typecheck`: OK.

## Riesgos pendientes

- V1 usa resumen heuristico local, no LLM summarizer, para evitar llamadas extra y PHI innecesaria.
- No hay persistencia materializada de memoria; se recalcula desde `audit_logs` recientes.
- Si se requiere memoria longitudinal formal, debe agregarse un modelo separado con `tenant_id`, `patient_id`, `deleted_at`, TTL y politicas PHI explicitas.

