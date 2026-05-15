# LAB DB REDIS CONNECTIVITY REPORT

Fecha: 2026-05-12
Objetivo: validar conectividad mínima sin startup de app ni migraciones.

## Verificación previa de targets

Desde `.env.runtime_lab`:
- `DATABASE_URL=postgresql://gsentinel_lab:gsentinel_lab@127.0.0.1:55432/gsentinel_runtime_lab`
- `REDIS_URL=redis://127.0.0.1:56379/0`

Confirmación: host loopback y puertos no estándar de lab.

## DB check (sin migraciones)

Comando:
- `docker exec gsentinel_postgres_runtime_lab psql -U gsentinel_lab -d gsentinel_runtime_lab -c "SELECT 1;"`

Resultado:
- `SELECT 1` exitoso.

## Redis check (sintético)

Comandos:
- `docker exec gsentinel_redis_runtime_lab redis-cli ping`
- `docker exec gsentinel_redis_runtime_lab redis-cli set runtime_lab:test "ok"`
- `docker exec gsentinel_redis_runtime_lab redis-cli get runtime_lab:test`
- `docker exec gsentinel_redis_runtime_lab redis-cli del runtime_lab:test`

Resultados:
- `PING -> PONG`
- `SET -> OK`
- `GET -> ok`
- `DEL -> 1`

## Resultado

Conectividad DB y Redis de laboratorio validada sin migraciones ni acceso a recursos productivos.
