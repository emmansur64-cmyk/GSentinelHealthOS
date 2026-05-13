# EVENT BUS MULTIPROCESS LIMITATION

Última actualización: 2026-05-12

## Hecho estructural

- Cada worker/proceso tiene su propia instancia de `InMemoryObservabilityEventBus` en memoria.
- Los contadores del bus no son globales entre procesos.
- La agregación cross-worker no ocurre de forma nativa con el bus actual.

## Counters per-worker (no globales)

| Métrica | Scope |
|---|---|
| `messages_processed_total` | por worker |
| `system_reset_total` | por worker |
| `lock_contention_total` | por worker |
| `brain_metrics.*` | por worker |
| `queue_depths.*` | por worker (aunque lee Redis → sí es global) |
| `ratios.*` | calculados sobre contadores per-worker |
| `alerts.*` | calculados sobre contadores per-worker |

## Counters que SÍ son globales (fuente Redis)

- `queue_depths.whatsapp_incoming/outgoing` — leídos desde Redis compartido
- `queue_depths.booking_shards.*` — leídos desde Redis compartido
- `redis_connected` — estado del worker actual hacia Redis compartido

## Impacto en canary

- En multi-worker real, cada proceso verá solo su propio subconjunto de eventos de bus.
- Cualquier métrica de observability basada en memoria queda fragmentada por worker.
- La lectura global de `/api/health/readiness.brain_metrics` debe tratarse como parcial del worker que atiende la request.
- Las métricas de Redis queue depth sí son globales y confiables.

## Validación dual-worker 2026-05-12

- Worker-A (pid=50776, :18080): startup OK, SELECT 1 OK, liveness 10/10
- Worker-B (pid=59184, :18081): startup OK, SELECT 1 OK, liveness 10/10
- Ambos workers vieron `brain_metrics` independientes (counters en 0 para ambos porque no procesaron requests clínicas)
- Confirmado: los counters per-worker son aditivos en produción, no compartidos

## Para producción si se requiere agregación global

1. **Opción A — Exporter pasivo**: cada worker empuja métricas a Redis INCRBY al final de cada request; agregador lee totales.
2. **Opción B — Prometheus/statsd**: cada worker expone `/metrics` scrapeables; Prometheus agrega.
3. **Opción C — Redis Streams**: el bus in-memory emite también a un stream Redis; consumidor centralizado agrega.
- No implementar hasta que exista necesidad operativa demostrada (SLA de alertas globales).

## Por qué no usar Redis/Kafka todavía

- El objetivo actual es validar seguridad y aislamiento con mínimo alcance.
- Introducir bus distribuido ahora mezclaría dos cambios grandes: escalado multi-proceso y transporte distribuido.
- Mantener el bus en memoria evita cambios de contrato y reduce riesgo.

## Recomendación

- Documentar en runbook que `brain_metrics` en readiness es per-worker.
- Si el canary requiere agregación global, usar Opción A (Redis INCRBY) como mínimo viable.
- Mantener TTL apagado por defecto hasta que exista evidencia de necesidad operativa.
