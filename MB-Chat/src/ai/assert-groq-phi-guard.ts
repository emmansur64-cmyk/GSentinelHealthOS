import { Logger } from '@nestjs/common';

const GROQ_SAFE_FOR_PHI = process.env.GROQ_SAFE_FOR_PHI === 'true';

export class ProviderPhiNotAllowedError extends Error {
  public readonly code = 'PROVIDER_PHI_NOT_ALLOWED';
  constructor(message = 'PHI is not allowed for this provider') {
    super(message);
    this.name = 'ProviderPhiNotAllowedError';
  }
}

/**
 * Detecta si el payload contiene PHI (simplificado: busca campos típicos, puede ser extendido).
 * @param payload string | object
 */
function detectPhi(payload: any): boolean {
  if (!payload) return false;
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Indicadores directos de identificación personal/sanitaria.
  const patterns: RegExp[] = [
    /\b(dni|documento|historia\s*clinica|historia_clinica|nro\s*hc|mrn|ssn|pasaporte)\b/i,
    /\b(nombre|name|apellido|surname)\b\s*[:=]/i,
    /\b(email|correo|mail|telefono|phone|direccion|address|fecha\s*de\s*nacimiento|dob)\b\s*[:=]?/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\+?\d[\d\s().-]{7,}\d/,
    /\b\d{7,10}\b/,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Lanza error si safe_for_phi es false y detecta PHI en el payload.
 * Loguea solo los campos permitidos.
 */
export function assertGroqPhiAllowedOrThrow(payload: any, context: { correlation_id: string, method: string }): void {
  const logger = new Logger('GroqPhiGuard');
  const phiDetected = detectPhi(payload);
  if (!GROQ_SAFE_FOR_PHI && phiDetected) {
    logger.warn({
      correlation_id: context.correlation_id,
      provider: 'groq',
      method: context.method,
      blocked_reason: 'PROVIDER_PHI_NOT_ALLOWED',
      phi_detected: true,
      safe_for_phi: false,
    });
    throw new ProviderPhiNotAllowedError();
  }
  // Log solo si hay PHI pero no bloquea (para trazabilidad, nunca loguea datos crudos)
  if (phiDetected) {
    logger.log({
      correlation_id: context.correlation_id,
      provider: 'groq',
      method: context.method,
      blocked_reason: null,
      phi_detected: true,
      safe_for_phi: GROQ_SAFE_FOR_PHI,
    });
  }
}
