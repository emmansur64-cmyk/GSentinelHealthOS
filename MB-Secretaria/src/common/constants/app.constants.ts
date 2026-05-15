export const KNOWN_ERROR_PATTERNS = {
  bookingConflict: /(overbook|double\s*book|booking\s*conflict)/i,
  invalidSchedule: /(invalid\s*schedule|slot\s*unavailable|outside\s*window)/i,
  transientSystem: /(timeout|temporarily\s*unavailable|connection\s*reset)/i,
  malformedData: /(schema\s*error|invalid\s*payload|parse\s*error)/i,
};

export const DEFAULT_RETRY_LIMIT = 3;
