import { Injectable, Logger } from '@nestjs/common';

export type MedicalImagingModality = 'RX' | 'TAC' | 'RMN' | 'ECO' | 'DOCUMENTO' | 'OTRO' | 'DESCONOCIDO';
export type MedicalImagingQuality = 'buena' | 'regular' | 'mala';
export type MedicalImagingConfidence = 'baja' | 'media' | 'alta';

export interface MedicalImagingResult {
  findings: string;
  probability: number;
  notes: string;
  assisted: true;
  provider: string;
  modality?: MedicalImagingModality;
  qualityStatus?: MedicalImagingQuality;
  limitations?: string[];
  observations?: string[];
  possibleFindings?: string[];
  redFlags?: string[];
  recommendedNextSteps?: string[];
  confidenceLevel?: MedicalImagingConfidence;
  report?: string;
}

interface ImagingApiResponse {
  findings?: string;
  probability?: number;
  notes?: string;
  imageType?: string;
  quality?: {
    status?: string;
    limitations?: unknown;
  };
  observations?: unknown;
  possibleFindings?: unknown;
  redFlags?: unknown;
  recommendedNextSteps?: unknown;
  confidence?: string;
}

@Injectable()
export class MedicalImagingService {
  private readonly logger = new Logger(MedicalImagingService.name);
  private readonly endpoint = process.env.MEDICAL_IMAGING_API_URL?.trim() ?? '';
  private readonly apiKey = process.env.MEDICAL_IMAGING_API_KEY?.trim() ?? '';
  private readonly provider = process.env.MEDICAL_IMAGING_PROVIDER?.trim() || 'specialized-api';

