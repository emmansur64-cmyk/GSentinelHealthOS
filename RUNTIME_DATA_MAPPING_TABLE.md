# RUNTIME DATA MAPPING TABLE
Generated: 2026-05-19 00:14:30 -03:00
Mode: PLAN ONLY (no apply)

| Category | Current path/source | Proposed target |
|---|---|---|
| MB-Chat learning artifact | .\MB-Chat\data | E:\GSentinelRuntime\artifacts\mb-chat-learning |
| Uploads volume (container path /data/uploads) | docker named volume uploads_data | E:\GSentinelRuntime\uploads |
| Postgres data volume | docker named volume postgres_data | E:\GSentinelRuntime\postgres |
| Redis master/replica volumes | docker named volumes redis_master_data/redis_replica_data | E:\GSentinelRuntime\redis\master and E:\GSentinelRuntime\redis\replica |
| Prometheus TSDB | docker named volume prometheus_data | E:\GSentinelRuntime\observability\prometheus |
| Grafana data | docker named volume grafana_data | E:\GSentinelRuntime\observability\grafana |
| Loki data | docker named volume loki_data | E:\GSentinelRuntime\observability\loki |
| QA artifacts under repo artifacts/ | .\artifacts\* | E:\GSentinelRuntime\artifacts\qa |
| ML artifacts under MB-Chat/cerebro_ai_med/models/artifacts | .\MB-Chat\cerebro_ai_med\models\artifacts | E:\GSentinelRuntime\ml\checkpoints\cerebro_ai_med |
| ML datasets under MB-Chat/data | .\MB-Chat\data | E:\GSentinelRuntime\ml\datasets\mb-chat |
| Embedding/vector snapshots | brain artifacts/semantic_index + redis semantic refs | E:\GSentinelRuntime\ml\embeddings + E:\GSentinelRuntime\ml\vectorstore |
