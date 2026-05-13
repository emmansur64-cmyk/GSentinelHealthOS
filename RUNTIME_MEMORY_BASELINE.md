# RUNTIME MEMORY BASELINE

## Estado

Baseline HTTP de memoria ejecutado en venv lab con FastAPI/TestClient instalado.

## Script creado

- `api/tests/runtime_memory_baseline.py`

## Comando ejecutado

```powershell
.\.venv_runtime_lab\Scripts\python.exe api/tests/runtime_memory_baseline.py
```

## Resultado

Ejecucion mas reciente (post thread-safety + TTL opcional):

```text
requests=500
endpoint=/
current_before_kb=0.0
peak_before_kb=0.0
current_after_kb=11963.977
peak_after_kb=12047.701
event_count=500
event_bus.current_size=500
event_bus.max_size=1000
event_bus.dropped_events=0
```

## Metodo previsto

- `TestClient`
- `tracemalloc`
- 500 requests locales
- conteo de eventos en `runtime_integration_event_bus`

## Hallazgo de diseno

El bus permanece acotado por `deque(maxlen=1000)`. En corrida de 500 requests no hubo overflow, por lo que `dropped_events=0`.

## Growth behavior

- `current_size` se mantiene acotado por `max_size`.
- `dropped_events` solo incrementa en overflow.
- No hay crecimiento infinito de eventos retenidos.

## Memory pressure

La memoria pico observada se mantiene en rango esperado para ejecucion local con TestClient. El estado retenido del bus permanece acotado.

## Conclusion

El crecimiento infinito del event bus sigue mitigado por limite FIFO. Con TTL deshabilitado por default no hay expiracion temporal activa en baseline estandar.
