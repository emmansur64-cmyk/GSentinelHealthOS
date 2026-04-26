# Resiliencia SRE para Integraciones Externas

## Objetivo

Evitar caida total cuando falla un proveedor externo:
- Google Calendar
- WhatsApp/Meta (y webhook n8n)
- IA (Groq)

## Arquitectura

### 1) Patron Outbox (persistencia primero)

1. La API guarda accion en DB dentro de la misma transaccion de negocio.
2. Se inserta evento en notification_outbox (status=pending).
3. Worker asincrono procesa eventos por lotes.
4. Si falla proveedor, el evento queda en failed con next_attempt_at.
5. Scheduler vuelve a intentar automaticamente.

### 2) Retry exponencial

Se aplica en llamadas remotas de proveedores con errores transitorios.

Regla base:
- retry_delay = min(max_delay, base_delay * 2^attempt) + jitter

Ejemplo implementado:
- base=0.5s, max=3-4s, retries=2

### 3) Circuit Breaker

Se abre el circuito por proveedor cuando hay fallos consecutivos.
Mientras esta abierto, se corta rapido (fail-fast) para proteger CPU/hilos y evitar cascadas.

Estados:
- closed: trafico normal
- open: se corta request inmediatamente
- half-open: prueba controlada (1 llamada)

## Implementacion real en este repo

### Reutilizable

- shared/utils/resilience.py
  - CircuitBreaker
  - CircuitBreakerRegistry
  - retry_async

### Google Calendar

- api/app/services/google_calendar_service.py
  - Circuito: provider.google.calendar
  - Retry para 429/5xx y errores transitorios
  - Idempotencia por google_event_id + deterministic eventId

### WhatsApp (n8n webhook en outbox)

- api/app/services/notification_service.py
  - Circuito: provider.whatsapp.n8n
  - Retry exponencial para timeout/connect/429/5xx

### WhatsApp Meta API (gateway saliente)

- whatsapp_gateway/services/whatsapp_service.py
  - Circuito: provider.whatsapp.meta
  - Retry exponencial para timeout/connect/429/5xx

- whatsapp_gateway/app/outgoing_consumer.py
  - Reencola en fallo con _retries
  - Pasa a DLQ al superar max_retries

### IA (Groq)

- brain/interpreters/nlu_engine.py
  - Circuito: provider.ai.groq
  - Retry con backoff en llamada Groq
  - Fallback automatico a reglas si circuito abierto o timeout/error

## Observabilidad SRE

- GET /api/health/providers
  - Estado agregado de providers: healthy/degraded/unknown
  - Snapshot por circuito: name, state, failures, failure_threshold, retry_after_seconds

Variables de configuracion de severidad:
- HEALTH_PROVIDERS_OPEN_IS_CRITICAL (default true)
- HEALTH_PROVIDERS_HALF_OPEN_IS_DEGRADED (default false)
- HEALTH_PROVIDERS_UNKNOWN_IS_DEGRADED (default true)

- GET /api/health/readiness y GET /api/health/dashboard-summary
  - Incluyen providers.circuits para correlacionar incidentes externos

## Cuando cortar requests (fail-fast)

Se cortan de forma inmediata cuando:
- Circuit breaker en estado open
- El proveedor ya supero umbral de fallos consecutivos

Beneficio:
- Menor latencia para el usuario final
- Evita saturar workers/conexiones
- Permite recuperacion controlada por half-open

## Como evitar duplicados

### Citas/API
- Idempotency-Key en middleware
- Reuso de respuesta si la misma request se repite

### Outbox
- Deduplicacion por event_type + aggregate_id en pending/failed

### Google Calendar
- Guardado de appointments.google_event_id
- eventId deterministico al crear para evitar duplicados por retry

## Casos solicitados

- Google no responde:
  - Retry local + circuit breaker
  - Si persiste, outbox failed y reintento programado
  - La cita local no se pierde

- WhatsApp falla:
  - n8n/webhook con retry + breaker (API)
  - Meta outgoing con retry + breaker + requeue + DLQ (gateway)

- IA timeout:
  - Retry en Groq
  - Si sigue fallando o circuito abierto, fallback por reglas
  - El flujo conversacional sigue operativo
