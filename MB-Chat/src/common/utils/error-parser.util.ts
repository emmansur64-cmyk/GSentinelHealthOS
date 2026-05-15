import { KNOWN_ERROR_PATTERNS } from '../constants/app.constants';
import { ErrorFingerprint, IncidentPayload } from '../types/brain.types';

function asLowercaseList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.toLowerCase());
}

export function extractErrorFingerprint(input: IncidentPayload): ErrorFingerprint {
  const text = `${input.message} ${input.stack ?? ''}`;
  const errors = asLowercaseList(input.metadata?.errors);
  const logs = asLowercaseList(input.metadata?.logs);

  if (errors.some((entry) => entry.includes('timeout')) && logs.some((entry) => entry.includes('postgres'))) {
    return {
      code: 'DB_CONNECTION_TIMEOUT',
      category: 'unknown',
      summary: 'Timeout de conexion a Postgres por correlacion multi-evento',
    };
  }

  if (KNOWN_ERROR_PATTERNS.bookingConflict.test(text)) {
    return {
      code: 'BOOKING_CONFLICT',
      category: 'booking',
      summary: 'Conflicto de reserva detectado',
    };
  }

  if (KNOWN_ERROR_PATTERNS.invalidSchedule.test(text)) {
    return {
      code: 'INVALID_SCHEDULE',
      category: 'schedule',
      summary: 'Problema de agenda detectado',
    };
  }

  if (KNOWN_ERROR_PATTERNS.malformedData.test(text)) {
    return {
      code: 'MALFORMED_DATA',
      category: 'data',
      summary: 'Datos inconsistentes detectados',
    };
  }

  if (KNOWN_ERROR_PATTERNS.transientSystem.test(text)) {
    return {
      code: 'TRANSIENT_SYSTEM_ERROR',
      category: 'unknown',
      summary: 'Falla transitoria de sistema',
    };
  }

  return {
    code: 'UNKNOWN',
    category: 'unknown',
    summary: 'Error no clasificado',
  };
}
