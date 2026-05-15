import { prisma } from "@/lib/prisma";

import { buildDoctorContextFallback } from "./fallback";
import { buildLocaleContext } from "./locale-adapters";
import { buildIsolatedPreferences } from "./preference-isolation";
import { buildRegionalGuidelines } from "./regional-guidelines";
import { sanitizeDoctorContextString } from "./sanitizer";
import { buildSpecialtyContext } from "./specialty-context";
import { buildTimezoneGuidance } from "./timezone-adapters";
import type { DoctorContextInput, DoctorProfileContext } from "./types";

export async function loadDoctorContext(input: DoctorContextInput): Promise<DoctorProfileContext> {
  try {
    const row = await prisma.user.findFirst({
      where: {
        id: input.doctorUserId,
        tenant_id: input.tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        tenant: { select: { nombre: true } },
        doctorProfile: {
          select: {
            specialty: true,
          },
        },
      },
    });

    if (!row) return buildDoctorContextFallback(input, new Error("doctor_not_found_in_tenant"));

    const locale = buildLocaleContext(input.metadata);
    const preferences = buildIsolatedPreferences(input.metadata);
    const specialty = sanitizeDoctorContextString(row.doctorProfile?.specialty, 120) ?? "medicina general";
    const experienceSource =
      input.metadata?.doctor_context && typeof input.metadata.doctor_context === "object"
        ? (input.metadata.doctor_context as Record<string, unknown>).experience
        : null;
    const specialtyContext = buildSpecialtyContext(specialty);

    return {
      instruction:
        "Usar este DOCTOR PROFILE CONTEXT solo para adaptar lenguaje, especialidad, region y preferencias del medico. No compartir entre tenants ni mezclar medicos.",
      scope: {
        tenantId: input.tenantId,
        doctorUserId: row.id,
      },
      doctor: {
        name: sanitizeDoctorContextString(row.name, 120),
        specialty,
        experience: sanitizeDoctorContextString(experienceSource, 120),
      },
      clinic: {
        name: sanitizeDoctorContextString(row.tenant.nombre, 160),
      },
      locale,
      specialtyContext: [...specialtyContext, buildTimezoneGuidance(locale.timezone)],
      regionalGuidelines: buildRegionalGuidelines(locale.country, locale.region),
      preferences,
      compatibility: {
        retrieval: input.hasRetrievalEvidence ? "available" : "not_available",
        runtimeContext: input.hasRuntimeContext ? "available" : "not_available",
      },
      isolation: {
        tenantScoped: true,
        doctorScoped: true,
        sharesAcrossTenants: false,
      },
      fallback: false,
      errors: [],
    };
  } catch (error) {
    return buildDoctorContextFallback(input, error);
  }
}
