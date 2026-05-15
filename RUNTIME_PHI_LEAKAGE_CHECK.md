# RUNTIME PHI LEAKAGE CHECK

## Patrones buscados

Busqueda case-insensitive:

- `Authorization`
- `Bearer`
- `API_KEY`
- `TOKEN`
- `password`
- `email`
- `phone`
- `patient`
- `dni`
- `document`
- `image_base64`

## Archivos revisados

- `api/app/runtime_integration.py`
- `api/app/main.py`
- `api/tests/test_runtime_integration.py`
- `api/tests/runtime_latency_baseline.py`
- `api/tests/runtime_memory_baseline.py`
- documentos runtime creados previamente

## Hallazgos

- `api/app/runtime_integration.py` contiene marcadores de redaccion: `authorization`, `cookie`, `token`, `secret`, `key`.
- `api/app/main.py` contiene headers/paths legitimos: `Authorization`, `Idempotency-Key`, `x-csrf-token`, router `patients`.
- `api/tests/test_runtime_integration.py` contiene un secreto sintetico `Bearer secret-token` para validar que no aparezca en telemetry.
- Documentos contienen menciones descriptivas a PHI/patient scope, no datos reales.

## Falsos positivos

- `patients` en body root esperado y router API.
- `Authorization` como header permitido CORS.
- `token` en rutas auth/CSRF.
- `secret-token` en test sintetico.

## Riesgos reales

- Si se habilita observability, los eventos quedan en bus de memoria sin limite.
- Los tests HTTP de redaccion ya se ejecutaron en `.venv_runtime_lab` y validaron que el token sintetico no aparezca en telemetry.
- El bus en memoria retuvo 500 eventos en baseline, por lo que debe acotarse antes de canary persistente.

## Mitigaciones

- No se leen request bodies.
- No se registran query params.
- Headers sensibles se redactan por marcador.
- Payloads complejos se resumen como `[SUMMARY_ONLY]`.
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`.
- `OBSERVABILITY_PHI_ALLOWED=false`.
