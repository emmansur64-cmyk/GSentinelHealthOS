# Integración de dialogue-service en cerebro_ai_med

## Overview

`dialogue-service` es un nuevo microservicio que gestiona el **estado conversacional** y la **clasificación de intención** del usuario, sin generar texto final (eso es responsabilidad de `nlg-service`).

## Arquitectura completa

```
┌──────────────────────────────────────────┐
│   Usuario / Cliente (HTTP)               │
└─────────────────┬────────────────────────┘
                  │
         ┌────────▼──────────┐
         │   API Gateway     │
         │   (Port 8000)     │
         └────────┬──────────┘
                  │
        ┌─────────┼─────────┬───────────┐
        │         │         │           │
        ▼         ▼         ▼           ▼
    ┌──────┐ ┌────────┐ ┌───────┐ ┌─────────┐
    │      │ │        │ │       │ │         │
    │ INF  │ │ DECIS  │ │DIALOG │ │   NLG   │
    │ 8001 │ │  8002  │ │ 8005  │ │  8003   │
    │      │ │        │ │       │ │         │
    └──────┘ └────────┘ └───────┘ └─────────┘
     (ML)     (Rules)   (Intent &  (Text)
              (Clinical) State)   (Generation)
```

## Flujo orquestado (ejemplo real)

### Turno 1: Usuario envía mensaje inicial

**Request al gateway:**
```json
{
  "session_id": "user-42-session-1",
  "message": "Hola, tengo fiebre"
}
```

**Gateway orquestra:**

1. **Dialogue-Service** (primero, para contexto):
   ```
   POST http://dialogue-service:8005/dialogue
   {
     "session_id": "user-42-session-1",
     "message": "Hola, tengo fiebre"
   }
   ```

   **Response:**
   ```json
   {
     "intent": "symptom_report",
     "next_step": "request_more_info",
     "required_fields": ["duration", "intensity"],
     "context_updates": {
       "symptoms": ["fever"],
       "symptom_details": {},
       "last_risk_level": null,
       "history_size": 1
     },
     "flags": []
   }
   ```

2. **Inference-Service** (análisis médico, si aplica):
   ```
   POST http://inference-service:8001/infer
   { "text": "Hola, tengo fiebre", "modality": "TEXT" }
   ```

   **Response:**
   ```json
   {
     "model_name": "medical_triage_v3",
     "risk_level": "low",
     "finding_code": "stable_pattern",
     "confidence": 0.65,
     "probabilities": {...},
     "features_used": {"fever": 1.0}
   }
   ```

3. **Decision-Service** (reglas clínicas):
   ```
   POST http://decision-service:8002/decide
   { ... ModelOutput ... }
   ```

   **Response:**
   ```json
   {
     "risk_level": "low",
     "clinical_flag": "routine",
     "triage_level": "green",
     "confidence_band": "medium",
     "explanations": ["fever_reported_low_risk"]
   }
   ```

4. **Dialogue-Service** (refinamiento con DecisionOutput):
   ```
   POST http://dialogue-service:8005/dialogue
   {
     "session_id": "user-42-session-1",
     "message": "Hola, tengo fiebre",
     "decision_output": { ... DecisionOutput ... }
   }
   ```

   **Response actualizada:**
   ```json
   {
     "intent": "symptom_report",
     "next_step": "request_more_info",
     "required_fields": ["duration", "intensity"],
     "context_updates": {
       "symptoms": ["fever"],
       "symptom_details": {},
       "last_risk_level": "low",
       "history_size": 2
     },
     "flags": []
   }
   ```

5. **NLG-Service** (genera texto para usuario):
   ```
   POST http://nlg-service:8003/generate
   {
     "decision_output": { ... DecisionOutput ... },
     "model_output": { ... ModelOutput ... },
     "patient_context": {
       "session_id": "user-42-session-1",
       "dialogue_action": { ... DialogueAction ... }
     }
   }
   ```

   **Response:**
   ```json
   {
     "text": "Entendido que tiene fiebre. ¿Cuánto tiempo lleva con este síntoma y cuál es la intensidad del dolor?",
     "style": "clinical",
     "variants_used": ["symptom_clarification"],
     "disclaimers": ["medical_professional_review_recommended"]
   }
   ```

