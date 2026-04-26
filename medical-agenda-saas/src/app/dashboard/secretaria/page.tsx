import { redirect } from "next/navigation";

import { SecretariaDashboard } from "@/components/secretaria-dashboard";
import { getAuthenticatedUser } from "@/lib/server-auth";

export default async function SecretariaPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "secretaria") redirect("/dashboard");

  return <SecretariaDashboard />;
}