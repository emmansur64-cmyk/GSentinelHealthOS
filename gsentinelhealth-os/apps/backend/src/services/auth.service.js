import { HttpError } from "../lib/http-error.js";

export function login({ identifier, password }) {
  const expectedUser = process.env.AUTH_USERNAME;
  const expectedPassword = process.env.AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    throw new HttpError(503, "Auth service misconfigured: AUTH_USERNAME/AUTH_PASSWORD required");
  }

  if (identifier !== expectedUser || password !== expectedPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  return {
    token: "simple-dev-token",
    user: {
      id: "admin",
      name: "System Admin",
      role: "admin",
    },
  };
}
