# AGENDA SOURCE FIX VERIFICATION

Fecha local: 2026-05-12

## Busquedas ejecutadas

- `rg "::uuid|text\s*=\s*uuid|appointment.*text|message text|wa_id|appointment_id" src\app\api\appointments src\lib\whatsapp\conversation-engine.ts -n`
- `rg "phone: true|REQUESTED_SLOT_UNAVAILABLE|OVERLAP_CONFLICT|doctor_id\s*=\s*\$\{|id <> \$\{|::uuid" src\chat\chat.service.ts src\app\api\appointments src\lib\whatsapp\conversation-engine.ts -n`

## Fixes de Agenda confirmados en fuente

| Archivo | Linea aprox. | Bug original | Fix aplicado | Riesgo residual |
|---|---:|---|---|---|
| `src/app/api/appointments/route.ts` | 186 | comparacion `doctor_id = uuid` contra columna text generaba `operator does not exist: text = uuid` | removido cast `::uuid`; comparacion usa valor string Prisma | bajo en LAB; depende de mantener schema `doctor_id` como text/string |
| `src/app/api/appointments/[id]/route.ts` | 156-157 | cast `::uuid` en `doctor_id` e `id` | removido cast `::uuid` | bajo |
| `src/app/api/appointments/update-status/route.ts` | 98-99 | cast `::uuid` en `doctor_id` e `id` | removido cast `::uuid` | bajo |
| `src/app/api/appointments/create-followup/route.ts` | 68 | cast `::uuid` en `doctor_id` | removido cast `::uuid` | bajo |
| `src/lib/whatsapp/conversation-engine.ts` | 502 | cast `::uuid` en `doctor_id` durante confirmacion WhatsApp | removido cast `::uuid` | WhatsApp worker no procesado E2E en esta fase |

## No reasignacion silenciosa

Confirmado en fuente:

- `REQUESTED_SLOT_UNAVAILABLE` en create/update/follow-up cuando el slot sugerido no coincide con el solicitado.
- `OVERLAP_CONFLICT` en `POST /api/appointments`.

## Bloqueo externo de build

Archivo:

- `src/chat/chat.service.ts:153`

Cambio minimo:

- `select: { id: true, name: true, phone: true, notes: true }`

Impacto:

- Alinea el shape de paciente con el contrato ya existente. No modifica comportamiento funcional de Agenda.

