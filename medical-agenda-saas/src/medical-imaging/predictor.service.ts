import "server-only";

import { observeMedicalImagingInference } from "@/lib/observability/metrics";
import { logServer } from "@/lib/server-logger";

import {
  getDefaultModelConfig,
  getEnabledModelConfigs,
  loadMedicalImagingSession,
  type ImagingModelConfig,
} from "@/medical-imaging/model.loader";
import { buildOnnxInputTensor } from "@/medical-imaging/preprocess";

export type ImagingPrediction = {
  study_type: "MRI" | "XRAY" | "CT" | "UNKNOWN";
  region: "knee" | "chest" | "spine" | "unknown";
  findings: string[];
  condition: string;
  probability: number;
  confidence: number;
  notes: string;
  model_key: string;
  model_version: string;
  inference_mode: "onnx" | "structured_fallback";
  elapsed_ms: number;
  blocked_by_latency?: boolean;
};

const MAX_IMAGING_LATENCY_MS = Number(process.env.MEDICAL_IMAGING_MAX_LATENCY_MS ?? "100");

const REGION_HINTS: Array<{ terms: string[]; region: ImagingPrediction["region"] }> = [
  { terms: ["rodilla", "knee"], region: "knee" },
  { terms: ["torax", "chest"], region: "chest" },
  { terms: ["columna", "spine"], region: "spine" },
];

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exp = values.map((v) => Math.exp(v - max));
  const sum = exp.reduce((acc, cur) => acc + cur, 0);
  return exp.map((v) => v / Math.max(sum, 1e-9));
}

function argmax(values: number[]): { index: number; value: number } {
  let index = 0;
  let value = values[0] ?? 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > value) {
      value = values[i];
      index = i;
    }
  }
  return { index, value };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function inferStudyHint(file: File): "MRI" | "CT" | "XRAY" | "UNKNOWN" {
  const lower = `${file.name} ${file.type}`.toLowerCase();
  if (lower.includes("mri") || lower.includes("rmn") || lower.includes("reson")) return "MRI";
  if (lower.includes("tac") || lower.includes("ct") || lower.includes("tomog")) return "CT";
  if (lower.includes("rx") || lower.includes("xray") || lower.includes("radio")) return "XRAY";
  return "UNKNOWN";
}

function inferRegionHint(file: File): ImagingPrediction["region"] {
  const lower = file.name.toLowerCase();
  for (const item of REGION_HINTS) {
    if (item.terms.some((term) => lower.includes(term))) return item.region;
  }
  return "unknown";
}

function pickModelCandidates(studyHint: "MRI" | "CT" | "XRAY" | "UNKNOWN"): ImagingModelConfig[] {
  const enabled = getEnabledModelConfigs();
  const exact = enabled.filter((model) => model.study_type === studyHint);
  const unknown = enabled.filter((model) => model.study_type === "UNKNOWN");
  const fallback = getDefaultModelConfig();

  const ordered = [...exact, ...unknown];
  if (fallback && !ordered.some((item) => item.key === fallback.key)) {
    ordered.push(fallback);
  }
  return ordered;
}

function parseModelOutput(outputValues: number[], config: ImagingModelConfig): { findings: string[]; confidence: number; condition: string; probability: number } {
  if (outputValues.length === 0) {
    return { findings: ["sin hallazgos evidentes"], confidence: 0.5, condition: "sin hallazgos evidentes", probability: 0.5 };
  }

  if (config.output_mode === "multilabel_sigmoid") {
    const threshold = typeof config.threshold === "number" ? config.threshold : 0.35;
    const probs = outputValues.map(sigmoid);
    const withLabels = probs.map((value, index) => ({ label: config.labels[index] ?? `label_${index}`, value }));
    const selected = withLabels.filter((item) => item.value >= threshold).sort((a, b) => b.value - a.value);
    const top = withLabels.sort((a, b) => b.value - a.value)[0];

    return {
      findings: selected.length > 0 ? selected.map((item) => item.label) : [top?.label ?? "sin hallazgos evidentes"],
      confidence: Number((top?.value ?? 0.5).toFixed(2)),
      condition: top?.label ?? "sin hallazgos evidentes",
      probability: Number((top?.value ?? 0.5).toFixed(2)),
    };
  }

  const probs = softmax(outputValues);
  const top = argmax(probs);
  const label = config.labels[top.index] ?? "sin hallazgos evidentes";
  return {
    findings: [label],
    confidence: Number(top.value.toFixed(2)),
    condition: label,
    probability: Number(top.value.toFixed(2)),
  };
}

