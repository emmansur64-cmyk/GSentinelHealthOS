"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

import { useNotifications } from "@/hooks/useNotifications";

const TYPE_LABEL = {
  appointment_created: "Turno creado",
  appointment_cancelled: "Turno cancelado",
  appointment_rescheduled: "Turno reprogramado",
};

export default function NotificationsDropdown({ socketUrl }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelId = "notifications-panel";

  const { items, unreadCount, isConnected, error, markAllAsRead, clearAll } = useNotifications({ socketUrl });

  useEffect(() => {
    if (!open) return;
    markAllAsRead();
  }, [open, markAllAsRead]);

  useEffect(() => {
    const onOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onOutsideClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onOutsideClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const connectionLabel = useMemo(() => {
    if (error) return "Desconectado";
    return isConnected ? "En linea" : "Conectando...";
  }, [error, isConnected]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        className="relative inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">Notificaciones</span>

        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[11px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div id={panelId} role="menu" className="absolute right-0 z-30 mt-2 w-[360px] max-w-[92vw] rounded-xl border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.15)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
              <p className={`text-xs ${error ? "text-rose-600" : isConnected ? "text-emerald-600" : "text-slate-500"}`}>
                {connectionLabel}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Marcar todas como leidas"
                onClick={markAllAsRead}
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Vaciar notificaciones"
                onClick={clearAll}
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="rounded-md px-2 py-4 text-center text-sm text-slate-500">Sin notificaciones</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-md border px-3 py-2 text-sm ${item.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{TYPE_LABEL[item.type] ?? "Evento"}</p>
                      <span className="text-[11px] text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{item.message || item.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
