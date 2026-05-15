# WhatsApp Webhook Duplication Audit

Fecha: 2026-05-15

## Endpoints auditados

| Endpoint | Archivo | Ruta | Estado |
|---|---|---|---|
| Gateway WhatsApp | `whatsapp_gateway/api/routes/webhook.py` | `/webhook/whatsapp` | Autoridad recomendada actual |
| FastAPI legacy | `api/app/api/v1/endpoints/webhooks_whatsapp.py` | `/api/v1/webhooks/whatsapp` | Legado, desactivado por guard explícito |

## Evidencia de routing/configuración

- `whatsapp_gateway/app/main.py` incluye el router gateway solo si `ENABLE_WHATSAPP_GATEWAY=true`.
- `.env.example` define `ENABLE_WHATSAPP_GATEWAY=true`.
- `api/app/main.py` incluye el webhook Python solo si `ENABLE_PY_WHATSAPP_WEBHOOK=true`.
- No se encontró `ENABLE_PY_WHATSAPP_WEBHOOK` habilitado en `.env.example`.

## Comparación funcional

| Criterio | Gateway | FastAPI legacy |
|---|---|---|
| Valida firma Meta | Sí, con body raw y `WHATSAPP_APP_SECRET`. | Sí, pero después de parsear mensaje inicial. |
| Resuelve cuenta multicliente | Sí, por `phone_number_id` y verify token. | Sí, consulta `ClientWhatsAppAccount`. |
| Encola mensajes | Sí, usa `WhatsAppQueueProducer`. | No, procesa y responde inline. |
| Idempotencia | Sí, `queue_service.publish()` puede devolver duplicado. | No se observó deduplicación equivalente. |
| Riesgo de doble procesamiento | Bajo si solo gateway está habilitado. Alto si se habilitan ambos. | Alto si se habilita junto al gateway. |
| Mezcla clínica/agenda | Gateway solo encola. | Detecta intent, crea shadow patient, auto-reply y broadcast. |

## Autoridad recomendada

El endpoint autoridad para recepción WhatsApp debe ser `whatsapp_gateway/api/routes/webhook.py`, porque:

- Está detrás del servicio dedicado `whatsapp_gateway`.
- Encola mensajes para procesamiento asíncrono.
- Tiene comportamiento explícito de duplicado/idempotencia.
- Mantiene menor mezcla de responsabilidades clínicas.

## Cambio aplicado

Se agregó guard reversible al endpoint FastAPI legacy:

- Nueva bandera: `ENABLE_PY_WHATSAPP_WEBHOOK_PROCESSING`.
- Valor por defecto: `false`.
- Si el router legacy se incluye por error, `GET` y `POST` devuelven `410 deprecated_whatsapp_webhook_disabled`.
- Se registran logs `deprecated_whatsapp_webhook_verify_blocked` y `deprecated_whatsapp_webhook_receive_blocked`.

## Rollback

Para reactivar temporalmente el endpoint legacy en un entorno controlado:

1. Mantener `ENABLE_PY_WHATSAPP_WEBHOOK=true`.
2. Agregar `ENABLE_PY_WHATSAPP_WEBHOOK_PROCESSING=true`.
3. Confirmar que el gateway no esté registrado simultáneamente en Meta para el mismo phone number.

No se borraron archivos ni rutas.
