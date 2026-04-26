"use client";

import dynamic from "next/dynamic";

const ImportAgenda = dynamic(() => import("@/components/pages/ImportAgenda"), {
  ssr: false,
});

export default function DashboardImportAgendaPage() {
  return <ImportAgenda />;
}
