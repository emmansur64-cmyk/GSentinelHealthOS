import Link from "next/link";

import { StatusPill } from "@/components/admin/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export default async function AdminWhatsappPage() {
  const rows = await prisma.$queryRaw<Array<{
    clinic_id: string;
    clinic_name: string;
    status: string;
    phone_number_id: string | null;
    waba_id: string | null;
    business_id: string | null;
    token_expires_at: Date | null;
    webhook_status: string | null;
    display_phone_number: string | null;
    last_webhook_at: Date | null;
    last_error_at: Date | null;
    last_error_message: string | null;
  }>>`
    SELECT t.id AS clinic_id, t.nombre AS clinic_name, COALESCE(cwa.status::text, 'pending') AS status,
           cwa.phone_number_id, cwa.waba_id,
           cwa.business_id,
           cwa.expires_at AS token_expires_at,
           CASE WHEN cwa.webhook_verified THEN 'verified' ELSE 'pending' END AS webhook_status,
           cwa.display_phone_number, cwa.last_webhook_at, cwa.last_error_at, cwa.last_error_message
    FROM tenants t
    LEFT JOIN clinic_whatsapp_accounts cwa ON cwa.tenant_id = t.id AND cwa.is_active = true
    WHERE t.id <> 'default'
    ORDER BY t.nombre ASC
  `;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Estado WhatsApp</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clinica</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Numero</TableHead>
            <TableHead>Phone Number ID</TableHead>
            <TableHead>WABA</TableHead>
            <TableHead>Business ID</TableHead>
            <TableHead>Webhook</TableHead>
            <TableHead>Token expira</TableHead>
            <TableHead>Ultimo webhook</TableHead>
            <TableHead>Ultimo error</TableHead>
            <TableHead>Accion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-sm text-slate-500">
                No hay clinicas registradas.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={`${row.clinic_id}-${row.phone_number_id ?? "none"}`}>
                <TableCell>{row.clinic_name}</TableCell>
                <TableCell><StatusPill status={row.status} /></TableCell>
                <TableCell>{row.display_phone_number ?? "-"}</TableCell>
                <TableCell>{row.phone_number_id ?? "-"}</TableCell>
                <TableCell>{row.waba_id ?? "-"}</TableCell>
                <TableCell>{row.business_id ?? "-"}</TableCell>
                <TableCell>{row.webhook_status ?? "-"}</TableCell>
                <TableCell>{row.token_expires_at ? new Date(row.token_expires_at).toLocaleString("es-AR") : "-"}</TableCell>
                <TableCell>{row.last_webhook_at ? new Date(row.last_webhook_at).toLocaleString("es-AR") : "-"}</TableCell>
                <TableCell>{row.last_error_message ?? "-"}</TableCell>
                <TableCell>
                  <Link href={`/admin/clinics/${row.clinic_id}/whatsapp`} className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
                    Reconectar
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
