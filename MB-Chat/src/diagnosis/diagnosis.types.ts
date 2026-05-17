import { MedicalCitation } from '../knowledge/types';

export enum XaiExplainabilityMode {
  MODO_MEDICO = 'MODO_MEDICO',
  MODO_AUDITORIA = 'MODO_AUDITORIA',
}

export interface DiagnosisXaiRequest {
  query: string;
  answer: string;
  citations: MedicalCitation[];
  mode?: XaiExplainabilityMode;
}

export interface ScientificLegalDefenseMatrix {
  standard: 'SRE-Med';
  caseLabel: string;
  questionUnderAudit: string;
  layers: {
    physiopathologicalLogic: {
      argument: string;
      defenseMechanism: string;
    };
    memoryTraceability: {
      evidenceRecord: string;
      recoveredData: string;
    };
    bibliographicEvidence: {
      clinicalGuidelines: string[];
      indexedLiterature: string[];
    };
  };
}

export interface XaiAuditConsoleReport {
  module: 'Validacion de Respuestas';
  component: 'IA Explicable (XAI) / Defensa Cientifico-Legal';
  explainabilityMode: XaiExplainabilityMode;
  objective: string;
  legalOperatorControl: {
    selectedMode: XaiExplainabilityMode;
    modeDescription: string;
  };
  matrix: ScientificLegalDefenseMatrix;
}
