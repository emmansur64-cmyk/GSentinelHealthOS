# Checklist de despliegue productivo — GSentinelHealthOS

> **Propósito**: lista de verificación paso a paso antes de poner el sistema multiclínica WhatsApp AI en producción.
> Completar cada ítem en orden; no proceder si algún ítem falla.

---

## 0. Pre-requisitos del entorno

| # | Verificación | Comando / Acción | Estado |
|---|---|---|---|
| 0.1 | Python ≥ 3.12 en todos los contenedores | `python --version` | ☐ |
| 0.2 | `.env` con todas las variables obligatorias presente en VPS | Ver sección **Variables de entorno** abajo | ☐ |
| 0.3 | `SECRET_ENCRYPTION_KEY` generada y almacenada de forma segura | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | ☐ |
| 0.4 | `DATABASE_URL` apunta a Postgres de producción (no de desarrollo) | Verificar host/puerto en `.env` | ☐ |
| 0.5 | Redis productivo accesible desde API, Brain y Gateway | `redis-cli -h $REDIS_HOST ping` | ☐ |
| 0.6 | Backup previo al despliegue tomado | `pg_dump $DB_NAME > backup_predeployment_$(date +%Y%m%d).sql` | ☐ |

---

## 1. Base de datos

| # | Verificación | Comando | Estado |
|---|---|---|---|
| 1.1 | Migraciones de Alembic aplicadas hasta `0022` | `alembic upgrade head` | ☐ |
| 1.2 | No quedan migraciones pendientes | `alembic current` → debe mostrar `head` | ☐ |
| 1.3 | Columnas nuevas presentes: `appointments.clinic_id`, `appointments.specialty`, `patients.dni`, `patients.full_name` | `\d appointments`, `\d patients` en psql | ☐ |
| 1.4 | Tabla `client_whatsapp_accounts` existe con columnas: `phone_number_id`, `access_token_encrypted`, `app_secret_encrypted`, `verify_token`, `clinic_id`, `client_id` | `\d client_whatsapp_accounts` | ☐ |
| 1.5 | Ningún registro con `clinic_id IS NULL` en tablas críticas | `SELECT table_name, COUNT(*) FROM (SELECT 'patients' AS table_name FROM patients WHERE clinic_id IS NULL UNION ALL SELECT 'appointments' FROM appointments WHERE clinic_id IS NULL) sub GROUP BY 1` | ☐ |

---

## 2. WhatsApp / Meta — Embedded Signup por clínica

Repetir para **cada clínica** que se vaya a conectar.

| # | Verificación | Acción | Estado |
|---|---|---|---|
| 2.1 | Cuenta Meta Business verificada para la clínica | Meta Business Manager | ☐ |
| 2.2 | Embedded Signup completado | `GET /meta/embedded-signup/callback?code=…&clinic_id=…` | ☐ |
| 2.3 | Registro creado en `client_whatsapp_accounts` con `status=active` | `SELECT phone_number_id, status, waba_id FROM client_whatsapp_accounts WHERE clinic_id='…'` | ☐ |
| 2.4 | `access_token_encrypted` y `app_secret_encrypted` son NO NULOS | Misma query | ☐ |
| 2.5 | Webhook URL registrada en Meta Developer Console | `https://<host>/webhook/whatsapp` | ☐ |
| 2.6 | `verify_token` en Meta coincide con el almacenado en BD | `GET /webhook/whatsapp?hub.verify_token=…&hub.challenge=…&hub.mode=subscribe` debe devolver el challenge | ☐ |
| 2.7 | Suscripción a `messages` habilitada en Meta | Meta App → Webhooks → messages: ✓ | ☐ |
| 2.8 | Test de mensaje real enviado desde número de prueba Meta | Ver logs del gateway: `Webhook payload received` | ☐ |

---

## 3. Variables de entorno requeridas

> Todas deben estar en `.env` de producción. **Ninguna** debe hardcodearse en código.

```
# Seguridad
SECRET_ENCRYPTION_KEY=<fernet_key_base64>
JWT_SECRET=<random_256bit>
INTERNAL_API_KEY=<random_string>

# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://redis:6379/0

# WhatsApp / Meta (global)
WHATSAPP_VERIFY_TOKEN=<token_global_fallback>

# API interna
INTERNAL_API_URL=http://api:8000

# Opcionales / recomendados
LOG_LEVEL=INFO
SENTRY_DSN=<dsn_if_used>
```

