import type { HumanReviewFlags } from "./types";

export const DEFAULT_HUMAN_REVIEW_FLAGS: HumanReviewFlags = {
  enabled: false,
  shadowMode: true,
  blockingEnabled: false,
  imageRequired: true,
  lowConfidenceRequired: true,
  multimodalRequired: true,
  highRiskRequired: true,
  overrideEnabled: false,
};

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

export function loadHumanReviewFlags(env: NodeJS.ProcessEnv = process.env): HumanReviewFlags {
  return {
    enabled: readBoolean(env.HUMAN_REVIEW_ENABLED, DEFAULT_HUMAN_REVIEW_FLAGS.enabled),
    shadowMode: readBoolean(env.HUMAN_REVIEW_SHADOW_MODE, DEFAULT_HUMAN_REVIEW_FLAGS.shadowMode),
    blockingEnabled: readBoolean(env.HUMAN_REVIEW_BLOCKING_ENABLED, DEFAULT_HUMAN_REVIEW_FLAGS.blockingEnabled),
    imageRequired: readBoolean(env.HUMAN_REVIEW_IMAGE_REQUIRED, DEFAULT_HUMAN_REVIEW_FLAGS.imageRequired),
    lowConfidenceRequired: readBoolean(
      env.HUMAN_REVIEW_LOW_CONFIDENCE_REQUIRED,
      DEFAULT_HUMAN_REVIEW_FLAGS.lowConfidenceRequired,
    ),
    multimodalRequired: readBoolean(
      env.HUMAN_REVIEW_MULTIMODAL_REQUIRED,
      DEFAULT_HUMAN_REVIEW_FLAGS.multimodalRequired,
    ),
    highRiskRequired: readBoolean(env.HUMAN_REVIEW_HIGH_RISK_REQUIRED, DEFAULT_HUMAN_REVIEW_FLAGS.highRiskRequired),
    overrideEnabled: readBoolean(env.HUMAN_OVERRIDE_ENABLED, DEFAULT_HUMAN_REVIEW_FLAGS.overrideEnabled),
  };
}
