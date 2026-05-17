export interface GroqSecretariaConfig {
  enabled: boolean;
  apiKey: string;
  apiKeyEnv: 'GROQ_API_KEY_SECRETARIA';
  model: string;
  modelEnv: 'GROQ_MODEL_SECRETARIA';
  baseUrl: string;
  timeoutMs: number;
}

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_TIMEOUT_MS = 12_000;

export function getGroqSecretariaConfig(): GroqSecretariaConfig {
  const apiKey = String(process.env.GROQ_API_KEY_SECRETARIA ?? '').trim();
  const model = String(process.env.GROQ_MODEL_SECRETARIA ?? '').trim();

  return {
    enabled: Boolean(apiKey && model),
    apiKey,
    apiKeyEnv: 'GROQ_API_KEY_SECRETARIA',
    model,
    modelEnv: 'GROQ_MODEL_SECRETARIA',
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}
