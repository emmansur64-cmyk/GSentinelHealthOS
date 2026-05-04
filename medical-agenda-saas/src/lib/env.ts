import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().optional(),
  JWT_EXPIRES_IN_HOURS: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // WhatsApp Cloud API
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_BUSINESS_ID: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  META_OAUTH_REDIRECT_URI: z.string().optional(),
  META_GRAPH_VERSION: z.string().optional(),
  META_GRAPH_API_VERSION: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(10),
  WHATSAPP_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  // Groq Vision para analisis preliminar de imagenes medicas/documentos.
  GROQ_IMAGE_ANALYSIS_API_KEY: z.string().optional(),
  GROQ_IMAGE_ANALYSIS_BASE_URL: z.string().default("https://api.groq.com/openai/v1"),
  GROQ_IMAGE_ANALYSIS_MODEL: z.string().default("meta-llama/llama-4-scout-17b-16e-instruct"),
  GROQ_IMAGE_ANALYSIS_MAX_MB: z
    .string()
    .default("10")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 && parsed <= 50;
    }, "GROQ_IMAGE_ANALYSIS_MAX_MB must be a positive number up to 50"),
});

export function getEnv() {
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    JWT_EXPIRES_IN_HOURS: process.env.JWT_EXPIRES_IN_HOURS,
    NODE_ENV: process.env.NODE_ENV,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_BUSINESS_ID: process.env.META_BUSINESS_ID,
    META_REDIRECT_URI: process.env.META_REDIRECT_URI,
    META_OAUTH_REDIRECT_URI: process.env.META_OAUTH_REDIRECT_URI,
    META_GRAPH_VERSION: process.env.META_GRAPH_VERSION,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    WHATSAPP_TOKEN_ENCRYPTION_KEY: process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    GROQ_IMAGE_ANALYSIS_API_KEY: process.env.GROQ_IMAGE_ANALYSIS_API_KEY,
    GROQ_IMAGE_ANALYSIS_BASE_URL: process.env.GROQ_IMAGE_ANALYSIS_BASE_URL,
    GROQ_IMAGE_ANALYSIS_MODEL: process.env.GROQ_IMAGE_ANALYSIS_MODEL,
    GROQ_IMAGE_ANALYSIS_MAX_MB: process.env.GROQ_IMAGE_ANALYSIS_MAX_MB,
  });

  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  const nextAuthIsEnabled = Boolean(parsed.data.NEXTAUTH_URL?.trim()) || process.env.NEXTAUTH_ENABLED === "true";
  if (nextAuthIsEnabled && !parsed.data.NEXTAUTH_SECRET?.trim()) {
    throw new Error("Invalid environment: NEXTAUTH_SECRET is required when NextAuth is enabled");
  }

  return parsed.data;
}

export function getJwtExpiresInHours() {
  const value = Number(process.env.JWT_EXPIRES_IN_HOURS ?? "24");
  return Number.isFinite(value) && value > 0 ? value : 24;
}

export function getGroqImageAnalysisConfig() {
  const env = getEnv();
  const apiKey =
    env.GROQ_IMAGE_ANALYSIS_API_KEY ??
    process.env.DOCTOR_CHAT_GROQ_API_KEY ??
    process.env.GROQ_API_KEY ??
    process.env.DOCUMENT_AI_API_KEY ??
    "";

  return {
    apiKey: apiKey.trim(),
    baseUrl: env.GROQ_IMAGE_ANALYSIS_BASE_URL.replace(/\/+$/, ""),
    model: env.GROQ_IMAGE_ANALYSIS_MODEL,
    maxBytes: Math.floor(Number(env.GROQ_IMAGE_ANALYSIS_MAX_MB) * 1024 * 1024),
  };
}
