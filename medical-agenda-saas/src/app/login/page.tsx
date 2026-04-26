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
import { fetchJsonWithRetry } from "@/lib/http-client";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";

const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Ingresa email o usuario"),
  password: z.string().min(8, "Minimo 8 caracteres"),
  tenant: z.string().trim().min(2, "Tenant requerido"),
});

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("clinica-principal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ identifier, password, tenant });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulario invalido");
      return;
    }

    setLoading(true);
    try {
      const result = await fetchJsonWithRetry<{
        id: string;
        tenant_id: string;
        name: string;
        email: string;
        role: "admin" | "secretaria" | "recepcionista" | "doctor" | "medico";
      }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify(parsed.data),
        },
        { retries: 1, timeoutMs: 12_000 },
      );

      setUser(result);
      toast.success("Sesion iniciada");
      router.push(getDashboardRouteByRole(result.role));
      router.refresh();
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
          <Image
            src="/logos/GSentinelHealthOS.png"
            alt=""
            width={520}
            height={520}
            priority
            className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 object-contain opacity-10 grayscale lg:h-[460px] lg:w-[460px]"
          />
          <div>
            <Image
              src="/logos/GSentinelHealthOS.png"
              alt="GSentinelHealthOS"
              width={360}
              height={120}
              priority
              className="relative h-auto w-72 object-contain"
            />
            <div className="relative mt-10 max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Acceso operativo</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white">GSentinelHealthOS</h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Plataforma de agenda medica, gestion de pacientes y soporte clinico para equipos administrativos y profesionales.
              </p>
            </div>
          </div>

          <div className="relative mt-10 grid gap-3 text-sm text-slate-300 sm:grid-cols-3 lg:grid-cols-1">
            <div className="border-t border-white/15 pt-3">Agenda y turnos</div>
            <div className="border-t border-white/15 pt-3">Panel medico</div>
            <div className="border-t border-white/15 pt-3">Chat clinico IA</div>
          </div>
        </section>

        <Card className="w-full justify-center rounded-none border-0 bg-white px-2 py-8 text-slate-950 shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Ingreso seguro</CardTitle>
                <CardDescription className="pt-1 text-slate-500">
                  Ingresa con tus credenciales institucionales.
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
                <Label htmlFor="tenant">Tenant</Label>
                <Input
                  id="tenant"
                  type="text"
                  value={tenant}
                  required
                  onChange={(event) => setTenant(event.target.value)}
                  className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                  placeholder="slug de clinica"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="identifier">Email o usuario</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  required
                  aria-invalid={Boolean(error)}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                  placeholder="nombre@clinica.com o doctor.demo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contrasena</Label>
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
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
