# AGENDA LAB REBUILD ROLLBACK

Fecha local: 2026-05-12

## Estado previo

| Campo | Valor |
|---|---|
| Container anterior | `cf2dfc8978fbfb0838200d9d59f180600dfbfe0bb6cef25d50ce91b5e0651d61` |
| Image ID anterior | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` |
| StartedAt anterior | `2026-05-12T13:25:23.15450248Z` |

## Estado nuevo

| Campo | Valor |
|---|---|
| Container nuevo | `670108f00f0826e5449f06d9f220e4e01a9efaba89d003b1729930371302b375` |
| Image ID nuevo | `sha256:283589541a44b181cc4af611c779c1f78a9c2abb59cff84d63bb185c1298ee01` |
| StartedAt nuevo | `2026-05-13T00:48:17.259697489Z` |

## Rollback propuesto, NO ejecutado

Solo si el LAB queda roto:

```powershell
docker tag sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a gsentinelhealthos-frontend:rollback-lab-before-agenda-fix-20260512
docker tag sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a gsentinelhealthos-frontend:latest
docker compose -f E:\GSentinelHealthOS\docker-compose.yml up -d --no-deps frontend
docker inspect gs_frontend --format "{{.Image}} {{.State.StartedAt}} {{if .State.Health}}{{.State.Health.Status}}{{end}}"
```

Nota: ese rollback volveria al bug `text = uuid`. Debe usarse solo para recuperar LAB si la imagen nueva falla criticamente.

## Datos LAB creados durante smoke

Turnos LAB creados y cancelados:

- `f415588d-e315-400d-84b8-972130096919`
- `1e31950f-e1af-489b-aacc-54e5af472e61`

Mensaje WhatsApp LAB inbound:

- `wamid.LAB_REBUILD_20260512_166d8754c65747d3ba7fc68d2f5160e1`

No limpiar sin una tarea especifica de cleanup LAB.

## Riesgos

- El tag local `gsentinelhealthos-frontend:latest` ahora apunta a la imagen nueva. Esto es esperado por el rebuild LAB, pero debe quedar documentado para evitar confusion con snapshots previos.
- No se ejecuto rollback.

