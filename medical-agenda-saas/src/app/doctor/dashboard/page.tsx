import { redirect } from "next/navigation";

import { DoctorDashboard } from "@/components/doctor-dashboard";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";

export default async function DoctorDashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!hasRole(user, ["doctor", "medico"])) redirect("/dashboard");

  const doctor = await prisma.doctorProfile.findFirst({
    where: { user_id: user.userId, tenant_id: user.tenantId },
    select: { user_id: true },
  });

  if (!doctor) {
    return <p className="text-sm text-red-600">No existe DoctorProfile para este usuario.</p>;
  }

  return <DoctorDashboard doctorId={doctor.user_id} />;
}
