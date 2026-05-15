# Medical Runtime Context V1

Fecha: 2026-05-09
Entorno: LABORATORIO / DEV
Proyecto: `E:\GSentinelHealthOS\medical-agenda-saas`

## Estado

FASE MEDICAL RUNTIME CONTEXT V1 COMPLETA

Se implemento una capa auxiliar, apagada por defecto, para aportar contexto temporal, ambiental y epidemiologico basico al chat profesional medico. No diagnostica, no prescribe, no modifica scoring clinico y degrada siempre al flujo previo si falla.

## Arquitectura

Flujo integrado:

```text
doctor/route.ts
-> chat.service.ts
   -> medical-runtime-context
   -> medical-web-retrieval
   -> callGroqDoctorChat
```

La nueva capa vive aislada en:

```text
medical-agenda-saas/src/lib/medical-runtime-context/
```

No se mezclo con `medical-web-retrieval`, MetaBrain runtime ni llamadas internas de Groq. `chat.service.ts` es el unico punto que construye el runtime context; `groq-doctor-chat.ts` solo formatea el metadata recibido para incluir el bloque `RUNTIME CONTEXT`.

## Archivos creados

- `medical-agenda-saas/src/lib/medical-runtime-context/index.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/config.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/time-context.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/weather-context.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/environmental-alerts.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/epidemiology-context.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/cache.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/types.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/sanitizer.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/context-builder.ts`
- `medical-agenda-saas/src/lib/medical-runtime-context/audit.ts`
- `MEDICAL_RUNTIME_CONTEXT_IMPLEMENTATION.md`

## Archivos modificados

- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- `medical-agenda-saas/tests/nlp/groq-doctor-chat.test.ts`
- `.env.example`

## Flags nuevas

```env
MEDICAL_RUNTIME_CONTEXT_ENABLED=false
MEDICAL_RUNTIME_CONTEXT_WEATHER_ENABLED=true
MEDICAL_RUNTIME_CONTEXT_ALERTS_ENABLED=true
MEDICAL_RUNTIME_CONTEXT_CACHE_TTL_SECONDS=900
MEDICAL_RUNTIME_CONTEXT_TIMEOUT_MS=5000
```

Opcionales para LAB/DEV con ubicacion aproximada de clinica, nunca GPS exacto ni direccion de paciente:

```env
MEDICAL_RUNTIME_CONTEXT_TIMEZONE=America/Argentina/Buenos_Aires
MEDICAL_RUNTIME_CONTEXT_REGION=
MEDICAL_RUNTIME_CONTEXT_LATITUDE=
MEDICAL_RUNTIME_CONTEXT_LONGITUDE=
```

## APIs utilizadas

- Clima V1: Open-Meteo (`https://api.open-meteo.com/v1/forecast`) solo si `MEDICAL_RUNTIME_CONTEXT_ENABLED=true`, weather habilitado y existen coordenadas aproximadas configuradas.
- Epidemiologia V1: placeholder seguro sin scraping ni fetch externo.
- Alertas V1: derivadas de clima disponible, sin scraping y sin fuentes no oficiales.

## Fallback behavior

Si falla clima, parsing, timeout, cache, timezone o cualquier excepcion:

- el chat sigue;
- Groq no se bloquea;
- retrieval medico sigue;
- no se lanza 500 desde runtime context;
- se registra log de incidente;
- se devuelve contexto seguro vacio o parcial.

Con `MEDICAL_RUNTIME_CONTEXT_ENABLED=false`, `buildMedicalRuntimeContext` devuelve `null` y el metadata enviado al flujo actual permanece sin `medical_runtime_context`.

## Cache behavior

- Cache local en memoria.
- TTL configurable por `MEDICAL_RUNTIME_CONTEXT_CACHE_TTL_SECONDS`.
- No usa Redis.
- No usa DB.
- La clave se limita a tenant, timezone y region aproximada sanitizada; no incluye PHI, mensaje clinico ni ubicacion sensible.

## Privacidad

No se usa GPS exacto del paciente, direccion del paciente, tracking invasivo ni PHI para providers externos.

Permitido en V1:

- timezone general;
- region aproximada configurada;
- coordenadas aproximadas de clinica si se configuran manualmente en DEV/LAB;
- contexto ambiental agregado.

Auditoria sin PHI:

- timestamp;
- fallback aplicado;
- fuente weather;
- fuentes de alertas;
- cache hit/miss;
- errores/timeout sanitizados.

## Contexto enviado a Groq

Cuando esta habilitado y construido, Groq recibe un bloque separado:

```text
RUNTIME CONTEXT:
```

Incluye:

- fecha/hora;
- timezone;
- clima si existe;
- alertas ambientales;
- epidemiologia auxiliar;
- instruccion obligatoria.

Instruccion:

```text
Usar este contexto solo como informacion auxiliar. No asumir causalidad clinica automatica. No reemplazar criterio medico.
```

## Validaciones ejecutadas

- `MEDICAL_RUNTIME_CONTEXT_ENABLED=false`: OK, devuelve `null`.
- `MEDICAL_RUNTIME_CONTEXT_ENABLED=true`: OK, agrega contexto temporal sin depender de clima.
- Weather mock: OK, agrega clima y alerta de calor.
- Weather timeout: OK, fallback seguro.
- API externa falla: OK, fallback seguro.
- Timezone invalido: OK, fallback a UTC.
- Cache: OK, segundo request usa cache hit.
- Chat simple/runtime context: OK, contexto estable.
- Consulta medica/runtime context: OK, contexto estable.
- Retrieval medico OFF: OK.
- Retrieval medico ON mock: OK.
- Retrieval medico fallback: OK.
- `callGroqDoctorChat`: OK, tests pasan e incluyen `RUNTIME CONTEXT`.
- `npm run typecheck`: OK.
- `npm run build`: OK.

