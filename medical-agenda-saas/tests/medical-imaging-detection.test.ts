import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}), { virtual: true });

import { detectMedicalImageInput } from "@/medical-imaging/imaging.service";

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
});
