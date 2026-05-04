import Link from "next/link";

import { AdminActionButton } from "@/components/admin/admin-action-button";
import { ClinicCreateForm } from "@/components/admin/clinic-create-form";
import { StatusPill } from "@/components/admin/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminClinics } from "@/lib/super-admin";

export default async function AdminClinicsPage() {
  const clinics = await getAdminClinics(200);

  return (
    <div className="space-y-5">
      <ClinicCreateForm />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Clinicas</h2>
          <p className="text-sm text-slate-500">Control operativo, estado de cuenta y WhatsApp por clinica.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre / Slug</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Ultimo login</TableHead>
              <TableHead>Alta</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-slate-500">
                  No hay clinicas registradas.
                </TableCell>
              </TableRow>
            ) : clinics.map((clinic) => (
              <TableRow key={clinic.id}>
                <TableCell>
                  <Link href={`/admin/clinics/${clinic.id}`} className="font-semibold text-slate-950 hover:underline">
                    {clinic.name}
                  </Link>
                  <p className="text-xs text-slate-400">{clinic.slug}</p>
                  {clinic.maintenance_mode ? <p className="text-xs text-amber-700">Mantenimiento activo</p> : null}
                </TableCell>
                <TableCell>{clinic.email ?? "-"}</TableCell>
                <TableCell>{clinic.phone ?? "-"}</TableCell>
                <TableCell>{clinic.user_count}</TableCell>
                <TableCell><StatusPill status={clinic.status} /></TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <StatusPill status={clinic.whatsapp_status} />
                    <Link href={`/admin/clinics/${clinic.id}/whatsapp`} className="text-xs text-slate-500 hover:underline">
                      Configurar
                    </Link>
                  </div>
                </TableCell>
                <TableCell>{clinic.last_login_at ? new Date(clinic.last_login_at).toLocaleString("es-AR") : "-"}</TableCell>
                <TableCell>{new Date(clinic.created_at).toLocaleDateString("es-AR")}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <AdminActionButton label="Suspender" endpoint={`/api/super-admin/clinics/${clinic.id}/status`} body={{ status: "suspended" }} />
                    <AdminActionButton label="Reactivar" endpoint={`/api/super-admin/clinics/${clinic.id}/status`} body={{ status: "active" }} />
                    <AdminActionButton
                      label={clinic.maintenance_mode ? "Fin mantenimiento" : "Mantenimiento"}
                      endpoint={`/api/super-admin/clinics/${clinic.id}/maintenance`}
                      body={{ maintenance_mode: !clinic.maintenance_mode }}
                    />
                    <AdminActionButton
                      label="Desactivar"
                      endpoint={`/api/super-admin/clinics/${clinic.id}/soft-delete`}
                      method="DELETE"
                      confirmText="DESACTIVAR"
                      variant="destructive"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
