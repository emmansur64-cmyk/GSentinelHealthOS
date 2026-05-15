# BRAIN NETWORK FIX

## Causa raiz exacta

El hostname interno correcto era `brain`, pero `gs_brain` estaba en restart loop y perdia IP estable dentro de la red Docker. Por eso el frontend veia:

```text
brain.fetch.retrying_network_error
target_url="http://brain:8001/orchestrate"
error_cause="getaddrinfo ENOTFOUND brain"
```

La causa del restart loop estaba en startup de FastAPI:

```text
PermissionError: [Errno 13] Permission denied: 'artifacts'
FileNotFoundError: [Errno 2] No such file or directory: 'artifacts/semantic_index'
```

`brain/orchestration/semantic_memory.py` crea `artifacts/semantic_index` durante `SemanticMemory.__init__`. La imagen `brain` corre como `appuser`, pero `/app/artifacts` no existia con permisos escribibles.

## Hostname correcto

Compose define el servicio:

- service name: `brain`
- container_name: `gs_brain`
- network: `gsentinelhealthos_gs_prod`
- aliases detectados: `gs_brain`, `brain`

Por lo tanto, el hostname interno correcto para `frontend` es:

```text
http://brain:8001
```

No habia que cambiarlo a `http://gs_brain:8001`.

## Segunda causa detectada

Luego de estabilizar `gs_brain`, `/orchestrate` respondia 401 porque el frontend enviaba `BRAIN_API_KEY`, mientras Brain valida `X-Internal-Key` contra `INTERNAL_SERVICES_KEY`.

Fingerprint seguro:

- frontend `BRAIN_API_KEY` antes: len 38, tail4 `QTSs`.
- brain `INTERNAL_SERVICES_KEY`: len 36, tail4 `OJ6A`.
- frontend `BRAIN_API_KEY` despues: len 36, tail4 `OJ6A`.

No se imprimieron secretos completos en este documento.

## Cambios aplicados

### `docker/brain.Dockerfile`

Se agrego la creacion del directorio escribible requerido por `SemanticMemory`:

```dockerfile
RUN mkdir -p /app/artifacts/semantic_index && chown -R appuser:appuser /app/artifacts
```

Esto ocurre antes de `USER appuser`.

### `docker-compose.yml`

Solo en el servicio `frontend`, se alineo:

```yaml
BRAIN_API_KEY: ${INTERNAL_SERVICES_KEY:-${BRAIN_API_KEY}}
```

Esto conserva fallback a `BRAIN_API_KEY`, pero prioriza la clave que Brain realmente valida.

## Comandos ejecutados

Auditoria:

```powershell
docker compose ps brain frontend
docker inspect gs_frontend gs_brain
docker logs gs_brain --tail 500
rg -n "http://brain:8001|BRAIN_API_URL|orchestrate|brain:8001" docker-compose.yml .env .env.example medical-agenda-saas api MetaBrain -S
```

Correccion:

```powershell
docker compose build brain
docker compose up -d --no-deps --force-recreate brain
docker compose up -d --no-deps --force-recreate frontend
```

Para recrear frontend se limpio la shell temporal de overrides de Groq/Brain antes de ejecutar Compose.

## Validacion networking

Desde `gs_frontend`:

```text
DNS_OK 172.20.0.18 family=4
BRAIN_HEALTH_STATUS=200
```

Validacion de `/orchestrate` desde `gs_frontend`:

```text
BRAIN_ORCHESTRATE_STATUS=200
```

Respuesta recibida:

```json
{"message":"Hola, ¿cómo estás?","session_id":"network-validation", "...":"..."}
```

## Logs relevantes posteriores

`gs_brain`:

```text
Application startup complete.
Uvicorn running on http://0.0.0.0:8001
POST /orchestrate HTTP/1.1 200 OK
```

`gs_frontend`:

```json
{"message":"doctor_chat.completed","doctor_id":"lab-doctor","confidence":0.92,"source":"GROQ","action":"GROQ_FREE_CHAT","degraded":false}
```

No aparecieron logs recientes de:

- `ENOTFOUND brain`
- `brain.fetch.retrying_network_error`
- `Invalid API Key`
- `doctor_chat.groq.http_error`

## Validaciones ejecutadas

- `docker compose ps brain frontend`
  - `gs_brain`: `Up`, `healthy`.
  - `gs_frontend`: `Up`, `unhealthy` por causa ya separada del healthcheck/cache; no se mezclo en este fix.
- DNS desde frontend a `brain`: OK.
- HTTP `GET /health` desde frontend a Brain: 200.
- HTTP `POST /orchestrate` desde frontend a Brain: 200.
- `npm run typecheck` en `medical-agenda-saas`: OK.
- `npm run build` en `medical-agenda-saas`: OK, con warning preexistente de Turbopack/NFT en `next.config.ts`.

## Estado final

Brain ya no reinicia por permisos de `artifacts/semantic_index`.
`http://brain:8001/orchestrate` resuelve desde `gs_frontend`.
La autenticacion interna frontend -> Brain esta alineada.
Groq se mantiene validado y no fue tocado.

Pendiente separado, no resuelto aqui:

- `gs_frontend unhealthy` por `EACCES /app/.next/cache` si persiste.

BRAIN NETWORK VALIDADO
