import { ok, fail } from "@/lib/api-response";
import { buildImagingClinicalGuidance } from "@/lib/metabrain";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { logServer } from "@/lib/server-logger";
import { analyzeMedicalImage } from "@/medical-imaging/imaging.service";

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

    const analysis = await analyzeMedicalImage(file, file.type);
    const metabrainDecision = buildImagingClinicalGuidance({
      study_type: analysis.type,
      region: analysis.region,
      findings: analysis.findings,
      confidence: analysis.confidence,
    });

    logServer("info", "imaging.analyze.completed", {
      user_id: authUser.userId,
      file_name: file.name,
      file_size: file.size,
      study_type: analysis.type,
      region: analysis.region,
      findings_count: analysis.findings.length,
      confidence: analysis.confidence,
      model_version: analysis.model_version,
      pipeline: analysis.pipeline,
    });

    return ok({
      study_type: analysis.type,
      region: analysis.region,
      findings: analysis.findings,
      condition: analysis.condition,
      probability: analysis.probability,
      confidence: analysis.confidence,
      notes: analysis.notes,
      model_key: analysis.model_key,
      model_version: analysis.model_version,
      inference_mode: analysis.pipeline === "onnx-v1" ? "onnx" : analysis.pipeline,
      pipeline: analysis.pipeline,
      elapsed_ms: analysis.elapsed_ms,
      blocked_by_latency: false,
      technical_description: analysis.technical_description,
      limitations: analysis.limitations,
      recommendation: analysis.recommendation,
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
