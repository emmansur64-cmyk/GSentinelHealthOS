# EVENT BUS AUDIT REPORT

## Estructura real

El bus usado por runtime integration es `MetaBrain/observability_py/event_bus.py`.

Estado previo:

```python
self._events: list[ObservabilityEvent] = []
self._events.append(event)
return list(self._events)
```

## Growth path

Ruta de crecimiento:

1. `api/app/runtime_integration.py`
2. `passive_runtime_integration_middleware`
3. `build_structured_log(...)`
4. `bus.publish(event)`
5. `InMemoryObservabilityEventBus._events.append(event)`

Con `OBSERVABILITY_ENABLED=true`, cada request publica un evento. El baseline previo mostro:

- 500 requests
- 500 eventos retenidos
- bus sin limite

## Riesgos

- Crecimiento lineal infinito.
- Presion progresiva de memoria.
- Canary inseguro si observability queda activa por largo tiempo.
- OOM futuro si el proceso queda vivo y recibe trafico continuo.

## Complejidad actual

Baja. El bus expone tres comportamientos:

- constructor
- `publish(event)`
- `list()`

No hay persistencia, brokers externos, threads ni async loops.

## Locks/race conditions

No hay locks. En el uso actual de FastAPI/TestClient y shadow local, las operaciones son simples e in-process. Para una etapa futura con alta concurrencia, conviene evaluar un lock liviano si se observa contencion.

## Puntos de cleanup

Punto natural: al publicar evento. La alternativa mas segura es reemplazar la lista por `collections.deque(maxlen=N)`, que aplica FIFO automaticamente y evita cleanup manual fragil.
