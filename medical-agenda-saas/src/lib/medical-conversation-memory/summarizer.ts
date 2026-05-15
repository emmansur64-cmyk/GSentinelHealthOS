import { sanitizeMedicalMemoryText, uniqueCompact } from "./sanitizer";
import { fitTextBudget } from "./token-budget";
import type {
  MedicalConversationMemoryConfig,
  MedicalConversationMemoryExchange,
} from "./types";

const MEDICATION_PATTERN =
  /\b(?:metformina|losartan|enalapril|amlodipina|atorvastatina|aspirina|ibuprofeno|paracetamol|amoxicilina|azitromicina|insulina|levotiroxina|omeprazol|warfarina|clopidogrel|furosemida|hidroclorotiazida|prednisona|salbutamol|sertralina|fluoxetina|clonazepam|diazepam|mg|mcg|ui|dosis|medicamento|farmaco|fármaco)\b[^.?!;]{0,90}/gi;
const HYPOTHESIS_PATTERN = /\b(?:hipotesis|hipótesis|diagnostico diferencial|diagnóstico diferencial|sospecha|probable|posible|compatible con|descartar)\b[^.?!;]{0,120}/gi;
const DECISION_PATTERN = /\b(?:conducta|plan|indicar|solicitar|derivar|internar|control|seguimiento|urgencia|reevaluar|interconsulta)\b[^.?!;]{0,120}/gi;
const SPECIALTY_PATTERN = /\b(?:cardiologia|cardiología|neurologia|neurología|psiquiatria|psiquiatría|pediatria|pediatría|clinica medica|clínica médica|traumatologia|traumatología|ginecologia|ginecología|endocrinologia|endocrinología|neumonologia|neumonología|infectologia|infectología)\b/gi;

function collectMatches(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern)).map((match) => match[0]);
}

export function summarizeMedicalConversationMemory(
  exchanges: MedicalConversationMemoryExchange[],
  config: MedicalConversationMemoryConfig,
): {
  summary: string;
  recentDecisions: string[];
  medicationMentions: string[];
  hypotheses: string[];
  specialtyContext: string | null;
} {
  const summaryParts: string[] = [];
  const medicationCandidates: string[] = [];
  const hypothesisCandidates: string[] = [];
  const decisionCandidates: string[] = [];
  const specialtyCandidates: string[] = [];

  for (const exchange of exchanges) {
    const doctor = sanitizeMedicalMemoryText(exchange.doctorMessage, 420);
    const assistant = sanitizeMedicalMemoryText(exchange.assistantResponse, 520);
    const combined = `${doctor}. ${assistant}`;

    if (doctor || assistant) {
      summaryParts.push(`- ${exchange.createdAt}: medico=${doctor || "sin texto"} | respuesta=${assistant || "sin texto"}`);
    }

    medicationCandidates.push(...collectMatches(combined, MEDICATION_PATTERN));
    hypothesisCandidates.push(...collectMatches(combined, HYPOTHESIS_PATTERN));
    decisionCandidates.push(...collectMatches(combined, DECISION_PATTERN));
    specialtyCandidates.push(...collectMatches(combined, SPECIALTY_PATTERN));
  }

  return {
    summary: fitTextBudget(summaryParts.slice(-config.maxExchanges).reverse(), config.maxSummaryChars),
    recentDecisions: uniqueCompact(decisionCandidates.reverse(), config.maxDecisions),
    medicationMentions: uniqueCompact(medicationCandidates.reverse(), config.maxMedicationMentions),
    hypotheses: uniqueCompact(hypothesisCandidates.reverse(), config.maxHypotheses),
    specialtyContext: uniqueCompact(specialtyCandidates.reverse(), 1)[0] ?? null,
  };
}

