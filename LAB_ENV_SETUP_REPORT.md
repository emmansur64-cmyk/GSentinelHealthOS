# LAB ENV SETUP REPORT

## Venv

- Path: `.venv_runtime_lab`
- Python: `3.14.2`
- Ejecutable: `.venv_runtime_lab\Scripts\python.exe`

## Fuente de dependencias

Fuente real detectada: `requirements.txt`.

La instalacion completa fue intentada con:

```powershell
.\.venv_runtime_lab\Scripts\python.exe -m pip install -r requirements.txt
```

## Resultado de instalacion completa

Fallida por incompatibilidad/build en Python 3.14:

- Paquete: `scikit-learn==1.3.2`
- Error: requiere Microsoft Visual C++ 14.0 o superior para compilar metadata/wheel.
- Causa probable: no hay wheel compatible para Python 3.14 para esa version.

No se hizo downgrade, no se edito `requirements.txt` y no se parchearon dependencias.

## Instalacion API parcial documentada

Para validar el runtime API sin ML/NLP, se instalaron dentro del venv las dependencias API exactas declaradas en `requirements.txt`:

- `fastapi==0.116.2`
- `starlette==0.47.3`
- `httpx==0.25.2`
- `pytest==7.4.3`
- `pytest-asyncio==0.21.1`
- `uvicorn[standard]==0.24.0`
- `sqlalchemy==2.0.48`
- `aiosqlite==0.20.0`
- `psycopg[binary]==3.2.13`
- `pydantic==2.12.5`
- `pydantic-settings==2.1.0`
- `redis==5.0.1`
- Google/auth/celery/utilidades necesarias del API

## Validacion de paquetes

```text
FASTAPI_ENV_OK 0.116.2 0.47.3 0.25.2 7.4.3
```

## Warnings

- `email-validator==2.1.0` aparece como yanked en PyPI por metadata de Python 3.7, no por fallo runtime observado.
- Pip reporto warnings de cache entry deserialization; no bloquearon instalacion API parcial.

## Incompatibilidades

- Python 3.14 no coincide con recomendacion del repo: `3.11-3.13`, preferido `3.12`.
- `scikit-learn==1.3.2` no quedo instalado.
- `numpy==1.26.2` no quedo instalado.
- Dependencias ML/ONNX/Groq del bloque final no quedaron instaladas por el fallo de `scikit-learn`.
