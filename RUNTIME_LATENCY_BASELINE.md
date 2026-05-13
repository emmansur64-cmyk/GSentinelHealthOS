# RUNTIME LATENCY BASELINE

## Estado

Baseline HTTP ejecutado en venv lab con FastAPI/TestClient instalado.

## Script creado

- `api/tests/runtime_latency_baseline.py`

## Comando ejecutado

```powershell
.\.venv_runtime_lab\Scripts\python.exe api/tests/runtime_latency_baseline.py
```

## Resultado

Endpoint: `/`

Requests por caso: `200`

Baseline mas reciente (post thread-safety + TTL opcional):

Observability disabled:

- p50: `3.620 ms`
- p95: `9.841 ms`
- p99: `19.509 ms`

Observability enabled:

- p50: `3.921 ms`
- p95: `12.047 ms`
- p99: `23.011 ms`

## Endpoint testeado

`/`

## Cantidad de requests

`200` por caso.

## p50 / p95 / p99

Medidos arriba.

## Overhead estimado

Overhead p50 estimado de observability pasiva: `+0.301 ms`.

p95/p99 muestran incremento moderado en enabled, consistente con overhead esperado de middleware/telemetry local.

## Conclusion

La observability pasiva con event bus bounded + lock + TTL opcional no mostro degradacion severa en root local sin lifespan externo.

## Riesgos

- Medicion sin startup/lifespan porque DB/Redis lab no estan disponibles.
- Runner local con Python 3.14 no es version recomendada por el repo.
- Debe repetirse con Python 3.12/3.13 y servicios lab reales.
