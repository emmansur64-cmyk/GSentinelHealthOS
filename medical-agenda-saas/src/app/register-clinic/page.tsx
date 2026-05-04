"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  clinic_name: z.string().trim().min(2, "Ingresa el nombre de la clinica"),
  tenant_slug: z.string().trim().min(2, "Ingresa un slug para la clinica"),
  owner_name: z.string().trim().min(2, "Ingresa el nombre del responsable"),
  owner_email: z.email("Ingresa un email valido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});

type RegisterPayload = {
  ok?: boolean;
  data?: {
    tenant_id: string;
    tenant_slug: string;
    clinic_name: string;
    owner_user_id: string;
    owner_email: string;
  };
  error?: {
    message?: string;
    details?: unknown;
  };
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function RegisterClinicPage() {
  const [clinicName, setClinicName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegisterPayload["data"] | null>(null);

  const normalizedSlug = useMemo(() => slugify(tenantSlug || clinicName), [clinicName, tenantSlug]);

  const onClinicNameChange = (value: string) => {
    setClinicName(value);
    if (!slugTouched) setTenantSlug(slugify(value));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCreated(null);

    const parsed = formSchema.safeParse({
      clinic_name: clinicName,
      tenant_slug: normalizedSlug,
      owner_name: ownerName,
      owner_email: ownerEmail,
      phone: phone || undefined,
      password,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulario invalido");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/public/register-clinic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json().catch(() => ({}))) as RegisterPayload;

      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error?.message ?? "No se pudo registrar la clinica");
      }

      setCreated(payload.data);
      toast.success("Clinica registrada");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error de red al registrar la clinica");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl lg:grid-cols-[380px_1fr]">
        <section className="flex flex-col justify-between border-b border-slate-200 bg-slate-950 p-8 text-white lg:border-b-0 lg:border-r">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-md bg-white text-slate-950">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Alta de clinica</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">GSentinelHealthOS</h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Crea la clinica y el usuario responsable inicial para empezar a configurar agenda, equipo y WhatsApp.
            </p>
          </div>

          <div className="mt-10 grid gap-3 text-sm text-slate-300">
            <div className="border-t border-white/15 pt-3">Tenant propio</div>
            <div className="border-t border-white/15 pt-3">Owner con rol clinic_owner</div>
            <div className="border-t border-white/15 pt-3">Compatible con alta manual</div>
          </div>
        </section>

        <Card className="w-full justify-center rounded-none border-0 bg-white px-2 py-8 text-slate-950 shadow-none">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl">Registrar nueva clinica</CardTitle>
            <CardDescription className="text-slate-500">
              El email del responsable se usara para ingresar al panel clinico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {created ? (
              <div className="space-y-5">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-5 w-5" />
                    Clinica creada
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>{created.clinic_name}</p>
                    <p>Slug: {created.tenant_slug}</p>
                    <p>Owner: {created.owner_email}</p>
                  </div>
                </div>

                <Link
                  href={`/login?tenant=${encodeURIComponent(created.tenant_slug)}`}
                  className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-slate-950 px-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Ir al login
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="clinic_name">Nombre de la clinica</Label>
                    <Input
                      id="clinic_name"
                      value={clinicName}
                      onChange={(event) => onClinicNameChange(event.target.value)}
                      className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                      placeholder="Clinica San Martin"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="tenant_slug">Slug de la clinica</Label>
                    <Input
                      id="tenant_slug"
                      value={tenantSlug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setTenantSlug(slugify(event.target.value));
                      }}
                      className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                      placeholder="clinica-san-martin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner_name">Responsable</Label>
                    <Input
                      id="owner_name"
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                      className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                      placeholder="Nombre y apellido"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner_email">Email owner</Label>
                    <Input
                      id="owner_email"
                      type="email"
                      autoComplete="username"
                      value={ownerEmail}
                      onChange={(event) => setOwnerEmail(event.target.value)}
                      className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                      placeholder="owner@clinica.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefono de contacto</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                      placeholder="+54 9 11 1234-5678"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="password">Contrasena inicial</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                      placeholder="Minimo 8 caracteres"
                    />
                  </div>
                </div>

                {error ? (
                  <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}

                <Button disabled={loading} type="submit" className="w-full bg-slate-950 text-white hover:bg-slate-800">
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Crear clinica"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
