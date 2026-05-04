import { fail } from "@/lib/api-response";
import { auditLog } from "@/lib/compliance/audit-log";
import { requireRole, requireSessionWithTenant } from "@/lib/compliance/access";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(text: string): Buffer {
  const content = `BT /F1 10 Tf 40 760 Td (${escapePdfText(text.slice(0, 8000))}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function GET(request: Request, context: Params): Promise<Response> {
  const session = await requireSessionWithTenant();
  if (!session.ok) return session.response;

  const role = await requireRole(session.authUser, ["CLINIC_ADMIN", "DOCTOR", "SECRETARY", "AUDITOR"]);
  if (!role.ok) return role.response;

  const { id } = await context.params;
  const format = (new URL(request.url).searchParams.get("format") ?? "json").trim().toLowerCase();
  if (format !== "json" && format !== "pdf") return fail("format invalido. Use json o pdf", 422);

  const patient = await prisma.patient.findFirst({
    where: { id, tenant_id: session.tenantId },
    include: {
      appointments: {
        where: { tenant_id: session.tenantId },
        orderBy: { datetime: "desc" },
        take: 200,
      },
      clinicalRecords: {
        where: { tenant_id: session.tenantId },
        orderBy: { created_at: "desc" },
        take: 200,
      },
      consents: {
        where: { tenant_id: session.tenantId },
        orderBy: { accepted_at: "desc" },
        take: 200,
        include: {
          consentTemplate: {
            select: { title: true, version: true, applies_to: true },
          },
        },
      },
      dataRequests: {
        where: { tenant_id: session.tenantId },
        orderBy: { requested_at: "desc" },
        take: 50,
      },
    },
  });

  if (!patient) return fail("Paciente no encontrado", 404);

  const payload = {
    exported_at: new Date().toISOString(),
    tenant_id: session.tenantId,
    patient,
  };

  await auditLog({
    tenantId: session.tenantId,
    actorUserId: session.authUser.userId,
    patientId: patient.id,
    entityType: "patient_data_export",
    entityId: patient.id,
    action: "EXPORT",
    metadata: {
      endpoint: "/api/internal/patients/:id/export",
      format,
      appointment_count: patient.appointments.length,
      clinical_record_count: patient.clinicalRecords.length,
      consent_count: patient.consents.length,
    },
  });

  if (format === "json") {
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const printable = [
    `Exportacion de datos del paciente`,
    `Fecha: ${payload.exported_at}`,
    `Paciente: ${patient.name}`,
    `Documento: ${patient.document ?? "N/A"}`,
    `Telefono: ${patient.phone}`,
    `Turnos: ${patient.appointments.length}`,
    `Registros clinicos: ${patient.clinicalRecords.length}`,
    `Consentimientos: ${patient.consents.length}`,
  ].join("\n");

  const pdf = buildSimplePdf(printable);
  const body = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(body).set(pdf);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"patient_export_${patient.id}.pdf\"`,
      "Cache-Control": "no-store",
    },
  });
}
