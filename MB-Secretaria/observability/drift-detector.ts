import type { DriftSignal, ObservabilityEvent } from "./types";

export function detectDriftSignals(events: ObservabilityEvent[]): DriftSignal[] {
  const now = new Date().toISOString();
  const signals: DriftSignal[] = [];
  const fallbackEvents = events.filter((event) => event.event_type.includes("fallback"));
  const lowConfidence = events.filter((event) => event.layer === "confidence" && Number(event.payload_summary.confidence_score) < 0.5);
  const degradedProviders = events.filter((event) => event.layer === "provider" && event.event_type.includes("degraded"));
  const reviewEscalations = events.filter((event) => event.layer === "review" && event.event_type.includes("escalation"));
  const multimodalConflicts = events.filter((event) => event.event_type.includes("multimodal_conflict"));

  if (fallbackEvents.length >= 3) signals.push(buildSignal("system", "fallback_spike", "warn", "Fallback events are increasing.", fallbackEvents, now));
  if (lowConfidence.length >= 3) signals.push(buildSignal("confidence", "low_confidence_spike", "warn", "Low confidence events are increasing.", lowConfidence, now));
  if (degradedProviders.length >= 2) signals.push(buildSignal("provider", "provider_degradation", "error", "Provider degraded events detected.", degradedProviders, now));
  if (reviewEscalations.length >= 2) signals.push(buildSignal("review", "review_escalation_spike", "warn", "Human review escalation pressure increased.", reviewEscalations, now));
  if (multimodalConflicts.length >= 1) signals.push(buildSignal("imaging", "multimodal_conflict", "warn", "Multimodal conflict signal detected.", multimodalConflicts, now));
  return signals;
}

function buildSignal(layer: DriftSignal["layer"], signal_type: string, severity: DriftSignal["severity"], description: string, events: ObservabilityEvent[], now: string): DriftSignal {
  return { layer, signal_type, severity, description, trace_refs: events.map((event) => event.trace_id).slice(0, 10), detected_at: now };
}
