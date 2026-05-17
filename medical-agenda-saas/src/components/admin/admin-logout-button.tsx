"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { isSuperAdminDirectAccessEnabled } from "@/lib/super-admin-direct-access";

export function AdminLogoutButton() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await logout();
    router.replace(isSuperAdminDirectAccessEnabled() ? "/admin" : "/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleLogout} disabled={pending} className="gap-2">
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Cerrar sesion
    </Button>
  );
}
