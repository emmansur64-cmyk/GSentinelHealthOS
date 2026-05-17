import http from 'k6/http';
import { check, fail } from 'k6';

import { buildHeaders, loadConfig, loadPayload } from './common.js';

const config = loadConfig({
  defaultVus: 1,
  defaultDuration: '5s',
  defaultRampUp: '0s',
  defaultRampDown: '0s',
  defaultTimeoutMs: 30000,
  defaultExpectedStatus: 200,
});
const payload = loadPayload(config.payloadPath);

const maxLatencyMs = Number(__ENV.MB_CHAT_SMOKE_MAX_LATENCY_MS || 10000);

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    http_req_duration: [`p(95)<${maxLatencyMs}`],
  },
};

export default function () {
  const response = http.post(config.fullUrl, JSON.stringify(payload), {
    headers: buildHeaders(config),
    timeout: `${config.timeoutMs}ms`,
    tags: { scenario: 'smoke', endpoint: config.endpoint },
  });

  if (response.status >= 500) {
    fail(`Smoke failed with 5xx status: ${response.status}`);
  }

  const statusAllowedDefault = [200, 201].includes(response.status);
  const statusOk = response.status === config.expectedStatus || statusAllowedDefault;

  let jsonBody = null;
  let jsonValid = true;
  try {
    jsonBody = response.json();
    jsonValid = jsonBody !== null && typeof jsonBody === 'object';
  } catch (_) {
    jsonValid = false;
  }

  const latencyBudgetSeconds = maxLatencyMs / 1000;

  check(response, {
    'status is expected or 200/201': () => statusOk,
    'response is JSON': () => jsonValid,
    'no 5xx': () => response.status < 500,
    'latency within smoke budget': (r) => r.timings.duration <= maxLatencyMs,
    'response not timeout-limited': (r) => r.timings.duration <= config.timeoutMs,
  });

  if (!jsonValid) {
    fail('Smoke failed: response is not valid JSON.');
  }

  if (response.timings.duration > config.timeoutMs) {
    fail(`Smoke failed: request exceeded timeout (${config.timeoutMs}ms).`);
  }

  if (response.timings.duration > latencyBudgetSeconds * 1000) {
    fail(`Smoke failed: latency ${response.timings.duration}ms exceeded ${maxLatencyMs}ms.`);
  }
}
