import { redirect } from "next/navigation";

import { PredictiveMetricsDashboard } from "@/components/admin/predictive-metrics-dashboard";
import { getAuthenticatedUser } from "@/lib/server-auth";

export default async function DashboardAdminPrediccionesPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (String(user.role).toLowerCase() !== "admin") redirect("/dashboard");

  return <PredictiveMetricsDashboard />;
}
