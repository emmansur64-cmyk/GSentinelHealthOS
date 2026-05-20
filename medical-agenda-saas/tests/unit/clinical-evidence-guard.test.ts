import { describe, expect, it } from "vitest";

import { evaluateClinicalSafetyGuard } from "@/chat/clinical-evidence-guard";

describe("clinical evidence guard", () => {
  it("blocks critical risk when no verified guideline evidence is available", () => {
    const result = evaluateClinicalSafetyGuard({
      message: "Paciente con sepsis y shock, considerar manejo UCI",
      response: "Sugerir manejo inicial y vasopresores.",
      requiresClinicalContract: true,
      evidenceUrls: [],
    });

    expect(result.riskLevel).toBe("critical");
    expect(result.evidenceConfidence).toBe("unsupported");
    expect(result.blocked).toBe(true);
  });

  it("allows critical risk only with verified guideline evidence", () => {
    const result = evaluateClinicalSafetyGuard({
      message: "Paciente con sepsis y shock",
      response: "Aplicar bundles institucionales y reevaluar.",
      requiresClinicalContract: true,
      evidenceUrls: ["https://www.cdc.gov/sepsis/clinical-tools/index.html"],
    });

    expect(result.riskLevel).toBe("critical");
    expect(result.evidenceConfidence).toBe("verified_guideline");
    expect(result.blocked).toBe(false);
  });

  it("blocks high risk with weak evidence", () => {
    const result = evaluateClinicalSafetyGuard({
      message: "Definir anticoagulacion en paciente de alto riesgo",
      response: "Ajustar esquema anticoagulante segun criterio.",
      requiresClinicalContract: true,
      evidenceUrls: [],
    });

    expect(result.riskLevel).toBe("high");
    expect(result.blocked).toBe(true);
  });
});

