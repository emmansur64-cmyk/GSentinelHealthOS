type GuardDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number }

interface AttemptRecord {
  failures: number
  firstFailureAt: number
  lockedUntil: number
}

const attempts = new Map<string, AttemptRecord>()

function readPositiveIntEnv(key: string, defaultValue: number): number {
  const raw = (process.env[key] ?? '').trim()
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue
  return parsed
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase() || 'unknown'
}

function keyFor(ip: string, email: string): string {
  return `${normalizeIp(ip)}::${normalizeEmail(email)}`
}

function nowMs(): number {
  return Date.now()
}

function settings() {
  return {
    windowMs: readPositiveIntEnv('SUPER_ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000),
    maxAttempts: readPositiveIntEnv('SUPER_ADMIN_LOGIN_MAX_ATTEMPTS', 5),
    lockoutMs: readPositiveIntEnv('SUPER_ADMIN_LOGIN_LOCKOUT_MS', 15 * 60 * 1000),
  }
}

function stale(record: AttemptRecord, ts: number, windowMs: number): boolean {
  if (record.lockedUntil > ts) return false
  return ts - record.firstFailureAt > windowMs
}

export function getLoginAttemptDecision(ip: string, email: string): GuardDecision {
  const ts = nowMs()
  const { windowMs } = settings()
  const key = keyFor(ip, email)
  const record = attempts.get(key)

  if (!record) return { allowed: true }

  if (stale(record, ts, windowMs)) {
    attempts.delete(key)
    return { allowed: true }
  }

  if (record.lockedUntil > ts) {
    return { allowed: false, retryAfterMs: record.lockedUntil - ts }
  }

  return { allowed: true }
}

export function registerLoginFailure(ip: string, email: string): { failures: number; lockedUntil: number } {
  const ts = nowMs()
  const { windowMs, maxAttempts, lockoutMs } = settings()
  const key = keyFor(ip, email)
  const current = attempts.get(key)

  let next: AttemptRecord
  if (!current || stale(current, ts, windowMs)) {
    next = {
      failures: 1,
      firstFailureAt: ts,
      lockedUntil: 0,
    }
  } else {
    next = {
      failures: current.failures + 1,
      firstFailureAt: current.firstFailureAt,
      lockedUntil: current.lockedUntil,
    }
  }

  if (next.failures >= maxAttempts) {
    next.lockedUntil = ts + lockoutMs
  }

  attempts.set(key, next)
  return { failures: next.failures, lockedUntil: next.lockedUntil }
}

export function clearLoginAttempts(ip: string, email: string): void {
  attempts.delete(keyFor(ip, email))
}

export function _resetLoginAttemptGuardForTests(): void {
  attempts.clear()
}

