import { NextResponse } from "next/server";

import { logAudit, requestMeta } from "@/lib/audit";
import { discoverWhatsAppAccount, exchangeCodeForToken, getMetaOAuthConfig } from "@/lib/meta-whatsapp";
import { hashOAuthState, PLATFORM_WHATSAPP_AUDIT } from "@/lib/platform-whatsapp";
import { prisma } from "@/lib/prisma";

function redirectToOverview(request: Request, params: Record<string, string>) {
  const url = new URL("/dashboard/overview", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

async function writeAudit(request: Request, input: {
  userId?: string | null;
  action: string;
  entityId?: string | null;
  details?: unknown;
}) {
  const meta = requestMeta(request);
  await logAudit({
    userId: input.userId ?? null,
    action: input.action,
    entity: "ClinicWhatsappAccount",
    entityId: input.entityId ?? null,
    details: input.details,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (denied) return redirectToOverview(request, { whatsapp: "error", reason: "meta_denied" });
  if (!code || !state) return redirectToOverview(request, { whatsapp: "error", reason: "missing_oauth_params" });

  const stateHash = hashOAuthState(state);
  const oauthState = await prisma.platformOAuthState.findUnique({ where: { state_hash: stateHash } });
  if (!oauthState || oauthState.consumed_at || oauthState.expires_at.getTime() <= Date.now()) {
    return redirectToOverview(request, { whatsapp: "error", reason: "invalid_state" });
  }

  await prisma.platformOAuthState.update({
    where: { id: oauthState.id },
    data: { consumed_at: new Date() },
  });

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: { tenantId: oauthState.tenant_id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!account?.registeredPhoneNumber) {
    await writeAudit(request, {
      userId: oauthState.user_id,
      action: PLATFORM_WHATSAPP_AUDIT.authError,
      details: { reason: "missing_registered_phone" },
    });
    return redirectToOverview(request, { whatsapp: "error", reason: "missing_registered_phone" });
  }

  const config = getMetaOAuthConfig();
  if (!config.ok) return redirectToOverview(request, { whatsapp: "error", reason: "meta_not_configured" });

  try {
    const token = await exchangeCodeForToken({
      code,
      appId: config.appId,
      appSecret: config.appSecret,
      redirectUri: config.redirectUri,
      apiVersion: config.apiVersion,
    });

    const discovered = await discoverWhatsAppAccount({
      accessToken: token.accessToken,
      apiVersion: config.apiVersion,
      expectedPhoneNumber: account.registeredPhoneNumber,
    });

    const updated = await prisma.clinicWhatsappAccount.update({
      where: { id: account.id },
      data: {
        clinicId: oauthState.tenant_id,
        metaBusinessId: discovered.businessId,
        wabaId: discovered.wabaId,
        phoneNumberId: discovered.phoneNumberId,
        displayPhoneNumber: discovered.displayPhoneNumber,
        accessTokenEncrypted: token.encryptedAccessToken,
        refreshTokenEncrypted: token.encryptedRefreshToken,
        tokenType: token.tokenType,
        expiresAt: token.expiresAt,
        status: "connected",
        webhookVerified: false,
        isActive: true,
        lastAuthorizedAt: new Date(),
        lastVerifiedAt: new Date(),
        lastErrorAt: null,
        lastError: null,
      },
    });

    await writeAudit(request, {
      userId: oauthState.user_id,
      action: PLATFORM_WHATSAPP_AUDIT.authSuccess,
      entityId: updated.id,
      details: { tenantId: oauthState.tenant_id, phoneNumberId: discovered.phoneNumberId, wabaId: discovered.wabaId },
    });

    return redirectToOverview(request, { whatsapp: "connected" });
  } catch (error) {
    await prisma.clinicWhatsappAccount.update({
      where: { id: account.id },
      data: {
        status: "error",
        lastErrorAt: new Date(),
        lastError: error instanceof Error ? error.message.slice(0, 1000) : "Meta OAuth error",
      },
    });
    await writeAudit(request, {
      userId: oauthState.user_id,
      action: PLATFORM_WHATSAPP_AUDIT.authError,
      entityId: account.id,
      details: { reason: "callback_failed" },
    });
    return redirectToOverview(request, { whatsapp: "error", reason: "callback_failed" });
  }
}
