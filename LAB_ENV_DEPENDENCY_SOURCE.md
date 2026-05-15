# LAB ENV DEPENDENCY SOURCE

## Archivos encontrados

- `requirements.txt`
- `MetaBrain/services/nlg_service/requirements.txt`
- `MetaBrain/cerebro_ai_med/requirements.txt`
- `MetaBrain/services/inference_service/requirements.txt`
- `MetaBrain/services/dialogue_engine/requirements.txt`
- `MetaBrain/services/decision_service/requirements.txt`
- `medical-agenda-saas/requirements-medical-imaging.txt`

No se encontraron `pyproject.toml`, `poetry.lock`, `Pipfile` ni `Pipfile.lock` para el runtime Python raiz.

## Dependencia fuente elegida

Fuente elegida: `requirements.txt` en la raiz del proyecto.

Motivo:

- Es el archivo de dependencias del runtime API raiz.
- Declara explicitamente FastAPI, Starlette, httpx, pytest, SQLAlchemy, Redis, drivers DB y utilidades compartidas.
- Los requirements bajo `MetaBrain/services/*` son de microservicios internos con versiones distintas y no deben gobernar el API raiz.

## Versiones esperadas

- FastAPI: `0.116.2`
- Starlette: `0.47.3`
- httpx: `0.25.2`
- pytest: `7.4.3`
- Uvicorn: `0.24.0`
- Pydantic: `2.12.5`
- SQLAlchemy: `2.0.48`
- psycopg: `3.2.13`
- Redis: `5.0.1`

## Riesgos

- `requirements.txt` recomienda Python `3.11-3.13`, con preferencia por `3.12`.
- El Python disponible en el entorno actual es `3.14.2`.
- Algunas dependencias de ML/NLP y drivers pueden no tener wheels estables para Python 3.14.
- `httpx==0.25.2` puede tener compatibilidad indirecta a validar con Starlette/TestClient.

## Dependencias faltantes actuales

En el Python global:

- `fastapi`: ausente
- `starlette`: ausente
- `httpx`: ausente
- `pytest`: instalado globalmente, version `9.0.2`, distinta a `requirements.txt`

## Conflictos potenciales Python 3.14

- El propio repo advierte que el runtime recomendado no es Python 3.14.
- `scikit-learn==1.3.2`, `numpy==1.26.2`, `onnxruntime==1.18.1` pueden fallar o requerir wheels no disponibles para Python 3.14.
- Si la instalacion falla por paquetes no esenciales para HTTP, no se hara downgrade silencioso ni parche improvisado; se documentara el paquete exacto.
