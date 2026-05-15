# AGENDA API FIRST AUTHORITY TARGET

## Endpoint elegido
- `POST /api/v1/appointments` (Agenda API FastAPI)

## Por que este endpoint
- Ya existe y tiene validacion de auth/scope.
- Ya encapsula logica transaccional en `AppointmentService`.
- Soporta idempotencia via header.
- Permite migrar un caller de alto impacto (WhatsApp confirm) con cambio acotado.

## Callers actuales que puede absorber ahora
- WhatsApp booking confirm en `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts`.
- Flujo de validacion de disponibilidad puntual via `POST /api/v1/appointments/gateway/validate-slot`.

## Callers que aun quedan directos a Prisma
- cancel/reschedule en `conversation-engine` (con guard + warning, no migrados aun).
- `medical-agenda-saas/src/app/api/appointments/**` (dashboard/server routes)
- `medical-agenda-saas/src/services/appointmentEngine.ts`
- repositorios Prisma (`appointmentRepository.ts`, disponibilidad, imports)

## Riesgo tecnico
- Bajo a medio:
  - bajo por reutilizar endpoint existente
  - medio por coexistencia temporal con bypass legacy

## Orden de migracion seguro
1. WhatsApp confirm -> Agenda API create (implementado en esta fase).
2. WhatsApp cancel -> Agenda API cancel.
3. WhatsApp reschedule -> Agenda API reschedule.
4. Auto-assign y dashboard writes -> facade hacia Agenda API por dominio.
5. Reducir bypass legacy hasta enforcement estricto.
