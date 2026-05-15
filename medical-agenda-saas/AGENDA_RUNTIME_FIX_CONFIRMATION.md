# AGENDA RUNTIME FIX CONFIRMATION

Fecha local: 2026-05-12

## Runtime activo

| Campo | Valor |
|---|---|
| Container | `gs_frontend` |
| Servicio | `frontend` |
| Image ID | `sha256:283589541a44b181cc4af611c779c1f78a9c2abb59cff84d63bb185c1298ee01` |
| StartedAt | `2026-05-13T00:48:17.259697489Z` |
| Health | healthy |
| Puerto | `127.0.0.1:3000->3000/tcp` |
| Network | `gsentinelhealthos_gs_prod` |

## Caso viejo reproducido

Antes del rebuild, `POST /api/appointments` fallaba por runtime viejo con:

`operator does not exist: text = uuid`

Despues del rebuild:

- `POST /api/appointments`: 201 en turno LAB.
- Segundo intento mismo slot: 409 controlado `REQUESTED_SLOT_UNAVAILABLE`.
- No hubo 500.

## Logs

Busqueda en logs recientes de `gs_frontend`:

- `text = uuid`: sin hallazgos.
- `operator does not exist`: sin hallazgos.
- `relation doctors`: sin hallazgos.
- `P2010`: sin hallazgos.

## Confirmacion de backend

La Agenda validada usa `Next.js + Prisma` contra `gsentinel_saas`.

No se uso `gs_api`/FastAPI legacy para crear, listar o cancelar turnos LAB.

## PHI

Los logs revisados muestran datos LAB y redaccion de telefono en eventos WhatsApp. No se cargaron pacientes reales.

