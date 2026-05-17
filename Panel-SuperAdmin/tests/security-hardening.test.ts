import test from 'node:test'
import assert from 'node:assert/strict'

import {
  _resetLoginAttemptGuardForTests,
  clearLoginAttempts,
  getLoginAttemptDecision,
  registerLoginFailure,
} from '../src/lib/login-attempt-guard'
import {
  sanitizeAuditMetadata,
  sanitizeTenantUpdatePayloadForLog,
} from '../src/lib/security-sanitizer'
import { validateSuperAdminCredentials } from '../src/lib/super-admin-credentials'
import { createRequestId } from '../src/lib/request-id'
import { readHealthTimeoutMs } from '../src/config/app.config'

test('login blocks after max failed attempts', () => {
  process.env.SUPER_ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS = '60000'
  process.env.SUPER_ADMIN_LOGIN_MAX_ATTEMPTS = '3'
  process.env.SUPER_ADMIN_LOGIN_LOCKOUT_MS = '600000'

  _resetLoginAttemptGuardForTests()
  const ip = '127.0.0.1'
  const email = 'admin@example.com'

  registerLoginFailure(ip, email)
  registerLoginFailure(ip, email)
  registerLoginFailure(ip, email)

  const decision = getLoginAttemptDecision(ip, email)
  assert.equal(decision.allowed, false)
  if (!decision.allowed) {
    assert.ok(decision.retryAfterMs > 0)
  }
})

test('login success can clear counter', () => {
  _resetLoginAttemptGuardForTests()
  const ip = '127.0.0.1'
  const email = 'admin2@example.com'

  registerLoginFailure(ip, email)
  clearLoginAttempts(ip, email)
  const decision = getLoginAttemptDecision(ip, email)
  assert.equal(decision.allowed, true)
})

test('plain password is rejected by default', async () => {
  process.env.SUPER_ADMIN_EMAIL = 'admin@example.com'
  process.env.SUPER_ADMIN_PASSWORD_HASH = ''
  process.env.SUPER_ADMIN_PASSWORD = 'plainpass'
  process.env.SUPER_ADMIN_ALLOW_PLAIN_PASSWORD_FALLBACK = 'false'

  const user = await validateSuperAdminCredentials('admin@example.com', 'plainpass')
  assert.equal(user, null)
})

test('hash is required for bootstrap auth path', async () => {
  process.env.SUPER_ADMIN_EMAIL = 'admin@example.com'
  process.env.SUPER_ADMIN_PASSWORD_HASH = ''
  process.env.SUPER_ADMIN_PASSWORD = ''
  process.env.SUPER_ADMIN_ALLOW_PLAIN_PASSWORD_FALLBACK = 'false'

  const user = await validateSuperAdminCredentials('admin@example.com', 'any')
  assert.equal(user, null)
})

test('client-like credentials do not authenticate in super-admin panel', async () => {
  process.env.SUPER_ADMIN_EMAIL = 'owner@gsentinel.local'
  process.env.SUPER_ADMIN_PASSWORD_HASH = '$2a$12$2ZmXJ5qYid3YR8SyeDjy9u8wP0SRX5pM84N5Yv5A4j6vY2tV3SYJS' // hash of: OwnerPassword#2026
  process.env.SUPER_ADMIN_ALLOW_PLAIN_PASSWORD_FALLBACK = 'false'

  const user = await validateSuperAdminCredentials('cliente@clinic.com', 'clinic-password')
  assert.equal(user, null)
})

test('tenant payload log is sanitized and whitelisted', () => {
  const input = {
    name: 'Tenant A',
    status: 'active',
    password: '123',
    token: 'abc',
    randomField: 'ignore',
  }
  const sanitized = sanitizeTenantUpdatePayloadForLog(input)

  assert.deepEqual(Object.keys(sanitized).sort(), ['name', 'status'])
  assert.equal((sanitized as Record<string, unknown>).password, undefined)
})

test('audit metadata strips sensitive keys', () => {
  const sanitized = sanitizeAuditMetadata({
    action: 'TENANT_UPDATE',
    token: 'secret-token',
    nested: { apiKey: 'x', ok: true },
  })

  assert.equal('token' in sanitized, false)
  const nested = sanitized.nested as Record<string, unknown>
  assert.equal('apiKey' in nested, false)
  assert.equal(nested.ok, true)
})

test('audit metadata huge payload is truncated fallback', () => {
  const huge = {
    items: Array.from({ length: 40 }, (_, i) => ({
      idx: i,
      value: 'x'.repeat(600),
    })),
  }
  const sanitized = sanitizeAuditMetadata(huge)

  assert.equal((sanitized as Record<string, unknown>)._truncated, true)
})

test('request id uses secure format prefix', () => {
  const rid = createRequestId()
  assert.match(rid, /^sa-/)
  assert.ok(rid.length > 10)
})

test('health timeout invalid value falls back to default', () => {
  process.env.HEALTH_CHECK_TIMEOUT_MS = 'not-a-number'
  const timeout = readHealthTimeoutMs()
  assert.equal(timeout, 5000)
})
