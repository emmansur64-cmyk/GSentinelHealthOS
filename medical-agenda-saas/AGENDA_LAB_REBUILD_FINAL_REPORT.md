# AGENDA LAB REBUILD FINAL REPORT

Fecha local: 2026-05-12

## 1. Resumen ejecutivo

Se reconstruyo y levanto en LAB solo el frontend canonico de Agenda (`gs_frontend` / servicio `frontend`) para que el runtime ejecute el fix ya presente en fuente. El bug viejo `operator does not exist: text = uuid` no aparece despues del rebuild y la creacion de turnos LAB funciona.

## 2. Archivos tocados

Archivos de Agenda ya modificados antes de esta fase y ejecutados ahora en runtime:

- `src/app/api/appointments/route.ts`
- `src/app/api/appointments/[id]/route.ts`
- `src/app/api/appointments/update-status/route.ts`
- `src/app/api/appointments/create-followup/route.ts`
- `src/lib/whatsapp/conversation-engine.ts`

Archivo tocado en esta fase solo para desbloquear build:

- `src/chat/chat.service.ts`: se agrego `phone: true` al select de paciente.

Reportes creados:

- `AGENDA_LAB_REBUILD_PRECHECK.md`
- `AGENDA_LAB_BUILD_BLOCKER.md`
- `AGENDA_SOURCE_FIX_VERIFICATION.md`
- `AGENDA_LAB_REBUILD_REPORT.md`
- `AGENDA_LAB_POST_REBUILD_VALIDATION.md`
- `AGENDA_RUNTIME_FIX_CONFIRMATION.md`
- `AGENDA_LAB_REBUILD_ROLLBACK.md`
- `AGENDA_LAB_REBUILD_FINAL_REPORT.md`

## 3. Servicios rebuilt

- Rebuilt: `frontend`
- Recreated: `gs_frontend`
- No rebuilt: `gs_api`, DB, Redis, workers, gateway, inference, brain, decision, dialogue, nlg.

## 4. Fix externo aplicado

Aplicado, minimo:

- `src/chat/chat.service.ts:153`
- `select: { id: true, name: true, phone: true, notes: true }`

## 5. Build PASS/FAIL

- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `docker compose build frontend`: PASS

Warnings:

- Turbopack/NFT warning no bloqueante.
- `npm ci` dentro de Docker reporto vulnerabilidades npm existentes. No se ejecuto fix de dependencias.

## 6. Runtime anterior

- Container ID: `cf2dfc8978fbfb0838200d9d59f180600dfbfe0bb6cef25d50ce91b5e0651d61`
- Image ID: `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a`

## 7. Runtime nuevo

- Container ID: `670108f00f0826e5449f06d9f220e4e01a9efaba89d003b1729930371302b375`
- Image ID: `sha256:283589541a44b181cc4af611c779c1f78a9c2abb59cff84d63bb185c1298ee01`
- Health: healthy
- Puerto: `127.0.0.1:3000`

## 8. Smoke tests

PASS:

- home
- health
- rutas protegidas sin auth
- fake auth
- login LAB
- `/api/auth/me`
- `/api/doctors`
- `/api/patients`
- `/api/schedules`
- `/api/appointments/suggestions`
- crear turno LAB
- cancelar turno LAB
- no reasignacion silenciosa ante slot ocupado

## 9. WhatsApp LAB E2E

PASS:

- Webhook inbound firmado.
- Persistencia en `incoming_messages`.
- Resolucion de tenant por `LAB_TEST_PHONE_NUMBER_ID`.

BLOCKED/FAIL para E2E completo:

- `WHATSAPP_AUTO_BOOT_WORKERS=false`.
- El mensaje queda `pending`.
- `conversation_states=0`.
- No se creo appointment desde flujo WhatsApp.
- No se enviaron mensajes reales.

## 10. Riesgos pendientes

- WhatsApp conversacional E2E aun no demostrado.
- El tag local `gsentinelhealthos-frontend:latest` fue actualizado por el rebuild LAB.
- Worktree general sigue sucio por cambios previos no relacionados.
- No se debe marcar produccion real sin WhatsApp E2E, rollback operativo y monitoreo.

## 11. Veredicto

GO LAB.

NO-GO PRODUCCION REAL.

## Confirmaciones

- NO se toco produccion.
- NO se usaron pacientes reales.
- NO se enviaron WhatsApp reales.
- NO se toco `gs_api` legacy.
- NO se borraron tablas.
- NO se hizo deploy productivo.
- NO se uso `git add .`.

