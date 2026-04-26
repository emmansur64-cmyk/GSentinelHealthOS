import { Menu, ShieldPlus, UserRound } from "lucide-react";

import NotificationsDropdown from "@/components/notifications/NotificationsDropdown";

export default function Header({ onToggleSidebar, userName, userRole, notificationsSocketUrl }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-slate-50">
              <ShieldPlus className="h-5 w-5 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-4 text-slate-900">GSentinelHealth OS</p>
              <p className="text-xs text-slate-500">Clinical Scheduling &amp; Patient Flow System</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <NotificationsDropdown socketUrl={notificationsSocketUrl} />

          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">{userName || "Usuario"}</span>
            <span className="text-emerald-500">|</span>
            <span>{userRole || "Online"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
