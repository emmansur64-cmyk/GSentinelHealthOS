import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

const register = new Registry();
collectDefaultMetrics({ register, prefix: "agenda_" });

export const requestsTotal = new Counter({
  name: "requests_total",
  help: "Total HTTP requests",
  labelNames: ["route", "method", "status"] as const,
  registers: [register],
});

export const requestDurationSeconds = new Histogram({
  name: "request_duration_seconds",
  help: "Request duration in seconds",
  labelNames: ["route", "method", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.7, 1, 2, 5, 10],
  registers: [register],
});

export const dbQueryDurationSeconds = new Histogram({
  name: "db_query_duration",
  help: "Database query duration in seconds",
  labelNames: ["model", "operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.03, 0.1, 0.3, 1, 3],
  registers: [register],
});

export const redisLatencySeconds = new Histogram({
  name: "redis_latency",
  help: "Redis operation latency in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.0005, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1],
  registers: [register],
});

export const queueJobsProcessed = new Counter({
  name: "queue_jobs_processed",
  help: "Processed queue jobs",
  labelNames: ["queue", "stage"] as const,
  registers: [register],
});

export const queueJobsFailed = new Counter({
  name: "queue_jobs_failed",
  help: "Failed queue jobs",
  labelNames: ["queue", "stage"] as const,
  registers: [register],
});

export const stageLatencySeconds = new Histogram({
  name: "stage_latency_seconds",
  help: "Latency by pipeline stage",
  labelNames: ["stage"] as const,
  buckets: [0.005, 0.01, 0.03, 0.1, 0.3, 1, 2, 5, 10],
  registers: [register],
});

export const queueActiveJobs = new Gauge({
  name: "queue_active_jobs",
  help: "Current active jobs per queue",
  labelNames: ["queue"] as const,
  registers: [register],
});

export const appointmentEngineDecisionsTotal = new Counter({
  name: "appointment_engine_decisions_total",
  help: "Total decisions made by appointment auto-assignment engine",
  labelNames: ["outcome", "fallback"] as const,
  registers: [register],
});

export const appointmentEngineDecisionSeconds = new Histogram({
  name: "appointment_engine_decision_seconds",
  help: "Decision latency of appointment auto-assignment engine in seconds",
  labelNames: ["outcome", "fallback"] as const,
  buckets: [0.005, 0.01, 0.03, 0.1, 0.3, 0.7, 1, 2, 5, 10],
  registers: [register],
});

export const appointmentEngineAttemptsHistogram = new Histogram({
  name: "appointment_engine_attempts",
  help: "Number of slot attempts per auto-assignment decision",
  labelNames: ["outcome"] as const,
  buckets: [0, 1, 2, 3, 5, 8, 13, 21],
  registers: [register],
});

export const appointmentEngineConflictsTotal = new Counter({
  name: "appointment_engine_conflicts_total",
  help: "Conflicts detected by auto-assignment final validation",
  labelNames: ["type"] as const,
  registers: [register],
});

export const noShowPredictionsTotal = new Counter({
  name: "no_show_predictions_total",
  help: "Total no-show predictions generated",
  labelNames: ["source", "risk_level"] as const,
  registers: [register],
});

export const noShowPredictionProbability = new Histogram({
  name: "no_show_prediction_probability",
  help: "Distribution of no-show prediction probabilities",
  labelNames: ["source"] as const,
  buckets: [0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 0.99],
  registers: [register],
});

export const recommendationGenerationSeconds = new Histogram({
  name: "recommendation_generation_seconds",
  help: "Recommendation engine generation latency",
  labelNames: ["slot_count_bucket"] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.7, 1, 2, 5, 10],
  registers: [register],
});

export const overbookingDecisionsTotal = new Counter({
  name: "overbooking_decisions_total",
  help: "Decisions taken by controlled overbooking guard",
  labelNames: ["decision"] as const,
  registers: [register],
});

export const medicalImagingInferenceTotal = new Counter({
  name: "medical_imaging_inference_total",
  help: "Total medical imaging inference attempts by model and outcome",
  labelNames: ["model", "outcome"] as const,
  registers: [register],
});

export const medicalImagingInferenceSeconds = new Histogram({
  name: "medical_imaging_inference_seconds",
  help: "Medical imaging inference latency by model and outcome",
  labelNames: ["model", "outcome"] as const,
  buckets: [0.01, 0.03, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2],
  registers: [register],
});

export const doctorChatFetchFailedTotal = new Counter({
  name: "doctor_chat_fetch_failed_total",
  help: "Total upstream fetch failures while resolving doctor chat with Brain service",
  labelNames: ["endpoint", "reason"] as const,
  registers: [register],
});

export const doctorChatFallbackTotal = new Counter({
  name: "doctor_chat_fallback_total",
  help: "Total doctor chat fallbacks to local rules engine",
  labelNames: ["reason"] as const,
  registers: [register],
});

