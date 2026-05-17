import Link from "next/link";
import {
  Activity,
  Bell,
  Building2,
  HeartPulse,
  LayoutDashboard,
  MessageCircle,
  ServerCog,
  Users,
  UserPlus,
} from "lucide-react";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Alta cliente", href: "/admin/clientes/nuevo", icon: UserPlus },
  { label: "Clinicas", href: "/admin/clinics", icon: Building2 },
  { label: "Usuarios", href: "/admin/users", icon: Users },
  { label: "Actividad", href: "/admin/activity", icon: Activity },
  { label: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle },
  { label: "Notificaciones", href: "/admin/notifications", icon: Bell },
  { label: "Sistema", href: "/admin/system", icon: ServerCog },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col px-5 py-6">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">GSentinelHealthOS</span>
              <span className="block text-xs text-slate-500">Administracion</span>
            </span>
          </Link>

          <nav className="mt-8 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p>Acceso interno restringido a administradores de plataforma.</p>
            <div className="mt-3">
              <AdminLogoutButton />
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-col justify-center gap-3 px-5 py-3 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Administracion</p>
              <h1 className="text-xl font-semibold text-slate-950">Clientes y operaciones</h1>
            </div>
            <div className="hidden lg:block">
              <AdminLogoutButton />
            </div>
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
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
