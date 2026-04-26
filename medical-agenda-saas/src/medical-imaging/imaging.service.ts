import { predictMedicalImaging } from "@/medical-imaging/predictor.service";

export type MedicalStudyType = "MRI" | "CT" | "XRAY" | "DICOM" | "UNKNOWN";
export type MedicalRegion = "knee" | "shoulder" | "spine" | "head" | "chest" | "unknown";
export type AnalysisQuality = "high" | "medium" | "low";

export type MedicalImageDetection = {
  isMedicalImage: boolean;
  confidence: number;
  reason: string;
  extension: string;
};

export type MedicalImagingAnalysis = {
  type: MedicalStudyType;
  region: MedicalRegion;
  quality: AnalysisQuality;
  findings: string[];
  condition: string;
  probability: number;
  technical_description: string;
  limitations: string;
  recommendation: string;
  confidence: number;
  pipeline: "onnx-v1" | "structured-v1";
  model_key: string;
  model_version: string;
  notes: string;
  elapsed_ms?: number;
};

const MEDICAL_EXTENSIONS = new Set(["dcm", "dicom", "nii", "nii.gz"]);
const MEDICAL_MIME_HINTS = [
  "application/dicom",
  "application/dicom+json",
  "image/dicom",
  "application/octet-stream",
];
const MEDICAL_NAME_HINTS = [
  "mri",
  "rmn",
  "resonancia",
  "tac",
  "ct",
  "tomografia",
  "rx",
  "xray",
  "radiografia",
  "dicom",
  "craneo",
  "columna",
  "hombro",
  "rodilla",
];

function getExtension(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".nii.gz")) return "nii.gz";
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return "";
  return lower.slice(dot + 1);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function estimateQuality(fileSizeBytes: number): AnalysisQuality {
  if (fileSizeBytes >= 1_400_000) return "high";
  if (fileSizeBytes >= 300_000) return "medium";
  return "low";
}

function inferStudyType(fileNameNormalized: string, extension: string): MedicalStudyType {
  if (extension === "dcm" || extension === "dicom") return "DICOM";
  if (containsAny(fileNameNormalized, ["mri", "rmn", "resonancia"])) return "MRI";
  if (containsAny(fileNameNormalized, ["tac", "ct", "tomografia"])) return "CT";
  if (containsAny(fileNameNormalized, ["rx", "xray", "radiografia"])) return "XRAY";
  return "UNKNOWN";
}

function inferRegion(fileNameNormalized: string): MedicalRegion {
  if (containsAny(fileNameNormalized, ["rodilla", "knee", "menisco"])) return "knee";
  if (containsAny(fileNameNormalized, ["hombro", "shoulder", "manguito"])) return "shoulder";
  if (containsAny(fileNameNormalized, ["columna", "spine", "cervical", "lumbar", "dorsal"])) return "spine";
  if (containsAny(fileNameNormalized, ["craneo", "brain", "cerebro", "head"])) return "head";
  if (containsAny(fileNameNormalized, ["torax", "chest", "pulmon"])) return "chest";
  return "unknown";
}

function defaultFindings(type: MedicalStudyType, region: MedicalRegion): string[] {
  const findings: string[] = [];

  findings.push("Estructuras anatomicas visibles en corte unico/limitado.");

  if (type === "MRI") findings.push("Contraste de tejidos blandos compatible con estudio por resonancia magnetica.");
  if (type === "CT") findings.push("Densidades oseas y de tejidos evaluables de forma preliminar en tomografia.");
  if (type === "XRAY") findings.push("Siluetas oseas visibles compatibles con radiografia convencional.");
  if (type === "DICOM") findings.push("Formato DICOM detectado; apto para pipeline clinico dedicado.");

  if (region === "knee") findings.push("Region de rodilla identificada con estructuras oseas y meniscales parcialmente visibles.");
  if (region === "shoulder") findings.push("Region de hombro identificada con componentes glenohumerales parcialmente visibles.");
  if (region === "spine") findings.push("Segmento de columna identificado con alineacion vertebral preliminarmente evaluable.");
  if (region === "head") findings.push("Region craneal identificada; evaluacion preliminar no concluyente sin serie completa.");
  if (region === "chest") findings.push("Region toracica identificada; correlacion clinica recomendada para interpretacion final.");

  findings.push("Sin analisis concluyente con una unica imagen aislada.");

  return findings;
}

export function detectMedicalImageInput(file: File, mimeType: string): MedicalImageDetection {
  const extension = getExtension(file.name);
  const normalizedName = normalizeText(file.name);
  const normalizedMime = normalizeText(mimeType || "");

  const extensionMatch = MEDICAL_EXTENSIONS.has(extension);
  const mimeMatch = MEDICAL_MIME_HINTS.some((value) => normalizedMime.includes(value));
  const genericImageMime = normalizedMime.startsWith("image/");
  const nameMatch = containsAny(normalizedName, MEDICAL_NAME_HINTS);
  const likelyImagingSize = file.size >= 120_000;

  let score = 0;
  if (extensionMatch) score += 0.7;
  if (mimeMatch) score += 0.45;
  if (nameMatch) score += 0.35;
  if (likelyImagingSize) score += 0.1;
  if (nameMatch && genericImageMime) score += 0.15;

  const confidence = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const isMedicalImage = extensionMatch || mimeMatch || (nameMatch && (genericImageMime || likelyImagingSize));

  return {
    isMedicalImage,
    confidence,
    reason: `ext=${extension || "none"}, mime=${normalizedMime || "none"}, size=${file.size}, name_match=${nameMatch}`,
    extension,
  };
}

