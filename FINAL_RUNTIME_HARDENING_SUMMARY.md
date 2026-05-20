# FINAL RUNTIME HARDENING SUMMARY
Generated: 2026-05-19 00:14:35 -03:00

## 1. Tabla exacta: mount actual -> mount nuevo
| Container | Actual | Nuevo |
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

## 2. Tabla RW -> RO
| Container | Source | Destination | Current | Target |
|---|---|---|---|---|
| gs_frontend | E:\GSentinelHealthOS\MB-Chat\data | /app/artifacts/mb-chat-learning | RW | RO |
| gs_brain | /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data | /app/artifacts/mb-chat-learning | RW | RO |

## 3. Containers con riesgo residual
| Container | Riesgo residual |
|---|---|
| gs_frontend | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_brain | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_api | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_panel_admin | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_outbox_scheduler | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_gateway | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_nlg_service | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_dialogue_engine | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_booking_worker_1 | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_inference_service | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_decision_service | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |
| gs_booking_worker_0 | proceso runtime potencialmente escribible; requiere RO fs + data-only RW |

## 4. Containers aun con root
| Container | User | Image |
|---|---|---|
| gsentinel_redis_precanary_lab | (default/root-likely) | redis:8.0.2-alpine |
| gs_redis_sentinel_1 | (default/root-likely) | redis:8.0.2-alpine |
| gs_redis_replica | (default/root-likely) | redis:8.0.2-alpine |
| gs_db | (default/root-likely) | postgres:16-alpine |
| gs_redis_master | (default/root-likely) | redis:8.0.2-alpine |
| gs_promtail | (default/root-likely) | grafana/promtail:2.9.8 |
| gs_redis_sentinel_2 | (default/root-likely) | redis:8.0.2-alpine |
| gs_redis_sentinel_3 | (default/root-likely) | redis:8.0.2-alpine |

## 5. Paths todavia inseguros
| Path | Motivo |
|---|---|
| .\MB-Chat\data | runtime artifacts mezclados con repo |
| .\MB-Chat\cerebro_ai_med\models\artifacts | artifacts ML dentro del repo |
| .\artifacts\* | artifacts runtime/QA dentro del repo |

## 6. Riesgo final clasificado
| Area | Nivel | Evidencia |
|---|---|---|
| Contaminacion runtime->repo | CRITICO | ./MB-Chat/data montado para runtime learning en frontend/brain |
| Auto-modificacion accidental | ALTO | procesos runtime + ausencia de enforcement runtime-integrity en compose |
| Contenedores root/default-root | ALTO | múltiples servicios con user no explícito |
| Contratos/puertos/clinica | BAJO | no se aplicaron cambios funcionales en esta ejecución |

## 7. Veredicto final
NO-GO hasta aplicar aislamiento y validar salud post-cambio.
