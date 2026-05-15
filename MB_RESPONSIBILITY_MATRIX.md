# MB Responsibility Matrix

| Componente | MB-Chat | MB-Secretaria | MB-Whatsapp | Shared/Core | Accion requerida |
|---|---|---|---|---|---|
| Chat clinico | KEEP | REMOVE | REMOVE | - | Guardar en MB-Chat, desactivar en otros dominios |
| Reasoning clinico | KEEP | DISABLE | DISABLE | - | Guardas fail-closed |
| `doctor_professional` | KEEP | DISABLE | DISABLE | - | Guardas por dominio |
| `clinical_support` | KEEP | DISABLE | DISABLE | - | Guardas por dominio |
| Patient-facing triage automatico | DISABLE | DISABLE | DISABLE | - | No activar fuera de flujo autorizado |
| WhatsApp transport | REMOVE | REMOVE | KEEP | - | Guardas por dominio |
| WhatsApp booking | REMOVE | REMOVE | KEEP | - | Autoridad via Agenda API |
| Conversation engine WhatsApp | REMOVE | REMOVE | KEEP | - | Mantener solo en MB-Whatsapp |
| Confirmation/cancel/reschedule | REMOVE | REMOVE | KEEP | - | Agenda API como autoridad |
| Importacion de planillas | REMOVE | KEEP | REMOVE | - | Mantener solo en MB-Secretaria |
| OCR/document parsing | REMOVE | KEEP | REMOVE | - | Mantener solo en MB-Secretaria |
| Availability normalization | LEGACY_TEMP | KEEP | KEEP | SHARED | Migrar a cliente Agenda API compartido |
| Appointment direct actions | DISABLE | DISABLE | DISABLE | - | No usar DB directa; Agenda API |
| Agenda API client | KEEP | KEEP | KEEP | SHARED | SHARED |
| Contracts | KEEP | KEEP | KEEP | SHARED | SHARED |
| Validators | KEEP | KEEP | KEEP | SHARED | SHARED |
| Auth | KEEP | KEEP | KEEP | SHARED | SHARED |
| Tenant | KEEP | KEEP | KEEP | SHARED | SHARED |
| Logging/observabilidad | KEEP | KEEP | KEEP | SHARED | SHARED |
| Groq chat provider | KEEP | REMOVE | REMOVE | SHARED | Aislar por `GROQ_API_KEY_CHAT` |
| Groq secretaria provider | REMOVE | KEEP | REMOVE | SHARED | Aislar por `GROQ_API_KEY_SECRETARIA` |
| Groq WhatsApp provider | REMOVE | REMOVE | KEEP | SHARED | Aislar por `GROQ_API_KEY_WHATSAPP` |
| Prisma directo | REMOVE | REMOVE | REMOVE | - | No introducir acceso nuevo |
| Brain Core compatibility | KEEP | KEEP | KEEP | SHARED | Mantener contratos legacy |
