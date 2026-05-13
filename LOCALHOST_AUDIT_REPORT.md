# Localhost Audit Report

Fecha: 2026-05-12
Repositorio auditado: `E:\GSentinelHealthOS`

## 1. Resumen ejecutivo

Auditoria solo lectura de puertos, procesos, Docker, endpoints HTTP y proyectos levantables.

Hallazgos principales:

- Hay 8 localhost HTTP del sistema publicados por Docker Desktop: `3000`, `8000`, `8001`, `8002`, `8010`, `8011`, `8012`, `8013`.
- Todos esos puertos pertenecen al compose activo `gsentinelhealthos`, definido por `E:\GSentinelHealthOS\docker-compose.yml`.
- El panel activo en `http://127.0.0.1:3000` es Next.js, titulo HTML `GSentinelHealth OS`, container `gs_frontend`, imagen `gsentinelhealthos-frontend`.
- El frontend activo se construye desde `E:\GSentinelHealthOS\medical-agenda-saas`, no desde `E:\GSentinelHealthOS\Panel GSentinelHS`.
- La ruta indicada como unica valida, `E:\GSentinelHealthOS\Panel GSentinelHS`, no existe en el filesystem auditado.
- No hay listeners activos en `3001`, `5173`, `5174`, `8080`, `11434`, `6379`, `55432`, `55433`, `56379`, `56380`, `18080` ni `18090`.
- `5432` esta escuchando en host `0.0.0.0` y `::` por un PostgreSQL Windows local (`postgres.exe`, PID `5164`), no por el container `gs_db`.
- Docker Redis y Docker Postgres estan activos dentro de la red compose, pero no publicados al host.
- No se detecto Vite activo.
- No se detecto Ollama activo.
- No se mataron procesos, no se reiniciaron servicios, no se modificaron archivos de configuracion, no se hizo deploy.

Nota operacional: `docker compose config` expone variables de entorno resueltas. Se uso solo para confirmar puertos/rutas y no se reproducen secretos en este reporte.

## 2. Todos los localhost detectados

| Localhost | Estado | Origen | Fingerprint | Observaciones |
|---|---:|---|---|---|
| `http://127.0.0.1:3000/` | 200 | Docker `gs_frontend` | `X-Powered-By: Next.js`, titulo `GSentinelHealth OS` | Panel principal activo. Build context: `medical-agenda-saas`. |
| `http://127.0.0.1:8000/` | 200 | Docker `gs_api` | `Server: uvicorn`, JSON `GSentinelHealthOS API` | Backend API. |
| `http://127.0.0.1:8001/` | 404 en `/`, 200 en `/health` | Docker `gs_brain` | `brain-orchestrator`, OpenAPI title `GSentinelH - Orquestador Central Inteligente` | Meta/orquestador HTTP. |
| `http://127.0.0.1:8002/` | 200 | Docker `gs_gateway` | `Server: uvicorn`, JSON `GSentinelHealthOS WhatsApp Gateway` | Gateway WhatsApp. |
| `http://127.0.0.1:8010/` | 404 en `/`, 200 en `/health` | Docker `gs_dialogue_engine` | `dialogue_engine`, OpenAPI title `dialogue-engine` | Runtime auxiliar. |
| `http://127.0.0.1:8011/` | 404 en `/`, 200 en `/health` | Docker `gs_inference_service` | `model_loaded: true`, `model_version: 3.0.0`, OpenAPI title `inference-service` | Servicio IA inference activo. |
| `http://127.0.0.1:8012/` | 404 en `/`, 200 en `/health` | Docker `gs_decision_service` | `decision_service`, OpenAPI title `decision-service` | Runtime auxiliar. |
| `http://127.0.0.1:8013/` | 404 en `/`, 200 en `/health` | Docker `gs_nlg_service` | `nlg-service`, OpenAPI title `nlg-service` | Servicio IA/NLG activo. |
| `http://127.0.0.1:4890/` | 400 | VS Code `Code.exe`, PID `67268` | No identificado como app GSentinel | Puerto interno de VS Code/NodeService. |
| `http://127.0.0.1:19294/` | No HTTP | Adobe `AdobeCollabSync.exe`, PID `49456` | Error de transporte HTTP | No pertenece al sistema principal. |
| `http://127.0.0.1:30329/` | Timeout | VS Code `Code.exe`, PID `67268` | No identificado como app GSentinel | Puerto interno de VS Code/NodeService. |
| `http://127.0.0.1:65223/` | 404 | VS Code Pylance `Code.exe`, PID `54304` | No identificado como app GSentinel | Puerto interno extension Python/Pylance. |

