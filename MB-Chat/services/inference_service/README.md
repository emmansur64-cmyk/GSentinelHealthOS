# inference-service

Servicio de inferencia ML desacoplado para `cerebro_ai_med`.

## Caracteristicas

- Endpoint principal `POST /infer` con contrato estricto `ModelInput -> ModelOutput`.
- Reutiliza el loader robusto existente (`get_model_service`) con:
  - resolucion de version activa en registry,
  - validacion de existencia de artefactos,
  - validacion de checksum SHA-256,
  - carga unica y thread-safe.
- Validacion estricta de payload (`strict=True`, `extra=forbid`).
- Logging estructurado JSON con `request_id`, input anonimizado, latencia y resultado.
- Manejo consistente de errores sin exponer stacktrace:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "category": "validation | inference | system"
  }
}
```

- Health checks:
  - `GET /health`
  - `GET /health/live`
- API key interna opcional por header `X-Internal-Key`.

## Variables de entorno

- `INFERENCE_TIMEOUT_SECONDS` (default: `0.5`)
- `INFERENCE_WORKERS` (default: `4`)
- `INFERENCE_INTERNAL_KEY` (opcional)

## Ejecutar local (sin Docker)

Desde la raiz del repo:

```powershell
$env:INFERENCE_TIMEOUT_SECONDS="0.5"
$env:INFERENCE_WORKERS="4"
uvicorn services.inference_service.main:app --host 0.0.0.0 --port 8001 --workers 1
```

## Ejecutar con Docker

Desde la raiz del repo:

```powershell
docker build -f services/inference_service/Dockerfile -t inference-service:local .
docker run --rm -p 8001:8001 inference-service:local
```

## Ejemplo de request/response

Request:

```bash
curl -X POST "http://127.0.0.1:8001/infer" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "text",
    "modality": "TEXT",
    "text": "Paciente con disnea progresiva y fiebre"
  }'
```

Response (ejemplo):

```json
{
  "model_name": "production_medical_triage",
  "model_version": "3.0.0",
  "risk_level": "high",
  "finding_code": "critical_alert_pattern",
  "confidence": 0.912341,
  "probabilities": {
    "low": 0.01532,
    "medium": 0.072339,
    "high": 0.912341
  },
  "recommendation_code": "urgent_immediate_evaluation",
  "features_used": {
    "token_count": 6.0,
    "char_count": 38.0,
    "active_ngrams": 12.0
  }
}
```

## Seguridad interna

Si se define `INFERENCE_INTERNAL_KEY`, todas las llamadas a `POST /infer` deben enviar:

- Header: `X-Internal-Key: <valor>`
