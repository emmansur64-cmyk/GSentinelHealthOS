# RUNTIME PORT 3000 DEV SHUTDOWN REPORT

Fecha local: 2026-05-15
Scope: `E:\GSentinelHealthOS\medical-agenda-saas`

## Objetivo

Apagar solo el proceso Next dev local que competia con Docker en puerto 3000.

## Accion Ejecutada

Se intento detener unicamente procesos cuyo command line coincidiera con:

- `medical-agenda-saas`
- `next`

Resultado:

```text
stopped PID 31456 "C:\Program Files\nodejs\node.exe" E:\GSentinelHealthOS\medical-agenda-saas\node_modules\next\dist\server\lib\start-server.js
PID 23108 ya no existia al intentar detenerlo; correspondia al padre next dev y se cerro junto con el proceso hijo.
```

No se apago Docker.
No se reinicio Docker.
No se toco `gs_frontend`.

## Validacion Posterior

`netstat -ano | findstr :3000`:

```text
TCP  127.0.0.1:3000  0.0.0.0:0  LISTENING  21416
```

Interpretacion:

- Ya no existe listener local Node en `0.0.0.0:3000`.
- Ya no existe listener local Node en `[::]:3000`.
- Solo queda Docker backend publicando `gs_frontend` en `127.0.0.1:3000`.

## Docker

`docker ps` mantiene `gs_frontend` activo:

```text
gs_frontend  gsentinelhealthos-frontend  127.0.0.1:3000->3000/tcp  Up 11 minutes (healthy)
```

## Procesos Locales

`Get-Process -Id 31456,23108` no devolvio procesos. Ambos PIDs quedaron apagados/no existentes.

## Health Checks

`http://127.0.0.1:3000/api/health`:

```json
{"ok":true,"data":{"status":"ok","service":"medical-agenda-saas","tenant_fallback_mode":"permissive","metabrain":{"connected":true,"channel":"redis.brain:integration:events"}}}
```

`http://localhost:3000/api/health`:

```json
{"ok":true,"data":{"status":"ok","service":"medical-agenda-saas","tenant_fallback_mode":"permissive","metabrain":{"connected":true,"channel":"redis.brain:integration:events"}}}
```

`http://[::1]:3000/api/health`:

```text
Connection refused
```

## Resultado

El conflicto operativo fue removido. `localhost:3000` y `127.0.0.1:3000` ya no entregan respuestas distintas.