Puertos esperados revisados y no activos: `3001`, `5173`, `5174`, `8080`, `11434`, `6379`, `55432`, `55433`, `56379`, `56380`, `18080`, `18090`.

## 3. Todos los puertos escuchando

### TCP LISTENING

| Puerto | Bind | PID | Proceso | Tipo | Origen | Ruta / comando | Observaciones |
|---:|---|---:|---|---|---|---|---|
| 135 | `0.0.0.0`, `::` | 1556 | `svchost.exe` | Windows | Sistema | No disponible via CIM | RPC/Windows, no app. |
| 139 | IPs locales varias | 4 | `System` | Windows | Sistema | N/A | NetBIOS/SMB, no app. |
| 445 | `::` | 4 | `System` | Windows | Sistema | N/A | SMB, no app. |
| 2179 | `0.0.0.0`, `::` | 2228 | `vmms.exe` | Hyper-V/WSL | Sistema | No disponible via CIM | Virtual Machine Management. |
| 3000 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | Next.js / Docker | `gs_frontend` | Docker Desktop services | Panel GSentinelHealth OS. |
| 4890 | `127.0.0.1` | 67268 | `Code.exe` | VS Code | IDE | VS Code NodeService | No pertenece al runtime principal. |
| 5040 | `0.0.0.0` | 2248 | `svchost.exe` | Windows | Sistema | No disponible via CIM | Windows service, no HTTP app. |
| 5432 | `0.0.0.0`, `::` | 5164 | `postgres.exe` | PostgreSQL | Host Windows | Path no disponible en `Get-Process` | PostgreSQL local expuesto en host. No es `gs_db` Docker. |
| 7680 | `::` | 6360 | `svchost.exe` | Windows | Sistema | No disponible via CIM | Windows delivery optimization, no app. |
| 8000 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | Python/FastAPI/Docker | `gs_api` | Docker Desktop services | API principal. |
| 8001 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | Python/FastAPI/Docker | `gs_brain` | Docker Desktop services | Brain orchestrator. |
| 8002 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | Python/FastAPI/Docker | `gs_gateway` | Docker Desktop services | WhatsApp Gateway. |
| 8010 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | Python/FastAPI/Docker | `gs_dialogue_engine` | Docker Desktop services | Dialogue engine. |
| 8011 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | IA inference/Docker | `gs_inference_service` | Docker Desktop services | Inference activo, model loaded. |
| 8012 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | Python/FastAPI/Docker | `gs_decision_service` | Docker Desktop services | Decision service. |
| 8013 | `127.0.0.1` | 61348 | `com.docker.backend.exe` | IA NLG/Docker | `gs_nlg_service` | Docker Desktop services | NLG service. |
| 19294 | `127.0.0.1` | 49456 | `AdobeCollabSync.exe` | Adobe | Externo | `C:\Program Files\Adobe\Acrobat DC\Acrobat\AdobeCollabSync.exe` | No pertenece al sistema. |
| 30329 | `127.0.0.1` | 67268 | `Code.exe` | VS Code | IDE | VS Code NodeService | No pertenece al runtime principal. |
| 49664 | `0.0.0.0`, `::` | 1296 | `lsass.exe` | Windows | Sistema | No disponible via CIM | RPC dinamico. |
| 49665 | `0.0.0.0`, `::` | 1144 | `wininit.exe` | Windows | Sistema | No disponible via CIM | RPC dinamico. |
| 49666 | `0.0.0.0`, `::` | 2588 | `svchost.exe` | Windows | Sistema | No disponible via CIM | RPC dinamico. |
| 49667 | `0.0.0.0`, `::` | 2720 | `svchost.exe` | Windows | Sistema | No disponible via CIM | RPC dinamico. |
| 49668 | `0.0.0.0`, `::` | 3736 | `spoolsv.exe` | Windows | Sistema | No disponible via CIM | Print spooler/RPC dinamico. |
| 49671 | `0.0.0.0`, `::` | 1268 | `services.exe` | Windows | Sistema | No disponible via CIM | Service control/RPC dinamico. |
| 65223 | `127.0.0.1` | 54304 | `Code.exe` | VS Code/Pylance | IDE | Pylance server bundle | No pertenece al runtime principal. |

