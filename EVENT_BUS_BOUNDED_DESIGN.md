# EVENT BUS BOUNDED DESIGN

## Estrategia elegida

Usar `collections.deque(maxlen=N)`.

Motivo:

- FIFO automatico.
- Memoria acotada.
- Sin threads.
- Sin loops async.
- Sin persistencia.
- Mantiene compatibilidad con `publish()` y `list()`.

## Limite

Default:

- `max_events=1000`

Override opcional por variable de entorno:

- `OBSERVABILITY_EVENT_BUS_MAX_EVENTS`

Si el valor es invalido o menor a 1, se usa `1000`.

## Politica overflow

FIFO:

- Cuando el bus esta lleno, el evento mas antiguo se descarta.
- El evento nuevo se conserva.
- Se incrementa `dropped_events`.

## Metricas basicas

- `current_size`
- `max_size`
- `dropped_events`

## Impacto observability

El bus queda apto para shadow/local/canary minimo sin crecimiento infinito. Pierde historial antiguo cuando supera el limite, lo cual es aceptable para telemetry pasiva in-memory.

## Tradeoffs

- Ventaja: memoria acotada y simple.
- Costo: eventos antiguos se descartan.
- No resuelve persistencia ni analitica historica.
- No sustituye un backend de observabilidad futuro.

## Rollback

Rollback simple: volver de `deque(maxlen=N)` a lista. No hay migraciones ni datos persistentes.

No recomendado salvo regresion, porque reintroduce crecimiento infinito.
