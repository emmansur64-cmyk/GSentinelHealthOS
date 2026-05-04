import { AdminShell } from "@/components/admin/admin-shell";
import { requireSuperAdminPage } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
