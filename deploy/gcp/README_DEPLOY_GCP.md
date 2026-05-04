# Deploy en Google Cloud - GSentinelHealthOS

Estos scripts automatizan el deploy en una VM de Google Cloud ya creada, usando `docker-compose.yml`.

## 1. Abrir firewall del Gateway

Ejecutar en Cloud Shell o en una máquina con `gcloud` autenticado contra el proyecto correcto:

```bash
cd ~/GSentinelHealthOS
bash deploy/gcp/open-firewall-8002.sh
```

Esto crea, si no existe, la regla:

```text
allow-gsentinel-gateway-8002
tcp:8002
source: 0.0.0.0/0
```

## 2. Preparar `.env`

El deploy no modifica `.env`. Solo valida que exista y que estas variables críticas estén presentes y no vacías:

```text
JWT_SECRET
GATEWAY_API_KEY
BRAIN_API_KEY
INTERNAL_SERVICES_KEY
WHATSAPP_VERIFY_TOKEN
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_APP_SECRET
```

## 3. Ejecutar deploy

En la VM:

```bash
cd ~/GSentinelHealthOS
bash deploy/gcp/deploy.sh
```

El script hace:

- `git pull --ff-only`
- valida `.env`
- valida `MetaBrain/nlu_engine.py`
- construye `api`, `brain` y `gateway`
- levanta Postgres, Redis, Sentinel, API, Brain, Gateway, workers y scheduler
- ejecuta `alembic upgrade head`
- prueba health local de API y Gateway

No borra volúmenes y no usa `docker-compose down -v`.

## 4. Verificar estado

En la VM:

```bash
cd ~/GSentinelHealthOS
bash deploy/gcp/check.sh
```

También se puede probar manualmente:

```bash
curl http://localhost:8000/api/health/readiness
curl http://localhost:8002/health
```

Desde navegador:

```text
http://34.39.235.83:8002/health
```

## 5. Configurar Meta WhatsApp

En Meta Developers, configurar:

```text
Callback URL: http://34.39.235.83:8002/webhook/whatsapp
Verify token: WABIZ_VERIFY_2026_GSENTINEL
```

## Nota de producción

Este setup deja funcional el webhook por IP pública y puerto `8002`. Para producción final conviene usar HTTPS con dominio, Nginx como reverse proxy y certificado SSL, por ejemplo:

```text
https://api.tudominio.com/webhook/whatsapp
```

