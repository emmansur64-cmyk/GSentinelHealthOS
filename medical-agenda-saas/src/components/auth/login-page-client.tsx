"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardRouteByRole } from "@/lib/dashboard-route";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";

const loginSchema = z.object({
  identifier: z.email("Ingresa un email valido"),
  password: z.string().min(8, "Minimo 8 caracteres"),
  tenant: z.string().trim().optional(),
});

type AvailableTenant = {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  role: string;
};

type LoginResult = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: "super_admin" | "clinic_owner" | "clinic_admin" | "admin" | "secretaria" | "receptionist" | "recepcionista" | "doctor" | "medico";
};

type ApiLoginPayload = {
  ok?: boolean;
  data?: LoginResult;
  error?: {
    message?: string;
    details?: {
      code?: string;
      tenants?: AvailableTenant[];
    } | null;
  };
};

export default function LoginPageClient() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("");
  const [availableTenants, setAvailableTenants] = useState<AvailableTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ identifier, password, tenant: tenant.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulario invalido");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiLoginPayload;

      if (!response.ok || payload.ok === false || !payload.data) {
        const tenants = payload.error?.details?.tenants ?? [];
        if (response.status === 409 && payload.error?.details?.code === "EMAIL_REQUIRES_CLINIC" && tenants.length > 0) {
          setAvailableTenants(tenants);
          setError("Ese email existe en mas de una clinica. Elegi una para continuar.");
          return;
        }

        throw new Error(payload.error?.message ?? "No se pudo iniciar sesion");
      }

      setAvailableTenants([]);
      setUser(payload.data);
      toast.success("Sesion iniciada");
      const targetRoute = getDashboardRouteByRole(payload.data.role);
      router.replace(targetRoute);
      router.refresh();

      // Fallback defensivo: asegura navegacion completa aunque el router cliente falle.
      setTimeout(() => {
        if (window.location.pathname === "/login") {
          window.location.assign(targetRoute);
        }
      }, 250);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error de red al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl lg:grid-cols-[1fr_440px]">
        <section className="relative flex flex-col justify-between overflow-hidden border-b border-slate-200 bg-slate-950 p-8 text-white lg:border-b-0 lg:border-r">
          <div>
            <div className="relative inline-flex rounded-md bg-white p-4 shadow-sm ring-1 ring-white/10">
              <Image
                src="/logos/GSentinelHealthOS.png"
                alt="GSentinelHealthOS"
                width={360}
                height={120}
                priority
                className="h-auto w-72 object-contain"
                style={{ height: "auto" }}
              />
            </div>
            <div className="relative mt-10 max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Acceso al panel clinico</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white">GSentinelHealthOS</h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Ingresa con tu cuenta autorizada para administrar tu clinica, agenda y equipo medico.
              </p>
            </div>
          </div>

          <div className="relative mt-10 grid gap-3 text-sm text-slate-300 sm:grid-cols-3 lg:grid-cols-1">
            <div className="border-t border-white/15 pt-3">Agenda por clinica</div>
            <div className="border-t border-white/15 pt-3">Roles y permisos</div>
            <div className="border-t border-white/15 pt-3">WhatsApp Business</div>
          </div>
        </section>

        <Card className="w-full justify-center rounded-none border-0 bg-white px-2 py-8 text-slate-950 shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Acceso al panel clinico</CardTitle>
                <CardDescription className="pt-1 text-slate-500">
                  Ingresa con tu cuenta autorizada para administrar tu clinica.
                </CardDescription>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-slate-50">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="identifier">Email</Label>
                <Input
                  id="identifier"
                  type="email"
                  autoComplete="username"
                  value={identifier}
                  required
                  aria-invalid={Boolean(error)}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                  placeholder="nombre@clinica.com"
                />
              </div>

              {availableTenants.length > 0 ? (
                <div className="space-y-2">
                  <Label>Clinica</Label>
                  <div className="grid gap-2">
                    {availableTenants.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setTenant(item.slug || item.id);
                          setError(null);
                        }}
                        className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                          tenant === item.slug || tenant === item.id
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        <span className="block font-semibold">{item.name}</span>
                        <span className="block text-xs opacity-75">{item.slug || item.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="tenant">Clinica <span className="font-normal text-slate-400">(opcional)</span></Label>
                <Input
                  id="tenant"
                  type="text"
                  autoComplete="organization"
                  value={tenant}
                  onChange={(event) => {
                    setTenant(event.target.value);
                    if (availableTenants.length > 0) setAvailableTenants([]);
                  }}
                  className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                  placeholder="slug-de-la-clinica"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contrasena</Label>
                  <a href="mailto:soporte@gsentinelhealth.com.ar?subject=Recuperar acceso" className="text-xs font-semibold text-slate-600 hover:text-slate-950">
                    Olvide mi contrasena
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  required
                  minLength={8}
                  aria-invalid={Boolean(error)}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                  placeholder="Tu contrasena"
                />
              </div>

              {error ? (
                <p role="alert" aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <Button disabled={loading} type="submit" className="w-full bg-slate-950 text-white hover:bg-slate-800">
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
