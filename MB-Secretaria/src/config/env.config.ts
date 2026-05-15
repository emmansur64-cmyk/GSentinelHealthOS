export interface EnvConfig {
  port: number;
  nodeEnv: string;
}

export default (): EnvConfig => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
});
