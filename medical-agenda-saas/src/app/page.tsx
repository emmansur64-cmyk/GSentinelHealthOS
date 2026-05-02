import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Calendar,
  Users,
  Clock,
  Settings,
  MessageSquare,
  Smartphone,
  FileUp,
  ShieldCheck,
} from "lucide-react";

import { getDashboardRouteByRole } from "@/lib/dashboard-route";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: Calendar,
    title: "Agenda con calendario",
    description:
      "Vista mensual y semanal de turnos por médico. Arrastrar para mover, redimensionar para cambiar duración. Colores por estado: programado, confirmado, cancelado, completado, ausente.",
  },
  {
    icon: Clock,
    title: "Configuración de horarios",
    description:
      "Duración de consulta (10–180 min), buffer entre turnos y horarios laborales configurables por clínica. Validación de disponibilidad y detección de superposición en tiempo real.",
  },
  {
    icon: Users,
    title: "Profesionales y pacientes",
    description:
      "Alta, listado y gestión de médicos y pacientes. Reglas de disponibilidad por día de semana o fecha específica.",
  },
  {
    icon: ShieldCheck,
    title: "Roles y accesos",
    description:
      "Cuatro roles con vistas diferenciadas: admin, doctor, secretaria y recepcionista. Autenticación JWT por tenant.",
  },
  {
    icon: MessageSquare,
    title: "Chat interno para médicos",
    description:
      "Chat disponible en el panel del médico, sin requerir turno seleccionado. Historial borrable desde la interfaz.",
  },
  {
    icon: Smartphone,
    title: "Gateway de WhatsApp",
    description:
      "Servicio independiente integrado con WhatsApp Business API vía webhook. Permite comunicación y notificaciones desde la plataforma.",
  },
  {
    icon: FileUp,
    title: "Importación de agenda",
    description:
      "Módulo para cargar agenda existente desde archivo, disponible desde el panel de administración.",
  },
  {
    icon: Settings,
    title: "API REST documentada",
    description:
      "Backend en FastAPI con documentación automática en /api/docs. Arquitectura multi-tenant. Workers para procesamiento asíncrono de reservas.",
  },
];

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (user) {
    redirect(getDashboardRouteByRole(user.role));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/GSentinelHealthOS.png"
              alt="GSentinelHealth OS"
              width={36}
              height={36}
              className="rounded-md"
            />
            <span className="font-semibold text-lg tracking-tight text-white">
              GSentinelHealth OS
            </span>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Ingresar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <span className="inline-block rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-6">
          medical-agenda-saas
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
          Sistema de agenda médica
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-slate-400 text-lg leading-relaxed">
          Plataforma web para gestión de turnos, profesionales y pacientes en
          clínicas. Roles diferenciados, calendario interactivo y gateway de
          WhatsApp integrado.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Ingresar al sistema
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="text-center text-2xl font-semibold text-white mb-12">
          Qué hace el sistema
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                <Icon size={20} />
              </div>
              <h3 className="font-medium text-white text-sm">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section className="border-t border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-center text-sm font-medium text-slate-500 uppercase tracking-widest mb-8">
            Stack técnico
          </h2>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-mono">
            {[
              "Next.js 15",
              "FastAPI",
              "PostgreSQL",
              "Redis Sentinel",
              "Celery",
              "Python 3.11",
              "Docker Compose",
              "WhatsApp Business API",
              "JWT / multi-tenant",
              "FullCalendar",
              "Tailwind CSS",
              "shadcn/ui",
            ].map((tech) => (
              <span
                key={tech}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>GSentinelHealth OS · {new Date().getFullYear()}</span>
          <Link href="/login" className="hover:text-slate-300 transition-colors">
            Ingresar →
          </Link>
        </div>
      </footer>
    </div>
  );
}
