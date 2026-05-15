# dialogue-engine

Servicio conversacional deterministico para `cerebro_ai_med`.

## Objetivo

Recibe texto de usuario + `session_id` (+ `DecisionOutput` opcional) y devuelve una `DialogueAction` estructurada. Este servicio **no genera texto final** y **no usa LLM**.

## Responsabilidad

- Clasificar intencion conversacional por reglas.
- Mantener estado por sesion en memoria de proceso.
- Aplicar politicas para decidir el siguiente paso.
- Emitir acciones para que otro servicio (por ejemplo `nlg-service`) construya la respuesta textual.

## Endpoint principal

`POST /dialogue`

Request:

```json
{
  "session_id": "session-abc-001",
  "message": "Tengo fiebre y tos desde 2 dias, dolor leve",
  "decision_output": {
    "risk_level": "medium",
    "clinical_flag": "priority",
    "requires_medical_evaluation": true,
    "triage_level": "yellow",
    "confidence_band": "medium",
    "explanations": ["high_probability_peak"]
  }
}
```

Response (ejemplo):

```json
{
  "intent": "symptom_report",
  "next_step": "collect_symptoms",
  "required_fields": [],
  "context_updates": {
    "symptoms": ["cough", "fever"],
    "symptom_details": {
      "duration": "2 dias",
      "intensity": "mild"
    },
    "last_risk_level": "medium",
    "history_size": 1
  },
  "flags": ["possible_risk"]
}
```

## Healthcheck

`GET /health`

```json
{
  "status": "ok",
  "service": "dialogue_engine"
}
```

## Errores

Formato uniforme:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Request payload validation failed.",
    "category": "validation"
  }
}
```

Categorias posibles: `validation | dialogue | system`.

## Ejecutar local (sin Docker)

Desde la raiz del repo:

```powershell
uvicorn services.dialogue_engine.main:app --host 0.0.0.0 --port 8005 --workers 1
```

## Ejecutar con Docker

Desde la raiz del repo:

```powershell
docker build -f services/dialogue_engine/Dockerfile -t dialogue-engine:local .
docker run --rm -p 8005:8005 dialogue-engine:local
```

## Ejemplo multi-turn real

Turno 1

Request:

```json
{
  "session_id": "session-42",
  "message": "Hola"
}
```

Response:

```json
{
  "intent": "greeting",
  "next_step": "request_more_info",
  "required_fields": ["symptoms"],
  "context_updates": {
    "symptoms": [],
    "symptom_details": {},
    "last_risk_level": null,
    "history_size": 1
  },
  "flags": []
}
```

Turno 2

Request:

```json
{
  "session_id": "session-42",
  "message": "Tengo disnea y fiebre desde 3 dias, dolor severo",
  "decision_output": {
    "risk_level": "high",
    "clinical_flag": "urgent",
    "requires_medical_evaluation": true,
    "triage_level": "red",
    "confidence_band": "high",
    "explanations": ["critical_symptoms_present"]
  }
}
```

Response:

```json
{
  "intent": "symptom_report",
  "next_step": "prioritize_response",
  "required_fields": [],
  "context_updates": {
    "symptoms": ["dyspnea", "fever"],
    "symptom_details": {
      "duration": "3 dias",
      "intensity": "severe"
    },
    "last_risk_level": "high",
    "history_size": 3
  },
  "flags": ["urgent_attention"]
}
```

Turno 3

Request:

```json
{
  "session_id": "session-42",
  "message": "Que tan grave es?"
}
```

Response:

```json
{
  "intent": "severity_question",
  "next_step": "prioritize_response",
  "required_fields": [],
  "context_updates": {
    "symptoms": ["dyspnea", "fever"],
    "symptom_details": {
      "duration": "3 dias",
      "intensity": "severe"
    },
    "last_risk_level": "high",
    "history_size": 5
  },
  "flags": ["urgent_attention"]
}
```
