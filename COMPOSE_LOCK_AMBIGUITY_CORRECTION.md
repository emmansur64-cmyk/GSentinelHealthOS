# COMPOSE LOCK AMBIGUITY CORRECTION

Fecha: 2026-05-12  
Modo: correccion documental sin cambios de runtime  
Proyecto raiz: `E:\GSentinelHealthOS`

## Archivo movido

Archivo original:

`E:\GSentinelHealthOS\docker-compose.runtime-lock.yml`

Nueva ubicacion documental:

`E:\GSentinelHealthOS\docs\runtime-evidence\docker-compose.runtime-lock.yml`

El archivo ya no queda como compose alternativo en la raiz del proyecto.

## Compose unico operativo

Confirmado por `docker compose ls`:

- Compose project activo: `gsentinelhealthos`
- Config file activo: `E:\GSentinelHealthOS\docker-compose.yml`

Regla operacional:

El unico compose operativo valido del proyecto es `E:\GSentinelHealthOS\docker-compose.yml`.

## README documental

Se agrego `E:\GSentinelHealthOS\docs\runtime-evidence\README.md` indicando:

- `docker-compose.yml` es el unico compose operativo valido.
- `docker-compose.runtime-lock.yml` es solo evidencia documental.
- No debe usarse para deploy.
- No debe usarse con `docker compose up`.
- No reemplaza al compose real.
- No es fuente de verdad operativa.

## Runtime intacto

Validacion de solo lectura:

- `docker compose ls` muestra solo `E:\GSentinelHealthOS\docker-compose.yml` como config activa.
- `docker ps --no-trunc` mantiene 17 containers activos.
- No se ejecuto `docker compose up/down/build/pull`.
- No se recreo ningun container.
- No se reinicio ningun servicio.

## docker-compose.yml

`docker-compose.yml` no fue editado en esta correccion. El archivo ya aparecia modificado en `git status --short` antes de esta tarea y permanece como cambio preexistente del worktree.

## Imagenes y tags

No se modificaron imagenes ni tags. Los tags canonicos previamente creados permanecen intactos.

## Confirmacion final

- NO se modifico runtime.
- NO se reinicio nada.
- NO se hizo deploy.
- NO se hizo rebuild.
- NO se recreo ningun container.
- NO se modifico `docker-compose.yml`.
- NO se edito `.env`.
- NO se alteraron imagenes ni tags.
- NO se altero Git.
