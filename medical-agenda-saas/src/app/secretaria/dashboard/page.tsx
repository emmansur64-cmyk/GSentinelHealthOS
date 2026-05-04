import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/server-auth";

export default async function SecretariaDashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  redirect("/dashboard/agenda");
}
