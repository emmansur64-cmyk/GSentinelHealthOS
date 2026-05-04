import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}), { virtual: true });

import { analyzeMedicalImage, detectMedicalImageInput } from "@/medical-imaging/imaging.service";
import { renderDicomToPng } from "@/medical-imaging/dicom-renderer.service";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DOCUMENT_AI_ENABLED;
  delete process.env.DOCUMENT_AI_API_KEY;
  delete process.env.DOCUMENT_AI_BASE_URL;
  delete process.env.DOCUMENT_AI_MODEL;
  delete process.env.DOCUMENT_AI_PROVIDER;
  delete process.env.DOCUMENT_AI_TIMEOUT_MS;
  delete process.env.DOCUMENT_AI_MAX_RETRIES;
});

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function tag(group: number, element: number): number[] {
  return [...u16(group), ...u16(element)];
}

function ascii(value: string): number[] {
  return Array.from(Buffer.from(value.length % 2 === 0 ? value : `${value} `, "ascii"));
}

function elementUs(group: number, element: number, value: number): number[] {
  return [...tag(group, element), ...ascii("US"), ...u16(2), ...u16(value)];
}

function elementCs(group: number, element: number, value: string): number[] {
  const body = ascii(value);
  return [...tag(group, element), ...ascii("CS"), ...u16(body.length), ...body];
}

function elementUi(group: number, element: number, value: string): number[] {
  const raw = value.endsWith("\0") ? value : `${value}\0`;
  const body = Array.from(Buffer.from(raw.length % 2 === 0 ? raw : `${raw}\0`, "ascii"));
  return [...tag(group, element), ...ascii("UI"), ...u16(body.length), ...body];
}

function elementOw(group: number, element: number, bytes: number[]): number[] {
  return [...tag(group, element), ...ascii("OW"), 0, 0, ...u32(bytes.length), ...bytes];
}

function buildMinimalDicom(): Buffer {
  const preamble = new Array(128).fill(0);
  const prefix = Array.from(Buffer.from("DICM", "ascii"));
  const pixelValues = [0, 1024, 2048, 4095].flatMap(u16);

  return Buffer.from([
    ...preamble,
    ...prefix,
    ...elementUi(0x0002, 0x0010, "1.2.840.10008.1.2.1"),
    ...elementUs(0x0028, 0x0002, 1),
    ...elementCs(0x0028, 0x0004, "MONOCHROME2"),
    ...elementUs(0x0028, 0x0010, 2),
    ...elementUs(0x0028, 0x0011, 2),
    ...elementUs(0x0028, 0x0100, 16),
    ...elementUs(0x0028, 0x0101, 16),
    ...elementUs(0x0028, 0x0102, 15),
    ...elementUs(0x0028, 0x0103, 0),
    ...elementOw(0x7fe0, 0x0010, pixelValues),
  ]);
}

describe("medical-imaging detection", () => {
  it("no clasifica planilla de agenda JPG como imagen medica", () => {
    const file = new File([Buffer.from("agenda")], "agenda_marzo_2026.jpg", { type: "image/jpeg" });
    const detection = detectMedicalImageInput(file, file.type);

    expect(detection.isMedicalImage).toBe(false);
  });

  it("detecta imagen medica por nombre clinico en JPG", () => {
    const file = new File([Buffer.alloc(250_000, 1)], "radiografia_torax_control.jpg", { type: "image/jpeg" });
    const detection = detectMedicalImageInput(file, file.type);

    expect(detection.isMedicalImage).toBe(true);
  });

  it("detecta DICOM por extension aunque no tenga nombre descriptivo", () => {
    const file = new File([Buffer.from("dicom")], "scan_001.dcm", { type: "application/octet-stream" });
    const detection = detectMedicalImageInput(file, file.type);

    expect(detection.isMedicalImage).toBe(true);
    expect(detection.extension).toBe("dcm");
  });

  it("renderiza DICOM monocromo sin compresion a PNG", async () => {
    const file = new File([buildMinimalDicom()], "scan_001.dcm", { type: "application/octet-stream" });

    const rendered = await renderDicomToPng(file, file.type);

    expect(rendered).not.toBeNull();
    expect(rendered?.mimeType).toBe("image/png");
    expect(rendered?.width).toBe(2);
    expect(rendered?.height).toBe(2);
    expect(rendered?.buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  });

  it("usa analisis visual IA cuando no hay ONNX disponible y DOCUMENT_AI esta habilitado", async () => {
    process.env.DOCUMENT_AI_ENABLED = "true";
    process.env.DOCUMENT_AI_API_KEY = "test-key";
    process.env.DOCUMENT_AI_PROVIDER = "groq";
    process.env.DOCUMENT_AI_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.DOCUMENT_AI_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
    process.env.DOCUMENT_AI_MAX_RETRIES = "0";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  study_type: "XRAY",
                  region: "chest",
                  quality: "medium",
                  findings: ["opacidad basal derecha no concluyente"],
                  condition: "hallazgo radiografico no concluyente",
                  probability: 0.62,
                  technical_description: "Radiografia de torax renderizada.",
                  limitations: "Imagen aislada sin proyeccion lateral ni informe formal.",
                  recommendation: "Correlacionar con clinica e informe radiologico.",
                  confidence_score: 0.66,
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const file = new File([Buffer.alloc(250_000, 1)], "radiografia_torax_control.jpg", { type: "image/jpeg" });
    const analysis = await analyzeMedicalImage(file, file.type);

    expect(analysis.pipeline).toBe("ai-vision-v1");
    expect(analysis.type).toBe("XRAY");
    expect(analysis.region).toBe("chest");
    expect(analysis.findings).toEqual(["opacidad basal derecha no concluyente"]);
  });
});
