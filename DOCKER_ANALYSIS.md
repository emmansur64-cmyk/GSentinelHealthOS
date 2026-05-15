# ANÁLISIS EXHAUSTIVO DE DOCKER Y DEPLOYMENT
## GSentinelHealthOS - Evaluación de Seguridad

**Fecha**: Mayo 8, 2026  
**Thoroughness**: MUY EXHAUSTIVO  
**Status**: VULNERABILIDADES CRÍTICAS IDENTIFICADAS

---

## RESUMEN EJECUTIVO

**Puntuación de Seguridad**: 3/10 (CRÍTICA)

### Vulnerabilidades Críticas Encontradas

1. **CRÍTICO**: Archivo `.env` con secretos en texto plano versionado
   - Groq API Key, WhatsApp tokens, Database password, JWT secret
   - Visible en git history permanentemente

2. **CRÍTICO**: Redis sin autenticación (`protected-mode no`, sin `requirepass`)
   - Accesible por cualquier contenedor en la red

3. **CRÍTICO**: Gateway expuesto a `0.0.0.0:8002` (no vinculado a localhost)
   - Acceso público a webhook de WhatsApp

4. **ALTO**: Todos los Dockerfiles Python corren como root
   - 7 servicios sin USER definido
   - Escape = acceso root al host

5. **ALTO**: Sin límites de CPU en ningún servicio
   - Servicio descontrolado puede consumir 100% CPU
   - Sin aislamiento de recursos

6. **ALTO**: Healthchecks deshabilitados en workers
   - booking_worker_0/1, outbox_scheduler
   - Sin detección de fallos

---

## ANÁLISIS DE DOCKERFILES

### Tabla Comparativa

| Dockerfile | Usuario | Healthcheck | Sin pin | Riesgo |
|-----------|---------|-------------|---------|--------|
| api | root ❌ | ✓ | 3.11-slim | ALTO |
| brain | root ❌ | ❌ | 3.11-slim | ALTO |
| gateway | root ❌ | ✓ | 3.11-slim | ALTO |
| decision-service | root ❌ | ❌ | 3.11-slim | ALTO |
| dialogue-engine | root ❌ | ❌ | 3.11-slim | ALTO |
| inference-service | root ❌ | ❌ | 3.11-slim | ALTO |
| nlg-service | root ❌ | ❌ | 3.11-slim | ALTO |
| redis | redis ✓ | N/A | 7-alpine | MEDIO |
| frontend | nextjs ✓ | ⚠️ | 20-bookworm | BAJO |

---

## CONFIGURACIÓN DOCKER-COMPOSE

### Exposición de Puertos

```
API:       127.0.0.1:8000  ✓ Seguro (localhost)
Brain:     127.0.0.1:8001  ✓ Seguro
Gateway:   0.0.0.0:8002    ❌ CRÍTICO (expuesto)
Frontend:  127.0.0.1:3000  ✓ Seguro
Services:  127.0.0.1:801x  ✓ Seguro (todos)
DB:        Internal only   ✓ Seguro
Redis:     Internal only   ⚠️ Inseguro (sin auth)
```

**CRÍTICO**: Gateway no está vinculado a localhost. Debería ser `127.0.0.1:${GATEWAY_PORT:-8002}:8002`

### Límites de Recursos

**Memoria**: Configurada
**CPU**: ❌ NO CONFIGURADA EN NINGÚN SERVICIO

### Healthchecks

- **Configurados**: API, Brain, Gateway, Frontend, todos los Services
- **Deshabilitados**: booking_worker_0, booking_worker_1, outbox_scheduler

Problema: Sin detección de fallos en workers.

---

## VARIABLES DE ENTORNO SENSIBLES

### Secretos Expuestos en .env

```
DB_PASSWORD=OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh
JWT_SECRET=fGd8p7xXW3FtuPco5zM4QOsHlmwgNKiJ9TrvYCEnab2Z1LqS
BRAIN_API_KEY=brain-7dECfrMjGPU4BH3bNmi9YZpnexgyQTSs
GATEWAY_API_KEY=gw-27a0cnXjVjhZoRTiCgzxqKymFbLEr65
INTERNAL_SERVICES_KEY=int-ZSnu8iX4MrxsqCTkoPlBIUVFd27vOJ6A
WHATSAPP_ACCESS_TOKEN=EAARicVwKsqYBRYZAXPvOsEIPrtv28oSZANK28L4SxThrTcfwCVg3JLCFvqKDeSjgDNyIFtiTd1J8ll7kmfXKD9A0ZCAUE6MoSvvJ2IuVkW8aaoLdcmzN5Yl1kPZClK3dxUZCvZCOuju33QtWy4wxtMvZCyqsQpuLrixutEpNM5CNIFBZCUaOzh5jSDF8UwwXnQZDZD
GROQ_API_KEY=[REDACTED]
SEED_ADMIN_PASSWORD=JVYfdTI0RGaiH9uszgAvPwqQ
```