| # | Variable | Crítica | Estado |
|---|---|---|---|
| 3.1 | `SECRET_ENCRYPTION_KEY` | ✅ | ☐ |
| 3.2 | `DATABASE_URL` | ✅ | ☐ |
| 3.3 | `REDIS_URL` | ✅ | ☐ |
| 3.4 | `JWT_SECRET` | ✅ | ☐ |
| 3.5 | `INTERNAL_API_KEY` | ✅ | ☐ |
| 3.6 | `WHATSAPP_VERIFY_TOKEN` | ✅ | ☐ |
| 3.7 | `INTERNAL_API_URL` | ✅ | ☐ |
| 3.8 | `LOG_LEVEL=INFO` (no DEBUG en prod) | ✅ | ☐ |

---

## 4. Infraestructura Docker

| # | Verificación | Comando | Estado |
|---|---|---|---|
| 4.1 | `docker-compose.prod.yml` usa imágenes tagueadas (no `latest`) | Ver `image:` en compose | ☐ |
| 4.2 | Health checks definidos para api, brain, gateway, redis | `docker compose ps` muestra `healthy` | ☐ |
| 4.3 | Puertos de BD y Redis no expuestos al exterior | `docker compose config` → redis no tiene `ports: "5432:5432"` | ☐ |
| 4.4 | Volúmenes de logs persistentes definidos | `volumes:` en docker-compose.prod.yml | ☐ |
| 4.5 | Restart policy `always` en todos los servicios críticos | Ver `restart:` en compose | ☐ |
| 4.6 | Memoria máxima configurada para brain worker | `mem_limit:` en compose o cgroups | ☐ |

---

## 5. Auditoría de seguridad pre-deploy

| # | Verificación | Comando | Estado |
|---|---|---|---|
| 5.1 | Auditoría de logs: sin tokens/secrets en texto claro | `python scripts/audit_logs_sensitive.py --docker sentinel-api sentinel-brain sentinel-gateway` | ☐ |
| 5.2 | Variables de entorno no logueadas al arranque | Revisar logs del primer boot: no deben aparecer `SECRET_ENCRYPTION_KEY`, etc. | ☐ |
| 5.3 | HTTPS habilitado en el gateway (TLS terminado en nginx/caddy) | `curl -v https://<host>/webhook/whatsapp` devuelve 200 | ☐ |
| 5.4 | Headers de seguridad presentes en respuestas API | `curl -I https://<host>/api/v1/health` → `X-Content-Type-Options`, `Strict-Transport-Security` | ☐ |
| 5.5 | Rate limiting activo en webhook | Enviar >30 mensajes/min desde mismo IP y verificar 429 | ☐ |
| 5.6 | HMAC signature verification activo en producción | Mensaje sin `X-Hub-Signature-256` debe devolver 401/403 | ☐ |

---

## 6. Verificación de aislamiento multitenant

| # | Verificación | Comando | Estado |
|---|---|---|---|
| 6.1 | Script de setup E2E ejecutado en BD de staging | `python scripts/e2e_setup_clinics.py` | ☐ |
| 6.2 | Suite E2E 10 tests pasan | `pytest tests/e2e/test_whatsapp_pipeline_e2e.py -v` → 10 passed | ☐ |
| 6.3 | Aislamiento BD verificado (staging) | `python scripts/verify_e2e_isolation.py --auto` → 0 violaciones | ☐ |
| 6.4 | Mensaje real a Clínica A → respuesta lleva token de Clínica A | Verificar `phone_number_id` en outgoing Redis | ☐ |
| 6.5 | Mensaje real a Clínica B → respuesta lleva token de Clínica B | Mismo check | ☐ |
| 6.6 | Paciente registrado en Clínica A NO aparece en listado de Clínica B | `GET /api/v1/patients?clinic_id=<clinic_b_id>` no devuelve paciente de A | ☐ |
| 6.7 | Turno de Clínica A NO aparece en agenda de Clínica B | `GET /api/v1/appointments?clinic_id=<clinic_b_id>` no devuelve turno de A | ☐ |

---

## 7. Monitoreo y alertas

