# SELECTIVE RECREATE RESULT
Generated: 2026-05-19 00:23:11 -03:00

## docker compose up -d --no-deps --force-recreate brain frontend
```
time="2026-05-19T00:23:11-03:00" level=warning msg="The \"GRAFANA_ADMIN_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-19T00:23:12-03:00" level=warning msg="Found orphan containers ([gsentinel_api_precanary_lab gsentinel_redis_precanary_lab gsentinel_postgres_precanary_lab]) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up."
 Container gs_brain Recreate 
 Container gs_brain Recreated 
 Container gs_frontend Recreate 
 Container gs_frontend Recreated 
 Container gs_brain Starting 
 Container gs_brain Started 
 Container gs_brain Waiting 
 Container gs_brain Healthy 
 Container gs_frontend Starting 
 Container gs_frontend Started 

```
## Recreate command status
```
OK=True

```
## docker compose ps brain frontend (after)
```
time="2026-05-19T00:23:47-03:00" level=warning msg="The \"GRAFANA_ADMIN_PASSWORD\" variable is not set. Defaulting to a blank string."
NAME          IMAGE                        COMMAND                  SERVICE    CREATED          STATUS                           PORTS
gs_brain      gsentinelhealthos-brain      "python brain/main.py"   brain      35 seconds ago   Up 31 seconds (healthy)          127.0.0.1:8001->8001/tcp
gs_frontend   gsentinelhealthos-frontend   "docker-entrypoint.s…"   frontend   33 seconds ago   Up 1 second (health: starting)   127.0.0.1:3000->3000/tcp

```
## Health status brain
```
healthy

```
## Health status frontend
```
starting

```
## Other critical services state (should remain running, not targeted)
```
/gs_db|StartedAt=2026-05-18T21:45:20.049945348Z|Running=true
/gs_redis_master|StartedAt=2026-05-18T21:45:19.94833302Z|Running=true
/gs_redis_replica|StartedAt=2026-05-18T21:45:20.134016345Z|Running=true
/gs_redis_sentinel_1|StartedAt=2026-05-18T21:45:19.918919597Z|Running=true
/gs_redis_sentinel_2|StartedAt=2026-05-18T21:45:20.070069012Z|Running=true
/gs_redis_sentinel_3|StartedAt=2026-05-18T21:45:19.988905773Z|Running=true
/gs_api|StartedAt=2026-05-18T21:45:20.013955613Z|Running=true
/gs_gateway|StartedAt=2026-05-18T21:45:20.037448306Z|Running=true
/gs_booking_worker_0|StartedAt=2026-05-18T21:45:20.026903387Z|Running=true
/gs_booking_worker_1|StartedAt=2026-05-18T21:45:20.139843402Z|Running=true
/gs_outbox_scheduler|StartedAt=2026-05-18T21:45:20.143281992Z|Running=true

```

VERDICT: SELECTIVE_RECREATE_FAIL_ROLLBACK_DONE
