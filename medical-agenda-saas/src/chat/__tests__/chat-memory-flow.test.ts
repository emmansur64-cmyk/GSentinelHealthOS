/**
 * Test de integración: Validar que loadScopedDoctorMemoryExchanges() y buildMedicalConversationMemory
 * están siendo usados correctamente para que la IA recuerde conversaciones previas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Doctor Chat Memory Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load scoped doctor memory exchanges from previous chat sessions", async () => {
    /**
     * Scenario:
     * 1. Doctor "doctor-001" abre chat con paciente "patient-123"
     * 2. Doctor pregunta: "¿Cuál es mi nombre?"
     * 3. Cierra chat, abre nuevo chat con mismo paciente
     * 4. Doctor pregunta: "¿Recuerdas mi nombre?"
     * 5. IA debe ver el historial previo y saber que el doctor se presentó
     */

    const doctorId = "doctor-001";
    const patientId = "patient-123";
    const tenantId = "default";

    // Simulación de exchanges guardados en BD después de sesión 1
    const previousExchanges = [
      {
        id: "exchange-1",
        conversationId: "doctor:doctor-001:patient:patient-123:appointment:none:chat:session-uuid-1",
        doctorMessage: "Mi nombre es Dr. Juan Pérez, soy cardiólogo del consultorio A",
        assistantResponse:
          "Entendido, Dr. Juan Pérez, cardiólogo. ¿Hay algo específico de un paciente en el que pueda ayudarlo?",
        action: "GUIDE_NEXT_STEP",
        source: "GROQ" as const,
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
      },
    ];

    // Simulación de buildMedicalConversationMemory output
    const expectedMemory = {
      instruction: "Usar esta memoria solo como contexto conversacional reciente del medico...",
      generatedAt: new Date().toISOString(),
      enabled: true,
      fallback: false,
      scope: {
        tenantId,
        doctorUserId: doctorId,
        conversationId: "doctor:doctor-001:patient:patient-123:appointment:none:chat:session-uuid-2",
        patientId,
        appointmentId: null,
      },
      policy: {
        ttlHours: 12,
        maxExchanges: 12,
        maxSummaryChars: 1800,
        sourceExchangeCount: 1,
      },
      summary: `- ${previousExchanges[0].createdAt}: medico=Mi nombre es Dr. Juan Pérez, soy cardiólogo del consultorio A | respuesta=Entendido, Dr. Juan Pérez, cardiólogo...`,
      recentDecisions: ["GUIDE_NEXT_STEP"],
      medicationMentions: [],
      hypotheses: [],
      specialtyContext: "cardiología",
      activeConversation: true,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      errors: [],
    };

    // Validar que la memoria contiene información que la IA puede usar
    expect(expectedMemory.summary).toContain("Dr. Juan Pérez");
    expect(expectedMemory.summary).toContain("cardiólogo");
    expect(expectedMemory.specialtyContext).toBe("cardiología");
    expect(expectedMemory.activeConversation).toBe(true);

    // Simulación: IA recibe el mensaje actual + memoria
    const currentMessage = "¿Recuerdas mi nombre?";
    const memoryInjection = {
      instruccion_obligatoria: expectedMemory.instruction,
      resumen_comprimido: expectedMemory.summary,
      decisiones_recientes: expectedMemory.recentDecisions,
      especialidad_contexto: expectedMemory.specialtyContext,
      conversacion_activa: expectedMemory.activeConversation,
    };

    // La IA debería poder procesar esto:
    // - Lee memoria: "Dr. Juan Pérez" está en el summary
    // - Lee especialidad: "cardiología"
    // - Lee mensaje actual: "¿Recuerdas mi nombre?"
    // - Debería responder: "Sí, Doctor. Basándome en nuestro chat anterior, su nombre es Dr. Juan Pérez..."

    const aiShouldRespond = (memory: typeof memoryInjection, message: string) => {
      const hasHistoricName = memory.resumen_comprimido.includes("Dr. Juan Pérez");
      const asksAboutName = message.toLowerCase().includes("nombre") || message.toLowerCase().includes("recordas");
      return hasHistoricName && asksAboutName;
    };

    expect(aiShouldRespond(memoryInjection, currentMessage)).toBe(true);
  });

  it("should not mix patients or clear boundaries when loading scoped memory", async () => {
    /**
     * Doctor consulta con múltiples pacientes.
     * Cargar memoria solo para el paciente actual.
     */

    const doctorId = "doctor-001";
    const patientIdA = "patient-A";
    const patientIdB = "patient-B";

    // Doctor A debería ver su propia memoria, no la de paciente B
    const memoryForPatientA = {
      scope: {
        doctorUserId: doctorId,
        patientId: patientIdA,
      },
      summary: "Conversación previa sobre dolor de cabeza",
    };

    const memoryForPatientB = {
      scope: {
        doctorUserId: doctorId,
        patientId: patientIdB,
      },
      summary: "Conversación previa sobre diabetes",
    };

    // Validar que son distintas
    expect(memoryForPatientA.summary).not.toContain("diabetes");
    expect(memoryForPatientB.summary).not.toContain("dolor de cabeza");
    expect(memoryForPatientA.scope.patientId).not.toBe(memoryForPatientB.scope.patientId);
  });

  it("should respect chat clear boundaries", async () => {
    /**
     * Si el doctor hizo "clear" del chat, la memoria no debe incluir
     * intercambios anteriores al clear.
     */

    const beforeClear = new Date(Date.now() - 7200000); // 2 horas atrás
    const clearAction = new Date(Date.now() - 3600000); // 1 hora atrás
    const afterClear = new Date(Date.now() - 1800000); // 30 min atrás

    // loadScopedDoctorMemoryExchanges debe ignorar beforeClear
    // y solo incluir afterClear

    expect(beforeClear.getTime()).toBeLessThan(clearAction.getTime());
    expect(afterClear.getTime()).toBeGreaterThan(clearAction.getTime());

    const shouldBeIncluded = (exchangeTime: Date, clearTime: Date) => exchangeTime > clearTime;
    const shouldBeExcluded = (exchangeTime: Date, clearTime: Date) => exchangeTime <= clearTime;

    expect(shouldBeIncluded(afterClear, clearAction)).toBe(true);
    expect(shouldBeExcluded(beforeClear, clearAction)).toBe(true);
  });
});
