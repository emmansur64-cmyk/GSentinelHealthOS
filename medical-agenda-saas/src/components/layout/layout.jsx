import { useState } from "react";
import { Outlet } from "react-router-dom";

import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ userName, userRole, notificationsSocketUrl }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[#F9FAFB] text-slate-900">
      <div className="flex h-full">
        <Sidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
            userName={userName}
            userRole={userRole}
            notificationsSocketUrl={notificationsSocketUrl}
          />

          <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
