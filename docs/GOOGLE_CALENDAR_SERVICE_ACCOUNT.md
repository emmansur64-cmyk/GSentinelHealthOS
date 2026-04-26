# Google Calendar con Service Account

## Objetivo

Configurar autenticacion segura de backend contra Google Calendar API sin credenciales hardcodeadas.

Arquitectura recomendada:
- Backend server-to-server
- Service Account
- Credenciales via variables de entorno o secret manager
- Calendario compartido con el email del service account

## 1. Crear Service Account

1. Ir a Google Cloud Console.
2. Crear o seleccionar proyecto.
3. Habilitar Google Calendar API.
4. Ir a IAM & Admin > Service Accounts.
5. Crear una nueva service account.
6. Generar clave JSON.

El JSON contiene campos como:
- type
- project_id
- private_key_id
- private_key
- client_email
- client_id
- token_uri

## 2. Descargar JSON de credenciales

Google entrega un archivo JSON.
No debe commitearse en el repositorio.

Opciones seguras para backend:
- Secret manager que inyecta el JSON como variable de entorno
- Variable de entorno con JSON completo en una sola linea
- Variable de entorno con JSON codificado en base64
- Archivo montado por Docker/Kubernetes y path en variable de entorno

## 3. Compartir calendario con el service account

Si el calendario objetivo no es propio del service account, compartirlo manualmente:

1. Abrir Google Calendar del calendario a sincronizar.
2. Ir a Configuracion y uso compartido.
3. Agregar como usuario con permisos al email del service account.

Email a compartir:
- client_email del JSON
- Ejemplo: scheduler-bot@my-project.iam.gserviceaccount.com

Permiso minimo recomendado:
- "Make changes to events"

## 4. Backend: variables de entorno

Variables soportadas:
- GOOGLE_CALENDAR_ENABLED=true
- GOOGLE_CALENDAR_AUTH_MODE=service_account
- GOOGLE_CALENDAR_ID=primary
- GOOGLE_CALENDAR_TIMEZONE=UTC
- GOOGLE_SERVICE_ACCOUNT_JSON=
- GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=
- GOOGLE_SERVICE_ACCOUNT_FILE=
- GOOGLE_CALENDAR_WEBHOOK_TOKEN=
- GOOGLE_CALENDAR_WEBHOOK_CALLBACK_URL=
- GOOGLE_CALENDAR_WATCH_TTL_SECONDS=86400

Regla:
- Definir una sola fuente de credenciales preferentemente.
- Prioridad actual del backend:
  1. GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  2. GOOGLE_SERVICE_ACCOUNT_JSON
  3. GOOGLE_SERVICE_ACCOUNT_FILE

## Inicializacion Python

Dependencias:
- google-auth
- google-api-python-client

Codigo real implementado en el repo:
- api/app/services/google_calendar_service.py

Fragmento de inicializacion:

```python
from api.app.core.config import settings
from api.app.services.google_calendar_service import GoogleCalendarService

client = GoogleCalendarService.build_calendar_client_from_env()
calendar = client.events().list(calendarId=settings.google_calendar_id, maxResults=10).execute()
```

La inicializacion carga credenciales desde ENV, valida campos requeridos y construye el cliente con:
- google.oauth2.service_account.Credentials.from_service_account_info
- googleapiclient.discovery.build

## Errores comunes y como detectarlos

### 1. Credenciales faltantes

Sintoma:
- RuntimeError indicando que faltan GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_FILE

Causa:
- No se inyecto ninguna credencial en el entorno

Accion:
- Definir una de las tres variables

### 2. JSON invalido

Sintoma:
- RuntimeError indicando que GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON valido
- RuntimeError indicando que GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 no es un base64 JSON valido

Causa:
- JSON truncado, mal escapado o base64 corrupto

Accion:
- Regenerar la variable y validar localmente antes de desplegar

### 3. Campos incompletos en credencial

Sintoma:
- RuntimeError indicando faltan client_email, private_key o token_uri

Causa:
- Se copio un JSON parcial o mal transformado

Accion:
- Volver a descargar la clave JSON completa desde Google Cloud

### 4. Calendario no compartido con el service account

Sintoma:
- HttpError 403 forbidden
- Mensajes como "The caller does not have permission"

Causa:
- El calendario no fue compartido con client_email del service account

Accion:
- Compartir el calendario y otorgar permiso para modificar eventos

### 5. Calendar ID incorrecto

Sintoma:
- HttpError 404 notFound

Causa:
- GOOGLE_CALENDAR_ID incorrecto o calendario inexistente

Accion:
- Verificar calendarId exacto en configuracion del calendario

### 6. API no habilitada

Sintoma:
- HttpError 403 con mensaje de API disabled o access not configured

Causa:
- Google Calendar API no habilitada en el proyecto GCP

Accion:
- Activarla en Google Cloud Console

### 7. Librerias faltantes

Sintoma:
- RuntimeError indicando google-auth no esta instalado
- RuntimeError indicando google-api-python-client no esta instalado

Accion:
- Instalar dependencias del requirements

## Recomendaciones operativas

- No guardar el JSON en el repositorio.
- En produccion, preferir secret manager o variable base64 inyectada por CI/CD.
- No mezclar OAuth interactivo con backend server-to-server salvo caso excepcional.
- Monitorear errores 403 y 404 en el outbox Google para detectar permisos o calendarId mal configurado.