| # | Verificación | Configuración | Estado |
|---|---|---|---|
| 7.1 | Dead Letter Queue (DLQ) configurada en Redis | `whatsapp:incoming:dlq` existe, alertar si `LLEN > 10` | ☐ |
| 7.2 | Alerta de errores críticos configurada (Sentry / Telegram / email) | Ver `SENTRY_DSN` o webhook de alertas | ☐ |
| 7.3 | Dashboard de métricas básico (mensajes/min, tasa de error) | Grafana / CloudWatch / Uptime Kuma | ☐ |
| 7.4 | Rotación de logs configurada (no crecer indefinidamente) | `logrotate` o Docker logging driver con `max-size` | ☐ |
| 7.5 | Backup automático de DB configurado (diario mínimo) | Cronjob o servicio managed | ☐ |

---

## 8. Smoke test post-despliegue

Ejecutar **en orden** después de levantar producción:

```bash
# 1. Health checks
curl https://<host>/api/v1/health
curl https://<host>/gateway/health
curl https://<host>/brain/health

# 2. Verificación de webhook
curl -X GET "https://<host>/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test123"
# → debe responder: test123

# 3. Enviar mensaje de prueba real desde WhatsApp al número de Clínica A
# → Verificar en logs: gateway → brain → outgoing
docker logs -f sentinel-gateway --since 1m
docker logs -f sentinel-brain --since 1m

# 4. Auditoría inmediata de logs post-test
python scripts/audit_logs_sensitive.py --docker sentinel-api sentinel-brain sentinel-gateway

# 5. Aislamiento BD productivo
python scripts/verify_e2e_isolation.py --clinic-a <real_clinic_a_id> --clinic-b <real_clinic_b_id>
```

| # | Paso | Resultado esperado | Estado |
|---|---|---|---|
| 8.1 | Health checks todos responden 200 | `{"status": "ok"}` | ☐ |
| 8.2 | Webhook GET devuelve challenge | Challenge correcto | ☐ |
| 8.3 | Mensaje de prueba recibido y procesado | Log: `Intake message processed` | ☐ |
| 8.4 | Respuesta llegó al WhatsApp de prueba | Mensaje recibido en celular | ☐ |
| 8.5 | Auditoría de logs: 0 hallazgos críticos | `audit_logs_sensitive.py` exit 0 | ☐ |
| 8.6 | Aislamiento BD: 0 violaciones | `verify_e2e_isolation.py` exit 0 | ☐ |

---

## 9. Procedimiento de rollback

Si se detecta un problema crítico post-despliegue:

```bash
# 1. Revertir a imagen anterior
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --scale api=0 --scale brain=0 --scale gateway=0

# Editar docker-compose.prod.yml para apuntar a imagen anterior, luego:
docker compose -f docker-compose.prod.yml up -d

# 2. Revertir migración de BD si aplicó (solo si necesario y reversible)
alembic downgrade -1  # ← uno a uno, verificar cada paso

# 3. Restaurar backup si hubo corrupción de datos
psql $DATABASE_URL < backup_predeployment_<fecha>.sql
```

| # | Condición de rollback | Acción |
|---|---|---|
| R1 | Health check falla después de deploy | Rollback imagen + reiniciar |
| R2 | Tokens cruzados entre clínicas (CRÍTICO) | Stop inmediato + rollback + auditoria forense |
| R3 | Datos de pacientes de clínica A visibles en B | Stop inmediato + rollback + notificar DPO |
| R4 | Error 500 tasa > 5% en primeros 15 min | Rollback imagen |

---

## 10. Evidencia a registrar

Completar al finalizar el despliegue:

```
Fecha despliegue:        _______________
Responsable:             _______________
Versión imagen API:      _______________
Versión imagen Brain:    _______________
Versión imagen Gateway:  _______________
clinic_a_id prod:        _______________
clinic_b_id prod:        _______________
phone_number_id A:       _______________
phone_number_id B:       _______________
Alembic version head:    _______________
E2E tests (staging):     10/10 passed ☐
Auditoría logs:          0 críticos ☐
Aislamiento BD:          0 violaciones ☐
Smoke test Clínica A:    OK ☐
Smoke test Clínica B:    OK ☐
```

---

*Generado automáticamente — GSentinelHealthOS E2E Validation Suite*
