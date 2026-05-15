# GROQ FRONTEND ENV FIX

## Causa raiz exacta

`gs_frontend` estaba ejecutando con una `GROQ_API_KEY` vieja tomada desde una variable de entorno de la shell host, no desde `E:\GSentinelHealthOS\.env`.

Docker Compose usa el archivo `.env` del proyecto para interpolacion, pero las variables ya presentes en la shell tienen prioridad. En este caso:

- Host `.env` `GROQ_API_KEY`: presente, longitud 56, tail4 `dt0K`.
- Shell host `GROQ_API_KEY`: presente, longitud 56, tail4 `38LL`.
- Contenedor `gs_frontend` antes del fix: `GROQ_API_KEY` y `DOCTOR_CHAT_GROQ_API_KEY` con tail4 `38LL`.

Eso explica el `doctor_chat.groq.http_error status=401` y `Invalid API Key`.

## Archivo `.env` unico

Fuente real:

- `E:\GSentinelHealthOS\.env`

No se creo `.env` dentro de `medical-agenda-saas`.
No se duplicaron secretos.
No se imprimio ninguna API key completa.

## `env_file` encontrado

En `docker-compose.yml`, el servicio `frontend` no tiene `env_file` explicito.

El compose raiz depende de la interpolacion estandar de Docker Compose desde:

- `E:\GSentinelHealthOS\.env`

cuando el comando se ejecuta desde `E:\GSentinelHealthOS`.

## Environment encontrado

El servicio `frontend` define:

- `GROQ_API_KEY: ${GROQ_API_KEY}`
- `GROQ_BASE_URL: ${GROQ_BASE_URL:-https://api.groq.com/openai/v1}`
- `GROQ_MODEL: ${GROQ_MODEL:-llama-3.3-70b-versatile}`
- `DOCTOR_CHAT_GROQ_API_KEY: ${DOCTOR_CHAT_GROQ_API_KEY:-${GROQ_API_KEY}}`

No se encontro `NEXT_PUBLIC_GROQ_API_KEY`.
No se encontro key Groq hardcodeada en codigo productivo.

## Dockerfile frontend

`medical-agenda-saas/Dockerfile`:

- no copia archivos `.env`,
- no define `ARG` de Groq,
- no define `ENV GROQ_API_KEY`,
- no embebe la key en build.

## Codigo auditado

`medical-agenda-saas/src/lib/groq-doctor-chat.ts` lee:

- `DOCTOR_CHAT_GROQ_API_KEY ?? GROQ_API_KEY`
- `DOCTOR_CHAT_GROQ_BASE_URL ?? GROQ_BASE_URL ?? default`
- `DOCTOR_CHAT_GROQ_MODEL ?? GROQ_MODEL ?? NLG_GROQ_MODEL ?? default`

El problema no era el codigo: era la env runtime del contenedor.

## Cambios aplicados

No se modifico codigo.
No se modifico Dockerfile.
No se modifico `docker-compose.yml`.
No se modifico `.env`.

Correccion aplicada: recreacion controlada solo de `frontend`, eliminando `GROQ_API_KEY` de la shell temporal para que Compose leyera `E:\GSentinelHealthOS\.env`.

## Comandos ejecutados

Auditoria segura:

```powershell
Get-Content docker-compose.yml
Get-Content medical-agenda-saas\Dockerfile
rg -n "GROQ_API_KEY|GROQ_BASE_URL|GROQ_MODEL|DOCTOR_CHAT_GROQ_API_KEY|NEXT_PUBLIC_GROQ|groq" medical-agenda-saas -S -g '!node_modules' -g '!.next'
```

Fingerprint seguro:

```powershell
# Host: longitud y ultimos 4 caracteres desde E:\GSentinelHealthOS\.env
# Contenedor: longitud y ultimos 4 caracteres via docker exec gs_frontend
```

Recreacion controlada:

```powershell
Remove-Item Env:GROQ_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:DOCTOR_CHAT_GROQ_API_KEY -ErrorAction SilentlyContinue
docker compose up -d --no-deps --force-recreate frontend
```

Validacion Groq desde contenedor:

```powershell
docker exec gs_frontend node -e "... fetch(GROQ_BASE_URL + '/models') ..."
```

## Validacion host vs contenedor

Antes:

- Host `.env` `GROQ_API_KEY`: len 56, tail4 `dt0K`.
- Contenedor `GROQ_API_KEY`: len 56, tail4 `38LL`.
- Contenedor `DOCTOR_CHAT_GROQ_API_KEY`: len 56, tail4 `38LL`.

Despues:

- Contenedor `GROQ_API_KEY`: len 56, tail4 `dt0K`.
- Contenedor `DOCTOR_CHAT_GROQ_API_KEY`: len 56, tail4 `dt0K`.
- Contenedor `GROQ_BASE_URL`: presente, len 30.
- Contenedor `GROQ_MODEL`: presente, len 23.

## Logs posteriores

Despues de recrear `frontend`, no aparecieron en logs recientes:

- `doctor_chat.groq.http_error`
- `Invalid API Key`

Validacion directa con Groq desde `gs_frontend`:

- `GROQ_MODELS_STATUS=200`

## Estado final

`gs_frontend` queda alineado con `E:\GSentinelHealthOS\.env` para Groq.

Pendiente separado, no mezclado en este fix:

- `brain ENOTFOUND` por `target_url http://brain:8001/orchestrate`.
- `gs_frontend unhealthy` por `EACCES /app/.next/cache` si reaparece.

## Nota operativa

Si se recrea `frontend` desde una shell que tenga `GROQ_API_KEY` exportada con valor viejo, Docker Compose puede volver a priorizar la shell sobre `.env`. Para mantener `E:\GSentinelHealthOS\.env` como unica verdad, ejecutar Compose desde una shell sin overrides de Groq o limpiar esas variables antes de recrear el servicio.

GROQ FRONTEND ENV VALIDADO
