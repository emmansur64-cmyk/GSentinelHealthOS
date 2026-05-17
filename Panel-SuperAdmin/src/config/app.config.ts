function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export function readHealthTimeoutMs(): number {
  const fallback = 5000
  const min = 500
  const max = 30000
  const raw = optionalEnv('HEALTH_CHECK_TIMEOUT_MS', String(fallback))
  const parsed = Number.parseInt(raw, 10)

  if (!Number.isFinite(parsed)) {
    console.warn(`[panel-super-admin] Invalid HEALTH_CHECK_TIMEOUT_MS="${raw}", using ${fallback}`)
    return fallback
  }

  if (parsed < min) return min
  if (parsed > max) return max
  return parsed
}

export const appConfig = {
  services: {
    mbChat: optionalEnv('MBCHAT_INTERNAL_URL', 'http://mb-chat:3001'),
    mbSecretaria: optionalEnv('MBSECRETARIA_INTERNAL_URL', 'http://mb-secretaria:3002'),
    mbWhatsapp: optionalEnv('MBWHATSAPP_INTERNAL_URL', 'http://mb-whatsapp:3003'),
    brainCore: optionalEnv('BRAIN_INTERNAL_URL', 'http://brain:8001'),
    agendaApi: optionalEnv('AGENDA_API_INTERNAL_URL', 'http://api:8000'),
  },
  health: {
    timeoutMs: readHealthTimeoutMs(),
  },
} as const

export type AppConfig = typeof appConfig
