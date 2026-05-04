import { ClinicShell } from "@/components/clinic/clinic-shell";
import { requireClinicPage } from "@/lib/clinic-auth";

export const dynamic = "force-dynamic";

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const { clinic } = await requireClinicPage();
  return <ClinicShell clinicName={clinic.nombre}>{children}</ClinicShell>;
}
