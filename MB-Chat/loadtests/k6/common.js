import { fail } from 'k6';

const BLOCKED_HOST_HINTS = [
  'gsentinelhealth.com.ar',
  'api.gsentinelhealth.com.ar',
];

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function parseDurationToSeconds(raw, fallbackSeconds) {
  const value = String(raw || '').trim();
  const match = value.match(/^(\d+)(ms|s|m|h)$/i);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 'ms') return amount / 1000;
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return fallbackSeconds;
}

export function loadConfig({
  defaultVus = 1000,
  defaultDuration = '5m',
  defaultRampUp = '2m',
  defaultRampDown = '1m',
  defaultTimeoutMs = 30000,
  defaultExpectedStatus = 200,
} = {}) {
  const baseUrl = String(__ENV.MB_CHAT_BASE_URL || '').trim();
  const endpoint = String(__ENV.MB_CHAT_LOADTEST_ENDPOINT || '').trim();
  const token = String(__ENV.MB_CHAT_LOADTEST_TOKEN || '').trim();

  if (!baseUrl) fail('MB_CHAT_BASE_URL is required.');
  if (!endpoint) fail('MB_CHAT_LOADTEST_ENDPOINT is required.');

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${normalizedBase}${normalizedEndpoint}`;

  const hostMatch = normalizedBase.match(/^https?:\/\/([^/:?#]+)/i);
  const protocolMatch = normalizedBase.match(/^(https?):\/\//i);
  const host = (hostMatch && hostMatch[1] ? hostMatch[1] : '').toLowerCase();
  const protocol = protocolMatch ? `${protocolMatch[1].toLowerCase()}:` : '';

  const allowProduction = parseBool(__ENV.MB_CHAT_ALLOW_PRODUCTION_LOADTEST, false);

  const blockedByHostHint = BLOCKED_HOST_HINTS.some((hint) => host.includes(hint));
  const looksPublicDomain = host.includes('.') && !host.endsWith('.local') && host !== 'localhost' && !host.startsWith('127.') && host !== '::1';
  const looksProductionLike = blockedByHostHint || (looksPublicDomain && protocol === 'https:');

  if (looksProductionLike && !allowProduction) {
    fail(
      `Blocked by safety guard: target ${fullUrl} looks production/public. ` +
      'Set MB_CHAT_ALLOW_PRODUCTION_LOADTEST=true only with explicit authorization.'
    );
  }

  if (looksProductionLike && allowProduction) {
    console.warn(
      `WARNING: Running load test against production/public-like target ${fullUrl}. ` +
      'Proceeding because MB_CHAT_ALLOW_PRODUCTION_LOADTEST=true.'
    );
  }

  const timeoutMs = Number(__ENV.MB_CHAT_LOADTEST_TIMEOUT_MS || defaultTimeoutMs);
  const expectedStatus = Number(__ENV.MB_CHAT_EXPECTED_STATUS || defaultExpectedStatus);

  const vus = Number(__ENV.MB_CHAT_LOADTEST_VUS || defaultVus);
  const duration = String(__ENV.MB_CHAT_LOADTEST_DURATION || defaultDuration).trim();
  const rampUp = String(__ENV.MB_CHAT_LOADTEST_RAMP_UP || defaultRampUp).trim();
  const rampDown = String(__ENV.MB_CHAT_LOADTEST_RAMP_DOWN || defaultRampDown).trim();

  const payloadPath = __ENV.MB_CHAT_LOADTEST_PAYLOAD_PATH || '../payloads/safe-medical-chat-payload.json';

  return {
    baseUrl,
    endpoint,
    fullUrl,
    token,
    timeoutMs,
    expectedStatus,
    vus,
    duration,
    rampUp,
    rampDown,
    payloadPath,
  };
}

export function loadPayload(payloadPath) {
  let payload;
  try {
    payload = JSON.parse(open(payloadPath));
  } catch (error) {
    fail(`Unable to parse payload JSON at ${payloadPath}: ${String(error)}`);
  }

  if (!payload || typeof payload !== 'object') {
    fail(`Payload at ${payloadPath} must be a JSON object.`);
  }

  return payload;
}

export function buildHeaders(config) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (config.token) {
    headers['X-API-Key'] = config.token;
  }
  return headers;
}
