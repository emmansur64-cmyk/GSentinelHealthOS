"use client";

import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

type WhatsAppStatus = {
  connected: boolean;
  status: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  webhookVerified: boolean;
};

export function WhatsappConnectButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinic/whatsapp/status", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { ok?: boolean; data?: WhatsAppStatus } | null) => {
        if (!cancelled && payload?.ok && payload.data) setStatus(payload.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function startOAuth() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/meta/oauth/start", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as { ok?: boolean; data?: { url?: string }; error?: { message?: string } };
      if (!response.ok || !payload.ok || !payload.data?.url) {
        throw new Error(payload.error?.message || "No se pudo iniciar Meta OAuth");
      }
      window.location.assign(payload.data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar Meta OAuth");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startOAuth}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
        >
          <MessageCircle className="h-4 w-4" />
          {loading ? "Conectando..." : "Conectar WhatsApp"}
        </button>
        <Link
          href="https://developers.facebook.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
        >
          <ExternalLink className="h-4 w-4" />
          Meta Developers
        </Link>
      </div>
      {status ? (
        <p className="text-xs text-slate-500">
          Estado: {status.status}
          {status.phoneNumberId ? ` · Phone ID: ${status.phoneNumberId}` : ""}
          {status.webhookVerified ? " · Webhook verificado" : ""}
        </p>
      ) : null}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
