import "server-only";

import * as ort from "onnxruntime-node";
import sharp from "sharp";

import type { ImagingModelConfig } from "@/medical-imaging/model.loader";

function normalize(value: number, mean: number, std: number): number {
  const scaled = value / 255;
  return (scaled - mean) / Math.max(std, 1e-9);
}

export async function buildOnnxInputTensor(file: File, config: ImagingModelConfig): Promise<ort.Tensor> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const resized = await sharp(bytes)
    .resize(config.input_size, config.input_size, { fit: "fill" })
    .removeAlpha()
    .toColourspace(config.channels === 1 ? "b-w" : "srgb")
    .raw()
    .toBuffer();

  const channels = config.channels;
  const width = config.input_size;
  const height = config.input_size;
  const plane = width * height;
  const output = new Float32Array(channels * plane);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelBase = (y * width + x) * channels;
      const idx = y * width + x;
      for (let c = 0; c < channels; c += 1) {
        const src = resized[pixelBase + c] ?? 0;
        output[c * plane + idx] = normalize(src, config.mean[c] ?? config.mean[0] ?? 0.5, config.std[c] ?? config.std[0] ?? 0.25);
      }
    }
  }

  return new ort.Tensor("float32", output, [1, channels, height, width]);
}
