import { redirect } from "next/navigation";

import { getDashboardRouteByRole } from "@/lib/dashboard-route";
import { getAuthenticatedUser } from "@/lib/server-auth";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  redirect(getDashboardRouteByRole(user.role));
}