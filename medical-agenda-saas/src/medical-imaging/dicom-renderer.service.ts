import "server-only";

import dicomParser from "dicom-parser";
import sharp from "sharp";

import { logServer } from "@/lib/server-logger";

type DicomPixelMeta = {
  rows: number;
  columns: number;
  bitsAllocated: number;
  pixelRepresentation: number;
  samplesPerPixel: number;
  photometricInterpretation: string;
  windowCenter: number | null;
  windowWidth: number | null;
  rescaleSlope: number;
  rescaleIntercept: number;
};

export type RenderedDicomImage = {
  buffer: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  metadata: DicomPixelMeta;
};

function isDicomFile(file: File, mimeType = file.type): boolean {
  const lowerName = file.name.toLowerCase();
  const lowerMime = String(mimeType || "").toLowerCase();
  return (
    lowerName.endsWith(".dcm") ||
    lowerName.endsWith(".dicom") ||
    lowerMime.includes("dicom") ||
    (lowerMime === "application/octet-stream" && (lowerName.includes("dicom") || lowerName.endsWith(".dcm")))
  );
}

function firstNumber(value: string | undefined): number | null {
  if (!value) return null;
  const first = value.split("\\")[0]?.trim();
  const parsed = Number(first);
  return Number.isFinite(parsed) ? parsed : null;
}

function readMeta(dataSet: dicomParser.DataSet): DicomPixelMeta | null {
  const rows = dataSet.uint16("x00280010") ?? 0;
  const columns = dataSet.uint16("x00280011") ?? 0;
  const bitsAllocated = dataSet.uint16("x00280100") ?? 0;
  const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
  const samplesPerPixel = dataSet.uint16("x00280002") ?? 1;
  const photometricInterpretation = String(dataSet.string("x00280004") ?? "MONOCHROME2").trim().toUpperCase();

  if (!rows || !columns || !bitsAllocated) return null;

  return {
    rows,
    columns,
    bitsAllocated,
    pixelRepresentation,
    samplesPerPixel,
    photometricInterpretation,
    windowCenter: firstNumber(dataSet.string("x00281050")),
    windowWidth: firstNumber(dataSet.string("x00281051")),
    rescaleSlope: firstNumber(dataSet.string("x00281053")) ?? 1,
    rescaleIntercept: firstNumber(dataSet.string("x00281052")) ?? 0,
  };
}

function readPixelValue(bytes: Uint8Array, offset: number, index: number, meta: DicomPixelMeta): number {
  if (meta.bitsAllocated === 8) {
    return bytes[offset + index] ?? 0;
  }

  const byteOffset = offset + index * 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset + byteOffset, 2);
  const raw = meta.pixelRepresentation === 1 ? view.getInt16(0, true) : view.getUint16(0, true);
  return raw * meta.rescaleSlope + meta.rescaleIntercept;
}

function applyWindow(value: number, min: number, max: number, meta: DicomPixelMeta): number {
  const width = meta.windowWidth && meta.windowWidth > 0 ? meta.windowWidth : max - min;
  const center = meta.windowCenter ?? min + width / 2;
  const low = center - width / 2;
  const high = center + width / 2;
  if (high <= low) return 0;
  return Math.max(0, Math.min(255, Math.round(((value - low) / (high - low)) * 255)));
}

function pixelsToGrayscale(bytes: Uint8Array, pixelOffset: number, meta: DicomPixelMeta): Buffer {
  const totalPixels = meta.rows * meta.columns;
  const values = new Float32Array(totalPixels);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < totalPixels; i += 1) {
    const value = readPixelValue(bytes, pixelOffset, i, meta);
    values[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const output = Buffer.alloc(totalPixels);
  const invert = meta.photometricInterpretation === "MONOCHROME1";
  for (let i = 0; i < totalPixels; i += 1) {
    const mapped = applyWindow(values[i] ?? min, min, max, meta);
    output[i] = invert ? 255 - mapped : mapped;
  }

  return output;
}

export async function renderDicomToPng(file: File, mimeType = file.type): Promise<RenderedDicomImage | null> {
  if (!isDicomFile(file, mimeType)) return null;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dataSet = dicomParser.parseDicom(bytes);
    const pixelElement = dataSet.elements.x7fe00010;
    const meta = readMeta(dataSet);

    if (!pixelElement || !meta) return null;
    if (pixelElement.encapsulatedPixelData || pixelElement.fragments?.length) {
      logServer("warn", "medical_imaging.dicom_render_unsupported_transfer_syntax", {
        file_name: file.name,
        transfer_syntax: dataSet.string("x00020010") ?? null,
      });
      return null;
    }
    if (![8, 16].includes(meta.bitsAllocated) || meta.samplesPerPixel !== 1) {
      logServer("warn", "medical_imaging.dicom_render_unsupported_pixel_format", {
        file_name: file.name,
        bits_allocated: meta.bitsAllocated,
        samples_per_pixel: meta.samplesPerPixel,
        photometric_interpretation: meta.photometricInterpretation,
      });
      return null;
    }

    const grayscale = pixelsToGrayscale(bytes, pixelElement.dataOffset, meta);
    const buffer = await sharp(grayscale, {
      raw: {
        width: meta.columns,
        height: meta.rows,
        channels: 1,
      },
    })
      .png()
      .toBuffer();

    return {
      buffer,
      mimeType: "image/png",
      width: meta.columns,
      height: meta.rows,
      metadata: meta,
    };
  } catch (error) {
    logServer("warn", "medical_imaging.dicom_render_failed", {
      file_name: file.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
