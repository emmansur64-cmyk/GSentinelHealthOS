import Link from "next/link";

import { ClinicCreateForm } from "@/components/admin/clinic-create-form";

export default function AdminClientOnboardingPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Alta de clientes</p>
          <h2 className="text-2xl font-semibold text-slate-950">Crear clinica y accesos operativos</h2>
          <p className="text-sm text-slate-600">
            Usá este módulo para registrar un cliente real con su usuario dueño y, si corresponde, dejar
            creados los accesos de secretaria y doctor desde el mismo flujo.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/admin/clinics" className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
              Ver clinicas
            </Link>
            <Link href="/admin/users" className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
              Ver usuarios
            </Link>
          </div>
        </div>
      </section>

      <ClinicCreateForm />
    </div>
  );
}