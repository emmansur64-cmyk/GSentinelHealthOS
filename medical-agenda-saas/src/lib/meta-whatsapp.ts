import { encryptText } from "@/lib/security/encryption";

const DEFAULT_GRAPH_VERSION = "v21.0";

type GraphError = {
  error?: {
    message?: string;
    code?: number;
    type?: string;
  };
};

type TokenResponse = GraphError & {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type BusinessesResponse = GraphError & {
  businesses?: {
    data?: Array<{ id: string; name?: string }>;
  };
};

type WabaResponse = GraphError & {
  data?: Array<{ id: string; name?: string }>;
};

type PhoneNumbersResponse = GraphError & {
  data?: Array<{
    id: string;
    display_phone_number?: string;
    verified_name?: string;
  }>;
};

export function getMetaOAuthConfig() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  const apiVersion = process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;

  if (!appId || !appSecret || !redirectUri) {
    return { ok: false as const, missing: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"].filter((key) => !process.env[key]) };
  }

  return { ok: true as const, appId, appSecret, redirectUri, apiVersion };
}

export function buildMetaOAuthUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    scope: "whatsapp_business_management,whatsapp_business_messaging,business_management",
    state: input.state,
  });
  return `https://www.facebook.com/${DEFAULT_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function readGraphJson<T extends GraphError>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T;
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Meta Graph API error HTTP ${response.status}`);
  }
  return data;
}

export async function exchangeCodeForToken(input: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
  apiVersion: string;
}) {
  const params = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const response = await fetch(`https://graph.facebook.com/${input.apiVersion}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await readGraphJson<TokenResponse>(response);
  if (!data.access_token) throw new Error("Meta did not return access_token");

  return {
    accessToken: data.access_token,
    encryptedAccessToken: encryptText(data.access_token),
    tokenType: data.token_type ?? "bearer",
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

export async function discoverWhatsAppAccount(input: {
  accessToken: string;
  apiVersion: string;
}) {
  const meResponse = await fetch(`https://graph.facebook.com/${input.apiVersion}/me?fields=businesses`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const me = await readGraphJson<BusinessesResponse>(meResponse);
  const businessId = me.businesses?.data?.[0]?.id;
  if (!businessId) throw new Error("No Meta Business found for authorized user");

  const wabaResponse = await fetch(`https://graph.facebook.com/${input.apiVersion}/${businessId}/owned_whatsapp_business_accounts`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const wabas = await readGraphJson<WabaResponse>(wabaResponse);
  const wabaId = wabas.data?.[0]?.id;
  if (!wabaId) throw new Error("No WhatsApp Business Account found for selected business");

  const phoneResponse = await fetch(`https://graph.facebook.com/${input.apiVersion}/${wabaId}/phone_numbers`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const phones = await readGraphJson<PhoneNumbersResponse>(phoneResponse);
  const phone = phones.data?.[0];
  if (!phone?.id) throw new Error("No WhatsApp phone number found for selected WABA");

  return {
    businessId,
    wabaId,
    phoneNumberId: phone.id,
    displayPhoneNumber: phone.display_phone_number ?? phone.verified_name ?? null,
  };
}