**Gateway devuelve al usuario:**
```json
{
  "status": "ok",
  "message": "Entendido que tiene fiebre. ¿Cuánto tiempo lleva con este síntoma y cuál es la intensidad del dolor?",
  "session_id": "user-42-session-1",
  "dialogue_state": {
    "intent": "symptom_report",
    "symptoms": ["fever"],
    "risk_level": "low"
  }
}
```

---

### Turno 2: Usuario responde con más detalles

**Request al gateway:**
```json
{
  "session_id": "user-42-session-1",
  "message": "Hace 3 días y es moderada"
}
```

**Gateway orquestra (flujo igual, pero dialogue-service ya tiene contexto):**

1. **Dialogue-Service** mantiene sesión, actualiza:
   ```json
   {
     "intent": "symptom_report",
     "next_step": "collect_symptoms",
     "required_fields": [],
     "context_updates": {
       "symptoms": ["fever"],
       "symptom_details": {
         "duration": "3 dias",
         "intensity": "moderate"
       },
       "last_risk_level": "low",
       "history_size": 3
     },
     "flags": []
   }
   ```

2. Inference + Decision igual

3. NLG genera:
   ```
   "Fiebre moderada hace 3 días. Esto sugiere posible infección.
    Le recomiendo consultar con un médico para descartar complicaciones.
    ¿Tiene otros síntomas como tos o dificultad para respirar?"
   ```

---

## Responsabilidades de cada servicio

| Servicio | Responsabilidad |
|----------|-----------------|
| **api-gateway** | Orquesta el flujo, enruta a servicios, mantiene sesión HTTP |
| **dialogue-service** | Clasifica intent, mantiene estado conversacional en memoria, aplica políticas de diálogo |
| **inference-service** | Analiza texto/imagen, produce ModelOutput (ML) |
| **decision-service** | Aplica reglas clínicas, produce DecisionOutput |
| **nlg-service** | Genera texto natural final (usa DialogueAction + DecisionOutput) |

## Integración en docker-compose

```yaml
dialogue-service:
  build:
    context: ..
    dockerfile: services/dialogue_engine/Dockerfile
  command: ["uvicorn", "services.dialogue_engine.main:app", "--host", "0.0.0.0", "--port", "8005", "--workers", "1"]
  expose:
    - "8005"
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8005/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s
```

## Endpoints principales

### Dialogue-Service

- **POST /dialogue**
  - Input: `DialogueRequest` (session_id, message, decision_output?)
  - Output: `DialogueAction` (intent, next_step, required_fields, flags, context_updates)
  - Resuelve: ¿qué intención? ¿qué pedir? ¿qué alertas?

- **GET /health**
  - Output: `{"status": "ok", "service": "dialogue_engine"}`
  - Usado por healthcheck del compose

## Cómo ejecutar

### Completo (con todos los servicios):

```powershell
$env:CEREBRO_API_KEY='real_async_key_2026'
docker compose -f docker/docker-compose.distributed.yml up -d
```

### Solo dialogue-service en desarrollo local:

```powershell
cd E:\MetaBrain
uvicorn services.dialogue_engine.main:app --host 0.0.0.0 --port 8005 --workers 1
```

Luego probar:

```powershell
$session = "test-$(Get-Random)"
$body = @{
  session_id = $session
  message = "Hola, tengo fiebre"
} | ConvertTo-Json

curl -X POST "http://localhost:8005/dialogue" `
  -H "Content-Type: application/json" `
  -d $body
```

## Logging estructurado

Dialogue-service produce logs JSON en formato:

```json
{
  "ts": "2026-04-21T10:30:45.123456+00:00",
  "level": "INFO",
  "logger": "cerebro_ai_med.distributed.dialogue",
  "message": "dialogue_action_generated",
  "request_id": "uuid-...",
  "session_id": "user-42-session-1",
  "intent": "symptom_report",
  "next_step": "request_more_info",
  "flags": ["possible_risk"],
  "latency_ms": 12.5
}
```

Todos los servicios loguean de esta forma para observabilidad centralizada.

## Próximos pasos (opcionales)

1. **Persistencia de sesiones**: Migrar `InMemoryStateManager` a Redis para multi-instancia
2. **Metricas**: Agregar Prometheus metrics en dialogue-service
3. **Validación clínica**: Enriquecer políticas con reglas de negocio médicas
4. **Feedback loop**: Guardar dialogue_actions en DB para mejora continua
