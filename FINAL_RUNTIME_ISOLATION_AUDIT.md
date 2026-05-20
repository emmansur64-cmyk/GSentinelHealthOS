# FINAL RUNTIME ISOLATION AUDIT
Generated: 2026-05-19 00:14:30 -03:00

## docker compose config (pre-change baseline)
```
time="2026-05-19T00:14:31-03:00" level=warning msg="The \"GRAFANA_ADMIN_PASSWORD\" variable is not set. Defaulting to a blank string."
name: gsentinelhealthos
services:
  api:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/api.Dockerfile
    cpus: 1
    container_name: gs_api
    depends_on:
      db:
        condition: service_healthy
        required: true
      migrate-api:
        condition: service_completed_successfully
        required: true
      redis-master:
        condition: service_healthy
        required: true
      redis-sentinel-1:
        condition: service_healthy
        required: true
    environment:
      BRAIN_API_KEY: BRAIN_KEY_REDACTED
      DATABASE_URL: postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel
      ENV: production
      GATEWAY_API_KEY: GATEWAY_KEY_REDACTED
      INTERNAL_SERVICES_KEY: INTERNAL_KEY_REDACTED
      JWT_AUDIENCE: gsentinel-clients
      JWT_ISSUER: gsentinel-api
      JWT_SECRET: REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      META_APP_ID: ""
      META_APP_SECRET: ""
      META_EMBEDDED_SIGNUP_CONFIGURATION_ID: ""
      META_GRAPH_API_VERSION: v21.0
      META_OAUTH_REDIRECT_URI: ""
      RATE_LIMIT_PER_MINUTE: "200"
      REDIS_CACHE_PREFIX: 'cache:'
      REDIS_QUEUE_PREFIX: 'queue:'
      REDIS_SENTINEL_MASTER: mymaster
      REDIS_SENTINEL_PASSWORD: REDACTED
      REDIS_SENTINELS: redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
      REDIS_STATE_PREFIX: 'state:'
      REDIS_URL: redis://:REDACTED@redis-master:6379
      SECRET_ENCRYPTION_KEY: REDACTED
      WHATSAPP_ACCESS_TOKEN: REDACTED
      WHATSAPP_API_VERSION: v25.0
      WHATSAPP_APP_SECRET: REDACTED
      WHATSAPP_BUSINESS_ACCOUNT_ID: "967835399226590"
      WHATSAPP_PHONE_NUMBER_ID: "1093032243892458"
      WHATSAPP_VERIFY_TOKEN: Em-10Taz812-Agus2026
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/liveness')" || exit 1
      timeout: 5s
      interval: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "805306368"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8000
        published: "8000"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: volume
        source: uploads_data
        target: /data/uploads
        volume: {}
  booking_worker_0:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/api.Dockerfile
    cpus: 0.75
    command:
      - python
      - -m
      - api.app.booking_queue_worker_main
    container_name: gs_booking_worker_0
    depends_on:
      db:
        condition: service_healthy
        required: true
      redis-master:
        condition: service_healthy
        required: true
      redis-sentinel-1:
        condition: service_healthy
        required: true
    environment:
      BOOKING_QUEUE_LOCK_TTL_MS: "15000"
      BOOKING_QUEUE_RESULT_TTL_SECONDS: "86400"
      BOOKING_QUEUE_SHARDS: "2"
      BOOKING_WORKER_SHARD: "0"
      BRAIN_API_KEY: BRAIN_KEY_REDACTED
      DATABASE_URL: postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel
      ENV: production
      GATEWAY_API_KEY: GATEWAY_KEY_REDACTED
      JWT_SECRET: REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      REDIS_CACHE_PREFIX: 'cache:'
      REDIS_QUEUE_PREFIX: 'queue:'
      REDIS_SENTINEL_MASTER: mymaster
      REDIS_SENTINEL_PASSWORD: REDACTED
      REDIS_SENTINELS: redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
      REDIS_STATE_PREFIX: 'state:'
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import socket; socket.create_connection(('db', 5432), 2).close(); socket.create_connection(('redis-master', 6379), 2).close()"
      timeout: 10s
      interval: 30s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
  booking_worker_1:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/api.Dockerfile
    cpus: 0.75
    command:
      - python
      - -m
      - api.app.booking_queue_worker_main
    container_name: gs_booking_worker_1
    depends_on:
      db:
        condition: service_healthy
        required: true
      redis-master:
        condition: service_healthy
        required: true
      redis-sentinel-1:
        condition: service_healthy
        required: true
    environment:
      BOOKING_QUEUE_LOCK_TTL_MS: "15000"
      BOOKING_QUEUE_RESULT_TTL_SECONDS: "86400"
      BOOKING_QUEUE_SHARDS: "2"
      BOOKING_WORKER_SHARD: "1"
      BRAIN_API_KEY: BRAIN_KEY_REDACTED
      DATABASE_URL: postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel
      ENV: production
      GATEWAY_API_KEY: GATEWAY_KEY_REDACTED
      JWT_SECRET: REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      REDIS_CACHE_PREFIX: 'cache:'
      REDIS_QUEUE_PREFIX: 'queue:'
      REDIS_SENTINEL_MASTER: mymaster
      REDIS_SENTINEL_PASSWORD: REDACTED
      REDIS_SENTINELS: redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
      REDIS_STATE_PREFIX: 'state:'
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import socket; socket.create_connection(('db', 5432), 2).close(); socket.create_connection(('redis-master', 6379), 2).close()"
      timeout: 10s
      interval: 30s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
  brain:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/brain.Dockerfile
    cpus: 1.5
    container_name: gs_brain
    depends_on:
      api:
        condition: service_healthy
        required: true
      db:
        condition: service_healthy
        required: true
      redis-master:
        condition: service_healthy
        required: true
      redis-sentinel-1:
        condition: service_healthy
        required: true
    environment:
      API_BASE_URL: http://api:8000
      BRAIN_ALLOWED_ORIGINS: http://localhost:3000,http://frontend:3000
      BRAIN_API_KEY: BRAIN_KEY_REDACTED
      BRAIN_HOST: 0.0.0.0
      BRAIN_MODE: http
      BRAIN_PORT: "8001"
      BRAIN_STATE_TTL_SECONDS: "86400"
      DATABASE_URL: postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel
      DECISION_SERVICE_URL: http://decision-service:8012
      DIALOGUE_ENGINE_URL: http://dialogue-engine:8010
      ENABLE_BRAIN_REDIS_WORKER: "true"
      ENV: production
      INFERENCE_SERVICE_URL: http://inference-service:8011
      INTERNAL_SERVICES_KEY: INTERNAL_KEY_REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      MEDICAL_CHAT_LEARNING_PATH: /app/artifacts/mb-chat-learning/medical-chat-learning.jsonl
      NLG_SERVICE_URL: http://nlg-service:8013
      REDIS_CACHE_PREFIX: 'cache:'
      REDIS_QUEUE_PREFIX: 'queue:'
      REDIS_SENTINEL_MASTER: mymaster
      REDIS_SENTINEL_PASSWORD: REDACTED
      REDIS_SENTINELS: redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
      REDIS_STATE_PREFIX: 'state:'
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1
      timeout: 5s
      interval: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "1073741824"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8001
        published: "8001"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: volume
        source: uploads_data
        target: /data/uploads
        volume: {}
      - type: bind
        source: E:\GSentinelHealthOS\MB-Chat\data
        target: /app/artifacts/mb-chat-learning
        bind: {}
  db:
    cpus: 1
    command:
      - postgres
      - -c
      - max_connections=50
      - -c
      - shared_buffers=128MB
    container_name: gs_db
    environment:
      POSTGRES_DB: gsentinel
      POSTGRES_PASSWORD: REDACTED
      POSTGRES_USER: sentinel
    healthcheck:
      test:
        - CMD-SHELL
        - pg_isready -U sentinel -d gsentinel
      timeout: 5s
      interval: 10s
      retries: 5
    image: postgres:16-alpine
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "1073741824"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 5432
        published: "55433"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: volume
        source: postgres_data
        target: /var/lib/postgresql/data
        volume: {}
      - type: bind
        source: E:\GSentinelHealthOS\database\init-multiple-dbs.sql
        target: /docker-entrypoINTERNAL_KEY_REDACTED.d/init.sql
        read_only: true
        bind: {}
  decision-service:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/decision-service.Dockerfile
    cpus: 0.75
    container_name: gs_decision_service
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
    environment:
      ENV: production
      INTERNAL_SERVICES_KEY: INTERNAL_KEY_REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import urllib.request; urllib.request.urlopen('http://localhost:8012/health')" || exit 1
      timeout: 10s
      interval: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8012
        published: "8012"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
  dialogue-engine:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/dialogue-engine.Dockerfile
    cpus: 0.75
    container_name: gs_dialogue_engine
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
    environment:
      ENV: production
      INTERNAL_SERVICES_KEY: INTERNAL_KEY_REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import urllib.request; urllib.request.urlopen('http://localhost:8010/health')" || exit 1
      timeout: 10s
      interval: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8010
        published: "8010"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
  frontend:
    build:
      context: E:\GSentinelHealthOS\medical-agenda-saas
      dockerfile: Dockerfile
    cpus: 1
    container_name: gs_frontend
    depends_on:
      brain:
        condition: service_healthy
        required: true
      db:
        condition: service_healthy
        required: true
      migrate-frontend:
        condition: service_completed_successfully
        required: true
      redis-master:
        condition: service_healthy
        required: true
    environment:
      BRAIN_API_KEY: INTERNAL_KEY_REDACTED
      BRAIN_API_URL: http://brain:8001
      BRAIN_TIMEOUT_MS: "5000"
      DATABASE_URL: postgresql://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel_saas
      DOCUMENT_AI_API_KEY: GROQ_KEY_REDACTED
      DOCUMENT_AI_BASE_URL: https://api.groq.com/openai/v1
      DOCUMENT_AI_ENABLED: "false"
      DOCUMENT_AI_PROVIDER: groq
      ENCRYPTION_KEY: Rd0JhO5AyXmMD89fPSNt6zjKxiF1cbo2
      ENV: production
      GROQ_API_KEY: GROQ_KEY_REDACTED
      GROQ_API_KEY_CHAT: GROQ_KEY_REDACTED
      GROQ_API_KEY_SECRETARIA: GROQ_KEY_REDACTED
      GROQ_BASE_URL: https://api.groq.com/openai/v1
      GROQ_IMAGE_ANALYSIS_API_KEY: GROQ_KEY_REDACTED
      GROQ_MODEL: llama-3.3-70b-versatile
      GROQ_MODEL_CHAT: meta-llama/llama-4-scout-17b-16e-instruct
      GROQ_MODEL_SECRETARIA: meta-llama/llama-4-scout-17b-16e-instruct
      JWT_EXPIRES_IN_HOURS: "24"
      JWT_SECRET: REDACTED
      MEDICAL_CHAT_INTERNET_MODE: open
      MEDICAL_CHAT_LEARNING_PATH: /app/artifacts/mb-chat-learning/medical-chat-learning.jsonl
      MEDICAL_RUNTIME_CONTEXT_ALERTS_ENABLED: "false"
      MEDICAL_RUNTIME_CONTEXT_CACHE_TTL_SECONDS: "900"
      MEDICAL_RUNTIME_CONTEXT_ENABLED: "true"
      MEDICAL_RUNTIME_CONTEXT_LATITUDE: ""
      MEDICAL_RUNTIME_CONTEXT_LONGITUDE: ""
      MEDICAL_RUNTIME_CONTEXT_REGION: ""
      MEDICAL_RUNTIME_CONTEXT_TIMEOUT_MS: "5000"
      MEDICAL_RUNTIME_CONTEXT_TIMEZONE: America/Argentina/Buenos_Aires
      MEDICAL_RUNTIME_CONTEXT_WEATHER_ENABLED: "true"
      MEDICAL_WEB_RETRIEVAL_ENABLED: "true"
      NEXT_TELEMETRY_DISABLED: "1"
      NODE_ENV: production
      PANEL_ADMIN_API_KEY: PANEL_ADMIN_KEY_REDACTED
      REDIS_URL: redis://:REDACTED@redis-master:6379
      WHATSAPP_API_VERSION: v25.0
      WHATSAPP_AUTO_BOOT_WORKERS: "false"
    healthcheck:
      test:
        - CMD-SHELL
        - node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      timeout: 10s
      interval: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 3000
        published: "3000"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: bind
        source: E:\GSentinelHealthOS\MB-Chat\data
        target: /app/artifacts/mb-chat-learning
        bind: {}
  gateway:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/gateway.Dockerfile
    cpus: 0.75
    container_name: gs_gateway
    depends_on:
      api:
        condition: service_healthy
        required: true
      redis-master:
        condition: service_healthy
        required: true
    environment:
      DATABASE_URL: postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel
      ENABLE_WHATSAPP_GATEWAY: "true"
      ENV: production
      GATEWAY_HOST: 0.0.0.0
      GATEWAY_PORT: "8002"
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      REDIS_SENTINEL_MASTER: ""
      REDIS_SENTINELS: ""
      REDIS_URL: redis://:REDACTED@redis-master:6379
      SECRET_ENCRYPTION_KEY: REDACTED
      WHATSAPP_ACCESS_TOKEN: REDACTED
      WHATSAPP_API_VERSION: v25.0
      WHATSAPP_APP_SECRET: REDACTED
      WHATSAPP_BUSINESS_ACCOUNT_ID: "967835399226590"
      WHATSAPP_PHONE_NUMBER_ID: "1093032243892458"
      WHATSAPP_VERIFY_TOKEN: Em-10Taz812-Agus2026
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1
      timeout: 10s
      interval: 30s
      retries: 3
      start_period: 5s
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8002
        published: "8002"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: volume
        source: uploads_data
        target: /data/uploads
        volume: {}
  inference-service:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/inference-service.Dockerfile
    cpus: 0.75
    container_name: gs_inference_service
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
    environment:
      ENV: production
      INTERNAL_SERVICES_KEY: INTERNAL_KEY_REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import urllib.request; urllib.request.urlopen('http://localhost:8011/health')" || exit 1
      timeout: 10s
      interval: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8011
        published: "8011"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
  migrate-api:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/api.Dockerfile
    command:
      - sh
      - -c
      - sleep 5 && alembic upgrade heads
    container_name: gs_migrate_api
    depends_on:
      db:
        condition: service_healthy
        required: true
    environment:
      DATABASE_URL: postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel
      SECRET_ENCRYPTION_KEY: REDACTED
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    networks:
      gs_prod: null
    restart: "no"
  migrate-frontend:
    build:
      context: E:\GSentinelHealthOS\medical-agenda-saas
      dockerfile: Dockerfile
      target: bootstrap
    command:
      - npx
      - prisma
      - migrate
      - deploy
      - --schema
      - prisma/schema.prisma
    container_name: gs_migrate_frontend
    depends_on:
      db:
        condition: service_healthy
        required: true
    environment:
      DATABASE_URL: postgresql://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel_saas
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    networks:
      gs_prod: null
    restart: "no"
  nlg-service:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/nlg-service.Dockerfile
    cpus: 0.75
    container_name: gs_nlg_service
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
    environment:
      ENV: production
      INTERNAL_SERVICES_KEY: INTERNAL_KEY_REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import urllib.request; urllib.request.urlopen('http://localhost:8013/health')" || exit 1
      timeout: 10s
      interval: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8013
        published: "8013"
        protocol: tcp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
  outbox_scheduler:
    build:
      context: E:\GSentinelHealthOS
      dockerfile: docker/api.Dockerfile
    cpus: 0.75
    command:
      - python
      - scripts/run_outbox_scheduler.py
    container_name: gs_outbox_scheduler
    depends_on:
      db:
        condition: service_healthy
        required: true
      redis-master:
        condition: service_healthy
        required: true
      redis-sentinel-1:
        condition: service_healthy
        required: true
    environment:
      BRAIN_API_KEY: BRAIN_KEY_REDACTED
      DATABASE_URL: postgresql+psycopg://sentinel:OzMTDZYpxmFNivfGStWo0kB6Xb85Uweh@db:5432/gsentinel
      ENV: production
      GATEWAY_API_KEY: GATEWAY_KEY_REDACTED
      GOOGLE_CALENDAR_AUTH_MODE: service_account
      GOOGLE_CALENDAR_ENABLED: "false"
      GOOGLE_CALENDAR_ID: primary
      GOOGLE_CALENDAR_TIMEZONE: America/Argentina/Buenos_Aires
      GOOGLE_CALENDAR_WATCH_TTL_SECONDS: "86400"
      GOOGLE_CALENDAR_WEBHOOK_CALLBACK_URL: ""
      GOOGLE_CALENDAR_WEBHOOK_TOKEN: ""
      GOOGLE_OAUTH_CLIENT_SECRET_FILE: ""
      GOOGLE_OAUTH_TOKEN_FILE: ""
      GOOGLE_SERVICE_ACCOUNT_FILE: ""
      GOOGLE_SERVICE_ACCOUNT_JSON: ""
      GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: ""
      JWT_SECRET: REDACTED
      LOG_FORMAT: json
      LOG_LEVEL: INFO
      OUTBOX_PROCESS_LIMIT: "200"
      OUTBOX_SCHEDULER_INTERVAL_SECONDS: "15"
      REDIS_CACHE_PREFIX: 'cache:'
      REDIS_QUEUE_PREFIX: 'queue:'
      REDIS_SENTINEL_MASTER: mymaster
      REDIS_SENTINEL_PASSWORD: REDACTED
      REDIS_SENTINELS: redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
      REDIS_STATE_PREFIX: 'state:'
      REDIS_URL: redis://:REDACTED@redis-master:6379
    healthcheck:
      test:
        - CMD-SHELL
        - python -c "import socket; socket.create_connection(('db', 5432), 2).close(); socket.create_connection(('redis-master', 6379), 2).close()"
      timeout: 10s
      interval: 30s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: bind
        source: E:\GSentinelHealthOS\scripts
        target: /app/scripts
        read_only: true
        bind: {}
  redis-master:
    cpus: 0.75
    command:
      - sh
      - -c
      - redis-server /usr/local/etc/redis/redis.conf --requirepass "bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy"
    container_name: gs_redis_master
    environment:
      REDIS_PASSWORD: bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy
    healthcheck:
      test:
        - CMD
        - sh
        - -c
        - redis-cli -h localhost -p 6379 -a "$$REDIS_PASSWORD" ping
      timeout: 3s
      interval: 10s
      retries: 5
    image: redis:8.0.2-alpine
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "805306368"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: volume
        source: redis_master_data
        target: /data
        volume: {}
      - type: bind
        source: E:\GSentinelHealthOS\broker\redis.conf
        target: /usr/local/etc/redis/redis.conf
        read_only: true
        bind: {}
  redis-replica:
    cpus: 0.5
    command:
      - sh
      - -c
      - redis-server /usr/local/etc/redis/redis.conf --replicaof redis-master 6379 --masterauth "bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy" --requirepass "bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy"
    container_name: gs_redis_replica
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
    environment:
      REDIS_PASSWORD: bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy
    healthcheck:
      test:
        - CMD
        - sh
        - -c
        - redis-cli -h localhost -p 6379 -a "$$REDIS_PASSWORD" ping
      timeout: 3s
      interval: 10s
      retries: 5
    image: redis:8.0.2-alpine
    logging:
      driver: json-file
      options:
        max-file: "3"
        max-size: 10m
    mem_limit: "536870912"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: volume
        source: redis_replica_data
        target: /data
        volume: {}
      - type: bind
        source: E:\GSentinelHealthOS\broker\redis.conf
        target: /usr/local/etc/redis/redis.conf
        read_only: true
        bind: {}
  redis-sentinel-1:
    cpus: 0.25
    command:
      - sh
      - -c
      - |-
        cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf && printf '
        sentinel auth-pass mymaster %s
        ' "$$REDIS_PASSWORD" >> /tmp/sentinel.conf && redis-server /tmp/sentinel.conf --sentinel
    container_name: gs_redis_sentinel_1
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
      redis-replica:
        condition: service_healthy
        required: true
    environment:
      REDIS_PASSWORD: bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy
    healthcheck:
      test:
        - CMD
        - sh
        - -c
        - redis-cli -h localhost -p 26379 -a "$$REDIS_PASSWORD" ping
      timeout: 3s
      interval: 10s
      retries: 5
    image: redis:8.0.2-alpine
    logging:
      driver: json-file
      options:
        max-file: "2"
        max-size: 5m
    mem_limit: "134217728"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: bind
        source: E:\GSentinelHealthOS\broker\sentinel.conf
        target: /usr/local/etc/redis/sentinel.conf
        read_only: true
        bind: {}
  redis-sentinel-2:
    cpus: 0.25
    command:
      - sh
      - -c
      - |-
        cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf && printf '
        sentinel auth-pass mymaster %s
        ' "$$REDIS_PASSWORD" >> /tmp/sentinel.conf && redis-server /tmp/sentinel.conf --sentinel
    container_name: gs_redis_sentinel_2
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
      redis-replica:
        condition: service_healthy
        required: true
    environment:
      REDIS_PASSWORD: bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy
    healthcheck:
      test:
        - CMD
        - sh
        - -c
        - redis-cli -h localhost -p 26379 -a "$$REDIS_PASSWORD" ping
      timeout: 3s
      interval: 10s
      retries: 5
    image: redis:8.0.2-alpine
    logging:
      driver: json-file
      options:
        max-file: "2"
        max-size: 5m
    mem_limit: "134217728"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: bind
        source: E:\GSentinelHealthOS\broker\sentinel.conf
        target: /usr/local/etc/redis/sentinel.conf
        read_only: true
        bind: {}
  redis-sentinel-3:
    cpus: 0.25
    command:
      - sh
      - -c
      - |-
        cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf && printf '
        sentinel auth-pass mymaster %s
        ' "$$REDIS_PASSWORD" >> /tmp/sentinel.conf && redis-server /tmp/sentinel.conf --sentinel
    container_name: gs_redis_sentinel_3
    depends_on:
      redis-master:
        condition: service_healthy
        required: true
      redis-replica:
        condition: service_healthy
        required: true
    environment:
      REDIS_PASSWORD: bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy
    healthcheck:
      test:
        - CMD
        - sh
        - -c
        - redis-cli -h localhost -p 26379 -a "$$REDIS_PASSWORD" ping
      timeout: 3s
      interval: 10s
      retries: 5
    image: redis:8.0.2-alpine
    logging:
      driver: json-file
      options:
        max-file: "2"
        max-size: 5m
    mem_limit: "134217728"
    networks:
      gs_prod: null
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - type: bind
        source: E:\GSentinelHealthOS\broker\sentinel.conf
        target: /usr/local/etc/redis/sentinel.conf
        read_only: true
        bind: {}
networks:
  gs_prod:
    name: gsentinelhealthos_gs_prod
    driver: bridge
volumes:
  postgres_data:
    name: gsentinelhealthos_postgres_data
  redis_master_data:
    name: gsentinelhealthos_redis_master_data
  redis_replica_data:
    name: gsentinelhealthos_redis_replica_data
  uploads_data:
    name: gsentinelhealthos_uploads_data

```
## docker compose ps (pre-change baseline)
```
time="2026-05-19T00:14:31-03:00" level=warning msg="The \"GRAFANA_ADMIN_PASSWORD\" variable is not set. Defaulting to a blank string."
NAME                            IMAGE                                 COMMAND                  SERVICE               CREATED        STATUS                 PORTS
gs_api                          gsentinelhealthos-api                 "uvicorn api.app.mai…"   api                   30 hours ago   Up 5 hours (healthy)   127.0.0.1:8000->8000/tcp
gs_booking_worker_0             gsentinelhealthos-booking_worker_0    "python -m api.app.b…"   booking_worker_0      2 days ago     Up 5 hours (healthy)   
gs_booking_worker_1             gsentinelhealthos-booking_worker_1    "python -m api.app.b…"   booking_worker_1      2 days ago     Up 5 hours (healthy)   
gs_brain                        gsentinelhealthos-brain               "python brain/main.py"   brain                 30 hours ago   Up 5 hours (healthy)   8001/tcp
gs_db                           postgres:16-alpine                    "docker-entrypoint.s…"   db                    30 hours ago   Up 5 hours (healthy)   127.0.0.1:55433->5432/tcp
gs_decision_service             gsentinelhealthos-decision-service    "uvicorn services.de…"   decision-service      2 days ago     Up 5 hours (healthy)   8012/tcp
gs_dialogue_engine              gsentinelhealthos-dialogue-engine     "uvicorn services.di…"   dialogue-engine       2 days ago     Up 5 hours (healthy)   8010/tcp
gs_frontend                     gsentinelhealthos-frontend            "docker-entrypoint.s…"   frontend              29 hours ago   Up 5 hours (healthy)   3000/tcp
gs_gateway                      gsentinelhealthos-gateway             "uvicorn whatsapp_ga…"   gateway               2 days ago     Up 5 hours (healthy)   8002/tcp
gs_grafana                      grafana/grafana:10.4.2                "/run.sh"                grafana               2 days ago     Up 5 hours (healthy)   3000/tcp
gs_inference_service            gsentinelhealthos-inference-service   "uvicorn services.in…"   inference-service     2 days ago     Up 5 hours (healthy)   8011/tcp
gs_loki                         grafana/loki:2.9.8                    "/usr/bin/loki -conf…"   loki                  2 days ago     Up 5 hours (healthy)   3100/tcp
gs_nlg_service                  gsentinelhealthos-nlg-service         "uvicorn services.nl…"   nlg-service           2 days ago     Up 5 hours (healthy)   8013/tcp
gs_outbox_scheduler             gsentinelhealthos-outbox_scheduler    "python scripts/run_…"   outbox_scheduler      2 days ago     Up 5 hours (healthy)   
gs_panel_admin                  gsentinelhealthos-panel-admin         "docker-entrypoint.s…"   panel-admin           33 hours ago   Up 5 hours (healthy)   3010/tcp
gs_prometheus                   prom/prometheus:v2.51.0               "/bin/prometheus --c…"   prometheus            2 days ago     Up 5 hours (healthy)   9090/tcp
gs_promtail                     grafana/promtail:2.9.8                "/usr/bin/promtail -…"   promtail              2 days ago     Up 5 hours             
gs_redis_master                 redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-master          30 hours ago   Up 5 hours (healthy)   6379/tcp
gs_redis_replica                redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-replica         30 hours ago   Up 5 hours (healthy)   6379/tcp
gs_redis_sentinel_1             redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-sentinel-1      30 hours ago   Up 5 hours (healthy)   6379/tcp
gs_redis_sentinel_2             redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-sentinel-2      2 days ago     Up 5 hours (healthy)   6379/tcp
gs_redis_sentinel_3             redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-sentinel-3      2 days ago     Up 5 hours (healthy)   6379/tcp
gsentinel_redis_precanary_lab   redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis_precanary_lab   2 hours ago    Up 2 hours (healthy)   127.0.0.1:56380->6379/tcp

```
## docker ps health/status baseline
```
gsentinel_redis_precanary_lab|Up 2 hours (healthy)|127.0.0.1:56380->6379/tcp
gs_frontend|Up 5 hours (healthy)|3000/tcp
gs_brain|Up 5 hours (healthy)|8001/tcp
gs_api|Up 5 hours (healthy)|127.0.0.1:8000->8000/tcp
gs_redis_sentinel_1|Up 5 hours (healthy)|6379/tcp
gs_redis_replica|Up 5 hours (healthy)|6379/tcp
gs_db|Up 5 hours (healthy)|127.0.0.1:55433->5432/tcp
gs_redis_master|Up 5 hours (healthy)|6379/tcp
gs_panel_admin|Up 5 hours (healthy)|3010/tcp
gs_grafana|Up 5 hours (healthy)|3000/tcp
gs_promtail|Up 5 hours|
gs_outbox_scheduler|Up 5 hours (healthy)|
gs_gateway|Up 5 hours (healthy)|8002/tcp
gs_loki|Up 5 hours (healthy)|3100/tcp
gs_nlg_service|Up 5 hours (healthy)|8013/tcp
gs_prometheus|Up 5 hours (healthy)|9090/tcp
gs_dialogue_engine|Up 5 hours (healthy)|8010/tcp
gs_booking_worker_1|Up 5 hours (healthy)|
gs_inference_service|Up 5 hours (healthy)|8011/tcp
gs_decision_service|Up 5 hours (healthy)|8012/tcp
gs_booking_worker_0|Up 5 hours (healthy)|
gs_redis_sentinel_2|Up 5 hours (healthy)|6379/tcp
gs_redis_sentinel_3|Up 5 hours (healthy)|6379/tcp

```
## Functional invariants
```
No compose mutation applied in this run.
No clinical logic touched.
No ports changed.
No routing/contracts edited.

```
