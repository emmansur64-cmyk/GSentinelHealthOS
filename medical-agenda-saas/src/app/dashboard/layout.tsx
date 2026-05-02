import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DashboardSessionHydrator } from "@/components/dashboard-session-hydrator";
import { SystemNotificationBanner } from "@/components/system-notification-banner";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) redirect("/login");

  return (
    <DashboardSessionHydrator user={{ ...user, tenant_id: authUser.tenantId }}>
      <AppShell>
        <SystemNotificationBanner tenantId={authUser.tenantId} />
        {children}
      </AppShell>
    </DashboardSessionHydrator>
  );
}
