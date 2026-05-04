import { ok } from "@/lib/api-response";
import { getRecentAdminAudit, requireSuperAdminApi } from "@/lib/super-admin";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  return ok(await getRecentAdminAudit(200));
}
