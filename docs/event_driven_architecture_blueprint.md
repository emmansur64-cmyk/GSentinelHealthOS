# Event-Driven Architecture Blueprint (FastAPI + PostgreSQL + RabbitMQ)

## 1. Objetivo
Escalar reservas de turnos y cancelaciones con alta concurrencia, desacoplando side effects (WhatsApp/email, analitica, auditoria) mediante eventos confiables.

## 2. Decisiones de arquitectura
- Source of truth: PostgreSQL.
- Integridad de booking: transaccion ACID local + locks/constraints.
- Publicacion de eventos: patron Outbox.
- Broker inicial: RabbitMQ (topologia orientada a negocio y notificaciones).
- Consumo: asincrono, idempotente, al menos una vez (at-least-once).

## 3. Eventos de dominio
### SlotReserved
- Cuándo: slot marcado como reservado/exitoso.
- Payload:
```json
{
  "event_id": "uuid",
  "event_type": "SlotReserved",
  "occurred_at": "2026-04-03T15:03:21.123Z",
  "aggregate_type": "slot",
  "aggregate_id": "slot:123",
  "correlation_id": "uuid",
  "causation_id": "uuid",
  "data": {
    "slot_id": 123,
    "doctor_id": 1,
    "patient_id": 1001,
    "priority": "normal",
    "reservation_source": "api"
  },
  "metadata": {
    "schema_version": 1,
    "producer": "booking-service"
  }
}
```

### AppointmentCreated
- Cuándo: cita creada y persistida.
- Payload:
```json
{
  "event_id": "uuid",
  "event_type": "AppointmentCreated",
  "occurred_at": "2026-04-03T15:03:21.140Z",
  "aggregate_type": "appointment",
  "aggregate_id": "appointment:987",
  "correlation_id": "uuid",
  "causation_id": "uuid",
  "data": {
    "appointment_id": 987,
    "slot_id": 123,
    "doctor_id": 1,
    "patient_id": 1001,
    "status": "scheduled"
  },
  "metadata": {
    "schema_version": 1,
    "producer": "booking-service"
  }
}
```

### AppointmentCancelled
- Cuándo: cita cancelada y slot liberado.
- Payload:
```json
{
  "event_id": "uuid",
  "event_type": "AppointmentCancelled",
  "occurred_at": "2026-04-03T15:12:51.021Z",
  "aggregate_type": "appointment",
  "aggregate_id": "appointment:987",
  "correlation_id": "uuid",
  "causation_id": "uuid",
  "data": {
    "appointment_id": 987,
    "slot_id": 123,
    "doctor_id": 1,
    "patient_id": 1001,
    "reason": "patient_request"
  },
  "metadata": {
    "schema_version": 1,
    "producer": "booking-service"
  }
}
```

## 4. Topologia RabbitMQ
- Exchange principal: `agenda.events` (topic, durable).
- Routing keys:
  - `slot.reserved`
  - `appointment.created`
  - `appointment.cancelled`
- Queues:
  - `notifications.whatsapp.q`
  - `notifications.email.q`
  - `projections.dashboard.q`
  - `audit.events.q`
- DLX:
  - Exchange: `agenda.events.dlx`
  - Queues DLQ por consumidor: `notifications.whatsapp.dlq`, etc.

Bindings sugeridos:
- `notifications.whatsapp.q` <- `appointment.*`
- `notifications.email.q` <- `appointment.*`
- `projections.dashboard.q` <- `slot.*` y `appointment.*`
- `audit.events.q` <- `#`

## 5. Flujo transaccional con Outbox
1. Request HTTP de reserva/cancelacion entra por FastAPI.
2. Caso de uso abre transaccion DB.
3. Persiste cambios de negocio (`time_slots`, `appointments`).
4. Inserta eventos en `outbox_events` (mismo commit).
5. Commit.
6. Outbox Relay publica eventos pendientes a RabbitMQ.
7. Relay marca eventos como `published`.
8. Consumidores procesan asincronamente (WhatsApp/email/proyecciones).

