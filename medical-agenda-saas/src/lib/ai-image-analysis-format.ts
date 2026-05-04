export type AiImageType = "RX" | "TAC" | "RMN" | "ECO" | "DOCUMENTO" | "OTRO" | "DESCONOCIDO";
export type AiImageQualityStatus = "buena" | "regular" | "mala";
export type AiImageConfidence = "baja" | "media" | "alta";

export type AiImageAnalysisResult = {
  imageType: AiImageType;
  quality: {
    status: AiImageQualityStatus;
    limitations: string[];
  };
  observations: string[];
  possibleFindings: string[];
  redFlags: string[];
  recommendedNextSteps: string[];
  doctorNote: string;
  confidence: AiImageConfidence;
};

export const AI_IMAGE_ANALYSIS_DOCTOR_NOTE =
  "Informe preliminar generado por IA. Requiere validación de un profesional médico.";

export function formatMedicalImageAnalysisReport(result: AiImageAnalysisResult): string {
  const list = (items: string[]) => (items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Sin datos concluyentes.");

  return [
    "Análisis asistido de imagen",
    `Tipo probable: ${result.imageType}`,
    `Calidad: ${result.quality.status}`,
    `Limitaciones: ${result.quality.limitations.length > 0 ? result.quality.limitations.join("; ") : "Sin limitaciones relevantes informadas."}`,
    "Observaciones:",
    list(result.observations),
    "Posibles hallazgos:",
    list(result.possibleFindings),
    "Alertas:",
    list(result.redFlags),
    "Recomendación:",
    list(result.recommendedNextSteps),
    `Nota: ${result.doctorNote || AI_IMAGE_ANALYSIS_DOCTOR_NOTE}`,
    `Confianza: ${result.confidence}`,
  ].join("\n");
}
