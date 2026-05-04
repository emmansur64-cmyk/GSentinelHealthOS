import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { logServer, logServerError } from "@/lib/server-logger";
import { verifyMetaOAuthState } from "@/lib/meta-oauth-state";
import { discoverWhatsAppAccount, exchangeCodeForToken, getMetaOAuthConfig } from "@/lib/meta-whatsapp";

function redirectToClinicDashboard(request: Request, params: Record<string, string>) {
  const url = new URL("/dashboard/agenda", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error) {
    return redirectToClinicDashboard(request, { whatsapp: "error", reason: "meta_denied" });
  }
  if (!code || !state) {
    return redirectToClinicDashboard(request, { whatsapp: "error", reason: "missing_oauth_params" });
  }

  const verifiedState = verifyMetaOAuthState(state);
  if (!verifiedState) {
    return redirectToClinicDashboard(request, { whatsapp: "error", reason: "invalid_state" });
  }

  const auth = await getAuthenticatedUser();
  if (!auth || auth.tenantId !== verifiedState.tenantId || auth.userId !== verifiedState.userId) {
    return redirectToClinicDashboard(request, { whatsapp: "error", reason: "invalid_tenant" });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: verifiedState.tenantId },
    select: { id: true },
  });
  if (!tenant) {
    return redirectToClinicDashboard(request, { whatsapp: "error", reason: "tenant_not_found" });
  }

  const config = getMetaOAuthConfig();
  if (!config.ok) {
    return redirectToClinicDashboard(request, { whatsapp: "error", reason: "meta_not_configured" });
  }

  try {
    const token = await exchangeCodeForToken({
      code,
      appId: config.appId,
      appSecret: config.appSecret,
      redirectUri: config.redirectUri,
      apiVersion: config.apiVersion,
    });

    const account = await discoverWhatsAppAccount({
      accessToken: token.accessToken,
      apiVersion: config.apiVersion,
    });

    await prisma.clinicWhatsappAccount.upsert({
      where: {
        tenantId_phoneNumberId: {
          tenantId: tenant.id,
          phoneNumberId: account.phoneNumberId,
        },
      },
      create: {
        tenantId: tenant.id,
        clinicId: tenant.id,
        metaBusinessId: account.businessId,
        wabaId: account.wabaId,
        phoneNumberId: account.phoneNumberId,
        displayPhoneNumber: account.displayPhoneNumber,
        accessTokenEncrypted: token.encryptedAccessToken,
        tokenType: token.tokenType,
        expiresAt: token.expiresAt,
        status: account.phoneNumberId ? "connected" : "pending",
        webhookVerified: false,
        isActive: true,
      },
      update: {
        tenantId: tenant.id,
        clinicId: tenant.id,
        metaBusinessId: account.businessId,
        wabaId: account.wabaId,
        displayPhoneNumber: account.displayPhoneNumber,
        accessTokenEncrypted: token.encryptedAccessToken,
        tokenType: token.tokenType,
        expiresAt: token.expiresAt,
        status: account.phoneNumberId ? "connected" : "pending",
        isActive: true,
        lastErrorAt: null,
        lastError: null,
      },
    });

    logServer("info", "meta.oauth.connected", {
      tenant_id: tenant.id,
      business_id: account.businessId,
      waba_id: account.wabaId,
      phone_number_id: account.phoneNumberId,
    });

    return redirectToClinicDashboard(request, { whatsapp: "connected" });
  } catch (caught) {
    logServerError("meta.oauth.callback.failed", caught, { tenant_id: verifiedState.tenantId });

    await prisma.clinicWhatsappAccount.updateMany({
      where: { tenantId: verifiedState.tenantId },
      data: {
        status: "error",
        lastErrorAt: new Date(),
        lastError: caught instanceof Error ? caught.message.slice(0, 1000) : "Meta OAuth error",
      },
    });

    return redirectToClinicDashboard(request, { whatsapp: "error", reason: "callback_failed" });
  }
}

