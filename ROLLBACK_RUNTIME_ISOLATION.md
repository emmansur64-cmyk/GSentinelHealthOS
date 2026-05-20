# ROLLBACK RUNTIME ISOLATION
Generated: 2026-05-19 00:14:35 -03:00

1. Revert docker-compose mount edits to previous state.
2. Repoint runtime paths from E:\GSentinelRuntime\* to original paths/volumes.
3. Keep both old/new artifact copies until health validated.
4. Re-run docker compose config + docker compose ps + endpoint health checks.

