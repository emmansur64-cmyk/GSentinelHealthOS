import { LoaderCircle } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-slate-700">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      Cargando aplicacion...
    </div>
  );
}
