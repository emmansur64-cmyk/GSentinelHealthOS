import Image from "next/image";

import { WhatsappConnectButton } from "@/components/clinic/clinic-shell";
import { prisma } from "@/lib/prisma";
import { requireClinicPage } from "@/lib/clinic-auth";

export default async function ClinicDashboardPage() {
  const { clinic } = await requireClinicPage();
  const clinicId = clinic.id;
  const [whatsappRows, appointments, patients, doctors] = await Promise.all([
    prisma.$queryRaw<Array<{ status: string; display_phone_number: string | null; phone_number_id: string | null; waba_id: string | null }>>`
      SELECT status::text AS status, display_phone_number, phone_number_id, waba_id
      FROM clinic_whatsapp_accounts
      WHERE tenant_id = ${clinicId} AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `,
    prisma.$queryRaw<Array<{ id: string; patient_name: string | null; doctor_name: string | null; datetime: Date; status: string }>>`
      SELECT a.id, p.name AS patient_name, u.name AS doctor_name, a.datetime, a.status::text AS status
      FROM appointments a
      LEFT JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
      LEFT JOIN users u ON u.id = a.doctor_id AND u.tenant_id = a.tenant_id
      WHERE a.tenant_id = ${clinicId} AND a.datetime >= CURRENT_DATE AND a.deleted_at IS NULL
      ORDER BY a.datetime ASC
      LIMIT 8
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; phone: string; created_at: Date }>>`
      SELECT id, name, phone, created_at FROM patients
      WHERE tenant_id = ${clinicId}
      ORDER BY created_at DESC
      LIMIT 6
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; specialty: string }>>`
      SELECT u.id, u.name, dp.specialty
      FROM doctor_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.tenant_id = ${clinicId}
      ORDER BY u.name ASC
      LIMIT 8
    `,
  ]);
  const whatsapp = whatsappRows[0] ?? { status: "pending", display_phone_number: null, phone_number_id: null, waba_id: null };
  const normalizedStatus = String(whatsapp.status || "pending");
  const isConnected = normalizedStatus.toLowerCase() === "connected";
  const whatsappStatusLabel = isConnected ? "Conectado" : normalizedStatus.toLowerCase() === "error" ? "Con error" : "Pendiente";

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="WhatsApp" value={whatsappStatusLabel} />
        <Metric label="Turnos proximos" value={String(appointments.length)} />
        <Metric label="Pacientes recientes" value={String(patients.length)} />
        <Metric label="Medicos configurados" value={String(doctors.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Image
              src="/logos/whatsapp-business.svg"
              alt="WhatsApp Business"
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl border border-slate-200"
            />
            <div>
              <h2 className="text-lg font-semibold">WhatsApp Business</h2>
              <p className="mt-1 text-sm font-medium text-slate-700">Estado: {whatsappStatusLabel}</p>
              <p className="mt-1 text-xs text-slate-500">
                {isConnected ? `Numero: ${whatsapp.display_phone_number ?? whatsapp.phone_number_id ?? "Configurado"}` : "Sin numero conectado"}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <WhatsappConnectButton />
          </div>
        </div>

        <Panel title="Agenda del dia y proximos turnos">
          {appointments.map((item) => (
            <Row key={item.id} title={item.patient_name ?? "Paciente"} detail={`${item.doctor_name ?? "Medico"} · ${new Date(item.datetime).toLocaleString("es-AR")} · ${item.status}`} />
          ))}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Pacientes recientes">{patients.map((item) => <Row key={item.id} title={item.name} detail={`${item.phone} · ${new Date(item.created_at).toLocaleDateString("es-AR")}`} />)}</Panel>
        <Panel title="Medicos y especialidades">{doctors.map((item) => <Row key={item.id} title={item.name} detail={item.specialty} />)}</Panel>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-base font-semibold">{title}</h2><div className="space-y-2">{children}</div></div>;
}

function Row({ title, detail }: { title: string; detail: string }) {
  return <div className="border-b border-slate-100 py-2 last:border-0"><p className="text-sm font-medium text-slate-900">{title}</p><p className="text-xs text-slate-500">{detail}</p></div>;
}
