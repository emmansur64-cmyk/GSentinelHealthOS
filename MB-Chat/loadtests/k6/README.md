# MB Chat K6 Load Tests

## Purpose
This folder provides reproducible and safety-guarded load tests for `MB-Chat` without changing clinical logic or API contracts.

## Requirements
- `k6` installed and available in PATH.
- Non-production environment (local/staging/internal) preferred.
- API Gateway and required internal services up:
  - api-gateway
  - inference-service
  - decision-service
  - nlg-service
  - Redis
  - RabbitMQ (if async endpoint is used)
- Synthetic payload only (no PHI/PII).

## Files
- `mb-chat-smoke.js`: pre-load connectivity and contract smoke test.
- `mb-chat-1000-vus.js`: high-concurrency test with ramp-up/sustain/ramp-down.
- `common.js`: shared config/safety helpers.

## Environment Variables
Mandatory:
- `MB_CHAT_BASE_URL`
- `MB_CHAT_LOADTEST_ENDPOINT`

Optional:
- `MB_CHAT_LOADTEST_TOKEN`
- `MB_CHAT_LOADTEST_VUS` (default `1000`)
- `MB_CHAT_LOADTEST_DURATION` (default `5m`)
- `MB_CHAT_LOADTEST_RAMP_UP` (default `2m`)
- `MB_CHAT_LOADTEST_RAMP_DOWN` (default `1m`)
- `MB_CHAT_LOADTEST_TIMEOUT_MS` (default `30000`)
- `MB_CHAT_EXPECTED_STATUS` (default `200`)
- `MB_CHAT_LOADTEST_PAYLOAD_PATH` (default `loadtests/payloads/safe-medical-chat-payload.json`)
- `MB_CHAT_ALLOW_PRODUCTION_LOADTEST` (default `false`)

## Safety Guardrails
- Execution is blocked by default for production/public-like targets.
- If target looks production/public, you must explicitly set:
  - `MB_CHAT_ALLOW_PRODUCTION_LOADTEST=true`
- Scripts never print token values.
- Scripts do not print full payloads.
- Scripts do not persist full responses by default.

## Run Smoke Test
PowerShell:
```powershell
$env:MB_CHAT_BASE_URL="http://localhost:8100"
$env:MB_CHAT_LOADTEST_ENDPOINT="/analyze"
$env:MB_CHAT_LOADTEST_TOKEN="replace_with_test_key"
k6 run loadtests/k6/mb-chat-smoke.js
```

## Run 1000 VUs Test
PowerShell:
```powershell
$env:MB_CHAT_BASE_URL="http://localhost:8100"
$env:MB_CHAT_LOADTEST_ENDPOINT="/analyze"
$env:MB_CHAT_LOADTEST_TOKEN="replace_with_test_key"
$env:MB_CHAT_LOADTEST_VUS="1000"
$env:MB_CHAT_LOADTEST_DURATION="5m"
$env:MB_CHAT_LOADTEST_RAMP_UP="2m"
$env:MB_CHAT_LOADTEST_RAMP_DOWN="1m"
k6 run loadtests/k6/mb-chat-1000-vus.js
```

## Result Interpretation
PASS candidate (infrastructure perspective, not clinical guarantee):
- Smoke test passes.
- Full load test passes thresholds.
- `http_req_failed < 1%`
- `http_req_duration p95 < 5000ms`
- `http_req_duration p99 < 15000ms`
- `checks > 99%`
- No sustained 5xx.
- No massive timeout pattern.
- No RabbitMQ saturation (if async mode tested).
- No observable memory leak trend.

FAIL / NO-GO indicators:
- Sustained 5xx responses.
- Extreme p95/p99 latency spikes.
- RabbitMQ blocked/backlogged.
- HTTP pool exhaustion symptoms.
- Worker saturation.
- CPU/memory at limit with instability.
- External provider timeout cascades.

## Important Claim Policy
Do not claim "supports 1000+ concurrent users" unless:
1. Smoke result is real and successful.
2. Full high-concurrency run was executed in target environment.
3. Metrics and service stability satisfy acceptance thresholds.