function fallbackPrediction(fileName: string): ImagingPrediction {
  const lower = fileName.toLowerCase();
  const study: ImagingPrediction["study_type"] =
    lower.includes("mri") || lower.includes("rmn") || lower.includes("reson")
      ? "MRI"
      : lower.includes("tac") || lower.includes("ct") || lower.includes("tomog")
        ? "CT"
        : lower.includes("rx") || lower.includes("xray") || lower.includes("radio")
          ? "XRAY"
          : "UNKNOWN";
  const region: ImagingPrediction["region"] =
    lower.includes("rodilla") || lower.includes("knee")
      ? "knee"
      : lower.includes("torax") || lower.includes("chest")
        ? "chest"
        : lower.includes("columna") || lower.includes("spine")
          ? "spine"
          : "unknown";

  return {
    study_type: study,
    region,
    findings: ["sin hallazgos evidentes"],
    condition: "sin hallazgos evidentes",
    probability: 0.55,
    confidence: 0.55,
    notes: "Analisis asistido en modo fallback estructurado; no reemplaza diagnostico medico.",
    model_key: "structured-v1",
    model_version: "structured-v1",
    inference_mode: "structured_fallback",
    elapsed_ms: 0,
    blocked_by_latency: false,
  };
}

export async function predictMedicalImaging(file: File): Promise<ImagingPrediction> {
  const startedAt = Date.now();
  const studyHint = inferStudyHint(file);
  const regionHint = inferRegionHint(file);
  const candidates = pickModelCandidates(studyHint);

  for (const candidate of candidates) {
    const loader = await loadMedicalImagingSession(candidate.key);
    if (!loader.session || !loader.config) {
      observeMedicalImagingInference({
        model: candidate.key,
        outcome: "no_model",
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    try {
      const inputTensor = await buildOnnxInputTensor(file, loader.config);
      const feeds: Record<string, unknown> = {
        [loader.config.input_name]: inputTensor,
      };
      const output = await loader.session.run(feeds as never);

      const outputTensor =
        output[loader.config.output_name] ??
        output.output ??
        output[Object.keys(output)[0] ?? ""];

      const outputValues = Array.from((outputTensor?.data as Float32Array | number[] | undefined) ?? []);
      if (outputValues.length === 0) {
        continue;
      }

      const parsed = parseModelOutput(outputValues, loader.config);
      const elapsed = Date.now() - startedAt;

      if (elapsed > MAX_IMAGING_LATENCY_MS) {
        observeMedicalImagingInference({
          model: loader.config.key,
          outcome: "blocked_latency",
          durationMs: elapsed,
        });

        logServer("warn", "medical_imaging.inference_blocked_latency", {
          model_key: loader.config.key,
          elapsed_ms: elapsed,
          max_allowed_ms: MAX_IMAGING_LATENCY_MS,
        });

        return {
          ...fallbackPrediction(file.name),
          notes: `Inferencia bloqueada por latencia > ${MAX_IMAGING_LATENCY_MS} ms. Se aplico fallback estructurado.`,
          elapsed_ms: elapsed,
          blocked_by_latency: true,
        };
      }

      observeMedicalImagingInference({
        model: loader.config.key,
        outcome: "success",
        durationMs: elapsed,
      });

      return {
        study_type: loader.config.study_type === "UNKNOWN" ? studyHint : loader.config.study_type,
        region: regionHint,
        findings: parsed.findings,
        condition: parsed.condition,
        probability: parsed.probability,
        confidence: parsed.confidence,
        notes: "Analisis asistido por modelo ONNX preentrenado; no reemplaza diagnostico medico.",
        model_key: loader.config.key,
        model_version: loader.modelPath.split(/[\\/]/).pop() ?? loader.config.key,
        inference_mode: "onnx",
        elapsed_ms: elapsed,
        blocked_by_latency: false,
      };
    } catch (error) {
      observeMedicalImagingInference({
        model: candidate.key,
        outcome: "error",
        durationMs: Date.now() - startedAt,
      });

      logServer("warn", "medical_imaging.model_inference_failed", {
        model_key: candidate.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const fallback = fallbackPrediction(file.name);
  observeMedicalImagingInference({
    model: fallback.model_key,
    outcome: "fallback",
    durationMs: Date.now() - startedAt,
  });

  return {
    ...fallback,
    elapsed_ms: Date.now() - startedAt,
  };
}
