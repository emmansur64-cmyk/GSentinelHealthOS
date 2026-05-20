# CONTAINER SECURITY HARDENING PLAN
Generated: 2026-05-19 00:14:30 -03:00
Mode: PLAN ONLY (no apply)

## Containers running as root/default-root-likely
```

container                     user                  image                  cmd
---------                     ----                  -----                  ---
gsentinel_redis_precanary_lab (default/root-likely) redis:8.0.2-alpine     redis-server --save  --appendonly no
gs_redis_sentinel_1           (default/root-likely) redis:8.0.2-alpine     sh -c cp /usr/local/etc/redis/sentinel.conf …
gs_redis_replica              (default/root-likely) redis:8.0.2-alpine     sh -c redis-server /usr/local/etc/redis/redi…
gs_db                         (default/root-likely) postgres:16-alpine     postgres -c max_connections=50 -c shared_buf…
gs_redis_master               (default/root-likely) redis:8.0.2-alpine     sh -c redis-server /usr/local/etc/redis/redi…
gs_promtail                   (default/root-likely) grafana/promtail:2.9.8 -config.file=/etc/promtail/promtail-config.y…
gs_redis_sentinel_2           (default/root-likely) redis:8.0.2-alpine     sh -c cp /usr/local/etc/redis/sentinel.conf …
gs_redis_sentinel_3           (default/root-likely) redis:8.0.2-alpine     sh -c cp /usr/local/etc/redis/sentinel.conf …


```
## Per-container hardening policy
```
Add explicit non-root user in image/container runtime.
Enable read_only filesystem where possible.
Use tmpfs for /tmp and ephemeral dirs.
Apply cap_drop: [ALL] with minimal selective adds.
Keep no-new-privileges:true (already present broadly).
Retain and verify healthchecks post-hardening.

```
