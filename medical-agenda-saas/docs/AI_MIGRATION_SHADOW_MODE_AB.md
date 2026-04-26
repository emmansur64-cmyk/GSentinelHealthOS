# Estrategia de Migracion Progresiva a Modelo Python (Shadow Mode A/B)

## Objetivo

Migrar del modelo heuristico actual a un modelo real en Python con riesgo controlado, observabilidad completa y rollback inmediato.

## Fases Operativas

1. Stage 0 - Baseline heuristico
- Serving: 100% heuristico.
- Requisito: dataset historico limpio (labels `completed`/`no_show`) y KPI de referencia estables.

2. Stage 1 - Shadow mode
- Serving: 100% heuristico.
- Scoring paralelo: 100% Python sin impacto de negocio.
- Comparar por request: probabilidad, Brier score y latencia.

3. Stage 2 - Canary A/B
- Serving: parcial Python (default 10%) y control heuristico (90%).
- Segmentacion sugerida: por doctor, especialidad o franja horaria.
- Requisito: delta de Brier <= `PREDICTION_MAX_ALLOWED_DELTA`.

4. Stage 3 - Cutover
- Serving: 100% Python.
- Fallback: heuristico habilitado por flag en caliente.

## Variables de Entorno

- `PREDICTION_MODEL_MODE`: `heuristic` | `shadow` | `python`
- `PREDICTION_PYTHON_ENDPOINT`: URL del servicio Python
- `PREDICTION_AB_TRAFFIC_RATIO`: porcentaje para variante candidata (0.0 a 1.0)
- `PREDICTION_MAX_ALLOWED_DELTA`: umbral maximo de degradacion permitida

## KPI de Go/No-Go

- Brier score candidato no peor que control por mas de delta permitido.
- Accuracy candidato >= accuracy control - 2 puntos porcentuales.
- P95 latencia de inferencia <= 350ms.
- Error rate de inferencia < 1%.

## Rollback

- Cambiar `PREDICTION_MODEL_MODE=heuristic`.
- Mantener shadow scoring activo hasta estabilizar.
- Registrar incidente y comparativa en dashboard admin.
