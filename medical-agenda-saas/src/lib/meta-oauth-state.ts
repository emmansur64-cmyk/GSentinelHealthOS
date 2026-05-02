import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret() {
  const secret = process.env.JWT_SECRET || process.env.META_APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET or META_APP_SECRET is required for OAuth state");
  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function createMetaOAuthState(input: { tenantId: string; userId: string }) {
  const payload = Buffer.from(JSON.stringify({
    tenantId: input.tenantId,
    userId: input.userId,
    iat: Date.now(),
  }), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function verifyMetaOAuthState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    tenantId?: string;
    userId?: string;
    iat?: number;
  };
  if (!decoded.tenantId || !decoded.userId || !decoded.iat) return null;
  if (Date.now() - decoded.iat > STATE_TTL_MS) return null;

  return { tenantId: decoded.tenantId, userId: decoded.userId };
}