export const doctorChatClinicalSafetyTotal = new Counter({
  name: "doctor_chat_clinical_safety_total",
  help: "Clinical safety gate outcomes for doctor chat by risk and evidence confidence",
  labelNames: ["risk_level", "evidence_confidence", "outcome"] as const,
  registers: [register],
});

export async function getPrometheusMetrics(): Promise<string> {
  return register.metrics();
}

export function getPrometheusContentType(): string {
  return register.contentType;
}

export function observeRequest(route: string, method: string, status: number, durationMs: number): void {
  const labels = { route, method, status: String(status) };
  requestsTotal.inc(labels, 1);
  requestDurationSeconds.observe(labels, durationMs / 1000);
}

export function observeDbQuery(model: string, operation: string, durationMs: number): void {
  dbQueryDurationSeconds.observe({ model, operation }, durationMs / 1000);
}

export function observeRedisLatency(operation: string, durationMs: number): void {
  redisLatencySeconds.observe({ operation }, durationMs / 1000);
}

export function observeStageLatency(stage: string, durationMs: number): void {
  stageLatencySeconds.observe({ stage }, durationMs / 1000);
}

export function incQueueProcessed(queue: string, stage: string): void {
  queueJobsProcessed.inc({ queue, stage }, 1);
}

export function incQueueFailed(queue: string, stage: string): void {
  queueJobsFailed.inc({ queue, stage }, 1);
}

export function setQueueActive(queue: string, active: number): void {
  queueActiveJobs.set({ queue }, active);
}

export function observeAppointmentEngineDecision(input: {
  outcome: "assigned" | "no_availability" | "error";
  fallbackUsed: boolean;
  durationMs: number;
  attempts: number;
}): void {
  const labels = {
    outcome: input.outcome,
    fallback: input.fallbackUsed ? "yes" : "no",
  };

  appointmentEngineDecisionsTotal.inc(labels, 1);
  appointmentEngineDecisionSeconds.observe(labels, input.durationMs / 1000);
  appointmentEngineAttemptsHistogram.observe({ outcome: input.outcome }, input.attempts);
}

export function incAppointmentEngineConflict(type: "overlap" | "rule_mismatch"): void {
  appointmentEngineConflictsTotal.inc({ type }, 1);
}

export function observeNoShowPrediction(input: {
  source: "appointment" | "slot";
  probability: number;
  riskLevel: "bajo" | "medio" | "alto";
}): void {
  noShowPredictionsTotal.inc({ source: input.source, risk_level: input.riskLevel }, 1);
  noShowPredictionProbability.observe({ source: input.source }, input.probability);
}

export function observeRecommendationGeneration(input: {
  durationMs: number;
  slots: number;
}): void {
  const bucket = input.slots <= 5 ? "small" : input.slots <= 15 ? "medium" : "large";
  recommendationGenerationSeconds.observe({ slot_count_bucket: bucket }, input.durationMs / 1000);
}

export function incOverbookingDecision(decision: "allowed" | "denied"): void {
  overbookingDecisionsTotal.inc({ decision }, 1);
}

export function observeMedicalImagingInference(input: {
  model: string;
  outcome: "success" | "blocked_latency" | "error" | "fallback" | "no_model";
  durationMs: number;
}): void {
  const labels = {
    model: input.model,
    outcome: input.outcome,
  };

  medicalImagingInferenceTotal.inc(labels, 1);
  medicalImagingInferenceSeconds.observe(labels, input.durationMs / 1000);
}

export function incDoctorChatFetchFailed(endpoint: string, reason: string): void {
  doctorChatFetchFailedTotal.inc({ endpoint, reason }, 1);
}

export function incDoctorChatFallback(reason: string): void {
  doctorChatFallbackTotal.inc({ reason }, 1);
}

export function incDoctorChatClinicalSafety(
  riskLevel: "low" | "moderate" | "high" | "critical",
  evidenceConfidence: "verified_guideline" | "literature_supported" | "weak_evidence" | "unsupported",
  outcome: "allowed" | "blocked",
): void {
  doctorChatClinicalSafetyTotal.inc(
    {
      risk_level: riskLevel,
      evidence_confidence: evidenceConfidence,
      outcome,
    },
    1,
  );
}

export type AlertSnapshot = {
  errorRate: number;
  p95LatencySeconds: number;
  queueActive: number;
  triggerErrorRate: boolean;
  triggerLatency: boolean;
  triggerQueueBacklog: boolean;
};

export function evaluateAlerts(input: {
  totalProcessed: number;
  totalFailed: number;
  p95LatencySeconds: number;
  queueActive: number;
  queueThreshold: number;
}): AlertSnapshot {
  const denominator = input.totalProcessed + input.totalFailed;
  const errorRate = denominator > 0 ? input.totalFailed / denominator : 0;
  return {
    errorRate,
    p95LatencySeconds: input.p95LatencySeconds,
    queueActive: input.queueActive,
    triggerErrorRate: errorRate > 0.05,
    triggerLatency: input.p95LatencySeconds > 2,
    triggerQueueBacklog: input.queueActive > input.queueThreshold,
  };
}
