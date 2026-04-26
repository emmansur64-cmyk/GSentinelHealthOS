import { NavLink } from "react-router-dom";
import { CalendarDays, ChartColumn, LayoutDashboard, Settings, Stethoscope, Users } from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", to: "/overview", icon: LayoutDashboard },
  { label: "Agenda", to: "/agenda", icon: CalendarDays },
  { label: "Profesionales", to: "/profesionales", icon: Stethoscope },
  { label: "Pacientes", to: "/pacientes", icon: Users },
  { label: "Reportes", to: "/reportes", icon: ChartColumn },
  { label: "Configuracion", to: "/configuracion", icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/50 transition-opacity duration-200 lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-72 border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-0 lg:w-64 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-900">Navegacion</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
