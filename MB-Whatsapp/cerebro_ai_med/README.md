# Cerebro AI Med

Proyecto modular de IA medica con FastAPI, PyTorch, MONAI, Ollama, ONNX Runtime y FAISS.

## Produccion Real A-G

Este servicio implementa endurecimiento de produccion en el orden A-G:

- Paso A: seguridad API con API key obligatoria, CORS restrictivo, headers de seguridad, timeout y limite de tamano de request.
- Paso B: model loader robusto con validacion de semver, checksum SHA-256, ruta segura de artefactos y fallback a version anterior valida.
- Paso C: logging estructurado JSON con request_id y trazabilidad de input anonimo, output, version de modelo y latencia.
- Paso D: rate limiting distribuido con Redis por ventana deslizante.
- Paso E: metricas Prometheus en /metrics (latencia, throughput, errores, inferencias).
- Paso F: dockerizacion para FastAPI + Redis.
- Paso G: validacion end-to-end via pytest.

## Estructura de Artefactos

Se usa registro local versionado con estructura:

- models/artifacts/text/{version}/text_risk_pipeline.joblib
- models/artifacts/image/{version}/image_risk_pipeline.joblib
- models/artifacts/metadata.json

El metadata define active_model y checksums por artefacto.

## Variables de Entorno

Usa como base cerebro_ai_med/.env.example y define al menos:

- CEREBRO_API_KEY
- CEREBRO_CORS_ALLOW_ORIGINS
- CEREBRO_REDIS_URL
- CEREBRO_RATE_LIMIT_ENABLED
- CEREBRO_RATE_LIMIT_FAIL_OPEN

Para produccion se recomienda:

- APP_ENV=production
- CEREBRO_RATE_LIMIT_FAIL_OPEN=false

## Ejecucion Local

1. Instalar dependencias:

python -m pip install -r cerebro_ai_med/requirements.txt

2. Levantar API:

python -m uvicorn cerebro_ai_med.main:app --host 0.0.0.0 --port 8000

3. Probar health y metrics:

curl http://127.0.0.1:8000/health/live
curl http://127.0.0.1:8000/health/ready
curl http://127.0.0.1:8000/metrics

## Ejecucion Docker

1. Exporta una API key fuerte:

set CEREBRO_API_KEY=replace_with_strong_key

2. Levanta API + Redis:

docker compose -f docker/docker-compose.cerebro-ai-med.yml up --build

## Ejemplo Request/Response Real

Request:

curl -X POST http://127.0.0.1:8000/analyze ^
	-H "Content-Type: application/json" ^
	-H "X-API-Key: replace_with_strong_key" ^
	-d "{\"input_type\":\"text\",\"modality\":\"TEXT\",\"text\":\"Dolor toracico opresivo, disnea y diaforesis\"}"

Response (ejemplo):

{
	"status": "accepted",
	"timestamp_utc": "2026-04-21T20:00:00.000000+00:00",
	"input": {
		"type": "text",
		"modality": "TEXT",
		"summary": {
			"text_length": 44,
			"preview": "Dolor toracico opresivo, disnea y diaforesis"
		}
	},
	"pipeline": {
		"step": "api_base",
		"next_step": "models_baseline",
		"message": "Entrada de texto validada correctamente"
	},
	"inference": {
		"model_name": "production_medical_triage",
		"model_version": "3.0.0",
		"risk_level": "high",
		"finding_code": "critical_alert_pattern",
		"confidence": 0.84,
		"probabilities": {
			"low": 0.08,
			"medium": 0.08,
			"high": 0.84
		},
		"recommendation_code": "urgent_immediate_evaluation",
		"features_used": {
			"token_count": 6,
			"char_count": 44,
			"active_ngrams": 10
		}
	},
	"medical_audit": {
		"no_definitive_diagnosis": true,
		"risk_level": "high",
		"safe_recommendation": "Buscar evaluacion medica urgente de forma inmediata.",
		"requires_medical_evaluation": true
	}
}

## Paso 1
Estructura base creada y validable localmente.

## Paso A - Seguridad API

1. Definir variable de entorno obligatoria:

```bash
set CEREBRO_API_KEY=super_secret_key_please_rotate
```

2. Ejecutar API:

```bash
python -m uvicorn cerebro_ai_med.main:app --host 127.0.0.1 --port 8000
```

3. Probar endpoint protegido:

```bash
curl -X POST http://127.0.0.1:8000/analyze -H "Content-Type: application/json" -H "X-API-Key: super_secret_key_please_rotate" -d "{\"input_type\":\"text\",\"modality\":\"TEXT\",\"text\":\"Paciente con fiebre y disnea\"}"
```

## Paso C - Observabilidad y Health Checks

Endpoints operativos:

```bash
curl http://127.0.0.1:8000/health/live
curl http://127.0.0.1:8000/health/ready
curl http://127.0.0.1:8000/health/model
```

Comportamiento:

- `/health/live`: valida liveness del proceso API.
- `/health/ready`: valida readiness real (API key configurada, registry presente, modelo activo valido, integridad de artefactos y servicio de modelo cargado).
- `/health/model`: health check profundo del modelo (estado de registry, version activa, existencia de artefactos y checksums SHA-256 por artefacto).
- Cada respuesta incluye headers de trazabilidad:
	- `X-Request-ID`
	- `X-Process-Time-ms`

## Verificacion rapida
```bash
python main.py
```