### UDP observado por `netstat -ano`

UDP no tiene estado `LISTENING`, pero se observaron sockets activos del sistema en `53`, `123`, `3702`, `5050`, `5353`, `5355`, varios puertos efimeros, SSDP/LLMNR/mDNS y adaptadores locales. No se detecto UDP atribuible de forma evidente a paneles GSentinel.

## 4. Mapa proceso -> puerto

| Proceso / PID | Puertos | Interpretacion |
|---|---|---|
| `com.docker.backend.exe` PID `61348` | `3000`, `8000`, `8001`, `8002`, `8010`, `8011`, `8012`, `8013` | Publicacion Docker Desktop para containers GSentinel. |
| `postgres.exe` PID `5164` | `5432` | PostgreSQL host Windows, no container publicado. |
| `Code.exe` PID `67268` | `4890`, `30329` | Puertos internos VS Code. |
| `Code.exe` PID `54304` | `65223` | Pylance / extension Python. |
| `AdobeCollabSync.exe` PID `49456` | `19294` | Adobe, externo al sistema. |
| PIDs Windows (`svchost`, `System`, `lsass`, `spoolsv`, etc.) | `135`, `139`, `445`, `2179`, `5040`, `7680`, `49664-49671` | Sistema operativo / Hyper-V / RPC. |

`wmic` no esta disponible en esta instalacion (`wmic` no reconocido). Se uso `Get-CimInstance Win32_Process`, `Get-Process -IncludeUserName`, `tasklist /v`, `netstat -ano` y `Get-NetTCPConnection`.

## 5. Mapa panel -> puerto

| Panel / app | Puerto real activo | Proceso host | Container | Ruta origen | Evidencia |
|---|---:|---|---|---|---|
| Panel GSentinelHealth OS | `3000` | Docker Desktop PID `61348` | `gs_frontend` | `E:\GSentinelHealthOS\medical-agenda-saas` | `X-Powered-By: Next.js`, titulo `GSentinelHealth OS`, compose build context. |
| `Panel GSentinelHS` original | No activo | N/A | N/A | `E:\GSentinelHealthOS\Panel GSentinelHS` | La ruta no existe en el filesystem auditado. |
| MetaBrain Nest local | No activo | N/A | N/A | `E:\GSentinelHealthOS\MetaBrain` | `MetaBrain/src/main.ts` default `PORT=3000`; no listener Node/Nest directo. |
| Vite/React dev | No activo | N/A | N/A | No identificado activo | `5173` y `5174` no escuchan. |

## 6. Docker exposure map

Compose activo:

- Proyecto: `gsentinelhealthos`
- Config file: `E:\GSentinelHealthOS\docker-compose.yml`
- Estado: `running(17)`

Containers publicados al host:

| Container | Servicio compose | Puerto host | Puerto container | Estado |
|---|---|---:|---:|---|
| `gs_frontend` | `frontend` | `127.0.0.1:3000` | `3000/tcp` | Up healthy |
| `gs_api` | `api` | `127.0.0.1:8000` | `8000/tcp` | Up healthy |
| `gs_brain` | `brain` | `127.0.0.1:8001` | `8001/tcp` | Up healthy |
| `gs_gateway` | `gateway` | `127.0.0.1:8002` | `8002/tcp` | Up healthy |
| `gs_dialogue_engine` | `dialogue-engine` | `127.0.0.1:8010` | `8010/tcp` | Up healthy |
| `gs_inference_service` | `inference-service` | `127.0.0.1:8011` | `8011/tcp` | Up healthy |
| `gs_decision_service` | `decision-service` | `127.0.0.1:8012` | `8012/tcp` | Up healthy |
| `gs_nlg_service` | `nlg-service` | `127.0.0.1:8013` | `8013/tcp` | Up healthy |

Containers no publicados al host:

- `gs_db`: `5432/tcp` interno Docker, no host port.
- `gs_redis_master`, `gs_redis_replica`, `gs_redis_sentinel_1`, `gs_redis_sentinel_2`, `gs_redis_sentinel_3`: `6379/tcp` interno Docker, no host port.
- `gs_booking_worker_0`, `gs_booking_worker_1`, `gs_outbox_scheduler`: sin puertos publicados.

