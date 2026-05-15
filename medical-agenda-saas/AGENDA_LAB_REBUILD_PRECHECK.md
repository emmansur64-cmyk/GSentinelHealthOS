# AGENDA LAB REBUILD PRECHECK

Fecha local: 2026-05-12 21:52:49 -03:00

## Alcance

Carpeta unica auditada y reconstruida: `E:\GSentinelHealthOS\medical-agenda-saas`.

No se uso `gs_api`/FastAPI legacy como backend de Agenda. No se uso DB `gsentinel` como DB canonica de Agenda. El servicio canonico de Compose para Agenda es `frontend`, container `gs_frontend`.

## Snapshot previo

Comandos de solo lectura ejecutados antes de tocar build/runtime LAB:

- `git status --short`
- `docker compose -f E:\GSentinelHealthOS\docker-compose.yml ps`
- `docker images --no-trunc`
- `docker inspect gs_frontend`
- `docker image inspect gsentinelhealthos-frontend`

## Runtime anterior de Agenda

| Campo | Valor |
|---|---|
| Compose file | `E:\GSentinelHealthOS\docker-compose.yml` |
| Compose project | `gsentinelhealthos` |
| Servicio | `frontend` |
| Container | `gs_frontend` |
| Container ID anterior | `cf2dfc8978fbfb0838200d9d59f180600dfbfe0bb6cef25d50ce91b5e0651d61` |
| Image ID anterior | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` |
| Image created anterior | `2026-05-09T22:42:57.790431547Z` |
| StartedAt anterior | `2026-05-12T13:25:23.15450248Z` |
| Puerto | `127.0.0.1:3000->3000/tcp` |
| Network | `gsentinelhealthos_gs_prod` |
| Mounts | sin bind mount de source |
| DB runtime | `gsentinel_saas` |
| DATABASE_URL | redactada |

## Backup local

Backup creado antes de editar:

`backups/agenda-lab-rebuild-20260512_213945/`

Archivos respaldados:

- `src/app/api/appointments/route.ts`
- `src/app/api/appointments/[id]/route.ts`
- `src/app/api/appointments/update-status/route.ts`
- `src/app/api/appointments/create-followup/route.ts`
- `src/lib/whatsapp/conversation-engine.ts`
- `src/chat/chat.service.ts`

## Worktree

El worktree ya estaba sucio antes de esta fase. No se uso `git add`, no se hizo commit y no se limpio el worktree.

