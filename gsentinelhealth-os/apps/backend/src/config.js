import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.BACKEND_PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  authUsername: process.env.AUTH_USERNAME,
  authPassword: process.env.AUTH_PASSWORD,
};
