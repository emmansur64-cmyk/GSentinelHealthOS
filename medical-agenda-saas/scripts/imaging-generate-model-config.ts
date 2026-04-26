import fs from "fs";
import path from "path";

import * as ort from "onnxruntime-node";

type ModelTemplate = {
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

type ConfigTemplate = {
  default_model: string;
  models: ModelTemplate[];
};

type InputMetadataLike = {
  shape?: readonly number[];
  dimensions?: readonly unknown[];
};

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

function inferStudyType(fileName: string): "MRI" | "XRAY" | "CT" | "UNKNOWN" {
  const lower = fileName.toLowerCase();
  if (lower.includes("mri") || lower.includes("rmn") || lower.includes("reson")) return "MRI";
  if (lower.includes("ct") || lower.includes("tac") || lower.includes("tomog")) return "CT";
  if (lower.includes("xray") || lower.includes("rx") || lower.includes("radio") || lower.includes("chex")) return "XRAY";
  return "UNKNOWN";
}

function inferOutputMode(fileName: string): "multiclass_softmax" | "multilabel_sigmoid" {
  const lower = fileName.toLowerCase();
  if (lower.includes("chex") || lower.includes("multi") || lower.includes("hemorrhage")) return "multilabel_sigmoid";
  return "multiclass_softmax";
}

function inferDefaultLabels(studyType: "MRI" | "XRAY" | "CT" | "UNKNOWN"): string[] {
  if (studyType === "XRAY") {
    return ["sin hallazgos evidentes", "posible neumonia", "posible derrame pleural", "posible neumotorax"];
  }
  if (studyType === "CT") {
    return ["sin hallazgos evidentes", "posible hemorragia intracraneal", "posible edema", "posible efecto de masa"];
  }
  if (studyType === "MRI") {
    return ["sin hallazgos evidentes", "posible alteracion meniscal", "posible edema oseo", "posible lesion de tejidos blandos"];
  }
  return ["sin hallazgos evidentes", "hallazgo inespecifico"];
}

function inferInputShape(shapeRaw: unknown): { channels: 1 | 3; inputSize: number } {
  const shape = Array.isArray(shapeRaw) ? shapeRaw : [];
  if (shape.length >= 4) {
    const channelCandidate = Number(shape[1]);
    const sizeCandidate = Number(shape[2]);
    const channels: 1 | 3 = channelCandidate === 1 ? 1 : 3;
    const inputSize = Number.isFinite(sizeCandidate) && sizeCandidate > 0 ? sizeCandidate : 224;
    return { channels, inputSize };
  }
  return { channels: 3, inputSize: 224 };
}

async function inspectModel(modelsDir: string, absoluteFilePath: string): Promise<ModelTemplate> {
  const fileName = path.basename(absoluteFilePath);
  const key = fileName.replace(/\.onnx$/i, "");
  const session = await ort.InferenceSession.create(absoluteFilePath, {
    executionProviders: ["cpu"],
  });

  const inputName = session.inputNames[0] ?? "input";
  const outputName = session.outputNames[0] ?? "output";
  const inputIndex = session.inputNames.findIndex((name) => name === inputName);
  const inputMeta = (inputIndex >= 0 ? session.inputMetadata[inputIndex] : session.inputMetadata[0]) as
    | InputMetadataLike
    | undefined;
  const inputShape = inputMeta?.shape ?? inputMeta?.dimensions;
  const { channels, inputSize } = inferInputShape(inputShape);

  const studyType = inferStudyType(fileName);
  const outputMode = inferOutputMode(fileName);
  const labels = inferDefaultLabels(studyType);
  const mean = channels === 1 ? [0.5] : [0.485, 0.456, 0.406];
  const std = channels === 1 ? [0.25] : [0.229, 0.224, 0.225];

  return {
    key,
    enabled: true,
    study_type: studyType,
    path: path.relative(process.cwd(), absoluteFilePath).replace(/\\/g, "/"),
    input_name: inputName,
    output_name: outputName,
    input_size: inputSize,
    channels,
    mean,
    std,
    output_mode: outputMode,
    ...(outputMode === "multilabel_sigmoid" ? { threshold: 0.35 } : {}),
    labels,
  };
}

async function main() {
  const modelsDirArg = parseArg("--modelsDir", "models");
  const outArg = parseArg("--out", "models/model_config.generated.json");

  const modelsDir = path.isAbsolute(modelsDirArg) ? modelsDirArg : path.join(process.cwd(), modelsDirArg);
  const outPath = path.isAbsolute(outArg) ? outArg : path.join(process.cwd(), outArg);

  const files = fs
    .readdirSync(modelsDir)
    .filter((item) => item.toLowerCase().endsWith(".onnx"))
    .map((item) => path.join(modelsDir, item));

  if (files.length === 0) {
    throw new Error(`No se encontraron archivos ONNX en ${modelsDir}`);
  }

  const models: ModelTemplate[] = [];
  for (const filePath of files) {
    const model = await inspectModel(modelsDir, filePath);
    models.push(model);
  }

  const template: ConfigTemplate = {
    default_model: models[0].key,
    models,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(template, null, 2), "utf-8");

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        models_scanned: models.length,
        output: outPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
