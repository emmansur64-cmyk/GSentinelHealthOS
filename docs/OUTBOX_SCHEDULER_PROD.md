# Outbox Scheduler en Produccion

Este documento describe como ejecutar el worker continuo de outbox para notificaciones y sincronizacion con Google Calendar.

## Opcion 1: Docker Compose (recomendado)

Servicios agregados:
- outbox_scheduler en docker-compose.prod.yml
- outbox-scheduler en docker-compose.yml

### Variables clave

- OUTBOX_PROCESS_LIMIT (default 200)
- OUTBOX_SCHEDULER_INTERVAL_SECONDS (default 15)
- GOOGLE_CALENDAR_ENABLED
- GOOGLE_CALENDAR_AUTH_MODE
- GOOGLE_CALENDAR_ID
- GOOGLE_CALENDAR_TIMEZONE
- GOOGLE_SERVICE_ACCOUNT_FILE
- GOOGLE_OAUTH_CLIENT_SECRET_FILE
- GOOGLE_OAUTH_TOKEN_FILE
- GOOGLE_CALENDAR_WEBHOOK_TOKEN
- GOOGLE_CALENDAR_WEBHOOK_CALLBACK_URL
- GOOGLE_CALENDAR_WATCH_TTL_SECONDS

### Levantar en prod

```bash
docker compose -f docker-compose.prod.yml up -d outbox_scheduler
```

### Ver logs

```bash
docker logs -f gs_outbox_scheduler
```

## Opcion 2: systemd (Linux VM/host)

1. Copiar el proyecto a /opt/GSentinelHealthOS y crear virtualenv.
2. Completar variables en /opt/GSentinelHealthOS/.env.
3. Instalar servicio:

```bash
bash scripts/install_outbox_scheduler_service.sh
```

4. Comandos utiles:

```bash
sudo systemctl status gsentinel-outbox-scheduler
sudo systemctl restart gsentinel-outbox-scheduler
sudo journalctl -u gsentinel-outbox-scheduler -f
```

## Health y operacion

- El worker ejecuta scripts/run_outbox_scheduler.py en loop.
- Si Google o red falla, el outbox queda en failed y reintenta con backoff.
- No se pierden turnos: la persistencia local del appointment sigue siendo transaccional.
- Endpoint de health especifico: GET /api/health/outbox
- El endpoint devuelve 200 si estado healthy y 503 si degraded/critical/unknown.

## Recomendaciones

- Monitorear cantidad de items failed en notification_outbox.
- Alertar si attempts cercanos a MAX_ATTEMPTS.
- Revisar last_error para diagnostico de credenciales o red.
