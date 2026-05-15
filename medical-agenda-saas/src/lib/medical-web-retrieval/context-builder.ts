import { auditMedicalWebRetrieval, auditMedicalWebRetrievalError } from "./audit";
import { retrieveMedicalWebEvidence } from "./retriever";
import type { MedicalWebRetrievalContext, MedicalWebRetrievalInput } from "./types";

const MEDICAL_WEB_RETRIEVAL_INSTRUCTION = [
  "Usar esta evidencia solo como apoyo clinico.",
  "No inventar fuentes.",
  "No afirmar certeza absoluta.",
  "Priorizar criterio medico profesional.",
  "Si la evidencia es insuficiente, indicarlo.",
].join(" ");

export async function buildMedicalWebRetrievalContext(
  input: MedicalWebRetrievalInput,
): Promise<MedicalWebRetrievalContext | null> {
  try {
    const result = await retrieveMedicalWebEvidence(input);
    if (!result) return null;
    auditMedicalWebRetrieval(input, result);
    if (!result.used || result.evidence.length === 0) return null;

    return {
      instruction: MEDICAL_WEB_RETRIEVAL_INSTRUCTION,
      query: result.query,
      sources: result.evidence,
    };
  } catch (error) {
    auditMedicalWebRetrievalError(input, error);
    return null;
  }
}
