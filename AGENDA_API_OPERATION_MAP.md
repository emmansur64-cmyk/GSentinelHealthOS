# AGENDA API OPERATION MAP

| operacion | archivo | funcion | acceso DB directo | endpoint HTTP existente | usa Prisma | caller actual | riesgo | prioridad migracion |
|---|---|---|---|---|---|---|---|---|
| create appointment (WhatsApp confirm) | `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts` | `handleConfirmAppointment` | si | no (in-process) | si | webhook WhatsApp -> worker | alto | alta |
| cancel appointment (WhatsApp) | `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts` | `handleCancelAppointment` | si | no | si | webhook WhatsApp -> worker | alto | media |
| reschedule appointment (WhatsApp) | `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts` | `handleRescheduleAppointment` | si | no | si | webhook WhatsApp -> worker | alto | media |
| availability lookup (WhatsApp propose) | `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts` | `handleCreateAppointment` + `findNextAvailableSlot` | si | no | si | webhook WhatsApp -> worker | medio | alta |
| create appointment (auto assign) | `medical-agenda-saas/src/services/appointmentEngine.ts` | `autoAssignAppointment` | si | `POST /api/appointments/auto-assign` (Next) | si | import/agenda parser, UI, jobs | alto | media |
| availability + overlap checks | `medical-agenda-saas/src/repositories/appointmentRepository.ts` | `verifySlotCoverageInRules`, `findOverlappingAppointment` | si | no | si | `appointmentEngine` | medio | media |
| create appointment (dashboard/app) | `medical-agenda-saas/src/app/api/appointments/route.ts` | `POST` | si | si (`/api/appointments`) | si | frontend dashboard | medio | baja |
| update appointment | `medical-agenda-saas/src/app/api/appointments/[id]/route.ts` | `PUT/PATCH` | si | si (`/api/appointments/:id`) | si | frontend dashboard | medio | baja |
| cancel appointment (delete soft) | `medical-agenda-saas/src/app/api/appointments/[id]/route.ts` | `DELETE` | si | si (`/api/appointments/:id`) | si | frontend dashboard | medio | baja |
| doctor schedule update status | `medical-agenda-saas/src/app/api/appointments/update-status/route.ts` | `POST` | si | si (`/api/appointments/update-status`) | si | doctor UI | medio | baja |
| create followup | `medical-agenda-saas/src/app/api/appointments/create-followup/route.ts` | `POST` | si | si (`/api/appointments/create-followup`) | si | doctor UI | medio | baja |
| create appointment (Agenda API) | `api/app/api/v1/endpoints/appointments.py` | `create_appointment` | no (endpoint; usa service SQLAlchemy) | si (`POST /api/v1/appointments`) | no | gateway/brain/dashboard internos | bajo | n/a (autoridad objetivo) |
| cancel appointment (Agenda API) | `api/app/api/v1/endpoints/appointments.py` | `cancel_appointment` | no | si (`DELETE /api/v1/appointments/{id}`) | no | gateway/brain/dashboard internos | bajo | n/a |
| reschedule appointment (Agenda API) | `api/app/api/v1/endpoints/appointments.py` | `reschedule_appointment` | no | si (`POST /api/v1/appointments/{id}/reschedule`) | no | gateway/brain/dashboard internos | bajo | n/a |
| confirm appointment (Agenda API) | `api/app/api/v1/endpoints/appointments.py` | `confirm_appointment` | no | si (`POST /api/v1/appointments/{id}/confirm`) | no | gateway/brain/dashboard internos | bajo | n/a |
| availability lookup (official single slot) | `api/app/api/v1/endpoints/appointments.py` | `validate_slot_gateway` | no | si (`POST /api/v1/appointments/gateway/validate-slot`) | no | gateway interno | bajo | alta para adopcion |
| doctor schedule + booking alt | `api/app/api/v1/endpoints/time_slots_simple.py` | `get_available_slots`, `book_slot` | no | si (`/api/v1/slots/*`) | no | integraciones slot-based | medio (doble contrato) | media |

## Hallazgo principal
- El bypass critico es `WhatsApp -> Prisma directo` en `conversation-engine`.
- El primer target seguro para autoridad explicita es redirigir `confirm create` de WhatsApp a `POST /api/v1/appointments`.
