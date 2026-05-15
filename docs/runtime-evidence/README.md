# Runtime Evidence

This directory contains documentary runtime evidence only.

The only valid operational Docker Compose file for this project is:

`E:\GSentinelHealthOS\docker-compose.yml`

`docker-compose.runtime-lock.yml` is only a documentary snapshot for traceability, rollback analysis and stabilization planning.

Do not use `docker-compose.runtime-lock.yml` for deploy. Do not run `docker compose up`, `docker compose down`, `docker compose build`, `docker compose pull` or any runtime operation with this file.

It does not replace the real compose file and is not the operational source of truth.
