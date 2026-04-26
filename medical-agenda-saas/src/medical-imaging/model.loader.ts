import "server-only";

import fs from "fs";
import path from "path";

import * as ort from "onnxruntime-node";

export type ImagingModelConfig = {
  key: string;
  enabled: boolean;
  study_type: "MRI" | "XRAY" | "CT" | "UNKNOWN";
  path: string;
  input_name: string;
  output_name: string;
  input_size: number;
  channels: 1 | 3;
  mean: number[];
  std: number[];
  output_mode: "multiclass_softmax" | "multilabel_sigmoid";
  threshold?: number;
  labels: string[];
};

type ImagingModelConfigFile = {
  default_model: string;
  models: ImagingModelConfig[];
};

const cachedSessions = new Map<string, ort.InferenceSession>();
let cachedConfigFile: ImagingModelConfigFile | null = null;
let cachedConfigPath = "";

function resolveModelPath(configuredPath: string): string {
  const configured = configuredPath.trim();
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function resolveConfigPath(): string {
  const configured = (process.env.MEDICAL_IMAGING_CONFIG_PATH ?? "models/model_config.json").trim();
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export function isImagingModelEnabled(): boolean {
  return String(process.env.MEDICAL_IMAGING_ENABLE_ONNX ?? "true").toLowerCase() !== "false";
}

export function loadModelConfig(): ImagingModelConfigFile {
  const configPath = resolveConfigPath();
  if (cachedConfigFile && cachedConfigPath === configPath) {
    return cachedConfigFile;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as ImagingModelConfigFile;

  cachedConfigFile = parsed;
  cachedConfigPath = configPath;
  return parsed;
}

export function getEnabledModelConfigs(): ImagingModelConfig[] {
  const config = loadModelConfig();
  return config.models.filter((model) => model.enabled);
}

export function getModelByKey(key: string): ImagingModelConfig | null {
  const config = loadModelConfig();
  return config.models.find((model) => model.key === key) ?? null;
}

export function getDefaultModelConfig(): ImagingModelConfig | null {
  const config = loadModelConfig();
  return config.models.find((model) => model.key === config.default_model) ?? null;
}

export async function loadMedicalImagingSession(modelKey: string): Promise<{
  session: ort.InferenceSession | null;
  modelPath: string;
  config: ImagingModelConfig | null;
  reason?: string;
}> {
  const config = getModelByKey(modelKey);
  const modelPath = resolveModelPath(config?.path ?? "models/medical_model_v1.onnx");

  if (!isImagingModelEnabled()) {
    return { session: null, modelPath, config, reason: "disabled_by_env" };
  }

  if (!config) {
    return { session: null, modelPath, config: null, reason: "config_not_found" };
  }

  if (!fs.existsSync(modelPath)) {
    return { session: null, modelPath, config, reason: "model_not_found" };
  }

  const cached = cachedSessions.get(modelKey);
  if (cached) {
    return { session: cached, modelPath, config };
  }

  const created = await ort.InferenceSession.create(modelPath, {
    executionProviders: ["cpu"],
    graphOptimizationLevel: "all",
  });
  cachedSessions.set(modelKey, created);

  return { session: created, modelPath, config };
}
