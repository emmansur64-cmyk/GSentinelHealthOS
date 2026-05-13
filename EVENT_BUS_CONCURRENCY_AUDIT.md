# EVENT BUS CONCURRENCY AUDIT

## Alcance

Componente auditado:

- [MetaBrain/observability_py/event_bus.py](MetaBrain/observability_py/event_bus.py)

Integracion runtime auditada:

- [api/app/runtime_integration.py](api/app/runtime_integration.py)

## Estructura actual

Implementacion actual observada:

- Buffer en memoria con `collections.deque(maxlen=N)`.
- `publish(event)` hace:
  - chequeo `len(self._events) >= self._max_events`
  - incremento de `_dropped_events`
  - `append(event)`
- `list()` devuelve `list(self._events)`.
- `stats()` expone `current_size`, `max_size`, `dropped_events`.

No hay lock explicito.

## Riesgos de race condition detectados

### 1) Race en `publish()` entre `len()` y `append()`

Flujo actual no atomico:

1. Hilo A evalua `len >= max`.
2. Hilo B evalua `len >= max`.
3. Ambos incrementan/omiten `_dropped_events` segun estado intermedio.
4. Ambos hacen `append`.

Efecto:

- `_dropped_events` puede quedar inconsistente frente al numero real de evicciones.
- Bajo concurrencia alta, `dropped_events` deja de ser confiable para auditoria.

### 2) Contador `_dropped_events` no atomico

`_dropped_events += 1` no tiene exclusion mutua.

Efecto:

- perdida de incrementos bajo carrera de escritura.
- inconsistencia en metricas de overflow.

### 3) Lectura concurrente en `list()` mientras hay escrituras

`list(self._events)` sobre deque mutando concurrentemente no garantiza snapshot consistente sin lock.

Efecto potencial:

- lecturas no deterministas durante escrituras concurrentes.
- posible excepcion de iteracion en condiciones de alta contencion (depende de timing/runtime).

### 4) Mutabilidad del evento publicado

`publish()` guarda referencia al objeto `ObservabilityEvent` recibido.

Efecto:

- si el productor muta el objeto despues de publicar, el contenido retenido cambia sin trazabilidad.
- hoy el riesgo es bajo porque `build_structured_log()` crea instancias nuevas por request, pero la API del bus no lo impide.

## Counters no atomicos

- `_dropped_events`: no protegido.
- `current_size` leido desde `len(self._events)` sin lock.

`event_count <= max_events` se mantiene por `deque(maxlen=...)`, pero los counters asociados pueden desalinearse sin sincronizacion.

## Escritura concurrente

- `deque.append` es seguro a nivel de estructura en CPython para operaciones basicas.
- la secuencia compuesta `len -> contador -> append` no es atomica.

## Lectura concurrente

- `list()` sin lock no provee snapshot consistente.
- `stats()` sin lock puede mezclar estado de distintos instantes bajo alta concurrencia.

## Limpieza TTL futura (riesgo de diseño)

Si se agrega TTL sin lock y con limpieza oportunista en `publish/list`, hay riesgo de:

- dobles expiraciones contadas.
- expiraciones parciales durante lectura.
- inconsistencias entre `expired_events` y elementos realmente eliminados.

Recomendacion: cualquier limpieza TTL debe ejecutarse dentro de una seccion critica corta.

## Recomendaciones

1. Proteger `publish()`, `list()` y `stats()` con `threading.RLock` de grano fino.
2. Mantener lock corto, sin I/O ni operaciones externas dentro de la seccion critica.
3. Usar snapshot copy bajo lock en `list()` para consistencia.
4. Mantener `deque(maxlen=N)` como defensa principal de retencion.
5. Si se implementa TTL:
   - hacerlo opcional y apagado por default;
   - limpieza oportunista dentro del mismo lock;
   - contador separado `expired_events`.

## Conclusión

Existe riesgo real de carrera en contadores y lecturas bajo concurrencia. El bus ya evita crecimiento infinito por `maxlen`, pero requiere sincronizacion minima para consistencia de metricas y seguridad operativa antes de canary persistente.
