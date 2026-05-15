# Agenda Import Dry-Run Precheck

Fecha: 2026-05-15
Modulo: medical-agenda-saas

## Alcance

- Se implementa solo en `medical-agenda-saas`.
- No se modifica MB-Secretaria, MB-Chat, MetaBrain ni MB-Whatsapp.
- No se hace deploy, restart, push ni commit.
- No se usan credenciales reales.

## Estado inicial

- Proyecto Next.js App Router.
- Scripts relevantes:
  - `npm exec vitest run tests/schedule-import-dry-run.test.ts`
  - `npm run typecheck`
  - `npm run build`
- No existia endpoint dry-run remoto para importacion de horarios.

## Decision tecnica

- Endpoint App Router: `POST /admin/schedule-import/dry-run`.
- Validacion contractual pura en memoria.
- Sin imports de Prisma.
- Sin consultas DB.
- Sin escrituras DB.
- Sin archivos persistidos por request.
- Sin logging de payload completo.
