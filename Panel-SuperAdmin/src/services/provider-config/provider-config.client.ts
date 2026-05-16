import type { AIProvider, ProviderName } from '@/modules/ai-providers/provider.types'

// Resolve Groq status by checking the env key is present and non-empty.
// TODO: persist per-tenant provider config to DB; this is the bootstrap check only.
function resolveGroqStatus(): AIProvider {
  const key = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
  const configured = Boolean(key && key !== 'gsk_change_me')

  return {
    name: 'groq',
    label: 'Groq (LLaMA)',
    status: configured ? 'configured' : 'unconfigured',
    model: configured ? model : undefined,
    timeoutMs: 30000,
    hasFallback: false,
    lastCheckedAt: new Date().toISOString(),
  }
}

export async function getProviderStatus(): Promise<AIProvider[]> {
  const groq = resolveGroqStatus()

  // TODO: add OpenAI and Anthropic provider checks when those keys are wired
  const openai: AIProvider = {
    name: 'openai',
    label: 'OpenAI',
    status: 'unconfigured',
    hasFallback: false,
    lastCheckedAt: new Date().toISOString(),
  }

  const anthropic: AIProvider = {
    name: 'anthropic',
    label: 'Anthropic',
    status: 'unconfigured',
    hasFallback: false,
    lastCheckedAt: new Date().toISOString(),
  }

  return [groq, openai, anthropic]
}

export function getProviderByName(name: ProviderName): Promise<AIProvider | null> {
  return getProviderStatus().then((providers) => providers.find((p) => p.name === name) ?? null)
}
