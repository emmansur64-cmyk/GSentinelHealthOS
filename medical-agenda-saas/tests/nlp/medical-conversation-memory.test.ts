import { describe, expect, it } from "vitest";

import { buildMedicalConversationMemory } from "@/lib/medical-conversation-memory";

describe("medical conversation memory", () => {
  it("compresses recent clinical conversation and sanitizes PHI", async () => {
    process.env.MEDICAL_CONVERSATION_MEMORY_ENABLED = "true";
    process.env.MEDICAL_CONVERSATION_MEMORY_MAX_EXCHANGES = "4";
    process.env.MEDICAL_CONVERSATION_MEMORY_MAX_SUMMARY_CHARS = "900";

    const memory = await buildMedicalConversationMemory({
      tenantId: "tenant-a",
      doctorUserId: "doctor-a",
      conversationId: "doctor:doctor-a:patient:patient-a:appointment:none:chat:test",
      patientId: "patient-a",
      appointmentId: null,
      currentMessage: "continuar",
      exchanges: [
        {
          id: "1",
          doctorMessage: "Paciente email test@example.com con telefono +5491111111111. Sospecha de neumonia.",
          assistantResponse: "Conducta: solicitar radiografia y controlar signos de alarma. Considerar amoxicilina.",
          action: "GUIDE_NEXT_STEP",
          source: "GROQ",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(memory?.summary).toContain("[REDACTED_EMAIL]");
    expect(memory?.summary).toContain("[REDACTED_PHONE]");
    expect(memory?.hypotheses.join(" ")).toContain("Sospecha de neumonia");
    expect(memory?.recentDecisions.join(" ")).toContain("Conducta");
    expect(memory?.medicationMentions.join(" ")).toContain("amoxicilina");
    expect(memory?.scope.tenantId).toBe("tenant-a");
    expect(memory?.scope.patientId).toBe("patient-a");
  });

  it("returns null when disabled", async () => {
    process.env.MEDICAL_CONVERSATION_MEMORY_ENABLED = "false";

    const memory = await buildMedicalConversationMemory({
      tenantId: "tenant-a",
      doctorUserId: "doctor-a",
      conversationId: "conversation-a",
      currentMessage: "hola",
      exchanges: [],
    });

    expect(memory).toBeNull();
  });
});

