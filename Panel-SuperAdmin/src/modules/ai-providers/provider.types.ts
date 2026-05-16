export type ProviderName = 'groq' | 'openai' | 'anthropic'
export type ProviderStatus = 'configured' | 'unconfigured' | 'error' | 'degraded'

export interface AIProvider {
  name: ProviderName
  label: string
  status: ProviderStatus
  model?: string
  timeoutMs?: number
  hasFallback: boolean
  lastCheckedAt?: string
  error?: string
}

export interface ProviderConfigUpdate {
  name: ProviderName
  model?: string
  timeoutMs?: number
  hasFallback?: boolean
}
