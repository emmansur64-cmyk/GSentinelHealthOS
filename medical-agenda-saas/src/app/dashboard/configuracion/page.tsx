"use client";

import dynamic from "next/dynamic";

const Settings = dynamic(() => import("@/components/pages/Settings"), {
  ssr: false,
});

export default function DashboardConfiguracionPage() {
  return <Settings />;
}
