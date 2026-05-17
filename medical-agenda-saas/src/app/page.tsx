import { redirect } from "next/navigation";

import { getDashboardRouteByRole } from "@/lib/dashboard-route";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { isSuperAdminDirectAccessEnabled } from "@/lib/super-admin-direct-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (!user && isSuperAdminDirectAccessEnabled()) {
    redirect("/admin");
  }
  redirect(user ? getDashboardRouteByRole(user.role) : "/login");
}
