import { redirect } from "next/navigation";

import { DoctorChatHub } from "@/components/doctor-chat-hub";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";

export default async function DoctorChatPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!hasRole(user, ["doctor", "medico"])) redirect("/dashboard");

  const doctor = await prisma.doctorProfile.findUnique({
    where: { user_id: user.userId },
    select: { user_id: true },
  });

  if (!doctor) {
    return <p className="text-sm text-red-600">No existe DoctorProfile para este usuario.</p>;
  }

  return <DoctorChatHub doctorId={doctor.user_id} />;
}
