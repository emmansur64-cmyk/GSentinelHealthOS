export interface AiConfig {
  provider: string;
  fallbackProvider: string;
}

export default (): AiConfig => ({
  provider: process.env.AI_PROVIDER ?? 'groq',
  fallbackProvider: process.env.AI_FALLBACK_PROVIDER ?? 'fallback',
});
