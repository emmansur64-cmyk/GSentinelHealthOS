import Link from "next/link";
import { Bell, CalendarDays, LayoutDashboard, Settings, Stethoscope, Users } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/clinic/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/clinic/agenda", icon: CalendarDays },
  { label: "Pacientes", href: "/dashboard/pacientes", icon: Users },
  { label: "Medicos", href: "/dashboard/profesionales", icon: Stethoscope },
  { label: "Usuarios", href: "/clinic/users", icon: Users },
  { label: "Configuracion", href: "/dashboard/configuracion", icon: Settings },
];

export function ClinicShell({
  clinicName,
  children,
}: {
  clinicName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col px-5 py-6">
          <Link href="/clinic/dashboard" className="block">
            <p className="text-sm font-semibold text-slate-950">GSentinelHealthOS</p>
            <p className="mt-1 text-xs text-slate-500">{clinicName}</p>
          </Link>
          <nav className="mt-8 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Datos aislados por clinic_id. No se muestran datos de otras clinicas.
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-col justify-center gap-3 px-5 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Panel clinico</p>
                <h1 className="text-xl font-semibold text-slate-950">{clinicName}</h1>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
                <Bell className="h-3.5 w-3.5" />
                Operativo
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export { WhatsappConnectButton } from "@/components/clinic/whatsapp-connect-button";
