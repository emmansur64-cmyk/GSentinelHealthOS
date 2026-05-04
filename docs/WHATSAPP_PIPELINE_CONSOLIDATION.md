# WhatsApp Pipeline Consolidation

## Active Pipeline (Primary)

The default and primary WhatsApp pipeline is:

- Next.js + BullMQ
- Official webhook route: `/api/webhooks/whatsapp`

Meta callback target must be:

- `https://gsentinelhealth.com.ar/api/webhooks/whatsapp`

## Legacy Pipelines (Disabled by Default)

The following legacy paths are preserved for rollback but disabled by default:

- Python API direct webhook (`api/app/api/v1/endpoints/webhooks_whatsapp.py`)
- Python WhatsApp gateway (`whatsapp_gateway/`)
- Brain Redis worker over legacy queues (`whatsapp:incoming` / `whatsapp:outgoing`)
- Node legacy webhook (`whatsapp_gateway/cloud-api-webhook/server.js`)

## Emergency Reactivation Flags

Legacy components can be re-enabled manually only by explicit feature flags:

- `ENABLE_PY_WHATSAPP_WEBHOOK=true`
- `ENABLE_WHATSAPP_GATEWAY=true`
- `ENABLE_BRAIN_REDIS_WORKER=true`
- `ENABLE_LEGACY_NODE_WHATSAPP=true`

If a flag is missing, the corresponding legacy component stays disabled.

## Minimum Variables for Next.js + BullMQ Pipeline

- `DATABASE_URL`
- `REDIS_URL` or `REDIS_HOST` + `REDIS_PORT`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `DEFAULT_TENANT_ID`
- `WHATSAPP_AUTO_BOOT_WORKERS`

## Operational Warning

Meta must point to only one webhook endpoint:

- `/api/webhooks/whatsapp`

Do not configure Meta to send traffic to legacy webhook endpoints while this consolidation is active.

## Validación local FLOW_OK

Validación ejecutada en entorno local (sin deploy, sin VPS) para el pipeline Next.js + BullMQ:

- Redis local OK
- Webhook GET OK
- Webhook POST firmado OK
- DB persistence OK
- Queue enqueue OK
- Workers OK

Requisito local confirmado para resolver tenant por `phone_number_id`:

- Tenant activo
- `ClinicWhatsappAccount` activa para el `phoneNumberId` local

Configuración local validada:

- `DEFAULT_TENANT_ID=default` solo para entorno local validado

Notas de seguridad:

- No incluir tokens
- No incluir secrets
