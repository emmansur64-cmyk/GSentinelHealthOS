# DOCKER RO CONVERSION PLAN
Generated: 2026-05-19 00:14:30 -03:00
Mode: PLAN ONLY (no apply)

## Exact mount mapping: current -> proposed
| Container | Current mount | Proposed mount |
|---|---|---|
| gsentinel_redis_precanary_lab | /var/lib/docker/volumes/cf209b9004adcb0b0d94cf6432af022b3953c52f5d0d1ed6d4186b9df8679696/_data:/data:rw | /var/lib/docker/volumes/cf209b9004adcb0b0d94cf6432af022b3953c52f5d0d1ed6d4186b9df8679696/_data:/data:rw |
| gs_frontend | E:\GSentinelHealthOS\MB-Chat\data:/app/artifacts/mb-chat-learning:rw | E:\GSentinelHealthOS\MB-Chat\data:/app/artifacts/mb-chat-learning:ro |
| gs_brain | /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data:/app/artifacts/mb-chat-learning:rw | /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data:/app/artifacts/mb-chat-learning:ro |
| gs_brain | /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data:/data/uploads:rw | /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data:/data/uploads:rw |
| gs_api | /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data:/data/uploads:rw | /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data:/data/uploads:rw |
| gs_redis_sentinel_1 | /var/lib/docker/volumes/fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384e058af/_data:/data:rw | /var/lib/docker/volumes/fd71a40b8a3b609282459400207ab018f42a4fb8a7352ec47496b53384e058af/_data:/data:rw |
| gs_redis_sentinel_1 | E:\GSentinelHealthOS\broker\sentinel.conf:/usr/local/etc/redis/sentinel.conf:ro | E:\GSentinelHealthOS\broker\sentinel.conf:/usr/local/etc/redis/sentinel.conf:rw |
| gs_redis_replica | /var/lib/docker/volumes/gsentinelhealthos_redis_replica_data/_data:/data:rw | /var/lib/docker/volumes/gsentinelhealthos_redis_replica_data/_data:/data:rw |
| gs_redis_replica | /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf:/usr/local/etc/redis/redis.conf:ro | /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf:/usr/local/etc/redis/redis.conf:rw |
| gs_db | E:\GSentinelHealthOS\database\init-multiple-dbs.sql:/docker-entrypoint-initdb.d/init.sql:ro | E:\GSentinelHealthOS\database\init-multiple-dbs.sql:/docker-entrypoint-initdb.d/init.sql:rw |
| gs_db | /var/lib/docker/volumes/gsentinelhealthos_postgres_data/_data:/var/lib/postgresql/data:rw | /var/lib/docker/volumes/gsentinelhealthos_postgres_data/_data:/var/lib/postgresql/data:rw |
| gs_redis_master | /var/lib/docker/volumes/gsentinelhealthos_redis_master_data/_data:/data:rw | /var/lib/docker/volumes/gsentinelhealthos_redis_master_data/_data:/data:rw |
| gs_redis_master | /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf:/usr/local/etc/redis/redis.conf:ro | /run/desktop/mnt/host/e/GSentinelHealthOS/broker/redis.conf:/usr/local/etc/redis/redis.conf:rw |
| gs_panel_admin | /var/lib/docker/volumes/gsentinelhealthos_panel_admin_runtime/_data:/app/.runtime:rw | /var/lib/docker/volumes/gsentinelhealthos_panel_admin_runtime/_data:/app/.runtime:rw |
| gs_grafana | /run/desktop/mnt/host/e/GSentinelHealthOS/observability/grafana/provisioning:/etc/grafana/provisioning:ro | /run/desktop/mnt/host/e/GSentinelHealthOS/observability/grafana/provisioning:/etc/grafana/provisioning:rw |
| gs_grafana | /var/lib/docker/volumes/gsentinelhealthos_grafana_data/_data:/var/lib/grafana:rw | /var/lib/docker/volumes/gsentinelhealthos_grafana_data/_data:/var/lib/grafana:rw |
| gs_promtail | /var/lib/docker/containers:/var/lib/docker/containers:ro | /var/lib/docker/containers:/var/lib/docker/containers:rw |
| gs_promtail | /var/run/docker.sock:/var/run/docker.sock:ro | /var/run/docker.sock:/var/run/docker.sock:rw |
| gs_promtail | E:\GSentinelHealthOS\observability\promtail-config.yml:/etc/promtail/promtail-config.yml:ro | E:\GSentinelHealthOS\observability\promtail-config.yml:/etc/promtail/promtail-config.yml:rw |
| gs_outbox_scheduler | E:\GSentinelHealthOS\scripts:/app/scripts:ro | E:\GSentinelHealthOS\scripts:/app/scripts:rw |
| gs_gateway | /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data:/data/uploads:rw | /var/lib/docker/volumes/gsentinelhealthos_uploads_data/_data:/data/uploads:rw |
| gs_loki | E:\GSentinelHealthOS\observability\loki-config.yml:/etc/loki/loki-config.yml:ro | E:\GSentinelHealthOS\observability\loki-config.yml:/etc/loki/loki-config.yml:rw |
| gs_loki | /var/lib/docker/volumes/gsentinelhealthos_loki_data/_data:/loki:rw | /var/lib/docker/volumes/gsentinelhealthos_loki_data/_data:/loki:rw |
| gs_prometheus | E:\GSentinelHealthOS\observability\prometheus.yml:/etc/prometheus/prometheus.yml:ro | E:\GSentinelHealthOS\observability\prometheus.yml:/etc/prometheus/prometheus.yml:rw |
| gs_prometheus | /var/lib/docker/volumes/gsentinelhealthos_prometheus_data/_data:/prometheus:rw | /var/lib/docker/volumes/gsentinelhealthos_prometheus_data/_data:/prometheus:rw |
| gs_redis_sentinel_2 | /var/lib/docker/volumes/d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c8995aac6a/_data:/data:rw | /var/lib/docker/volumes/d6e03b8abee05a2a5f74fe3b6ff21f7886e736c2fbdaddf0220e04c8995aac6a/_data:/data:rw |
| gs_redis_sentinel_2 | E:\GSentinelHealthOS\broker\sentinel.conf:/usr/local/etc/redis/sentinel.conf:ro | E:\GSentinelHealthOS\broker\sentinel.conf:/usr/local/etc/redis/sentinel.conf:rw |
| gs_redis_sentinel_3 | E:\GSentinelHealthOS\broker\sentinel.conf:/usr/local/etc/redis/sentinel.conf:ro | E:\GSentinelHealthOS\broker\sentinel.conf:/usr/local/etc/redis/sentinel.conf:rw |
| gs_redis_sentinel_3 | /var/lib/docker/volumes/703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1196aa9/_data:/data:rw | /var/lib/docker/volumes/703c697e74cc60a206942050f3e49502f6aa67f93cf94f4c77cc7b8da1196aa9/_data:/data:rw |

## RW -> RO conversion candidates
| Container | Source | Destination | Current | Target | Reason |
|---|---|---|---|---|---|
| gs_frontend | E:\GSentinelHealthOS\MB-Chat\data | /app/artifacts/mb-chat-learning | RW | RO | Code/config write prevention |
| gs_brain | /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data | /app/artifacts/mb-chat-learning | RW | RO | Code/config write prevention |
