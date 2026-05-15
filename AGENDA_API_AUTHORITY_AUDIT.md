# Agenda API Authority Audit

Fecha: 2026-05-15

## 1. ¿Existe Agenda API real?

Existe una Agenda API implícita en FastAPI bajo `api/app/api/v1/endpoints/appointments.py` y endpoints de slots bajo `api/app/api/v1/endpoints/time_slots_simple.py`. Sin embargo, todavía no es autoridad única porque `medical-agenda-saas` escribe directo en BD con Prisma.

## 2. Endpoints que ya pueden actuar como autoridad

| Operación | Endpoint FastAPI | Estado |
|---|---|---|
| Crear turno | `POST /api/v1/appointments` | Existe, transaccional vía `AppointmentService`. |
| Encolar reserva | `POST /api/v1/appointments/queue/enqueue` | Existe, idempotencia por header. |
| Leer resultado async | `GET /api/v1/appointments/queue/result/{request_id}` | Existe. |
| Leer turno | `GET /api/v1/appointments/{appointment_id}` | Existe. |
| Leer turnos paciente | `GET /api/v1/appointments/patient/{patient_id}` | Existe. |
| Leer turnos doctor | `GET /api/v1/appointments/doctor/{doctor_id}` | Existe. |
| Cancelar turno | `DELETE /api/v1/appointments/{appointment_id}` | Existe. |
| Confirmar turno | `POST /api/v1/appointments/{appointment_id}/confirm` | Existe. |
| Reprogramar turno | `POST /api/v1/appointments/{appointment_id}/reschedule` | Existe. |
| Validar slot | `POST /api/v1/appointments/gateway/validate-slot` | Existe, interno. |
| Generar slots | `POST /api/v1/slots/generate` | Existe. |
| Disponibilidad | `GET /api/v1/slots/available` | Existe. |
| Reservar slot | `POST /api/v1/slots/book` | Existe. |
| Cancelar slot appointment | `POST /api/v1/slots/appointments/{appointment_id}/cancel` | Existe. |
| Reprogramar slot appointment | `POST /api/v1/slots/appointments/{appointment_id}/reschedule` | Existe. |
| Doctores | `api/app/api/v1/endpoints/doctors.py` | Existe CRUD básico. |
| Pacientes | `api/app/api/v1/endpoints/patients.py` | Existe CRUD básico y shadow patient. |

## 3. Operaciones que siguen yendo directo a Prisma

- Next `/api/appointments` crea, lee, actualiza y cancela turnos directo con Prisma.
- Next `/api/appointments/update-status` cambia estado directo con Prisma.
- Next `/api/appointments/create-followup` crea seguimiento directo con Prisma.
- `appointmentEngine.ts` auto-asigna con transacción Prisma.
- `whatsapp/conversation-engine.ts` crea, cancela y reprograma turnos directo con Prisma.
- `aiIntakeService.ts` crea doctores/reglas de agenda directo con Prisma.
- Rutas de pacientes, doctores y schedules en Next siguen usando Prisma.

## 4. Qué falta para que `medical-agenda-saas` use HTTP

- Cliente HTTP interno de Agenda API con tenant headers, API key y manejo de errores.
- Contrato estable de idempotencia para create/update/cancel.
- Scopes formales para update/cancel/reschedule.
- Adaptación de modelos entre Prisma/Next y schemas FastAPI.
- Estrategia de compatibilidad para dashboard Next: primero proxy HTTP, luego retirar Prisma por zonas.
- Pruebas de paridad entre Prisma actual y Agenda API.

## 5. Orden seguro de migración

1. Fijar contrato de Agenda API y matriz de scopes.
2. Migrar WhatsApp a Agenda API HTTP porque es el mayor riesgo de mezcla de responsabilidades.
3. Migrar auto-asignación (`appointmentEngine.ts`) a operación HTTP o endpoint compuesto.
4. Migrar rutas Next `/api/appointments*` a cliente HTTP manteniendo respuesta compatible.
5. Migrar pacientes/doctores/schedules.
6. Remover Prisma del runtime Next solo cuando no haya rutas críticas dependientes.

## Decisión de esta fase

No se migró Prisma. Se dejó Agenda API identificada como autoridad futura y se endureció la validación de scopes en endpoints FastAPI de agenda donde ya existían scopes declarados.
