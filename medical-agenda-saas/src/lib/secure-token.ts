import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function getKey() {
  const material = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material || material.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY or JWT_SECRET with at least 32 characters is required");
  }
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

export function decryptSecret(value: string) {
  if (!value.startsWith(PREFIX)) return value;

  const payload = Buffer.from(value.slice(PREFIX.length), "base64url");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
