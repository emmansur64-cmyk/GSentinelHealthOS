# SaaS Multi-Tenant Deployment Notes

## 1. Database Migration

1. Run prisma migration in production window:

```bash
npm run prisma:deploy
```

2. Ensure migration `20260407022000_multi_tenant_saas_foundation` is applied.

3. Validate default tenant exists:

```sql
SELECT id, slug, plan, estado FROM tenants;
```

## 2. Required Environment Variables

Set at minimum:

- `DATABASE_URL`
- `JWT_SECRET` (>= 32 chars)
- `JWT_EXPIRES_IN_HOURS`
- `DEFAULT_TENANT_ID`
- `DEFAULT_TENANT_SLUG`

Recommended:

- `AUTH_LOGIN_RATE_LIMIT_PER_MINUTE`
- `PREDICTION_OVERBOOKING_ENABLED`
- `PREDICTION_OVERBOOKING_MAX_CONCURRENT`
- `PREDICTION_HIGH_RISK_THRESHOLD`

## 3. Security Baseline

- Enforce HTTPS end-to-end.
- Keep `auth_token` as `HttpOnly`, `Secure`, `SameSite=Lax`.
- Rotate JWT secrets periodically.
- Restrict DB user grants to app schema only.
- Enable DB backups and point-in-time recovery.

## 4. Tenant Isolation

- Tables include `tenant_id`.
- RLS policy `*_tenant_isolation` is enabled in migration.
- Runtime context injects tenant on tenant-scoped writes.
- Never accept tenant_id from frontend payload for privileged operations.

## 5. Billing Controls

- Doctor creation checks `limite_medicos`.
- Appointment creation checks `limite_turnos_mensuales`.
- Return `402` when plan limit is exceeded.

## 6. VPS Runbook

1. Build image and start stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

2. Apply migration:

```bash
docker compose -f docker-compose.prod.yml exec app npm run prisma:deploy
```

3. Run prediction metrics job (optional scheduler mode):

```bash
docker compose -f docker-compose.prod.yml exec app npm run job:recalculate-metrics
```
