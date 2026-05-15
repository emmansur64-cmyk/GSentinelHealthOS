# RUNTIME LAB SHUTDOWN ROLLBACK REPORT

Fecha: 2026-05-12
Objetivo: validar apagado seguro del lab y ausencia de residuos operativos.

## Estado previo

- Infraestructura lab levantada con `docker-compose.runtime-lab.yml`.
- DB lab en `127.0.0.1:55432`.
- Redis lab en `127.0.0.1:56379`.
- Stress multi-worker bloqueado por timeout de startup DB bajo multi-proceso.

## Acciones de rollback/shutdown

1. Se detuvo el compose lab dedicado.
2. Se verificó que no quedaran listeners del lab en los puertos no estándar.
3. Se evitó cualquier acción sobre el stack productivo.

## Criterios de seguridad

- Safe fallback documentado en `.env.runtime_lab`.
- No se tocaron datos productivos.
- No se ejecutaron migraciones destructivas.
- No se modificaron contratos API.

## Resultado esperado del drill

- DB lab apagada y contenedor eliminado del filtro `runtime_lab`.
- Redis lab apagado y contenedor eliminado del filtro `runtime_lab`.
- No quedaron listeners en `18080`, `55432` ni `56379`.
- El proceso Python del lab fue terminado explícitamente.
- No quedaron procesos lab visibles tras la verificación final.

## Nota

Si algún proceso sigue vivo después del apagado, debe terminarse explícitamente y no reutilizarse para canary.
