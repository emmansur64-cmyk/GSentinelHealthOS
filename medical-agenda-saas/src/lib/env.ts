import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_HOURS: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // WhatsApp Cloud API
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
});

export function getEnv() {
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN_HOURS: process.env.JWT_EXPIRES_IN_HOURS,
    NODE_ENV: process.env.NODE_ENV,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
  });

  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  return parsed.data;
}

export function getJwtExpiresInHours() {
  const value = Number(process.env.JWT_EXPIRES_IN_HOURS ?? "24");
  return Number.isFinite(value) && value > 0 ? value : 24;
}