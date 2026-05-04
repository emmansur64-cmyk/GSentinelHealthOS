import { redirect } from "next/navigation";

import { getDashboardRouteByRole } from "@/lib/dashboard-route";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthenticatedUser();
  redirect(user ? getDashboardRouteByRole(user.role) : "/login");
}
