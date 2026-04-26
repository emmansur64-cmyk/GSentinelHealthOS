import { NavLink, Outlet } from "react-router-dom";

import { useAppStore } from "../store/useAppStore";

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/agenda", label: "Agenda" },
  { to: "/pacientes", label: "Pacientes" },
  { to: "/profesionales", label: "Profesionales" },
  { to: "/reportes", label: "Reportes" },
  { to: "/config", label: "Config" },
];

export default function MainLayout() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              Menu
            </button>
            <div>
              <p className="text-sm font-semibold leading-4">GSentinelHealth OS</p>
              <p className="text-xs text-slate-500">Clinical Scheduling &amp; Patient Flow System</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside
          className={`border-r border-slate-200 bg-white p-4 transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-16 left-0 z-30 w-60 lg:static lg:inset-auto lg:w-auto`}
        >
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-[#2563EB] text-white" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Cerrar menu lateral"
            className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="min-h-0 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
