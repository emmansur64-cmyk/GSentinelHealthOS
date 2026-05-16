function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback
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
    timeoutMs: parseInt(optionalEnv('HEALTH_CHECK_TIMEOUT_MS', '5000')),
  },
} as const

export type AppConfig = typeof appConfig
