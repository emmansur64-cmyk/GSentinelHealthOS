# AGENDA API CALLER MIGRATION MAP

| caller actual | acceso viejo | acceso nuevo | compatibilidad | rollback | riesgo |
|---|---|---|---|---|---|
| WhatsApp confirm booking (`conversation-engine`) | `tx.appointment.create` directo Prisma | `POST /api/v1/appointments` via `agenda-api-client` | fallback legacy controlado por flag | volver a path legacy automatico si Agenda API falla | medio |
| WhatsApp availability puntual (`conversation-engine`) | `findNextAvailableSlot` local sin autoridad externa | validacion adicional por `POST /api/v1/appointments/gateway/validate-slot` | best-effort con fallback a lectura local | desactivar `AGENDA_API_AUTHORITY_ENABLED` | bajo |
| WhatsApp cancel booking | `tx.appointment.updateMany` directo | pendiente (siguiente fase: `DELETE /api/v1/appointments/{id}`) | guard + warning estructurado en fase actual | permanece legacy temporal | medio |
| WhatsApp reschedule | cancel + buscar slot local directo | pendiente (siguiente fase: `POST /api/v1/appointments/{id}/reschedule`) | guard + warning estructurado en fase actual | permanece legacy temporal | medio |

## Flags operativas
- `AGENDA_API_AUTHORITY_ENABLED` (default true)
- `AGENDA_API_ALLOW_LEGACY_WRITE_BYPASS` (default true para no romper runtime)
