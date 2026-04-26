import { LoaderCircle } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-2 text-slate-700">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      Cargando panel...
    </div>
  );
}
