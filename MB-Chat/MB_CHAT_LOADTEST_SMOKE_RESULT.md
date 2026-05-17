# MB Chat Smoke Load Test Result

## Date
- 2026-05-17

## Scope Executed
- Only smoke test executed.
- No 1000 VUs test executed.
- No production target used.
- No deploy performed.

## Phase 1 - Environment Verification

### Effective target selection
- `MB_CHAT_BASE_URL` at runtime: `http://host.docker.internal:8100` (k6 container) -> local gateway process on host.
- `MB_CHAT_LOADTEST_ENDPOINT`: `/analyze`
- Production safety: `MB_CHAT_ALLOW_PRODUCTION_LOADTEST=false`

### Service readiness checks
- Local MB-Chat gateway process started temporarily on `127.0.0.1:8100`.
- Liveness check passed before smoke:
  - `GET http://127.0.0.1:8100/health/live` => `200`

### Dependencies observed
- Inference service: reachable on `127.0.0.1:8011`.
- Decision service: reachable on `127.0.0.1:8012`.
- NLG service: reachable on `127.0.0.1:8013`.
- Redis rate-limit path was disabled for this smoke run (`CEREBRO_RATE_LIMIT_ENABLED=false`) to avoid unrelated local Redis binding mismatch.
- RabbitMQ/AMQP: not required for `/analyze` smoke (sync path).

### External provider safety
- NLG container env inspection:
  - `NLG_GROQ_ENABLED=UNSET`
  - `GROQ_API_KEY=UNSET`
- No evidence of external provider use in this smoke run.

## Phase 2 - Smoke Execution

### Command executed (real)
```powershell
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e MB_CHAT_BASE_URL=http://host.docker.internal:8100 \
  -e MB_CHAT_LOADTEST_ENDPOINT=/analyze \
  -e MB_CHAT_LOADTEST_TOKEN=*** \
  -e MB_CHAT_ALLOW_PRODUCTION_LOADTEST=false \
  -e MB_CHAT_EXPECTED_STATUS=200 \
  -v E:\GSentinelHealthOS\MB-Chat:/work -w /work \
  grafana/k6 run loadtests/k6/mb-chat-smoke.js
```

## Real Results

### HTTP status codes observed
- `200`: 1 (health check)
- `422`: 5 (smoke POST `/analyze` iterations)

### k6 checks
- `checks_total`: 25
- `checks_succeeded`: 80.00% (20/25)
- `checks_failed`: 20.00% (5/25)

### k6 latency
- `http_req_duration avg`: `6.84ms`
- `http_req_duration p95`: `14ms`

### Errors / threshold outcome
- `http_req_failed`: `100.00%` (5/5)
- Failed check: `status is expected or 200/201`
- No 5xx observed.
- k6 exit with threshold failure.

## PASS / FAIL Decision
- **FAIL**

Reason:
- Smoke contract check failed because `/analyze` returned `422` for all 5 test iterations.
- Even with good latency and no 5xx, smoke is not valid while request contract returns non-success status.

## Authorization for Progressive Load
- `50 VUs`: **NOT AUTHORIZED** (until smoke passes)
- `100 VUs`: **NOT AUTHORIZED**
- `250 VUs`: **NOT AUTHORIZED**
- `500 VUs`: **NOT AUTHORIZED**
- `1000 VUs`: **NOT AUTHORIZED**

## Evidence Files
- `loadtests/reports/smoke-k6-output.log`
- `loadtests/reports/smoke-gateway-stdout.log`
- `loadtests/reports/smoke-gateway-stderr.log`

## Notes
- Token value was not printed in logs or report.
- No PHI/PII payload was used (synthetic payload only).
- Production endpoints were not targeted.
