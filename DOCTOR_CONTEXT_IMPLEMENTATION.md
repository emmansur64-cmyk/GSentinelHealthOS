# DOCTOR CONTEXT IMPLEMENTATION

## Estado

DOCTOR PROFILE CONTEXT V1 implementado en entorno LAB/DEV.

## Objetivo

Permitir que el chat medico profesional adapte sus respuestas al perfil del medico autenticado y al tenant actual, sin mezclar medicos, tenants ni preferencias.

Contexto cubierto:

- especialidad,
- pais/region,
- idioma,
- experiencia declarada,
- hospital/clinica,
- preferencias clinicas,
- protocolos preferidos,
- timezone medico.

## Arquitectura

Nueva libreria:

`medical-agenda-saas/src/lib/doctor-context/`

Archivos creados:

- `types.ts`: contratos del contexto de perfil medico.
- `loader.ts`: carga segura desde Prisma con `tenant_id + doctorUserId`.
- `specialty-context.ts`: adaptacion base por especialidad.
- `regional-guidelines.ts`: guias regionales auxiliares.
- `locale-adapters.ts`: pais, region, idioma y timezone.
- `timezone-adapters.ts`: guia de uso de timezone medico.
- `preference-isolation.ts`: preferencias no sensibles desde metadata explicita.
- `sanitizer.ts`: sanitizacion de strings/listas.
- `fallback.ts`: fallback seguro a medicina general.
- `index.ts`: exports publicos.

## Fuente de datos

Datos persistidos usados:

- `users.id`
- `users.tenant_id`
- `users.name`
- `tenants.nombre`
- `doctor_profiles.specialty`

Datos opcionales desde metadata del request:

- `metadata.doctor_context.country`
- `metadata.doctor_context.region`
- `metadata.doctor_context.language`
- `metadata.doctor_context.timezone`
- `metadata.doctor_context.experience`
- `metadata.doctor_context.clinicalStyle`
- `metadata.doctor_context.preferredProtocols`
- `metadata.doctor_context.evidencePreference`

No se usan matricula, secretos, tokens ni datos de otros tenants.

## Integracion

Archivos modificados:

- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`

Flujo:

`doctor/route.ts -> chat.service.ts -> doctor-context -> runtime context -> memory -> retrieval -> specialty protocols -> reasoning -> callGroqDoctorChat`

El contexto se agrega como:

`metadata.doctor_profile_context`

Groq recibe el bloque:

`DOCTOR PROFILE CONTEXT`

## Aislamiento

La carga consulta:

`User where id = doctorUserId AND tenant_id = tenantId AND active = true`

El contexto incluye scope explicito:

- `tenantId`
- `doctorUserId`
- `tenantScoped: true`
- `doctorScoped: true`
- `sharesAcrossTenants: false`

No hay cache compartida entre medicos o tenants.

## Compatibilidad

Retrieval:

- El contexto registra si hay evidencia externa disponible.
- No modifica retrieval ni sus fuentes.

Runtime context:

- El contexto registra si runtime context esta disponible.
- Timezone medico se usa como informacion operativa general.

Specialty protocols:

- Doctor context no reemplaza protocolos por especialidad.
- Solo aporta perfil del medico y preferencias.

## Fallback

Si el medico no existe en el tenant o falla Prisma:

- se usa medicina general,
- no se lanza excepcion al chat,
- se mantiene scope tenant/doctor del request,
- se registran errores en el payload,
- Groq puede continuar con contexto seguro.

## Validaciones ejecutadas

- `npx vitest run tests/nlp/doctor-context.test.ts tests/nlp/groq-doctor-chat.test.ts` OK.
- `npm run typecheck` OK.
- `npm run build` OK.

Casos cubiertos:

- multiples medicos,
- multiples tenants,
- fallback seguro si el medico no pertenece al tenant,
- sanitizacion de preferencias,
- compatibilidad retrieval ON/OFF,
- compatibilidad runtime context ON/OFF,
- prompt enviado a Groq con `DOCTOR PROFILE CONTEXT`.

## Validaciones finales

Typecheck y build finalizaron correctamente. `next build` reporto una advertencia no bloqueante de Turbopack sobre tracing en `next.config.ts` via `src/lib/prisma.ts`; no fue introducida ni modificada por esta fase.

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

- V1 depende de campos disponibles en el modelo actual; pais/region/idioma/timezone avanzados aun no estan persistidos como columnas.
- Preferencias se reciben desde metadata explicita y sanitizada; no existe todavia UI dedicada para administrarlas.
- No sustituye criterio medico ni protocolos institucionales locales.
