"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, ToggleLeft, ToggleRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/admin/status-pill";

type WhatsAppAccount = {
  id: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayPhoneNumber: string | null;
  status: string;
  isActive: boolean;
  lastWebhookAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ClinicWhatsAppPage() {
  const params = useParams<{ id: string }>();
  const clinicId = params.id;

  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  async function loadAccounts() {
    setLoading(true);
    try {
      const resp = await fetch(`/api/super-admin/clinics/${clinicId}/whatsapp`);
      const json = await resp.json() as { ok?: boolean; data?: WhatsAppAccount[] };
      if (json.ok && Array.isArray(json.data)) setAccounts(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      setError("phone_number_id, waba_id y access_token son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch(`/api/super-admin/clinics/${clinicId}/whatsapp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim(),
          display_phone_number: displayPhone.trim() || undefined,
          access_token: accessToken.trim(),
          app_secret: appSecret.trim() || undefined,
          verify_token: verifyToken.trim() || undefined,
          is_active: true,
        }),
      });
      const json = await resp.json() as { ok?: boolean; error?: { message?: string } };

      if (!resp.ok || !json.ok) {
        throw new Error(json.error?.message ?? "No se pudo guardar");
      }

      setSaved(true);
      setAccessToken("");
      setAppSecret("");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(account: WhatsAppAccount) {
    if (!account.phoneNumberId) return;
    setToggling(account.id);
    try {
      await fetch(`/api/super-admin/clinics/${clinicId}/whatsapp`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone_number_id: account.phoneNumberId,
          is_active: !account.isActive,
        }),
      });
      await loadAccounts();
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cuentas existentes */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Cuentas WhatsApp configuradas</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-slate-500">Sin cuenta configurada para esta clinica.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {acc.displayPhoneNumber ?? acc.phoneNumberId}
                  </p>
                  <p className="text-xs text-slate-500">
                    WABA: {acc.wabaId ?? "-"} · Phone ID: {acc.phoneNumberId ?? "-"}
                  </p>
                  {acc.lastError ? (
                    <p className="text-xs text-rose-600">Ultimo error: {acc.lastError}</p>
                  ) : null}
                  {acc.lastWebhookAt ? (
                    <p className="text-xs text-slate-400">
                      Ultimo webhook: {new Date(acc.lastWebhookAt).toLocaleString("es-AR")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={acc.status} />
                  <button
                    type="button"
                    onClick={() => void handleToggle(acc)}
                    disabled={toggling === acc.id}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    title={acc.isActive ? "Desactivar" : "Activar"}
                  >
                    {toggling === acc.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : acc.isActive ? (
                      <ToggleRight className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-slate-400" />
                    )}
                    {acc.isActive ? "Activa" : "Inactiva"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Formulario para configurar/actualizar */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">Configurar cuenta WhatsApp</h2>
        <p className="mb-4 text-sm text-slate-500">
          Ingresa los datos de la cuenta WhatsApp Cloud API para esta clinica.
          Los tokens se guardan en base de datos y no se exponen en pantalla luego de guardar.
        </p>

        {saved ? (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Cuenta guardada correctamente.
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={(e) => void handleSave(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wa_phone_number_id">Phone Number ID *</Label>
            <Input
              id="wa_phone_number_id"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="1234567890"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa_waba_id">WABA ID *</Label>
            <Input
              id="wa_waba_id"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="9876543210"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa_display_phone">Numero de display</Label>
            <Input
              id="wa_display_phone"
              value={displayPhone}
              onChange={(e) => setDisplayPhone(e.target.value)}
              placeholder="+54 9 11 1234-5678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa_verify_token">Verify Token (webhook)</Label>
            <Input
              id="wa_verify_token"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="token-secreto-webhook"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="wa_access_token">Access Token *</Label>
            <Input
              id="wa_access_token"
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAxxxxxx..."
              required
            />
            <p className="text-xs text-slate-400">No se muestra luego de guardar.</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="wa_app_secret">App Secret (opcional)</Label>
            <Input
              id="wa_app_secret"
              type="password"
              autoComplete="off"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="app secret de Meta"
            />
            <p className="text-xs text-slate-400">Se usa para verificar la firma de webhooks por clinica.</p>
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Guardar configuracion"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
