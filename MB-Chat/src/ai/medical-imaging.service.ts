import { Injectable, Logger } from '@nestjs/common';

export interface MedicalImagingResult {
  findings: string;
  probability: number;
  notes: string;
  assisted: true;
  provider: string;
}

interface ImagingApiResponse {
  findings?: string;
  probability?: number;
  notes?: string;
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
      return {
        findings: (data.findings ?? '').trim() || 'Hallazgos no concluyentes reportados por el servicio de imagen.',
        probability: this.clampProbability(data.probability),
        notes:
          (data.notes ?? '').trim() ||
          'Asistencia automática basada en servicio de imagen validado. Requiere correlación clínica por profesional.',
        assisted: true,
        provider: this.provider,
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
}