export async function analyzeMedicalImageStructured(file: File, mimeType: string): Promise<MedicalImagingAnalysis> {
  const normalizedName = normalizeText(file.name);
  const extension = getExtension(file.name);

  const type = inferStudyType(normalizedName, extension);
  const region = inferRegion(normalizedName);
  const quality = estimateQuality(file.size);
  const findings = defaultFindings(type, region);

  const technicalDescription =
    type === "MRI"
      ? "Imagen compatible con corte de resonancia magnetica; interpretacion limitada por ausencia de serie completa."
      : type === "CT"
        ? "Imagen compatible con tomografia computada; interpretacion limitada por ausencia de multiplanaridad y contexto clinico integral."
        : type === "XRAY"
          ? "Imagen compatible con radiografia; valoracion preliminar limitada por proyeccion unica."
          : type === "DICOM"
            ? "Estudio en formato DICOM detectado; apto para evaluacion con visor medico y pipeline avanzado."
            : "Imagen medica detectada por heuristica; tipo de estudio no concluyente con metadatos actuales.";

  const limitations =
    "Analisis preliminar estructurado (no diagnostico definitivo). Se requiere estudio completo, correlacion clinica y lectura por especialista.";

  const recommendation =
    region === "knee"
      ? "Imagen compatible con corte de rodilla. Se visualizan estructuras oseas y meniscos de forma parcial. Recomendar correlacion con serie completa e informe radiologico."
      : region === "shoulder"
        ? "Imagen compatible con corte de hombro. Evaluacion limitada a captura unica; recomendar serie completa y correlacion clinica."
        : region === "spine"
          ? "Imagen compatible con columna. Valorar alineacion y cambios degenerativos en estudio completo; recomendar informe radiologico formal."
          : "Se recomienda correlacionar con estudio completo, antecedentes clinicos y reporte radiologico final.";

  return {
    type,
    region,
    quality,
    findings,
    condition: findings[0] ?? "sin hallazgos evidentes",
    probability: 0.55,
    technical_description: technicalDescription,
    limitations,
    recommendation,
    confidence: 0.55,
    pipeline: "structured-v1",
    model_key: "structured-v1",
    model_version: "structured-v1",
    notes: "Analisis asistido: no reemplaza diagnostico medico.",
    elapsed_ms: 0,
  };
}

function mapPredictionToAnalysis(prediction: Awaited<ReturnType<typeof predictMedicalImaging>>): MedicalImagingAnalysis {
  const type: MedicalStudyType = prediction.study_type === "CT" ? "CT" : prediction.study_type === "MRI" ? "MRI" : prediction.study_type === "XRAY" ? "XRAY" : "UNKNOWN";
  const region: MedicalRegion =
    prediction.region === "knee" || prediction.region === "chest" || prediction.region === "spine"
      ? prediction.region
      : "unknown";
  const quality: AnalysisQuality = prediction.confidence >= 0.8 ? "high" : prediction.confidence >= 0.6 ? "medium" : "low";

  const technicalDescription =
    prediction.study_type === "MRI"
      ? "Clasificacion ONNX compatible con resonancia magnetica."
      : prediction.study_type === "CT"
        ? "Clasificacion ONNX compatible con tomografia computada."
        : prediction.study_type === "XRAY"
          ? "Clasificacion ONNX compatible con radiografia."
          : "Clasificacion ONNX no concluyente para tipo de estudio.";

  const recommendation =
    region === "knee"
      ? "Correlacionar con serie completa de rodilla e informe radiologico formal."
      : region === "chest"
        ? "Correlacionar con sintomas respiratorios/hemodinamicos y lectura radiologica completa."
        : region === "spine"
          ? "Correlacionar con clinica neurologica y serie completa de columna."
          : "Correlacionar con estudio completo y evaluacion especializada.";

  return {
    type,
    region,
    quality,
    findings: prediction.findings,
    condition: prediction.condition,
    probability: prediction.probability,
    technical_description: technicalDescription,
    limitations: "Analisis asistido por modelo ONNX sobre imagen aislada; no reemplaza diagnostico medico.",
    recommendation,
    confidence: prediction.confidence,
    pipeline: prediction.inference_mode === "onnx" ? "onnx-v1" : "structured-v1",
    model_key: prediction.model_key,
    model_version: prediction.model_version,
    notes: prediction.notes,
    elapsed_ms: prediction.elapsed_ms,
  };
}

export async function analyzeMedicalImage(file: File, mimeType: string): Promise<MedicalImagingAnalysis> {
  const prediction = await predictMedicalImaging(file);
  if (prediction.inference_mode === "onnx") {
    return mapPredictionToAnalysis(prediction);
  }
  return await analyzeMedicalImageStructured(file, mimeType);
}
