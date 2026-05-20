# FINAL RO MOUNT VALIDATION
Generated: 2026-05-19 00:14:35 -03:00
Mode: PRE-APPLY validation only

## Current RW risky mounts
```

container   source                                                 destination                     rw   reason
---------   ------                                                 -----------                     --   ------
gs_frontend E:\GSentinelHealthOS\MB-Chat\data                      /app/artifacts/mb-chat-learning True RW mount on cod…
gs_brain    /run/desktop/mnt/host/e/GSentinelHealthOS/MB-Chat/data /app/artifacts/mb-chat-learning True RW mount on cod…


```
## Validation gates before apply
```
docker compose config must pass after edits
healthchecks green after targeted service restarts
no contract/port diff
no clinical behavior diff

```
