# SELECTIVE RECREATE ROLLBACK STATUS
Generated: 2026-05-19 00:25:25 -03:00

Rollback executed from: docker-compose.yml.bak-runtime-isolation-20260519-0018

## Rollback recreate output
```
time="2026-05-19T00:24:51-03:00" level=warning msg="The \"GRAFANA_ADMIN_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-19T00:24:51-03:00" level=warning msg="Found orphan containers ([gsentinel_api_precanary_lab gsentinel_redis_precanary_lab gsentinel_postgres_precanary_lab]) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up."
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
