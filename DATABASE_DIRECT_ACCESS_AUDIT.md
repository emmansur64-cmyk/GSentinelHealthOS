# Database Direct Access Audit

Fecha: 2026-05-15

Alcance: `medical-agenda-saas`. Esta fase audita Prisma directo; no se reemplazó Prisma.

## Resumen

`medical-agenda-saas` todavía opera como autoridad directa de agenda en varias rutas Next.js y servicios internos. La autoridad futura debería pasar por Agenda API HTTP, pero hoy los flujos de calendario, WhatsApp y auto-asignación escriben directo en BD mediante Prisma.

## Prisma Client

| Archivo | Evidencia | Clasificación |
|---|---|---|
| `medical-agenda-saas/src/lib/prisma.ts` | Crea `PrismaClient` y exporta `prisma`. | UNKNOWN |
| `medical-agenda-saas/prisma/seed.ts` | Seed con `new PrismaClient()`. | WRITE PATIENT / WRITE DOCTOR / UNKNOWN |

## Repositorios y Servicios

| Archivo | Operación | Clasificación | Migrable luego a Agenda API HTTP |
|---|---|---|---|
| `src/repositories/appointmentRepository.ts` | `upsertPatientByDocument`, `findOverlappingAppointment`, `createAppointmentRecord`. | WRITE PATIENT / READ ONLY / WRITE APPOINTMENT | Sí: patient lookup/upsert, overlap validation, appointment create. |
| `src/repositories/availabilityRepository.ts` | Lee doctores, duración de agenda, citas ocupadas. | READ ONLY / WRITE DOCTOR no detectado | Sí: availability/search endpoints. |
| `src/services/appointmentEngine.ts` | Auto-asignación: transacción Prisma, lock, paciente, turno, no-show. | WRITE APPOINTMENT / WRITE PATIENT / READ ONLY | Sí, pero requiere operación compuesta en Agenda API. |
| `src/services/appointmentLifecycleService.ts` | Lee y actualiza appointments por ciclo de vida. | WRITE APPOINTMENT | Sí: status/lifecycle endpoints. |
| `src/services/aiIntakeService.ts` | Crea/actualiza `doctorProfile` y `availabilityRule`. | WRITE DOCTOR | Sí: doctor schedule/availability endpoints. |
| `src/services/predictionEngine.ts` | Lee pacientes/turnos y escribe tablas de predicción/outcomes. | READ ONLY / WRITE CLINICAL o analytics | Parcial; no debe mezclarse con autoridad de agenda. |
| `src/lib/smart-schedule.ts` | Lee appointments y availability rules para slots. | READ ONLY | Sí: availability endpoint. |
| `src/lib/doctor-availability.ts` | Lee reglas, slots mensuales y appointments. | READ ONLY | Sí. |
| `src/lib/whatsapp/conversation-engine.ts` | Procesa WhatsApp y crea/cancela/reprograma appointments. | WRITE APPOINTMENT / READ ONLY | Sí, prioridad alta: WhatsApp debe llamar Agenda API, no Prisma. |
| `src/lib/whatsapp/metabrain-assistant.ts` | Lee doctores y reglas de disponibilidad. | READ ONLY | Sí. |

## Rutas Next.js que escriben turnos

| Ruta | Archivo | Acción | Clasificación |
|---|---|---|---|
| `GET /api/appointments` | `src/app/api/appointments/route.ts` | Lista appointments. | READ ONLY |
| `POST /api/appointments` | `src/app/api/appointments/route.ts` | Crea turno con lock y overlap check. | WRITE APPOINTMENT |
| `GET /api/appointments/:id` | `src/app/api/appointments/[id]/route.ts` | Lee turno. | READ ONLY |
| `PUT/PATCH /api/appointments/:id` | `src/app/api/appointments/[id]/route.ts` | Actualiza/reprograma turno. | WRITE APPOINTMENT |
| `DELETE /api/appointments/:id` | `src/app/api/appointments/[id]/route.ts` | Soft delete + `cancelled`. | WRITE APPOINTMENT |
| `POST /api/appointments/update-status` | `src/app/api/appointments/update-status/route.ts` | Cambia estado/reprograma. | WRITE APPOINTMENT |
| `POST /api/appointments/create-followup` | `src/app/api/appointments/create-followup/route.ts` | Crea seguimiento. | WRITE APPOINTMENT |
| `POST /api/appointments/auto-assign` | `src/app/api/appointments/auto-assign/route.ts` | Llama `autoAssignAppointment`. | WRITE APPOINTMENT / WRITE PATIENT |
| `GET /api/appointments/today` | `src/app/api/appointments/today/route.ts` | Lee turnos y contexto paciente. | READ ONLY / WRITE CLINICAL no detectado |
| `GET /api/appointments/suggestions` | `src/app/api/appointments/suggestions/route.ts` | Sugiere slots. | READ ONLY |

## Rutas relacionadas con pacientes/doctores

| Ruta | Archivo | Clasificación |
|---|---|---|
| `GET/POST /api/patients` | `src/app/api/patients/route.ts` | READ ONLY / WRITE PATIENT |
| `GET/PUT/DELETE /api/patients/:id` | `src/app/api/patients/[id]/route.ts` | READ ONLY / WRITE PATIENT |
| `GET/POST /api/doctors` | `src/app/api/doctors/route.ts` | READ ONLY / WRITE DOCTOR |
| `GET/PATCH /api/doctors/:id/availability` | `src/app/api/doctors/[id]/availability/route.ts` | READ ONLY / WRITE DOCTOR |
| `GET/POST /api/schedules` | `src/app/api/schedules/route.ts` | READ ONLY / WRITE DOCTOR |
| `GET/PUT/DELETE /api/schedules/:id` | `src/app/api/schedules/[id]/route.ts` | READ ONLY / WRITE DOCTOR |

## Hallazgos

- Prisma directo no está limitado a una capa: aparece en rutas, servicios, repositorios y lógica WhatsApp.
- `appointmentRepository.ts` concentra piezas útiles para una futura Agenda API, pero todavía recibe `Prisma.TransactionClient`.
- WhatsApp (`conversation-engine.ts`) mezcla conversación, selección de slot y escritura de turnos.
- El dashboard Next usa `/api/appointments` local como autoridad práctica actual.

## Ruta segura futura

1. Congelar contrato HTTP de Agenda API en FastAPI para create/read/update/cancel/availability.
2. Cubrir idempotencia, tenant y locks en Agenda API.
3. Migrar primero WhatsApp a HTTP.
4. Migrar `appointmentEngine.ts` como operación compuesta o cliente de Agenda API.
5. Migrar rutas Next de agenda a cliente HTTP.
6. Recién después retirar Prisma directo de `medical-agenda-saas` por zonas.
