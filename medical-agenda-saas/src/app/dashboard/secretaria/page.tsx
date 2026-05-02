import { redirect } from "next/navigation";

import { SecretariaDashboard } from "@/components/secretaria-dashboard";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";

export default async function SecretariaPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!hasRole(user, ["secretaria", "recepcionista", "receptionist", "clinic_owner", "clinic_admin", "admin"])) {
    redirect("/dashboard");
  }

  return <SecretariaDashboard />;
}