# LAB DB REDIS STARTUP REPORT

Fecha: 2026-05-12
Objetivo: levantar infraestructura DB/Redis aislada de laboratorio.

## Opción usada

Opción A (Docker lab explícito) con archivo dedicado:
- `docker-compose.runtime-lab.yml`

## Servicios levantados

- `postgres_runtime_lab`
- `redis_runtime_lab`

## Puertos expuestos (loopback no estándar)

- PostgreSQL: `127.0.0.1:55432 -> 5432`
- Redis: `127.0.0.1:56379 -> 6379`

## Evidencia de salud

- `gsentinel_postgres_runtime_lab`: healthy
- `gsentinel_redis_runtime_lab`: healthy

## Aislamiento aplicado

- Red dedicada: `gsentinel_runtime_lab_net`
- Volumen dedicado: `gsentinel_runtime_lab_postgres_data`
- Sin servicios de app en este compose
- Sin uso de `docker-compose.yml` principal

## Riesgos y controles

- Se detectaron contenedores preexistentes del stack principal en la máquina (warning de orphan containers).
- Control aplicado: conexiones de validación limitadas a puertos loopback no estándar del lab.
- No se usaron puertos/product endpoints del stack principal.

## Resultado

Infraestructura lab aislada levantada correctamente, apta para pruebas de conectividad y startup/lifespan local.