Containers terminados:

- `gs_migrate_api`: `Exited (0)`.
- `gs_migrate_frontend`: `Exited (0)`.

No se detectaron containers Docker ajenos al proyecto `gsentinelhealthos` en `docker ps -a`.

## 7. Servicios IA detectados

| Servicio | Puerto | Estado HTTP | Evidencia |
|---|---:|---|---|
| `gs_inference_service` | `8011` | `/health` 200 | JSON incluye `model_loaded: true`, `model_version: 3.0.0`. |
| `gs_nlg_service` | `8013` | `/health` 200 | JSON `service: nlg-service`, OpenAPI title `nlg-service`. |
| `gs_brain` | `8001` | `/health` 200 | Orquestador central, OpenAPI describe dialogue/inference/decision/nlg. |
| Ollama | `11434` | No activo | No listener en `11434`. |
| MetaBrain Nest local | `3000` esperado por config | No activo como proceso Node local | `3000` esta ocupado por Docker frontend. |
| Cerebro/MetaBrain Python local | `8000`/`8100-8103` potencial por archivos de tests | No activo como proceso local separado | Puertos activos `8000` y `8010-8013` pertenecen al compose principal. |

## 8. Riesgos

- `5432` en host esta ocupado por PostgreSQL Windows local y expuesto en `0.0.0.0`/`::`. Esto puede interferir con tests o apps que asumen `localhost:5432` como DB de GSentinel o medical-agenda.
- El Postgres Docker `gs_db` no esta publicado al host; cualquier cliente host que use `localhost:5432` no llega a `gs_db`.
- `6379` no esta publicado al host; tests o apps locales que esperan `redis://localhost:6379` fallaran o conectaran a otro Redis si aparece despues.
- `medical-agenda-saas/docker-compose.prod.yml` define `WEB_PORT:-3000`; si se levanta aparte sin cambiar `WEB_PORT`, colisionaria con `gs_frontend`.
- `MetaBrain/src/main.ts` usa `PORT` o default `3000`; si se levanta localmente sin override, colisionaria con `gs_frontend`.
- La ruta declarada como panel original `Panel GSentinelHS` no existe; el panel real activo viene de `medical-agenda-saas`.
- `docker compose config` resuelve secretos; no debe usarse para reportes compartibles sin sanitizar.

## 9. Conflictos

Conflictos activos:

- No hay dos procesos escuchando el mismo puerto de aplicacion (`3000`, `8000`, `8001`, `8002`, `8010`, `8011`, `8012`, `8013`).
- Hay binds dual-stack/sistema duplicados normales en Windows (`135`, `5432`, `49664-49671`), no son dos apps distintas.

Conflictos potenciales:

- `medical-agenda-saas` standalone y `gs_frontend` usan `3000` por default.
- `MetaBrain` Nest local y `gs_frontend` usan `3000` por default.
- `api`/tests locales apuntan a `localhost:5432` y `localhost:6379`, pero Docker DB/Redis no estan publicados al host.
- Runtime lab/pre-canary tienen puertos previstos `55432`, `55433`, `56379`, `56380`, `18090`; no estan activos ahora, pero pueden colisionar con stacks de `medical-agenda-saas` si se levantan simultaneamente con defaults cercanos.

## 10. Puertos huerfanos

No se detectaron puertos de aplicacion Docker huerfanos: todos los puertos `3000`, `8000`, `8001`, `8002`, `8010`, `8011`, `8012`, `8013` mapean a containers vivos y saludables.

Puertos locales no GSentinel:

- `4890`, `30329`, `65223`: VS Code / extensiones.
- `19294`: Adobe Collaboration Sync.
- Puertos Windows/RPC: `135`, `139`, `445`, `2179`, `5040`, `7680`, `49664-49671`.

## 11. Paneles legacy detectados

- `medical-agenda-saas` es el unico panel Next.js encontrado con `package.json` y `next.config.ts`; ademas es el build context del container `gs_frontend`.
- `Panel GSentinelHS` no existe en la ruta solicitada.
- No se detecto Vite activo ni carpetas `Panel` alternativas dentro de la profundidad auditada.
- No se detecto un panel React/Vite activo en `5173`/`5174`.

## 12. Posibles interferencias

