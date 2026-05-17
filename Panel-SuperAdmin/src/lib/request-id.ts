export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sa-${crypto.randomUUID()}`
  }

  // Node.js fallback.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('node:crypto') as { randomBytes: (size: number) => Buffer }
    return `sa-${nodeCrypto.randomBytes(16).toString('hex')}`
  } catch {
    return `sa-fallback-${Math.random().toString(36).slice(2, 18)}`
  }
}
