# RUNTIME PORT 3000 CONFLICT PRECHECK

Fecha local: 2026-05-15
Scope: `E:\GSentinelHealthOS\medical-agenda-saas`

## Objetivo

Auditar conflicto local del puerto 3000 antes de normalizar runtime.

## Estado Git

`git status --short` muestra cambios de trabajo preexistentes/no commiteados:

```text
 M .env.example
 M MB-Secretaria/.env.example
 M MB-Secretaria/src/config/env.config.ts
 M MB-Secretaria/src/import-preview/import-preview.module.ts
 M MB-Secretaria/src/import-preview/schedule-import-parser.service.ts
 M docker-compose.yml
 M medical-agenda-saas/src/app/api/import/agenda/parse/route.ts
?? MB-Secretaria/src/import-preview/schedule-import-parser.service.spec.ts
?? MB-Secretaria/src/providers/
?? medical-agenda-saas/tests/agenda-import-groq-secretaria.test.ts
```

## Docker

`docker ps` confirma `gs_frontend` activo y healthy:

```text
gs_frontend  gsentinelhealthos-frontend  127.0.0.1:3000->3000/tcp  Up 11 minutes (healthy)
```

No se detecto necesidad de reiniciar Docker.

## Puerto 3000

`netstat -ano | findstr :3000`:

```text
TCP  0.0.0.0:3000    0.0.0.0:0  LISTENING  31456
TCP  127.0.0.1:3000  0.0.0.0:0  LISTENING  21416
TCP  [::]:3000       [::]:0     LISTENING  31456
```

Interpretacion:

- PID `21416`: Docker backend publicando `gs_frontend` en `127.0.0.1:3000`.
- PID `31456`: proceso Node local escuchando en `0.0.0.0:3000` y `[::]:3000`.

## Procesos Next dev

`Get-Process -Id 31456,23108`:

```text
23108 node C:\Program Files\nodejs\node.exe
31456 node C:\Program Files\nodejs\node.exe
```

`Get-CimInstance Win32_Process`:

```text
23108 node.exe "node" "E:\GSentinelHealthOS\medical-agenda-saas\node_modules\.bin\\..\next\dist\bin\next" dev
31456 node.exe "C:\Program Files\nodejs\node.exe" E:\GSentinelHealthOS\medical-agenda-saas\node_modules\next\dist\server\lib\start-server.js
```

Conclusion: ambos procesos pertenecen claramente a Next dev local del proyecto `medical-agenda-saas`.

## Health Checks

`http://127.0.0.1:3000/api/health`:

```json
{"ok":true,"data":{"status":"ok","service":"medical-agenda-saas","tenant_fallback_mode":"permissive","metabrain":{"connected":true,"channel":"redis.brain:integration:events"}}}
```

`http://localhost:3000/api/health`:

```json
{"ok":true,"data":{"status":"degraded","service":"medical-agenda-saas","tenant_fallback_mode":"permissive","metabrain":{"connected":false,"channel":"redis.brain:integration:events"}}}
```

`http://[::1]:3000/api/health`:

```json
{"ok":true,"data":{"status":"degraded","service":"medical-agenda-saas","tenant_fallback_mode":"permissive","metabrain":{"connected":false,"channel":"redis.brain:integration:events"}}}
```

## Diagnostico

Hay dos runtimes locales sirviendo puerto 3000:

- Docker production en `127.0.0.1:3000`, container `gs_frontend`, health `ok`.
- Next dev local en IPv4 wildcard e IPv6 wildcard, PIDs `23108` y `31456`, health `degraded`.

`localhost:3000` resuelve hacia el runtime dev local por IPv6, por eso puede diferir de `127.0.0.1:3000`.

## Accion Recomendada Para Fase 2

Apagar solo Next dev local:

- PID `31456`
- PID padre `23108`

No apagar Docker. No reiniciar Docker. No tocar `gs_frontend`.
