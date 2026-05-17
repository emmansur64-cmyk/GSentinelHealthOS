import http from 'k6/http';
import { check } from 'k6';

import { buildHeaders, loadConfig, loadPayload, parseDurationToSeconds } from './common.js';

const config = loadConfig({
  defaultVus: 1000,
  defaultDuration: '5m',
  defaultRampUp: '2m',
  defaultRampDown: '1m',
  defaultTimeoutMs: 30000,
  defaultExpectedStatus: 200,
});
const payload = loadPayload(config.payloadPath);

const rampUpSeconds = parseDurationToSeconds(config.rampUp, 120);
const sustainedSeconds = parseDurationToSeconds(config.duration, 300);
const rampDownSeconds = parseDurationToSeconds(config.rampDown, 60);

export const options = {
  scenarios: {
    chat_high_concurrency: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: config.rampUp, target: config.vus },
        { duration: config.duration, target: config.vus },
        { duration: config.rampDown, target: 1 },
      ],
      gracefulRampDown: '30s',
      tags: {
        endpoint: config.endpoint,
        test_type: 'high_concurrency_1000plus',
      },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000', 'p(99)<15000'],
    checks: ['rate>0.99'],
    iteration_duration: ['p(99)<30000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

export default function () {
  const response = http.post(config.fullUrl, JSON.stringify(payload), {
    headers: buildHeaders(config),
    timeout: `${config.timeoutMs}ms`,
    tags: { endpoint: config.endpoint },
  });

  const isExpected = response.status === config.expectedStatus;
  const no5xx = response.status < 500;

  let bodyIsJson = true;
  try {
    const parsed = response.json();
    bodyIsJson = parsed !== null && typeof parsed === 'object';
  } catch (_) {
    bodyIsJson = false;
  }

  check(response, {
    'status matches expected': () => isExpected,
    'no 5xx': () => no5xx,
    'response is JSON': () => bodyIsJson,
  });
}

export function handleSummary(data) {
  const meta = {
    target_url: config.fullUrl,
    endpoint: config.endpoint,
    vus_target: config.vus,
    ramp_up_seconds: rampUpSeconds,
    sustained_seconds: sustainedSeconds,
    ramp_down_seconds: rampDownSeconds,
    timeout_ms: config.timeoutMs,
    expected_status: config.expectedStatus,
    thresholds_note: 'Initial thresholds for infrastructure validation only; not a clinical guarantee.',
  };

  return {
    stdout: JSON.stringify({ meta, metrics: data.metrics }, null, 2),
  };
}