Build mantiene 2 warnings NFT de Turbopack ya existentes relacionados con trazado dinamico desde `next.config.ts`/`src/lib/prisma.ts`; no bloquean build y no fueron modificados en esta fase.

## Limitaciones V1

- No hay alertas oficiales en tiempo real de SMN/WHO/OPS/Ministerio de Salud todavia.
- No hay calidad de aire real todavia.
- No hay cache distribuido.
- No hay persistencia historica.
- Weather requiere coordenadas aproximadas configuradas; si no existen, se omite sin error.

## Que NO se toca

- Produccion.
- VPS.
- Dockerfile.
- docker-compose.
- Contenedores.
- Microservicios nuevos.
- Dependencias.
- Auth.
- Paneles.
- WhatsApp pipeline.
- MetaBrain runtime.
- Logica clinica existente.
- Scoring medico.
- `node_modules`.

## Riesgos pendientes

- Definir fuente oficial estable para alertas epidemiologicas antes de implementar fetch real.
- Definir politica de coordenadas aproximadas por tenant/clinica sin PHI.
- Considerar metricas operativas futuras para tasa de fallback, sin guardar datos sensibles.

## VALIDACION FECHA/HORA EN CHAT REAL

Fecha: 2026-05-09

Estado:

RUNTIME CONTEXT FECHA/HORA VALIDADO EN CHAT MEDICO

### Causa raiz exacta

El runtime context V1 estaba implementado e integrado, pero no llegaba al prompt real porque el archivo de entorno cargado por Next (`E:\GSentinelHealthOS\.env`) no tenia las variables `MEDICAL_RUNTIME_CONTEXT_*`.

Por diseno seguro, `MEDICAL_RUNTIME_CONTEXT_ENABLED` usa default `false`. Con esa variable ausente, `buildMedicalRuntimeContext` devuelve `null`, `chat.service.ts` no agrega `metadata.medical_runtime_context`, y Groq no recibe fecha/hora. En ese estado era esperable que respondiera que no tenia acceso a la fecha actual.

### Variable encontrada

Antes de la correccion:

- `E:\GSentinelHealthOS\.env`: existia, sin variables `MEDICAL_RUNTIME_CONTEXT_*`.
- `.env.local`: no existia.
- `.env.development`: no existia.
- `medical-agenda-saas\.env`: no existia.
- `medical-agenda-saas\.env.local`: no existia.
- `medical-agenda-saas\.env.development`: no existia.

Despues de la correccion:

```env
MEDICAL_RUNTIME_CONTEXT_ENABLED=true
MEDICAL_RUNTIME_CONTEXT_WEATHER_ENABLED=false
MEDICAL_RUNTIME_CONTEXT_ALERTS_ENABLED=false
MEDICAL_RUNTIME_CONTEXT_CACHE_TTL_SECONDS=900
MEDICAL_RUNTIME_CONTEXT_TIMEOUT_MS=5000
```

Para esta validacion se activo solo fecha/hora. Clima y alertas quedaron apagados.

### Integracion auditada

- `chat.service.ts` ejecuta `buildMedicalRuntimeContext` antes de `buildMedicalWebRetrievalContext`.
- Si el runtime context existe, se pasa como `metadata.medical_runtime_context` a `callGroqDoctorChat`.
- `groq-doctor-chat.ts` lee `metadata.medical_runtime_context` y agrega un bloque `RUNTIME CONTEXT` al payload enviado a Groq.
- El bloque aplica tambien para preguntas simples porque no depende de una consulta clinica ni de retrieval.
- Web retrieval no se dispara para: `hola sabes que dia es hoy`.

### Correccion de prompt

Se agrego al system prompt de Groq:

```text
Si el usuario pregunta fecha u hora, usa el RUNTIME CONTEXT provisto. No respondas que no tenes acceso a la fecha actual si el contexto esta presente.
```

### Archivos modificados

- `E:\GSentinelHealthOS\.env`
- `E:\GSentinelHealthOS\medical-agenda-saas\src\lib\groq-doctor-chat.ts`
- `E:\GSentinelHealthOS\medical-agenda-saas\tests\nlp\groq-doctor-chat.test.ts`
- `E:\GSentinelHealthOS\MEDICAL_RUNTIME_CONTEXT_IMPLEMENTATION.md`

### Pruebas ejecutadas

- Variables reales verificadas en `.env`: OK.
- Runtime context fecha/hora:
  - `hola sabes que dia es hoy`: genera `localDate`, `localTime`, `dayOfWeek`, timezone.
  - Weather desactivado: `weather=null`.
  - Alerts desactivado: `environmentalAlerts=[]`.
- Web retrieval:
  - `MEDICAL_WEB_RETRIEVAL_ENABLED=true`
  - pregunta `hola sabes que dia es hoy`
  - resultado: no dispara fetch ni retrieval.
- Prompt Groq:
  - `hola sabes qué día es hoy`
  - `qué hora es aproximadamente`
  - `estamos de noche o de día`
  - las tres incluyen `RUNTIME CONTEXT`, fecha, hora e instruccion explicita.
- `npx vitest run tests/nlp/groq-doctor-chat.test.ts`: OK, 4 tests.
- `npm run typecheck`: OK.
- `npm run build`: OK.

### Resultado final

Con `MEDICAL_RUNTIME_CONTEXT_ENABLED=true`, el chat medico debe responder preguntas de fecha/hora usando el runtime context. Ya no debe decir que no tiene acceso a la fecha actual cuando el contexto esta presente.
