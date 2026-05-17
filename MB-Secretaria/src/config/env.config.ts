export interface EnvConfig {
  port: number;
  nodeEnv: string;
  groqSecretaria: {
    apiKeyConfigured: boolean;
    modelConfigured: boolean;
  };
}

export default (): EnvConfig => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  groqSecretaria: {
    apiKeyConfigured: Boolean(String(process.env.GROQ_API_KEY_SECRETARIA ?? '').trim()),
    modelConfigured: Boolean(String(process.env.GROQ_MODEL_SECRETARIA ?? '').trim()),
  },
});