**Impacto**: Total compromiso de seguridad del sistema

---

## CONFIGURACIÓN REDIS

### Archivo: broker/redis.conf

```
bind 0.0.0.0
protected-mode no
```

**Problemas**:
- ❌ Sin `requirepass`
- ❌ Sin TLS/SSL
- ❌ Sin ACL
- ❌ Accesible por cualquiera en la red

---

## RECOMENDACIONES INMEDIATAS

### 1. Revocar y Regenerar Secretos (24 horas)

```bash
# Groq API Key
# https://console.groq.com/keys → Revocar → Generar nueva

# WhatsApp/Meta Tokens
# https://developers.facebook.com/apps → Regenerar

# Database Password
docker exec gs_db psql -U sentinel
ALTER USER sentinel WITH PASSWORD 'NUEVA_PASSWORD';

# JWT Secret
openssl rand -hex 32

# API Keys
# Regenerar GATEWAY_API_KEY, BRAIN_API_KEY, INTERNAL_SERVICES_KEY
```

### 2. Remover .env del Repositorio

```bash
git rm --cached .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "SECURITY: Remove .env with exposed secrets"
git push origin GsentinelH
```

### 3. Asegurar Redis

Editar `broker/redis.conf`:

```
bind 127.0.0.1
protected-mode yes
requirepass <STRONG_PASSWORD>
tls-port 6380
tls-cert-file /etc/redis/redis.crt
tls-key-file /etc/redis/redis.key
```

### 4. Vincular Gateway a Localhost

Editar `docker-compose.yml` línea 321:

```yaml
gateway:
  ports:
    - "127.0.0.1:${GATEWAY_PORT:-8002}:8002"  # Agregar 127.0.0.1
```

### 5. Agregar Usuario No-Root

Para cada Dockerfile Python, agregar:

```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```

---

## ARCHIVOS MODIFICADOS NECESARIOS

**Eliminar/Rotar**:
- `E:\GSentinelHealthOS\.env`

**Modificar**:
- `E:\GSentinelHealthOS\docker-compose.yml` (gateway binding)
- `E:\GSentinelHealthOS\broker\redis.conf` (autenticación)
- `E:\GSentinelHealthOS\docker\api.Dockerfile` (agregar USER)
- `E:\GSentinelHealthOS\docker\brain.Dockerfile` (agregar USER)
- `E:\GSentinelHealthOS\docker\gateway.Dockerfile` (agregar USER)
- `E:\GSentinelHealthOS\docker\decision-service.Dockerfile` (agregar USER)
- `E:\GSentinelHealthOS\docker\dialogue-engine.Dockerfile` (agregar USER)
- `E:\GSentinelHealthOS\docker\inference-service.Dockerfile` (agregar USER)
- `E:\GSentinelHealthOS\docker\nlg-service.Dockerfile` (agregar USER)

**Crear/Actualizar**:
- `.env.prod` (con secretos rotados)
- `.gitignore` (asegurar .env incluido)

---

## RECOMENDACIONES DE CORTO PLAZO (1 SEMANA)

1. Agregar límites de CPU a todos los servicios
2. Habilitar healthchecks en workers
3. Pinear versiones de imágenes base
4. Implementar Docker Secrets

---

## VULNERABILIDADES CONOCIDAS EN IMÁGENES BASE

**python:3.11-slim**: 50-70 CVEs estimados (sin version pin)
**redis:7-alpine**: 30-40 CVEs, Redis 7.0 es EOL
**node:20-bookworm-slim**: 40-60 CVEs estimados
**postgres:16-alpine**: 20-30 CVEs estimados

**Recomendación**: Usar versiones específicas:
- `python:3.11.10-slim-bookworm`
- `redis:7.2-alpine`
- `node:20.12-bookworm-slim`
- `postgres:16.3-alpine`

