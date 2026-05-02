import { fail, ok } from "@/lib/api-response";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { createMetaOAuthState } from "@/lib/meta-oauth-state";
import { buildMetaOAuthUrl, getMetaOAuthConfig } from "@/lib/meta-whatsapp";

export async function GET() {
  const ctx = await requireClinicApi();
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const config = getMetaOAuthConfig();
  if (!config.ok) {
    return fail("Meta OAuth no configurado", 503, { missing: config.missing });
  }

  return ok({
    url: buildMetaOAuthUrl({
      appId: config.appId,
      redirectUri: config.redirectUri,
      state: createMetaOAuthState({ tenantId: ctx.clinic.id, userId: ctx.auth.userId }),
    }),
  });
}
