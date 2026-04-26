import { describe, expect, it } from "vitest";
import {
  detectNegation,
  detectBlockingNegation,
  analyzeNegations,
  _internal,
} from "@/lib/nlp/negation-detector";

describe("negation-detector", () => {
  describe("detectNegation - casos obligatorios del usuario", () => {
    it('detecta "no quiero cancelar" como negación de cancel_appointment', () => {
      const result = detectNegation("no quiero cancelar", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
      expect(result.originalIntent).toBe("cancel_appointment");
    });

    it('detecta "no cambies nada" como negación de reschedule_appointment', () => {
      const result = detectNegation("no cambies nada", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
      expect(result.originalIntent).toBe("reschedule_appointment");
    });

    it('detecta "no puedo ese día" sin bloquear (es disponibilidad, no negación de acción)', () => {
      const result = detectNegation("no puedo ese día", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(false);
      expect(result.pattern).toBe("no_puedo_fecha");
    });
  });

  describe("detectNegation - patrones de negación directa", () => {
    it('bloquea "no lo canceles"', () => {
      const result = detectNegation("no lo canceles", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "no necesito cancelar"', () => {
      const result = detectNegation("no necesito cancelar", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "no voy a cambiar"', () => {
      const result = detectNegation("no voy a cambiar", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "mejor no"', () => {
      const result = detectNegation("mejor no", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "prefiero no"', () => {
      const result = detectNegation("prefiero no cancelar el turno", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "nunca quise cancelar"', () => {
      const result = detectNegation("nunca quise cancelar", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "no dije que cancelen"', () => {
      const result = detectNegation("no dije que cancelen", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "dejalo asi"', () => {
      const result = detectNegation("dejalo asi", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "dejálo como está"', () => {
      const result = detectNegation("dejálo como está", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "sin cancelar"', () => {
      const result = detectNegation("sin cancelar nada", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "no era para cancelar"', () => {
      const result = detectNegation("no era para cancelar", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it('bloquea "no toques el turno"', () => {
      const result = detectNegation("no toques el turno", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });
  });

  describe("detectNegation - variantes de verbos", () => {
    const verbVariants = [
      { verb: "anular", intent: "cancel_appointment" as const },
      { verb: "borrar", intent: "cancel_appointment" as const },
      { verb: "eliminar", intent: "cancel_appointment" as const },
      { verb: "mover", intent: "reschedule_appointment" as const },
      { verb: "reprogramar", intent: "reschedule_appointment" as const },
      { verb: "postergar", intent: "reschedule_appointment" as const },
      { verb: "adelantar", intent: "reschedule_appointment" as const },
      { verb: "modificar", intent: "reschedule_appointment" as const },
    ];

    for (const { verb, intent } of verbVariants) {
      it(`bloquea "no quiero ${verb}" con intent ${intent}`, () => {
        const result = detectNegation(`no quiero ${verb}`, intent);
        expect(result.detected).toBe(true);
        expect(result.blockExecution).toBe(true);
      });
    }
  });

  describe("detectNegation - disponibilidad (no bloquea)", () => {
    it('"no puedo mañana" detecta pero no bloquea', () => {
      const result = detectNegation("no puedo mañana", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(false);
    });

    it('"no voy a poder ir" detecta pero no bloquea', () => {
      const result = detectNegation("no voy a poder ir", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(false);
    });

    it('"no me queda bien ese horario" detecta pero no bloquea', () => {
      const result = detectNegation("no me queda bien ese horario", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(false);
    });

    it('"no me sirve el lunes" detecta pero no bloquea', () => {
      const result = detectNegation("no me sirve el lunes", "reschedule_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(false);
    });
  });

  describe("detectNegation - casos que NO deben detectar negación", () => {
    it('permite "quiero cancelar mi turno" (sin negación)', () => {
      const result = detectNegation("quiero cancelar mi turno", "cancel_appointment");
      expect(result.detected).toBe(false);
      expect(result.blockExecution).toBe(false);
    });

    it('permite "cancelar turno" (sin negación)', () => {
      const result = detectNegation("cancelar turno", "cancel_appointment");
      expect(result.detected).toBe(false);
      expect(result.blockExecution).toBe(false);
    });

    it('permite "necesito cambiar el horario" (sin negación)', () => {
      const result = detectNegation("necesito cambiar el horario", "reschedule_appointment");
      expect(result.detected).toBe(false);
      expect(result.blockExecution).toBe(false);
    });

    it("ignora intents no críticos", () => {
      const result = detectNegation("no quiero", "greeting");
      expect(result.detected).toBe(false);
      expect(result.blockExecution).toBe(false);
    });

    it("ignora create_appointment", () => {
      const result = detectNegation("no quiero turno", "create_appointment");
      expect(result.detected).toBe(false);
      expect(result.blockExecution).toBe(false);
    });
  });

  describe("detectBlockingNegation", () => {
    it("devuelve negación solo si bloquea", () => {
      const result = detectBlockingNegation("no quiero cancelar", "cancel_appointment");
      expect(result.detected).toBe(true);
      expect(result.blockExecution).toBe(true);
    });

    it("ignora negaciones de disponibilidad", () => {
      const result = detectBlockingNegation("no puedo mañana", "reschedule_appointment");
      expect(result.detected).toBe(false);
      expect(result.blockExecution).toBe(false);
    });
  });

  describe("analyzeNegations", () => {
    it("retorna todos los patrones encontrados", () => {
      const results = analyzeNegations("no quiero cancelar");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe("action");
    });

    it("distingue entre action y availability", () => {
      const results = analyzeNegations("no puedo mañana");
      expect(results.some((r) => r.type === "availability")).toBe(true);
    });

    it("retorna array vacío si no hay negaciones", () => {
      const results = analyzeNegations("quiero un turno");
      expect(results).toEqual([]);
    });
  });

  describe("normalizeText", () => {
    const { normalizeText } = _internal;

    it("convierte a minúsculas", () => {
      expect(normalizeText("NO QUIERO")).toBe("no quiero");
    });

    it("elimina acentos para matching", () => {
      expect(normalizeText("mañana")).toBe("manana");
    });

    it("normaliza espacios múltiples", () => {
      expect(normalizeText("no   quiero")).toBe("no quiero");
    });

    it("elimina puntuación", () => {
      expect(normalizeText("no quiero!")).toBe("no quiero");
    });
  });

  describe("respuestas sugeridas", () => {
    it("devuelve suggestedReply para cancel_appointment", () => {
      const result = detectNegation("no quiero cancelar", "cancel_appointment");
      expect(result.suggestedReply).toContain("no");
      expect(result.suggestedReply).toContain("cancelar");
    });

    it("devuelve suggestedReply para reschedule_appointment", () => {
      const result = detectNegation("no cambies", "reschedule_appointment");
      expect(result.suggestedReply).toContain("no");
      expect(result.suggestedReply).toContain("cambiar");
    });
  });

  describe("edge cases", () => {
    it("maneja mensaje vacío", () => {
      const result = detectNegation("", "cancel_appointment");
      expect(result.detected).toBe(false);
    });

    it("maneja mensaje con solo espacios", () => {
      const result = detectNegation("   ", "cancel_appointment");
      expect(result.detected).toBe(false);
    });

    it("no es case sensitive", () => {
      const result = detectNegation("NO QUIERO CANCELAR", "cancel_appointment");
      expect(result.detected).toBe(true);
    });

    it("maneja acentos y tildes", () => {
      const result = detectNegation("no quiero cancelár", "cancel_appointment");
      expect(result.detected).toBe(true);
    });

    it("maneja puntuación extra", () => {
      const result = detectNegation("no quiero cancelar!!!", "cancel_appointment");
      expect(result.detected).toBe(true);
    });
  });
});
