# MB Chat Load Test Precheck

## Scope and Date
- Project: `E:\GSentinelHealthOS\MB-Chat`
- Precheck date: 2026-05-17
- Goal: determine safe and reproducible path for load testing 1000+ concurrent users.

## Endpoints Detected (API Gateway)
- `POST /analyze` (requires `X-API-Key`, sync distributed orchestration)
- `POST /analyze/async` (requires `X-API-Key`, publishes to AMQP)
- `GET /analyze/result/{job_id}` (requires `X-API-Key`, reads async result from Redis)
- `GET /memory/history` (requires `X-API-Key`)
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

## Candidate Endpoint for Load Test
- Primary candidate: `POST /analyze`
- Why: exercises the real gateway path, internal HTTP pools, orchestration and response contract.
- Secondary candidate (queue stress): `POST /analyze/async` plus polling `GET /analyze/result/{job_id}`.

## Health and Readiness
- Liveness exists: `GET /health/live`
- Readiness exists: `GET /health/ready`
- Readiness checks include inference/decision/nlg service reachability and Redis circuit state.

## Chat/Test Payload Safety
- The gateway accepts text payloads with `input_type=text`, `modality=TEXT`, `text`, `patient_context`.
- A synthetic payload can be used with fictitious context only (no PHI/PII).
- Payload sanitization and limits are enforced by runtime validators.

## Runtime Dependencies Confirmed
- External provider path (optional): Groq through NLG reformulator when `NLG_GROQ_ENABLED=true` and `GROQ_API_KEY` is set.
- Broker: RabbitMQ/AMQP used by `POST /analyze/async` and worker.
- Internal HTTP services: gateway -> inference-service (`/infer`), decision-service (`/decide`), nlg-service (`/generate`).
- Redis: rate limit, async result store, and health signals.
- Local storage/logs: memory history file (`CEREBRO_MEMORY_HISTORY_PATH`) and structured logging.

## Risks Identified
- PHI/PII leakage risk if non-sanitized real patient text is used in load payload.
- External egress risk to Groq if NLG Groq mode is enabled during test.
- False negatives risk if readiness is degraded by dependency mismatch or unavailable downstream services.
- Rate-limiter 429 may dominate results if limits are too low for target load.
- Async scenario can saturate RabbitMQ/worker if prefetch/worker counts are undersized.

## Required Environment Variables for Test
- `MB_CHAT_BASE_URL`
- `MB_CHAT_LOADTEST_ENDPOINT`
- `MB_CHAT_LOADTEST_TOKEN` (optional but normally required for protected endpoints)
- `MB_CHAT_LOADTEST_VUS`
- `MB_CHAT_LOADTEST_DURATION`
- `MB_CHAT_LOADTEST_RAMP_UP`
- `MB_CHAT_LOADTEST_RAMP_DOWN`
- `MB_CHAT_LOADTEST_TIMEOUT_MS`
- `MB_CHAT_EXPECTED_STATUS`
- `MB_CHAT_ALLOW_PRODUCTION_LOADTEST`

Recommended runtime controls for safe execution:
- `NLG_GROQ_ENABLED=false` (avoid external provider during load test)
- `CEREBRO_RATE_LIMIT_ENABLED=true` with tuned limits for the intended test profile
- `CEREBRO_INTERNAL_TIMEOUT_SECONDS`, `CEREBRO_INTERNAL_RETRIES`, `CEREBRO_INTERNAL_RETRY_BACKOFF_SECONDS`
- `CEREBRO_ASYNC_WORKER_PREFETCH` (if testing async endpoint)

## Test Mode Decision
- Recommended mode: controlled non-production environment with synthetic payload and no PHI/PII.
- Preferred provider mode during load test: deterministic/local (`NLG_GROQ_ENABLED=false`) to avoid external egress.

## GO / NO-GO
- Current decision: **GO with constraints**.
- GO conditions:
  - Target is local/staging/internal environment.
  - Synthetic payload only.
  - No production domain unless explicit override is set.
  - No PHI/PII in requests.
  - External provider egress disabled or explicitly accepted by policy.
- NO-GO conditions:
  - Production URL without explicit override.
  - Real patient data in payload.
  - Missing API key for protected endpoint.
  - Core dependencies down (`/health/ready` degraded due to required services unavailable).
