"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BrainCircuit,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  Stethoscope,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const isAdmin = user?.role === "admin";
  const isMedico = user?.role === "doctor" || user?.role === "medico";
  const isRecepcion = user?.role === "secretaria" || user?.role === "recepcionista";

  const roleLabel = isAdmin ? "Administracion" : isMedico ? "Medico" : "Recepcion";

  const navItems = [
    { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
    { label: "Agenda", href: "/dashboard/agenda", icon: CalendarDays },
    ...(isMedico ? [{ label: "Panel Doctor", href: "/dashboard/doctor", icon: Stethoscope }] : []),
    ...(isMedico ? [] : [{ label: "Pacientes", href: "/dashboard/pacientes", icon: UserRound }]),
    ...(isAdmin || isRecepcion ? [{ label: "Profesionales", href: "/dashboard/profesionales", icon: Stethoscope }] : []),
    ...(isAdmin || isRecepcion ? [{ label: "Importar Agenda", href: "/dashboard/importar-agenda", icon: Upload }] : []),
    ...(isAdmin ? [{ label: "Configuracion", href: "/dashboard/configuracion", icon: Settings }] : []),
    ...(isAdmin
      ? [{ label: "IA Predictiva", href: "/dashboard/admin/predicciones", icon: BrainCircuit }]
      : []),
  ];

  const pageLabelByPath: Record<string, string> = {
    "/dashboard/overview": "Overview",
    "/dashboard/agenda": "Agenda",
    "/dashboard/doctor": "Panel Doctor",
    "/dashboard/pacientes": "Pacientes",
    "/dashboard/profesionales": "Profesionales",
    "/dashboard/importar-agenda": "Importar Agenda",
    "/dashboard/configuracion": "Configuracion",
    "/dashboard/admin/predicciones": "IA Predictiva",
  };

  const activePageLabel =
    Object.entries(pageLabelByPath).find(([path]) => pathname === path || pathname?.startsWith(`${path}/`))?.[1] ??
    "Dashboard";

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      toast.error("No se pudo cerrar sesion");
    }
  };

  const handleConnectWhatsApp = async () => {
    try {
      const response = await fetch("/api/meta/oauth/start", { headers: { Accept: "application/json" } });
      const payload = await response.json() as { ok?: boolean; data?: { url?: string }; error?: { message?: string } };
      if (!response.ok || !payload.ok || !payload.data?.url) {
        throw new Error(payload.error?.message || "No se pudo iniciar Meta OAuth");
      }
      window.location.href = payload.data.url;
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo iniciar Meta OAuth");
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900" suppressHydrationWarning>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col px-5 py-6" suppressHydrationWarning>
          <div>
            <Image
              src="/logos/GSentinelHealthOS.png"
              alt="GSentinelHealthOS"
              width={230}
              height={76}
              className="h-auto w-48 object-contain"
              style={{ height: "auto" }}
              priority
            />
            <div suppressHydrationWarning>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Operaciones clinicas</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-500 group-hover:text-slate-700"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" suppressHydrationWarning>
            <p className="text-xs font-medium text-slate-500">Cuenta activa</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{user?.name ?? "Usuario"}</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
            <Button variant="outline" size="sm" onClick={handleLogout} className="mt-3 w-full justify-center">
              <LogOut className="h-4 w-4" />
              Cerrar sesion
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72" suppressHydrationWarning>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-5 lg:px-10" suppressHydrationWarning>
            <div suppressHydrationWarning>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Plataforma</p>
              <h1 className="text-lg font-semibold text-slate-900">{activePageLabel}</h1>
            </div>

            <div className="flex items-center gap-3" suppressHydrationWarning>
              {isAdmin ? (
                <Button variant="outline" size="sm" onClick={handleConnectWhatsApp}>
                  <MessageCircle className="h-4 w-4" />
                  Conectar WhatsApp
                </Button>
              ) : null}
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700" suppressHydrationWarning>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Entorno operativo
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-5 pb-3 lg:hidden" suppressHydrationWarning>
            {navItems.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] px-5 py-6 lg:px-10">
          <div key={pathname} className="page-enter" suppressHydrationWarning>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
