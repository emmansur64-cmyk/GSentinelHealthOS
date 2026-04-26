import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

async function fetchHealth() {
  const response = await api.get("/health");
  return response.data;
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">GSentinelHealth OS</h1>
      <p className="mt-2 text-sm text-slate-500">Clinical Scheduling & Patient Flow System</p>
      <div className="mt-4 text-sm">
        {isLoading && "Verificando backend..."}
        {isError && "No se pudo conectar con el backend."}
        {data && `Backend status: ${data.status}`}
      </div>
    </section>
  );
}
