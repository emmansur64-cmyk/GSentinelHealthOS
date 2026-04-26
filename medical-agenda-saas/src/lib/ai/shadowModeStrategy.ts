export type PredictionModelMode = "heuristic" | "shadow" | "python";

export type ShadowModeStrategySnapshot = {
  mode: PredictionModelMode;
  pythonEndpoint: string | null;
  abTrafficRatio: number;
  maxAllowedDelta: number;
  currentVariantWeights: {
    control: number;
    candidate: number;
  };
  isPythonConfigured: boolean;
  recommendedRolloutStage: "stage_0" | "stage_1" | "stage_2" | "stage_3";
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return value;
}

export function getPredictionModelMode(): PredictionModelMode {
  const raw = (process.env.PREDICTION_MODEL_MODE ?? "heuristic").trim().toLowerCase();
  if (raw === "python") return "python";
  if (raw === "shadow") return "shadow";
  return "heuristic";
}

export function getShadowModeStrategySnapshot(): ShadowModeStrategySnapshot {
  const mode = getPredictionModelMode();
  const pythonEndpoint = process.env.PREDICTION_PYTHON_ENDPOINT?.trim() || null;
  const abTrafficRatio = clamp(parseNumberEnv("PREDICTION_AB_TRAFFIC_RATIO", 0.1), 0, 1);
  const maxAllowedDelta = clamp(parseNumberEnv("PREDICTION_MAX_ALLOWED_DELTA", 0.08), 0.005, 0.5);
  const isPythonConfigured = Boolean(pythonEndpoint);

  const recommendedRolloutStage =
    mode === "heuristic"
      ? "stage_0"
      : mode === "shadow"
        ? "stage_1"
        : isPythonConfigured
          ? "stage_3"
          : "stage_2";

  return {
    mode,
    pythonEndpoint,
    abTrafficRatio,
    maxAllowedDelta,
    currentVariantWeights: {
      control: Number((1 - abTrafficRatio).toFixed(4)),
      candidate: Number(abTrafficRatio.toFixed(4)),
    },
    isPythonConfigured,
    recommendedRolloutStage,
  };
}