## 6. Contrato operativo de consumidores
- Idempotencia obligatoria por `event_id`.
- Tabla `consumer_offsets` o `processed_events` por consumidor.
- Si `event_id` ya procesado: ACK y no-op.
- Reintentos con backoff exponencial.
- En error permanente: NACK a DLQ.

## 7. Ejemplo de publicacion desde Outbox Relay (Python)
```python
import json
import aio_pika
from sqlalchemy import text

PUBLISH_BATCH_SIZE = 100
MAX_RETRIES = 8

async def publish_pending_events(session, channel):
    rows = await session.execute(
        text("""
        SELECT id, event_type, routing_key, payload, attempts
        FROM outbox_events
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY created_at
        LIMIT :limit
        FOR UPDATE SKIP LOCKED
        """),
        {"limit": PUBLISH_BATCH_SIZE},
    )

    exchange = await channel.declare_exchange("agenda.events", aio_pika.ExchangeType.TOPIC, durable=True)

    for row in rows:
        try:
            await exchange.publish(
                aio_pika.Message(
                    body=json.dumps(row.payload).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    message_id=str(row.payload["event_id"]),
                ),
                routing_key=row.routing_key,
            )
            await session.execute(
                text("UPDATE outbox_events SET status='published', published_at=now() WHERE id=:id"),
                {"id": row.id},
            )
        except Exception:
            await session.execute(
                text("""
                UPDATE outbox_events
                SET attempts = attempts + 1,
                    status = CASE WHEN attempts + 1 >= :max_retries THEN 'dead' ELSE 'pending' END,
                    next_attempt_at = now() + ((2 ^ LEAST(attempts, 6)) || ' seconds')::interval,
                    last_error = 'publish_failed'
                WHERE id = :id
                """),
                {"id": row.id, "max_retries": MAX_RETRIES},
            )

    await session.commit()
```

## 8. Ejemplo de consumidor idempotente (WhatsApp/email)
```python
async def consume_notification(event, db, whatsapp_client, email_client):
    event_id = event["event_id"]
    event_type = event["event_type"]
    data = event["data"]

    already = await db.scalar(
        text("SELECT 1 FROM processed_events WHERE consumer_name=:c AND event_id=:e"),
        {"c": "notifications", "e": event_id},
    )
    if already:
        return

    if event_type == "AppointmentCreated":
        await whatsapp_client.send_confirmation(data)
        await email_client.send_confirmation(data)
    elif event_type == "AppointmentCancelled":
        await whatsapp_client.send_cancellation(data)
        await email_client.send_cancellation(data)

    await db.execute(
        text("INSERT INTO processed_events (consumer_name, event_id, processed_at) VALUES (:c,:e,now())"),
        {"c": "notifications", "e": event_id},
    )
    await db.commit()
```

## 9. Integracion de notificaciones
Canales recomendados:
- WhatsApp: consumidor `notifications.whatsapp.q`.
- Email: consumidor `notifications.email.q`.

Plantillas:
- `AppointmentCreated` => confirmacion + detalle de fecha/hora.
- `AppointmentCancelled` => cancelacion + opcion de reprogramar.

Trazabilidad:
- Propagar `correlation_id` en logs y mensajes salientes.

## 10. Observabilidad y SLO
Métricas criticas:
- `outbox_pending_count`
- `outbox_publish_latency_ms`
- `consumer_lag_seconds`
- `dlq_messages_total`
- `notification_send_success_rate`

Alertas:
- Pending outbox > umbral por 5 min.
- DLQ creciente.
- P95 publish/consume > objetivo.

## 11. Roadmap de adopcion
Fase 1:
- Crear tablas outbox/processed.
- Publicar `AppointmentCreated` y `AppointmentCancelled`.
- Consumidor de notificaciones.

Fase 2:
- Agregar `SlotReserved` y proyecciones de dashboard.
- Retries/DLQ maduros.

Fase 3:
- Reprocesamiento historico y analitica avanzada.
- Opcional: replicar stream a Kafka para BI/event replay.
