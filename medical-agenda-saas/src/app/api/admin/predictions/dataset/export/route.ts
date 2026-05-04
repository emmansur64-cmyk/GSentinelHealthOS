import { fail } from "@/lib/api-response";
import { encodeNoShowDatasetToCsv, encodeNoShowDatasetToParquet } from "@/lib/ai/datasetExport";
import { auditLog } from "@/lib/compliance/audit-log";
import { requireRole, requireSessionWithTenant } from "@/lib/compliance/access";
import { getNoShowDataset } from "@/services/predictionEngine";

function buildDownloadFileName(format: "csv" | "parquet", from: Date, to: Date): string {
  const start = from.toISOString().slice(0, 10);
  const end = to.toISOString().slice(0, 10);
  return `no_show_dataset_${start}_${end}.${format === "parquet" ? "parquet" : "csv"}`;
}

export async function GET(request: Request): Promise<Response> {
  const session = await requireSessionWithTenant();
  if (!session.ok) return session.response;
  const role = await requireRole(session.authUser, ["CLINIC_ADMIN", "AUDITOR"]);
  if (!role.ok) return role.response;

  const url = new URL(request.url);
  const formatRaw = (url.searchParams.get("format") ?? "csv").trim().toLowerCase();
  const format = formatRaw === "parquet" ? "parquet" : formatRaw === "csv" ? "csv" : null;
  if (!format) return fail("format invalido. Use csv o parquet", 422);

  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const limitRaw = Number(url.searchParams.get("limit") ?? "50000");

  const to = toRaw ? new Date(toRaw) : new Date();
  const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - 180 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return fail("Rango de fechas invalido", 422);
  }

  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 500), 150000) : 50000;

  try {
    const rows = await getNoShowDataset({ from, to, limit, tenantId: session.tenantId });
    const filename = buildDownloadFileName(format, from, to);

    await auditLog({
      tenantId: session.tenantId,
      actorUserId: session.authUser.userId,
      entityType: "prediction_dataset",
      action: "EXPORT",
      metadata: {
        endpoint: "/api/admin/predictions/dataset/export",
        format,
        from: from.toISOString(),
        to: to.toISOString(),
        limit,
        exported_rows: rows.length,
      },
    });

    if (format === "csv") {
      const csv = encodeNoShowDatasetToCsv(rows);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const parquetBuffer = await encodeNoShowDatasetToParquet(rows);
    return new Response(new Uint8Array(parquetBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail("No se pudo exportar dataset", 500, error instanceof Error ? error.message : null);
  }
}
