import { afterEach, describe, expect, it, vi } from "vitest";

import { metabrain } from "@/lib/metabrain";

const baseContext = {
  doctor_id: "doctor-1",
  patient: null,
  current_appointment: null,
  recent_history: [],
  conversation_history: [],
  clinical_state: null,
  metadata: {},
};

describe("metabrain social conversation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("responde small-talk social con fecha y evita fallback clinico generico", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00.000Z"));

    const decision = await metabrain.decide({
      role: "DOCTOR",
      message: "como estas hoy sabes que dia es hoy",
      context: baseContext,
    });

    expect(decision.action).toBe("SOCIAL_DATE_QUERY");
    expect(decision.source).toBe("RULES");
    expect(decision.confidence).toBeGreaterThanOrEqual(0.95);
    expect(decision.response).toContain("Estoy bien");
    expect(decision.response).toContain("Hoy es");
    expect(decision.response).not.toContain("MetaBrain responde en modo libre");
  });

  it("responde saludo simple sin caer en GUIDE_GENERAL", async () => {
    const decision = await metabrain.decide({
      role: "DOCTOR",
      message: "hola",
      context: baseContext,
    });

    expect(decision.action).toBe("SOCIAL_GREETING");
    expect(decision.response).toContain("Hola");
    expect(decision.action).not.toBe("GUIDE_GENERAL");
  });

  it("reconoce variacion 'que dias es hoy' y responde con fecha", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00.000Z"));

    const decision = await metabrain.decide({
      role: "DOCTOR",
      message: "hola sabes que dias es hoy",
      context: baseContext,
    });

    expect(decision.action).toBe("SOCIAL_DATE_QUERY");
    expect(decision.response).toContain("Hoy es");
    expect(decision.response).not.toContain("MetaBrain responde en modo libre");
  });
});
