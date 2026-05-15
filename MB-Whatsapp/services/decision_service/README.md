# decision-service

Servicio de decision clinica desacoplado para `cerebro_ai_med`.

## Objetivo

Interpreta `ModelOutput` proveniente de `inference-service` y genera `DecisionOutput` mediante reglas deterministicas, sin ejecutar inferencia ni usar LLM.

## Caracteristicas

- Endpoint principal `POST /decide` con contrato estricto `ModelOutput -> DecisionOutput`.
- Reglas clinicas explicitas, auditables y extensibles en `app/rules.py`.
- Validacion estricta (`strict=True`, `extra=forbid`).
- Logging JSON con `request_id`, resumen de entrada, decision y latencia.
- Manejo uniforme de errores:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "category": "validation | decision | system"
  }
}
```

- Health checks:
  - `GET /health`
  - `GET /health/live`
- API key interna opcional por header `X-Internal-Key`.

## Variables de entorno

- `DECISION_INTERNAL_KEY` (opcional)

## Ejecutar local (sin Docker)

Desde la raiz del repo:

```powershell
uvicorn services.decision_service.main:app --host 0.0.0.0 --port 8002 --workers 1
```

## Ejecutar con Docker

Desde la raiz del repo:

```powershell
docker build -f services/decision_service/Dockerfile -t decision-service:local .
docker run --rm -p 8002:8002 decision-service:local
```

## Ejemplo real de request/response

Request:

```bash
curl -X POST "http://127.0.0.1:8002/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "production_medical_triage",
    "model_version": "3.0.0",
    "risk_level": "high",
    "finding_code": "critical_alert_pattern",
    "confidence": 0.62,
    "probabilities": {
      "low": 0.08,
      "medium": 0.19,
      "high": 0.73
    },
    "recommendation_code": "urgent_immediate_evaluation",
    "features_used": {
      "tachycardia": 1.0,
      "hypoxia": 0.9,
      "fever": 0.8,
      "dyspnea": 0.85
    }
  }'
```

Response (ejemplo):

```json
{
  "risk_level": "high",
  "clinical_flag": "urgent",
  "requires_medical_evaluation": true,
  "triage_level": "red",
  "confidence_band": "medium",
  "explanations": [
    "high_risk_detected",
    "high_probability_peak",
    "multi_factor_risk",
    "critical_symptoms_present"
  ]
}
```
