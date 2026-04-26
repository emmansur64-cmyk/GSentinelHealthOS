import { ok, fail } from "@/lib/api-response";
import { buildImagingClinicalGuidance } from "@/lib/metabrain";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { logServer } from "@/lib/server-logger";
import { predictMedicalImaging } from "@/medical-imaging/predictor.service";

function base64ToFile(base64: string, fileName = "image_upload.jpg", mimeType = "image/jpeg"): File {
  const clean = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
  const bytes = Buffer.from(clean, "base64");
  return new File([bytes], fileName, { type: mimeType });
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "doctor", "medico", "secretaria"])) return fail("Sin permisos", 403);

  const contentType = request.headers.get("content-type") ?? "";

  try {
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const input = form.get("image");
      if (input instanceof File) file = input;
    } else {
      const json = (await request.json().catch(() => null)) as
        | {
            image_base64?: string;
            filename?: string;
            mime_type?: string;
          }
        | null;
      if (json?.image_base64) {
        file = base64ToFile(json.image_base64, json.filename ?? "image_upload.jpg", json.mime_type ?? "image/jpeg");
      }
    }

    if (!file) return fail("Imagen no valida. Envia multipart image o image_base64", 422);

    const prediction = await predictMedicalImaging(file);
    const metabrainDecision = buildImagingClinicalGuidance(prediction);

    logServer("info", "imaging.analyze.completed", {
      user_id: authUser.userId,
      file_name: file.name,
      file_size: file.size,
      study_type: prediction.study_type,
      region: prediction.region,
      findings: prediction.findings,
      confidence: prediction.confidence,
      model_version: prediction.model_version,
      inference_mode: prediction.inference_mode,
    });

    return ok({
      study_type: prediction.study_type,
      region: prediction.region,
      findings: prediction.findings,
      condition: prediction.condition,
      probability: prediction.probability,
      confidence: prediction.confidence,
      notes: prediction.notes,
      model_key: prediction.model_key,
      model_version: prediction.model_version,
      inference_mode: prediction.inference_mode,
      elapsed_ms: prediction.elapsed_ms,
      blocked_by_latency: prediction.blocked_by_latency ?? false,
      metabrain: {
        action: metabrainDecision.action,
        response: metabrainDecision.response,
        confidence: metabrainDecision.confidence,
        source: metabrainDecision.source,
      },
      clinical_warning: "Analisis asistido: no reemplaza diagnostico medico profesional.",
    });
  } catch (error) {
    return fail("No se pudo analizar la imagen", 500, error instanceof Error ? error.message : null);
  }
}
