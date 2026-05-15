import { Injectable } from '@nestjs/common';

export type MedicalUserRole = 'PATIENT' | 'DOCTOR';

export interface RoleClassificationResult {
  role: MedicalUserRole;
  confidence: number;
  signals: {
    technicalScore: number;
    colloquialScore: number;
    structureScore: number;
  };
}

@Injectable()
export class ClassificationService {
  private readonly technicalTerms = [
    'icd',
    'cie-10',
    'diagnostico diferencial',
    'diagnóstico diferencial',
    'tratamiento',
    'mg',
    'iv',
    'ecg',
    'electrocardiograma',
    'hemograma',
    'protocolo',
    'comorbilidad',
    'posología',
    'etiología',
    'ensayo clínico',
    'guía clínica',
    'algoritmo terapéutico',
    'dx',
    'tx',
  ];

  private readonly colloquialTerms = [
    'me duele',
    'dolor',
    'tengo',
    'me siento',
    'mareo',
    'náusea',
    'nausea',
    'fiebre',
    'tos',
    'gripa',
    'resfrio',
    'resfrío',
    'no sé',
    'que hago',
    'qué hago',
    'ayuda',
    'me preocupa',
    'mi hijo',
    'mi mamá',
    'mi mama',
  ];

  classifyMessage(message: string): RoleClassificationResult {
    const text = (message ?? '').toLowerCase().trim();
    if (!text) {
      return {
        role: 'PATIENT',
        confidence: 0.5,
        signals: {
          technicalScore: 0,
          colloquialScore: 0,
          structureScore: 0,
        },
      };
    }

    const technicalHits = this.technicalTerms.filter((t) => text.includes(t)).length;
    const colloquialHits = this.colloquialTerms.filter((t) => text.includes(t)).length;

    // Message structure heuristic: professional/clinical formatting.
    const hasStructuredSections =
      /\b(antecedentes|impresion|impresión|plan|assessment|plan de manejo|historia)\b/.test(text) ||
      /\b(so2|sat|ta|fc|fr|t°|temp|bpm)\b/.test(text);
    const hasUnitsOrRanges = /\b\d+\s?(mg|ml|mmhg|kg|cm|bpm|%)\b/.test(text);
    const structureScore = Number(hasStructuredSections) + Number(hasUnitsOrRanges);

    const technicalScore = technicalHits + structureScore * 0.7;
    const colloquialScore = colloquialHits;

    const role: MedicalUserRole = technicalScore >= colloquialScore ? 'DOCTOR' : 'PATIENT';

    // Confidence based on signal separation with floor/ceiling.
    const delta = Math.abs(technicalScore - colloquialScore);
    const rawConfidence = 0.55 + Math.min(0.4, delta * 0.12);
    const confidence = Math.max(0.5, Math.min(0.95, rawConfidence));

    return {
      role,
      confidence,
      signals: {
        technicalScore,
        colloquialScore,
        structureScore,
      },
    };
  }
}
