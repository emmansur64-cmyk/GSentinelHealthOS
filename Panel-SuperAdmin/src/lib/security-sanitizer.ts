const SENSITIVE_KEY_PATTERNS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'jwt',
  'bearer',
  'email',
  'phone',
  'telefono',
]

const ALLOWED_TENANT_CHANGE_KEYS = new Set([
  'name',
  'slug',
  'status',
  'plan',
  'clinicCount',
  'userCount',
])

const MAX_STRING = 256
const MAX_ARRAY_ITEMS = 20
const MAX_DEPTH = 4
const MAX_OBJECT_KEYS = 50
const MAX_METADATA_CHARS = 4096

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern))
}

function truncateString(input: string): string {
  if (input.length <= MAX_STRING) return input
  return `${input.slice(0, MAX_STRING)}...[truncated]`
}

function sanitizeUnknown(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[max-depth]'
  if (value === null) return null
  if (typeof value === 'string') return truncateString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeUnknown(item, depth + 1))

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    let count = 0

    for (const [key, nested] of Object.entries(obj)) {
      if (count >= MAX_OBJECT_KEYS) break
      if (isSensitiveKey(key)) continue
      out[key] = sanitizeUnknown(nested, depth + 1)
      count += 1
    }
    return out
  }

  return String(value)
}

export function sanitizeTenantUpdatePayloadForLog(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const obj = payload as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (!ALLOWED_TENANT_CHANGE_KEYS.has(key)) continue
    out[key] = sanitizeUnknown(value, 0)
  }
  return out
}

export function sanitizeAuditMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}

  const sanitized = sanitizeUnknown(metadata, 0)
  const asObject = sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {}

  const serialized = JSON.stringify(asObject)
  if (serialized.length <= MAX_METADATA_CHARS) return asObject

  return {
    _truncated: true,
    _originalSize: serialized.length,
    preview: truncateString(serialized),
  }
}