  async analyzeImage(input: {
    imageBase64: string;
    mimeType?: string;
    patientAge?: number;
    modalityHint?: string;
  }): Promise<MedicalImagingResult> {
    const preprocessed = this.preprocessImage(input.imageBase64, input.mimeType);

    if (!this.endpoint || !this.apiKey) {
      return {
        findings: 'No se pudo ejecutar análisis de imagen: servicio especializado no configurado.',
        probability: 0,
        notes:
          'Resultado de asistencia no diagnóstica. Configurar MEDICAL_IMAGING_API_URL y MEDICAL_IMAGING_API_KEY para habilitar inferencia validada.',
        assisted: true,
        provider: this.provider,
      };
    }

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: preprocessed.payloadBase64,
          mime_type: preprocessed.mimeType,
          patient_age: input.patientAge,
          modality_hint: input.modalityHint,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`[MedicalImaging] API error status=${res.status} body=${body.slice(0, 180)}`);
        return {
          findings: 'No se pudo obtener análisis confiable de la imagen en este momento.',
          probability: 0,
          notes:
            'Resultado de asistencia no diagnóstica. Repetir estudio o revisar conectividad con proveedor especializado.',
          assisted: true,
          provider: this.provider,
        };
      }

      const data = (await res.json()) as ImagingApiResponse;
      const modality = this.normalizeModality(data.imageType ?? input.modalityHint, preprocessed.mimeType);
      const qualityStatus = this.normalizeQualityStatus(data.quality?.status);
      const limitations = this.normalizeStringList(data.quality?.limitations, 12);
      const observations = this.normalizeStringList(data.observations, 20);
      const possibleFindings = this.normalizeStringList(data.possibleFindings, 20);
      const redFlags = this.normalizeStringList(data.redFlags, 12);
      const recommendedNextSteps = this.normalizeStringList(data.recommendedNextSteps, 12);
      const confidenceLevel = this.normalizeConfidenceLevel(data.confidence);
      const probability = this.resolveProbability(data.probability, confidenceLevel);

      return {
        findings: (data.findings ?? '').trim() || 'Hallazgos no concluyentes reportados por el servicio de imagen.',
        probability,
        notes:
          (data.notes ?? '').trim() ||
          'Asistencia automática basada en servicio de imagen validado. Requiere correlación clínica por profesional.',
        assisted: true,
        provider: this.provider,
        modality,
        qualityStatus,
        limitations,
        observations,
        possibleFindings,
        redFlags,
        recommendedNextSteps,
        confidenceLevel,
        report: this.buildProfessionalReport({
          modality,
          qualityStatus,
          limitations,
          observations,
          possibleFindings,
          redFlags,
          recommendedNextSteps,
          confidenceLevel,
          findings: (data.findings ?? '').trim(),
          notes: (data.notes ?? '').trim(),
          probability,
        }),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[MedicalImaging] runtime error: ${msg}`);
      return {
        findings: 'No se pudo completar análisis de imagen por error transitorio.',
        probability: 0,
        notes:
          'Resultado de asistencia no diagnóstica. Considerar evaluación radiológica convencional y correlación clínica.',
        assisted: true,
        provider: this.provider,
      };
    }
  }

  private preprocessImage(imageRaw: string, mimeHint?: string): {
    payloadBase64: string;
    mimeType: string;
  } {
    const raw = (imageRaw ?? '').trim();
    if (!raw) {
      throw new Error('image_empty');
    }

    // Accept both data-url and raw base64 payloads.
    const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/i);
    const mimeType = (dataUrlMatch?.[1] || mimeHint || 'application/octet-stream').toLowerCase();
    const payloadBase64 = dataUrlMatch?.[2] || raw;

    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/dicom'];
    if (!allowedMime.includes(mimeType)) {
      throw new Error(`unsupported_mime:${mimeType}`);
    }

    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(payloadBase64)) {
      throw new Error('invalid_base64_payload');
    }

    return {
      payloadBase64: payloadBase64.replace(/\s+/g, ''),
      mimeType,
    };
  }

  private clampProbability(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  private normalizeStringList(value: unknown, maxItems: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
      .slice(0, maxItems);
  }

  private normalizeModality(value: unknown, mimeType: string): MedicalImagingModality {
    const text = String(value ?? '').trim().toUpperCase();
    if (text === 'RX' || text === 'XRAY' || text === 'X-RAY') return 'RX';
    if (text === 'TAC' || text === 'CT') return 'TAC';
    if (text === 'RMN' || text === 'MRI') return 'RMN';
    if (text === 'ECO' || text === 'US' || text === 'ULTRASOUND') return 'ECO';
    if (text === 'DOCUMENTO') return 'DOCUMENTO';
    if (text === 'OTRO') return 'OTRO';
    if (text === 'DESCONOCIDO') return 'DESCONOCIDO';

    if (mimeType === 'application/dicom') return 'DESCONOCIDO';
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' || mimeType === 'image/png' || mimeType === 'image/webp') {
      return 'OTRO';
    }
    return 'DESCONOCIDO';
  }

  private normalizeQualityStatus(value: unknown): MedicalImagingQuality {
    const text = String(value ?? '').trim().toLowerCase();
    if (text === 'buena') return 'buena';
    if (text === 'mala') return 'mala';
    return 'regular';
  }

  private normalizeConfidenceLevel(value: unknown): MedicalImagingConfidence {
    const text = String(value ?? '').trim().toLowerCase();
    if (text === 'alta') return 'alta';
    if (text === 'media') return 'media';
    return 'baja';
  }

  private resolveProbability(probability: unknown, confidenceLevel: MedicalImagingConfidence): number {
    const normalized = this.clampProbability(probability);
    if (normalized > 0) return normalized;
    if (confidenceLevel === 'alta') return 0.85;
    if (confidenceLevel === 'media') return 0.65;
    return 0.35;
  }

  private buildProfessionalReport(input: {
    modality: MedicalImagingModality;
    qualityStatus: MedicalImagingQuality;
    limitations: string[];
    observations: string[];
    possibleFindings: string[];
    redFlags: string[];
    recommendedNextSteps: string[];
    confidenceLevel: MedicalImagingConfidence;
    findings: string;
    notes: string;
    probability: number;
  }): string {
    const list = (items: string[], fallback: string) => {
      if (items.length === 0) return `- ${fallback}`;
      return items.map((item) => `- ${item}`).join('\n');
    };

    return [
      'Informe preliminar asistido de imagen medica',
      `Modalidad probable: ${input.modality}`,
      `Calidad tecnica: ${input.qualityStatus}`,
      `Limitaciones: ${input.limitations.length > 0 ? input.limitations.join('; ') : 'Sin limitaciones relevantes informadas.'}`,
      'Observaciones:',
      list(input.observations, 'Sin observaciones concluyentes.'),
      'Posibles hallazgos:',
      list(input.possibleFindings, input.findings || 'Sin hallazgos concluyentes.'),
      'Banderas rojas:',
      list(input.redFlags, 'No se identifican banderas rojas evidentes en este analisis asistido.'),
      'Siguientes pasos sugeridos:',
      list(
        input.recommendedNextSteps,
        input.notes || 'Correlacion clinico-radiologica por profesional y consideracion de lectura radiologica formal.',
      ),
      `Confianza del proveedor: ${input.confidenceLevel} (${(input.probability * 100).toFixed(0)}%)`,
      'Nota de seguridad: informe preliminar por IA, no reemplaza informe radiologico definitivo ni juicio clinico profesional.',
    ].join('\n');
  }
}
