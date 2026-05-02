"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";

type User = {
  id: string;
  tenant_id?: string;
  name: string;
  email: string;
  role: "super_admin" | "clinic_owner" | "clinic_admin" | "admin" | "secretaria" | "receptionist" | "recepcionista" | "doctor" | "medico";
};

export function DashboardSessionHydrator({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    setUser(user);
  }, [setUser, user]);

  return <>{children}</>;
}
