export interface EnvConfig {
  port: number;
  nodeEnv: string;
  auditRetentionDays: number;
  mongoUri: string;
  mongoDbName: string;
}

export default (): EnvConfig => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS ?? 30),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/metabrain',
  mongoDbName: process.env.MONGODB_DB_NAME ?? 'metabrain',
});
