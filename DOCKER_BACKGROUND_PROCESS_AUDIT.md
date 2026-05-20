# DOCKER BACKGROUND PROCESS AUDIT

Generated: 2026-05-18 23:56:57 -03:00

## docker ps --format ...
```
NAMES                           IMAGE                                 COMMAND                  STATUS                       PORTS
gsentinel_redis_precanary_lab   redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up About an hour (healthy)   127.0.0.1:56380->6379/tcp
gs_frontend                     gsentinelhealthos-frontend            "docker-entrypoint.s…"   Up 5 hours (healthy)         3000/tcp
gs_brain                        gsentinelhealthos-brain               "python brain/main.py"   Up 5 hours (healthy)         8001/tcp
gs_api                          gsentinelhealthos-api                 "uvicorn api.app.mai…"   Up 5 hours (healthy)         127.0.0.1:8000->8000/tcp
gs_redis_sentinel_1             redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)         6379/tcp
gs_redis_replica                redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)         6379/tcp
gs_db                           postgres:16-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)         127.0.0.1:55433->5432/tcp
gs_redis_master                 redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)         6379/tcp
gs_panel_admin                  gsentinelhealthos-panel-admin         "docker-entrypoint.s…"   Up 5 hours (healthy)         3010/tcp
gs_grafana                      grafana/grafana:10.4.2                "/run.sh"                Up 5 hours (healthy)         3000/tcp
gs_promtail                     grafana/promtail:2.9.8                "/usr/bin/promtail -…"   Up 5 hours                   
gs_outbox_scheduler             gsentinelhealthos-outbox_scheduler    "python scripts/run_…"   Up 5 hours (healthy)         
gs_gateway                      gsentinelhealthos-gateway             "uvicorn whatsapp_ga…"   Up 5 hours (healthy)         8002/tcp
gs_loki                         grafana/loki:2.9.8                    "/usr/bin/loki -conf…"   Up 5 hours (healthy)         3100/tcp
gs_nlg_service                  gsentinelhealthos-nlg-service         "uvicorn services.nl…"   Up 5 hours (healthy)         8013/tcp
gs_prometheus                   prom/prometheus:v2.51.0               "/bin/prometheus --c…"   Up 5 hours (healthy)         9090/tcp
gs_dialogue_engine              gsentinelhealthos-dialogue-engine     "uvicorn services.di…"   Up 5 hours (healthy)         8010/tcp
gs_booking_worker_1             gsentinelhealthos-booking_worker_1    "python -m api.app.b…"   Up 5 hours (healthy)         
gs_inference_service            gsentinelhealthos-inference-service   "uvicorn services.in…"   Up 5 hours (healthy)         8011/tcp
gs_decision_service             gsentinelhealthos-decision-service    "uvicorn services.de…"   Up 5 hours (healthy)         8012/tcp
gs_booking_worker_0             gsentinelhealthos-booking_worker_0    "python -m api.app.b…"   Up 5 hours (healthy)         
gs_redis_sentinel_2             redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)         6379/tcp
gs_redis_sentinel_3             redis:8.0.2-alpine                    "docker-entrypoint.s…"   Up 5 hours (healthy)         6379/tcp

```
## docker compose ps
```
NAME                            IMAGE                                 COMMAND                  SERVICE               CREATED             STATUS                       PORTS
gs_api                          gsentinelhealthos-api                 "uvicorn api.app.mai…"   api                   30 hours ago        Up 5 hours (healthy)         127.0.0.1:8000->8000/tcp
gs_booking_worker_0             gsentinelhealthos-booking_worker_0    "python -m api.app.b…"   booking_worker_0      2 days ago          Up 5 hours (healthy)         
gs_booking_worker_1             gsentinelhealthos-booking_worker_1    "python -m api.app.b…"   booking_worker_1      2 days ago          Up 5 hours (healthy)         
gs_brain                        gsentinelhealthos-brain               "python brain/main.py"   brain                 30 hours ago        Up 5 hours (healthy)         8001/tcp
gs_db                           postgres:16-alpine                    "docker-entrypoint.s…"   db                    30 hours ago        Up 5 hours (healthy)         127.0.0.1:55433->5432/tcp
gs_decision_service             gsentinelhealthos-decision-service    "uvicorn services.de…"   decision-service      2 days ago          Up 5 hours (healthy)         8012/tcp
gs_dialogue_engine              gsentinelhealthos-dialogue-engine     "uvicorn services.di…"   dialogue-engine       2 days ago          Up 5 hours (healthy)         8010/tcp
gs_frontend                     gsentinelhealthos-frontend            "docker-entrypoint.s…"   frontend              29 hours ago        Up 5 hours (healthy)         3000/tcp
gs_gateway                      gsentinelhealthos-gateway             "uvicorn whatsapp_ga…"   gateway               2 days ago          Up 5 hours (healthy)         8002/tcp
gs_grafana                      grafana/grafana:10.4.2                "/run.sh"                grafana               2 days ago          Up 5 hours (healthy)         3000/tcp
gs_inference_service            gsentinelhealthos-inference-service   "uvicorn services.in…"   inference-service     2 days ago          Up 5 hours (healthy)         8011/tcp
gs_loki                         grafana/loki:2.9.8                    "/usr/bin/loki -conf…"   loki                  2 days ago          Up 5 hours (healthy)         3100/tcp
gs_nlg_service                  gsentinelhealthos-nlg-service         "uvicorn services.nl…"   nlg-service           2 days ago          Up 5 hours (healthy)         8013/tcp
gs_outbox_scheduler             gsentinelhealthos-outbox_scheduler    "python scripts/run_…"   outbox_scheduler      2 days ago          Up 5 hours (healthy)         
gs_panel_admin                  gsentinelhealthos-panel-admin         "docker-entrypoint.s…"   panel-admin           33 hours ago        Up 5 hours (healthy)         3010/tcp
gs_prometheus                   prom/prometheus:v2.51.0               "/bin/prometheus --c…"   prometheus            2 days ago          Up 5 hours (healthy)         9090/tcp
gs_promtail                     grafana/promtail:2.9.8                "/usr/bin/promtail -…"   promtail              2 days ago          Up 5 hours                   
gs_redis_master                 redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-master          30 hours ago        Up 5 hours (healthy)         6379/tcp
gs_redis_replica                redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-replica         30 hours ago        Up 5 hours (healthy)         6379/tcp
gs_redis_sentinel_1             redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-sentinel-1      30 hours ago        Up 5 hours (healthy)         6379/tcp
gs_redis_sentinel_2             redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-sentinel-2      2 days ago          Up 5 hours (healthy)         6379/tcp
gs_redis_sentinel_3             redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis-sentinel-3      2 days ago          Up 5 hours (healthy)         6379/tcp
gsentinel_redis_precanary_lab   redis:8.0.2-alpine                    "docker-entrypoint.s…"   redis_precanary_lab   About an hour ago   Up About an hour (healthy)   127.0.0.1:56380->6379/tcp

```
## docker inspect $(docker ps -q) --format ...
```
/gsentinel_redis_precanary_lab [redis-server --save  --appendonly no] [docker-entrypoint.sh] [{volume cf209b9004adcb0b0d94cf6432af022b3953c52f5d0d1ed6d4186b9df8679696 /var/lib/docker/volumes/cf209b9004adcb0b0d94cf6432af022b3953c52f5d0d1ed6d4186b9df8679696/_data /data local  true }]
/gs_frontend [node server.js] [docker-entrypoint.sh] [{bind  E:\GSentinelHealthOS\MB-Chat\data /app/artifacts/mb-chat-learning  rw true rprivate}]
/gs_brain [python brain/main.py] [] [{volume gsentinelhealthos_uploads_data /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data /data/uploads local rw true } {bind  /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data /app/artifacts/mb-chat-learning  rw true rprivate}]
/gs_api [uvicorn api.app.main:app --host 0.0.0.0 --port 8000] [] [{volume gsentinelhealthos_uploads_data /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data /data/uploads local rw true }]
/gs_redis_sentinel_1 [sh -c cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf && printf '
sentinel auth-pass mymaster %s
' "$REDIS_PASSWORD" >> /tmp/sentinel.conf && redis-server /tmp/sentinel.conf --sentinel] [docker-entrypoint.sh] [{volume fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384e058af /var/lib/docker/volumes/fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384e058af/_data /data local z true } {bind  E:\GSentinelHealthOS\broker\sentinel.conf /usr/local/etc/redis/sentinel.conf  ro false rprivate}]
/gs_redis_replica [sh -c redis-server /usr/local/etc/redis/redis.conf --replicaof redis-master 6379 --masterauth "bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy" --requirepass "bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy"] [docker-entrypoint.sh] [{bind  /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf /usr/local/etc/redis/redis.conf  ro false rprivate} {volume gsentinelhealthos_redis_replica_data /var/lib/docker/volumes/gsentinelhealthos_redis_replica_data/_data /data local rw true }]
/gs_db [postgres -c max_connections=50 -c shared_buffers=128MB] [docker-entrypoint.sh] [{bind  E:\GSentinelHealthOS\database\init-multiple-dbs.sql /docker-entrypoint-initdb.d/init.sql  ro false rprivate} {volume gsentinelhealthos_postgres_data /var/lib/docker/volumes/gsentinelhealthos_postgres_data/_data /var/lib/postgresql/data local rw true }]
/gs_redis_master [sh -c redis-server /usr/local/etc/redis/redis.conf --requirepass "bDAhxY9Af2LcR86iXN7U9gBIDpGeVuaiiKPLBTvEqLP2vbvy"] [docker-entrypoint.sh] [{volume gsentinelhealthos_redis_master_data /var/lib/docker/volumes/gsentinelhealthos_redis_master_data/_data /data local rw true } {bind  /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf /usr/local/etc/redis/redis.conf  ro false rprivate}]
/gs_panel_admin [node server.js] [docker-entrypoint.sh] [{volume gsentinelhealthos_panel_admin_runtime /var/lib/docker/volumes/gsentinelhealthos_panel_admin_runtime/_data /app/.runtime local rw true }]
/gs_grafana [] [/run.sh] [{volume gsentinelhealthos_grafana_data /var/lib/docker/volumes/gsentinelhealthos_grafana_data/_data /var/lib/grafana local rw true } {bind  /run/desktop/mnt/host/e/GSentinelHealthOS/observability/grafana/provisioning /etc/grafana/provisioning  ro false rprivate}]
/gs_promtail [-config.file=/etc/promtail/promtail-config.yml] [/usr/bin/promtail] [{bind  /var/lib/docker/containers /var/lib/docker/containers  ro false rslave} {bind  /var/run/docker.sock /var/run/docker.sock  ro false rprivate} {bind  E:\GSentinelHealthOS\observability\promtail-config.yml /etc/promtail/promtail-config.yml  ro false rprivate}]
/gs_outbox_scheduler [python scripts/run_outbox_scheduler.py] [] [{bind  E:\GSentinelHealthOS\scripts /app/scripts  ro false rprivate}]
/gs_gateway [uvicorn whatsapp_gateway.app.main:app --host 0.0.0.0 --port 8002] [] [{volume gsentinelhealthos_uploads_data /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data /data/uploads local rw true }]
/gs_loki [-config.file=/etc/loki/loki-config.yml] [/usr/bin/loki] [{bind  E:\GSentinelHealthOS\observability\loki-config.yml /etc/loki/loki-config.yml  ro false rprivate} {volume gsentinelhealthos_loki_data /var/lib/docker/volumes/gsentinelhealthos_loki_data/_data /loki local rw true }]
/gs_nlg_service [uvicorn services.nlg_service.main:app --host 0.0.0.0 --port 8013 --workers 1] [] []
/gs_prometheus [--config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus --storage.tsdb.retention.time=15d --web.enable-lifecycle --web.console.libraries=/etc/prometheus/console_libraries --web.console.templates=/etc/prometheus/consoles] [/bin/prometheus] [{bind  E:\GSentinelHealthOS\observability\prometheus.yml /etc/prometheus/prometheus.yml  ro false rprivate} {volume gsentinelhealthos_prometheus_data /var/lib/docker/volumes/gsentinelhealthos_prometheus_data/_data /prometheus local rw true }]
/gs_dialogue_engine [uvicorn services.dialogue_engine.main:app --host 0.0.0.0 --port 8010 --workers 1] [] []
/gs_booking_worker_1 [python -m api.app.booking_queue_worker_main] [] []
/gs_inference_service [uvicorn services.inference_service.main:app --host 0.0.0.0 --port 8011 --workers 1] [] []
/gs_decision_service [uvicorn services.decision_service.main:app --host 0.0.0.0 --port 8012 --workers 1] [] []
/gs_booking_worker_0 [python -m api.app.booking_queue_worker_main] [] []
/gs_redis_sentinel_2 [sh -c cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf && printf '
sentinel auth-pass mymaster %s
' "$REDIS_PASSWORD" >> /tmp/sentinel.conf && redis-server /tmp/sentinel.conf --sentinel] [docker-entrypoint.sh] [{volume d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c8995aac6a /var/lib/docker/volumes/d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c8995aac6a/_data /data local z true } {bind  E:\GSentinelHealthOS\broker\sentinel.conf /usr/local/etc/redis/sentinel.conf  ro false rprivate}]
/gs_redis_sentinel_3 [sh -c cp /usr/local/etc/redis/sentinel.conf /tmp/sentinel.conf && printf '
sentinel auth-pass mymaster %s
' "$REDIS_PASSWORD" >> /tmp/sentinel.conf && redis-server /tmp/sentinel.conf --sentinel] [docker-entrypoint.sh] [{bind  E:\GSentinelHealthOS\broker\sentinel.conf /usr/local/etc/redis/sentinel.conf  ro false rprivate} {volume 703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1196aa9 /var/lib/docker/volumes/703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1196aa9/_data /data local z true }]

```
## docker logs --tail 80 gs_brain
```
INFO:     127.0.0.1:60268 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39906 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:34304 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:59068 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:51630 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:49606 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:46132 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:43082 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:45126 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:51358 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39222 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:56518 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:53488 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39194 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:37976 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:51096 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34222 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:51242 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:53518 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:50342 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:33712 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:40294 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41792 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:35534 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:37812 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37690 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:57406 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:40100 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54748 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:39174 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:46130 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41048 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:33490 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:48492 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52862 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:56432 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:36696 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52180 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:48846 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:42468 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:57406 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:59344 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:38508 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:59990 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:42810 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:42464 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55450 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:43880 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:36474 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52828 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:46992 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:34588 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39696 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:45588 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:56114 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33168 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:44450 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:58644 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:38356 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:46824 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:39484 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41418 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:50252 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:48580 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41626 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:50208 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:40198 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:60726 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:60976 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:50624 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:45424 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:53852 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:44202 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:40878 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:59320 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:48072 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55420 - "GET /metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:41898 - "GET /metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:54804 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:51446 - "GET /metrics HTTP/1.1" 200 OK

```
## docker logs --tail 80 gs_api
```
INFO:     172.20.0.15:60204 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:51426 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:60316 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:35708 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:54918 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:55466 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:53528 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:49004 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:52636 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:37412 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:51102 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:60894 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:55250 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:58674 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:43082 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:59086 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:51914 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:53040 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:57804 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:59406 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:48376 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:54072 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:49552 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:46774 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:56540 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:53730 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:40356 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:38270 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:37272 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:44184 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:53858 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:46534 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:39936 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:40872 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:35562 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:50020 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:36908 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:58986 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:43172 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:48888 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:44376 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:34624 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:57380 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:35522 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:45662 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:49336 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:50474 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:40224 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:42468 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:52036 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:57112 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:53134 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:51452 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:51760 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:52532 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:59360 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:47116 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:50076 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:57914 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:43546 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:55246 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:34650 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:51144 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:38938 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:37148 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:34210 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:40892 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:36050 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:33414 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:46004 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:44820 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:55140 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:34154 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:59228 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:44396 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:55242 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:35522 - "GET /api/health/liveness HTTP/1.1" 200 OK
INFO:     172.20.0.15:35634 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     172.20.0.15:40150 - "GET /api/metrics HTTP/1.1" 200 OK
INFO:     127.0.0.1:41104 - "GET /api/health/liveness HTTP/1.1" 200 OK

```
## docker logs --tail 80 gs_dialogue_engine
```
INFO:     127.0.0.1:44510 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:59508 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:33606 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37790 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:35930 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:45920 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:59880 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:36262 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:38528 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41936 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41828 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:36168 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51212 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33130 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:50044 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55614 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:55708 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:58706 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:46312 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33760 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36350 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:43626 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51096 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:47540 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:59644 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:35878 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34612 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39366 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:50760 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34578 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:40568 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:42414 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:37018 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:47778 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:56958 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:60696 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:47182 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:51232 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:54772 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37362 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     172.20.0.15:49196 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:39024 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33678 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51532 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:46714 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:33530 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34294 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:46740 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:38918 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:58554 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:49714 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36258 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:57490 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:39696 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52552 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51124 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34920 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34362 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:48186 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:49578 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:57244 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:42668 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41000 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36700 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:50124 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:37808 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:45130 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:56490 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:44546 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:46476 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54004 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51606 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:51690 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:45976 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:49788 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:38168 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39346 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:37330 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41616 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34456 - "GET /health HTTP/1.1" 200 OK

```
## docker logs --tail 80 gs_inference_service
```
INFO:     172.20.0.15:58908 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:46598 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:40954 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34774 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:58200 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:43276 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39264 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:58586 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:45944 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:42596 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33332 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36156 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:53524 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34282 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:38070 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41112 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:51686 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:33380 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55524 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:52562 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:40822 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:55992 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54886 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51262 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34420 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:39936 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:32774 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34256 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:47464 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:57984 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:51316 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:49518 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:35024 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:37580 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:47202 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:44478 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:42512 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:60056 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:53718 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:60814 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:60586 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:39294 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:43824 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:54662 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:53282 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41664 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:60338 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:50230 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:60476 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:48208 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55746 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:40392 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:35008 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:43842 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:48978 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:43810 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37308 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:44046 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:43380 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:40808 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:35552 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41808 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55754 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:42654 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:50208 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51456 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54902 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:58758 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:32834 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:58148 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:46732 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41316 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:56938 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:57892 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:46164 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34216 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37808 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36414 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:43036 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:49454 - "GET /health HTTP/1.1" 200 OK

```
## docker logs --tail 80 gs_decision_service
```
INFO:     172.20.0.15:36072 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:42468 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:50722 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:57460 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:42208 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:32832 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:40110 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:52974 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:58808 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:47438 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:45314 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41274 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:44308 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:58346 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52058 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:48694 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:53548 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:44346 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34298 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:35414 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54344 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41142 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39060 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:52906 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33464 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:59962 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37632 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:44554 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54438 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:46114 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:38248 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:37932 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:59034 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:57836 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33716 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:33012 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54876 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:39306 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41202 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:41754 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:38278 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:43996 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52954 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:49382 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:60070 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:52814 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:44050 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:45996 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52018 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:55044 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:42680 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:45808 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:57950 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:56320 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:60420 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:35076 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52208 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:35666 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54950 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:59044 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:56728 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:56294 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55892 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:40708 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37940 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:37262 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:37062 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:57618 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:50596 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:54434 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:43618 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36356 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39064 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51308 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:53608 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:46970 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:47560 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:56340 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33926 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:53158 - "GET /health HTTP/1.1" 200 OK

```
## docker logs --tail 80 gs_nlg_service
```
INFO:     127.0.0.1:55996 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:42628 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:59700 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54640 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36592 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52018 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:58212 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:56858 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:45738 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:47582 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:50574 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:57538 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:53012 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39258 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:34778 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:53296 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36084 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:35684 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:36278 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:59976 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:54252 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:35002 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:52826 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:46412 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:54412 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55144 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:59738 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34552 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:59926 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:56644 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:33422 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52262 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51628 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34376 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:44210 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:52164 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:38482 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39056 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:54122 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:59136 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:40262 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:48390 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:35348 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:55936 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:53472 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:34238 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:48594 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:56190 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:33710 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:41352 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:53574 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:53910 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:35328 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:46110 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:49656 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:57324 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:48090 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:49342 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:60426 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:50910 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:35386 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:50406 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:57672 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:35436 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:52936 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:36904 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:50368 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:54932 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:51442 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:43582 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:48070 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:39400 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:43902 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:33918 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:58406 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:49042 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:39814 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:42614 - "GET /metrics HTTP/1.1" 404 Not Found
INFO:     127.0.0.1:53496 - "GET /health HTTP/1.1" 200 OK
INFO:     172.20.0.15:48594 - "GET /metrics HTTP/1.1" 404 Not Found

```
## keyword scan in gs_brain logs (file write|watcher|guard|brain|reload|hot reload|sync|auto update|patch|training write|memory write)
```
<no output>
```
## keyword scan in gs_api logs (file write|watcher|guard|brain|reload|hot reload|sync|auto update|patch|training write|memory write)
```
<no output>
```
## keyword scan in gs_dialogue_engine logs (file write|watcher|guard|brain|reload|hot reload|sync|auto update|patch|training write|memory write)
```
<no output>
```
## keyword scan in gs_inference_service logs (file write|watcher|guard|brain|reload|hot reload|sync|auto update|patch|training write|memory write)
```
<no output>
```
## keyword scan in gs_decision_service logs (file write|watcher|guard|brain|reload|hot reload|sync|auto update|patch|training write|memory write)
```
<no output>
```
## keyword scan in gs_nlg_service logs (file write|watcher|guard|brain|reload|hot reload|sync|auto update|patch|training write|memory write)
```
<no output>
```
