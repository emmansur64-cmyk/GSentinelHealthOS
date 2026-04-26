import "server-only";
import path from "path";
import fs from "fs";
import { logServer, logServerError } from "@/lib/server-logger";

// Vector de features (orden debe coincidir EXACTAMENTE con train_no_show_model.py)
export type OnnxNoShowFeatures = {
  patientNoShowRate: number;     // 0-1
  doctorNoShowRate: number;      // 0-1
  specialtyNoShowRate: number;   // 0-1
  leadTimeNorm: number;          // lead_time_days / 45, capped at 1.0
  isWeekend: boolean;
  isMorning: boolean;            // hour < 12
  isNight: boolean;              // hour >= 18
  isConfirmed: boolean;
};

type OnnxModelMeta = {
  model_version: string;
  trained_at: string;
  n_samples: number;
  auc_roc: number;
  brier_score: number;
};

// onnxruntime-node se importa dinámicamente para que Next.js lo trate
// como paquete externo (serverExternalPackages en next.config.ts) y no
// lo procese con webpack — necesario para addons nativos (.node).
type OrtModule = typeof import("onnxruntime-node");
type InferenceSession = import("onnxruntime-node").InferenceSession;

const MODEL_PATH = path.join(process.cwd(), "models", "no_show_model.onnx");
const META_PATH = path.join(process.cwd(), "models", "no_show_model.json");

let sessionPromise: Promise<InferenceSession | null> | null = null;
let modelMeta: OnnxModelMeta | null = null;
let modelUnavailable = false;

async function loadSession(): Promise<InferenceSession | null> {
  if (!fs.existsSync(MODEL_PATH)) {
    logServer("warn", "Modelo ONNX no encontrado — usando heurística de respaldo", {
      path: MODEL_PATH,
    });
    modelUnavailable = true;
    return null;
  }

  try {
    const ort: OrtModule = await import("onnxruntime-node");
    const session = await ort.InferenceSession.create(MODEL_PATH);

    if (fs.existsSync(META_PATH)) {
      try {
        const raw = fs.readFileSync(META_PATH, "utf-8");
        modelMeta = JSON.parse(raw) as OnnxModelMeta;
        logServer("info", "Modelo ONNX cargado", {
          version: modelMeta.model_version,
          auc_roc: modelMeta.auc_roc,
          n_samples: modelMeta.n_samples,
          trained_at: modelMeta.trained_at,
        });
      } catch {
        logServer("warn", "No se pudo leer metadatos del modelo ONNX");
      }
    }

    return session;
  } catch (err) {
    logServerError("Error al inicializar sesión ONNX — usando heurística de respaldo", err);
    modelUnavailable = true;
    return null;
  }
}

function getSession(): Promise<InferenceSession | null> {
  if (modelUnavailable) return Promise.resolve(null);
  if (!sessionPromise) {
    sessionPromise = loadSession();
  }
  return sessionPromise;
}

/**
 * Retorna la versión del modelo activo.
 * "onnx-gbm-v1" si el modelo ONNX está cargado, "heuristic-logit-v1" si usa fallback.
 */
export function getOnnxModelVersion(): string {
  return modelMeta?.model_version ?? "heuristic-logit-v1";
}

/**
 * Corre inferencia ONNX con los 8 features de no-show.
 * Retorna la probabilidad de ausentismo (0.01–0.99), o null si el modelo
 * no está disponible (el caller debe aplicar la heurística de respaldo).
 */
export async function inferNoShowProbability(
  features: OnnxNoShowFeatures,
): Promise<number | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const ort: OrtModule = await import("onnxruntime-node");

    const input = Float32Array.from([
      features.patientNoShowRate,
      features.doctorNoShowRate,
      features.specialtyNoShowRate,
      features.leadTimeNorm,
      features.isWeekend ? 1 : 0,
      features.isMorning ? 1 : 0,
      features.isNight ? 1 : 0,
      features.isConfirmed ? 1 : 0,
    ]);

    const tensor = new ort.Tensor("float32", input, [1, 8]);
  const feeds = { float_input: tensor };
    const results = await session.run(feeds);

    // skl2onnx con zipmap=False produce un tensor float32 [1, 2]
    // donde índice 1 = P(clase no_show)
    const probOut = results["probabilities"];
    if (probOut?.data) {
      const proba = probOut.data as Float32Array;
      // proba[0] = P(show), proba[1] = P(no_show)
      const p = Number(proba[1]);
      if (Number.isFinite(p)) {
        return Math.min(Math.max(p, 0.01), 0.99);
      }
    }

    // Si skl2onnx usó otro nombre de salida, intentar con el segundo output
    const outputNames = session.outputNames;
    if (outputNames.length >= 2) {
      const altOut = results[outputNames[1]];
      if (altOut?.data) {
        const proba = altOut.data as Float32Array;
        const p = Number(proba[1]);
        if (Number.isFinite(p)) {
          return Math.min(Math.max(p, 0.01), 0.99);
        }
      }
    }

    logServer("warn", "Salida ONNX inesperada — sin tensor de probabilidades válido", {
      outputNames,
    });
    return null;
  } catch (err) {
    logServerError("Error durante inferencia ONNX", err);
    return null;
  }
}
