# EVENT BUS STRESS REPORT

## Comando

```powershell
.\.venv_runtime_lab\Scripts\python.exe api/tests/runtime_event_bus_stress.py
```

## Requests simuladas

- Requests: `1500`
- Endpoint: `/`
- Datos reales: ninguno
- Providers externos: ninguno
- IA clinica: no activa

## Queue max

- `max_size=1000`
- `current_size=1000`

## Dropped events

- `dropped_events=500`
- `expected_dropped=500`

## Estabilidad

Resultado:

```text
bounded=True
stable=True
```

No hubo crash ni status 5xx.

## Riesgos

- Prueba local sin lifespan externo porque DB/Redis lab no estan disponibles.
- No valida concurrencia multi-worker.
- No valida canary prolongado en horas/dias.
