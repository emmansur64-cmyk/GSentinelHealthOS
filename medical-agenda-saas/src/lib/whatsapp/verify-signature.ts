import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma X-Hub-Signature-256 de Meta.
 * Usa timing-safe comparison para evitar timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature || !appSecret) return false;

  const expected = "sha256=" +
    createHmac("sha256", appSecret)
      .update(typeof rawBody === "string" ? rawBody : rawBody)
      .digest("hex");

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
