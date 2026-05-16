export function createRequestId(): string {
  return `sa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
