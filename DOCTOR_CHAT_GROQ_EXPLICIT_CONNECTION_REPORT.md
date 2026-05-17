# DOCTOR CHAT GROQ EXPLICIT CONNECTION REPORT

Fecha local: 2026-05-15
Scope: `E:\GSentinelHealthOS\medical-agenda-saas`

## Objetivo

Conectar Doctor Chat a Groq en forma explicita, sin fallbacks ambiguos ni reutilizacion de claves de otros dominios.

## Cambios Aplicados

### Runtime Doctor Chat

Archivo:

```text
medical-agenda-saas/src/lib/groq-doctor-chat.ts
```

Configuracion efectiva:

```text
API key: GROQ_API_KEY_CHAT
Modelo: GROQ_MODEL_CHAT
Base URL: https://api.groq.com/openai/v1
```

Se eliminaron del flujo de Doctor Chat los fallbacks a:

```text
DOCTOR_CHAT_GROQ_API_KEY
GROQ_API_KEY
DOCUMENT_AI_API_KEY
DOCUMENT_AI_PROVIDER / DOCUMENT_AI_BASE_URL
GROQ_MODEL
NLG_GROQ_MODEL
```

Si falta `GROQ_API_KEY_CHAT` o `GROQ_MODEL_CHAT`, Doctor Chat no llama a Groq.

### Docker local

Archivo:

```text
docker-compose.yml
```

El servicio `frontend` recibe ahora:

```yaml
GROQ_API_KEY_CHAT: ${GROQ_API_KEY_CHAT}
GROQ_MODEL_CHAT: ${GROQ_MODEL_CHAT}
```

Se removio la inyeccion ambigua:

```yaml
DOCTOR_CHAT_GROQ_API_KEY: ${DOCTOR_CHAT_GROQ_API_KEY:-${GROQ_API_KEY}}
```

### Variables documentadas

Archivo:

```text
.env.example
```

Variables agregadas:

```text
GROQ_API_KEY_CHAT=
GROQ_MODEL_CHAT=
```

## Validacion

`.env` local:

```text
GROQ_API_KEY_CHAT present=True length=56
GROQ_MODEL_CHAT=meta-llama/llama-4-scout-17b-16e-instruct
```

Tests:

```text
npm exec vitest run tests/nlp/groq-doctor-chat.test.ts
10 passed
```

Typecheck:

```text
npm run typecheck
OK
```

Rebuild local:

```text
docker compose up -d --build --no-deps --force-recreate frontend
OK
```

Runtime `gs_frontend`:

```json
{"chatKey":true,"chatKeyLen":56,"chatModel":"meta-llama/llama-4-scout-17b-16e-instruct","doctorLegacy":false,"groqGeneric":true}
```

Groq `/models` desde `gs_frontend`:

```json
{"status":200,"ok":true,"model":"meta-llama/llama-4-scout-17b-16e-instruct","modelListed":true,"modelCount":16}
```

Groq `/chat/completions` desde `gs_frontend`:

```json
{"status":200,"ok":true,"model":"meta-llama/llama-4-scout-17b-16e-instruct","hasChoice":true,"error":null}
```

Docker health:

```text
gs_frontend 127.0.0.1:3000->3000/tcp Up healthy
```

## Resultado

Doctor Chat queda conectado a Groq en forma explicita mediante:

```text
GROQ_API_KEY_CHAT
GROQ_MODEL_CHAT
```

No depende de claves genericas ni de claves de Secretaria, Document AI o NLG.
