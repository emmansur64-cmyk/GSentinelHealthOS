# AGENDA LAB REBUILD REPORT

Fecha local: 2026-05-12

## Servicio reconstruido

Servicio Compose detectado: `frontend`.

Comandos ejecutados:

- `docker compose -f E:\GSentinelHealthOS\docker-compose.yml config --services`
- `docker compose -f E:\GSentinelHealthOS\docker-compose.yml build frontend`
- `docker compose -f E:\GSentinelHealthOS\docker-compose.yml up -d --no-deps frontend`

Se uso `--no-deps` para evitar recrear DB, Redis, `gs_api`, workers o servicios legacy.

## Runtime anterior vs nuevo

| Campo | Anterior | Nuevo |
|---|---|---|
| Container | `gs_frontend` | `gs_frontend` |
| Container ID | `cf2dfc8978fbfb0838200d9d59f180600dfbfe0bb6cef25d50ce91b5e0651d61` | `670108f00f0826e5449f06d9f220e4e01a9efaba89d003b1729930371302b375` |
| Image ID | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` | `sha256:283589541a44b181cc4af611c779c1f78a9c2abb59cff84d63bb185c1298ee01` |
| Image created | `2026-05-09T22:42:57.790431547Z` | `2026-05-13T00:47:51.44798174Z` |
| StartedAt | `2026-05-12T13:25:23.15450248Z` | `2026-05-13T00:48:17.259697489Z` |
| Health | healthy antes | healthy despues |
| Puerto | `127.0.0.1:3000->3000/tcp` | `127.0.0.1:3000->3000/tcp` |
| Network | `gsentinelhealthos_gs_prod` | `gsentinelhealthos_gs_prod` |

## Build

Docker build de `frontend`: PASS.

Warnings:

- `npm ci` reporto vulnerabilidades npm existentes dentro del build. No se ejecuto `npm audit fix` ni cambios de dependencias.
- Turbopack/NFT warning no bloqueante sobre trazado amplio.

## Servicios no reconstruidos

No se reconstruyo ni recreo:

- `gs_api`
- `gs_db`
- Redis
- workers Python
- decision/dialogue/nlg/inference
- gateway

## Estado post-rebuild

`gs_frontend`: `running`, `healthy`, imagen `sha256:283589541a44b181cc4af611c779c1f78a9c2abb59cff84d63bb185c1298ee01`.

