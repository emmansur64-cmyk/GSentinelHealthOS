import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const KEY_BYTES = 32;

function getEncryptionKey() {
  const raw = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY or ENCRYPTION_KEY is required");

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  return key;
}

export function encryptText(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

export function decryptText(encryptedText: string) {
  if (!encryptedText.startsWith(PREFIX)) {
    throw new Error("Encrypted value has an invalid format");
  }

  const payload = Buffer.from(encryptedText.slice(PREFIX.length), "base64url");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