- `localhost:5432`: puede estar apuntando a PostgreSQL host y no al DB Docker esperado por algunos tests.
- `localhost:6379`: no existe listener; pruebas de integracion que dependan de Redis host pueden fallar.
- `localhost:3000`: ocupado por Docker frontend; levantar `medical-agenda-saas npm run dev`, `next dev`, `MetaBrain npm start:dev`, o un compose prod separado sin cambiar puerto generaria conflicto o fallback.
- VS Code puertos internos (`4890`, `30329`, `65223`) no parecen interferir con GSentinel, pero pueden aparecer en scans ingenuos como unknown localhost.

## 13. Localhost seguros

Seguros en el sentido de estar identificados, esperados y limitados a loopback:

- `127.0.0.1:3000` `gs_frontend`
- `127.0.0.1:8000` `gs_api`
- `127.0.0.1:8001` `gs_brain`
- `127.0.0.1:8002` `gs_gateway`
- `127.0.0.1:8010` `gs_dialogue_engine`
- `127.0.0.1:8011` `gs_inference_service`
- `127.0.0.1:8012` `gs_decision_service`
- `127.0.0.1:8013` `gs_nlg_service`

## 14. Localhost que parecen incorrectos

- `E:\GSentinelHealthOS\Panel GSentinelHS`: no existe, por lo que no puede ser el origen del panel activo.
- `localhost:5432`: parece incorrecto si se espera llegar al Postgres Docker `gs_db`; actualmente llega a PostgreSQL host Windows.
- `localhost:6379`: parece incorrecto para Redis Docker; no hay listener host.

## 15. Localhost duplicados

- No hay duplicados activos de paneles HTTP.
- Los puertos publicados por Docker comparten el mismo PID host (`com.docker.backend.exe`) porque Docker Desktop proxy publica multiples containers; no es duplicacion de app.
- Binds duplicados `0.0.0.0`/`::` en puertos Windows son comportamiento normal de doble pila, no apps duplicadas.

## 16. Localhost que NO pertenecen al sistema principal

- `127.0.0.1:4890`: VS Code NodeService.
- `127.0.0.1:30329`: VS Code NodeService.
- `127.0.0.1:65223`: VS Code Pylance.
- `127.0.0.1:19294`: Adobe Collaboration Sync.
- Puertos Windows/RPC/SMB/Hyper-V: `135`, `139`, `445`, `2179`, `5040`, `7680`, `49664-49671`.

## 17. Recomendacion de consolidacion futura

Sin ejecutar cambios ahora:

1. Definir una matriz canonica de puertos para `dev`, `runtime-lab`, `precanary` y `docker-prod-local`.
2. Decidir formalmente si el panel canonico es `medical-agenda-saas` o una carpeta restaurada `Panel GSentinelHS`.
3. Si `Panel GSentinelHS` debe ser la fuente valida, restaurar o reubicar esa ruta antes de cualquier cleanup.
4. Evitar que `MetaBrain` local y `medical-agenda-saas` local usen `3000` simultaneamente; documentar overrides (`PORT`, `WEB_PORT`, `FRONTEND_PORT`).
5. Alinear tests locales que esperan `localhost:5432`/`localhost:6379` con la realidad Docker: o publicar puertos de lab dedicados, o usar servicios dentro de compose.
6. Mantener `docker compose config` fuera de reportes sin sanitizacion porque imprime secretos resueltos.
7. Antes de cleanup, generar una lista de procesos permitidos vs externos para no cerrar IDE/Adobe/Windows.

## Evidencia ejecutada

Comandos de auditoria usados:

- `netstat -ano`
- `Get-NetTCPConnection`
- `tasklist /v`
- `Get-CimInstance Win32_Process`
- `Get-Process -IncludeUserName`
- `docker ps`
- `docker ps -a`
- `docker compose ls`
- `docker compose ps`
- `docker inspect`
- HTTP GET suave a `/`, `/health`, `/docs`, `/openapi.json`
- Busqueda local con `rg --files` y `rg` para `package.json`, compose, config y referencias de puertos

Comandos no disponibles:

- `wmic`: no reconocido en este sistema.

Acciones no realizadas:

- No se mataron procesos.
- No se reiniciaron servicios.
- No se detuvieron containers.
- No se cambiaron puertos.
- No se edito `.env`.
- No se hizo deploy.
- No se instalaron dependencias.
- No se hizo cleanup.
