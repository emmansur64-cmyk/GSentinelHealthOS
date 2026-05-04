import { createHash, randomBytes } from "node:crypto";

import type { ClinicWhatsappAccount } from "@prisma/client";

export const PLATFORM_WHATSAPP_ROLES = ["clinic_owner", "clinic_admin", "admin"] as const;

export const PLATFORM_WHATSAPP_AUDIT = {
  registerNumber: "REGISTER_WHATSAPP_NUMBER",
  startAuth: "START_META_AUTH",
  authSuccess: "META_AUTH_SUCCESS",
  authError: "META_AUTH_ERROR",
  disconnect: "DISCONNECT_WHATSAPP",
} as const;

export function isValidE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export function normalizeE164Phone(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function maskIdentifier(value?: string | null) {
  if (!value) return null;
  if (value.length <= 6) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function createOAuthStateValue() {
  return randomBytes(32).toString("base64url");
}

export function hashOAuthState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function resolveWhatsappStatus(account?: Pick<ClinicWhatsappAccount, "status" | "accessTokenEncrypted" | "expiresAt" | "registeredPhoneNumber" | "displayPhoneNumber"> | null) {
  if (!account || (!account.registeredPhoneNumber && !account.displayPhoneNumber)) return "NOT_CONFIGURED";
  if (account.status === "connected" && account.expiresAt && account.expiresAt.getTime() <= Date.now()) return "TOKEN_EXPIRED";
  if (account.status === "connected" && account.accessTokenEncrypted) return "CONNECTED";
  if (account.status === "error") return "AUTHORIZATION_ERROR";
  if (account.status === "disconnected") return "DISCONNECTED";
  return "PENDING_AUTHORIZATION";
}

export function toSafeWhatsappConfig(account: ClinicWhatsappAccount | null) {
  const connectionStatus = resolveWhatsappStatus(account);
  return {
    connectionStatus,
    whatsappPhoneNumber: account?.registeredPhoneNumber ?? account?.displayPhoneNumber ?? null,
    displayPhoneNumber: account?.displayPhoneNumber ?? null,
    lastAuthorizedAt: account?.lastAuthorizedAt?.toISOString() ?? null,
    lastVerifiedAt: account?.lastVerifiedAt?.toISOString() ?? null,
    tokenExpiresAt: account?.expiresAt?.toISOString() ?? null,
    whatsappBusinessAccountIdMasked: maskIdentifier(account?.wabaId),
    whatsappPhoneNumberIdMasked: maskIdentifier(account?.phoneNumberId),
    metaBusinessIdMasked: maskIdentifier(account?.metaBusinessId),
    webhookVerified: account?.webhookVerified ?? false,
    lastError: connectionStatus === "AUTHORIZATION_ERROR" ? account?.lastError ?? null : null,
  };
}
