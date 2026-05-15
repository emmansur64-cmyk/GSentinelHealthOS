import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-logger", () => ({
  logServer: vi.fn(),
  logServerError: vi.fn(),
}));

const baseInput = {
  role: "DOCTOR" as const,
  message: "Necesito orientar diagnostico diferencial y conducta inicial",
  context: {
    doctor_id: "doctor-1",
    patient: {
      id: "patient-1",
      name: "Paciente Test",
      phone: "+5491111111111",
      notes: "Antecedente de hipertension",
    },
    current_appointment: null,
    recent_history: [],
    conversation_history: [],
    clinical_state: "Dolor toracico de 2 horas de evolucion",
    metadata: {
      conversation_id: "doctor:doctor-1:patient:patient-1:appointment:none",
    },
  },
};

describe("callGroqDoctorChat", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DOCTOR_CHAT_GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.DOCUMENT_AI_API_KEY;
    delete process.env.DOCUMENT_AI_PROVIDER;
    delete process.env.DOCUMENT_AI_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("no llama a Groq si no hay API key configurada", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    const result = await callGroqDoctorChat(baseInput);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia el chat libre del doctor a Groq y normaliza la respuesta", async () => {
    process.env.DOCTOR_CHAT_GROQ_API_KEY = "test-groq-key";
    process.env.DOCTOR_CHAT_GROQ_MODEL = "llama-test-model";
    process.env.DOCTOR_CHAT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.DOCTOR_CHAT_GROQ_TIMEOUT_MS = "5000";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "llama-test-model",
        choices: [
          {
            message: {
              content: "Respuesta clinica libre generada por Groq.",
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    const result = await callGroqDoctorChat(baseInput);

    expect(result).toEqual({
      action: "GROQ_FREE_CHAT",
      response: "Respuesta clinica libre generada por Groq.",
      confidence: 0.92,
      source: "GROQ",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-groq-key",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("llama-test-model");
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: baseInput.message,
    });
    expect(JSON.stringify(body.messages)).toContain("El chat es libre");
    expect(JSON.stringify(body.messages)).toContain("Dolor toracico");
  });

  it("incluye runtime context como informacion auxiliar si esta presente", async () => {
    process.env.DOCTOR_CHAT_GROQ_API_KEY = "test-groq-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Respuesta clinica considerando contexto auxiliar.",
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    const result = await callGroqDoctorChat({
      ...baseInput,
      context: {
        ...baseInput.context,
        metadata: {
          ...baseInput.context.metadata,
          medical_runtime_context: {
            instruction:
              "Usar este contexto solo como informacion auxiliar. No asumir causalidad clinica automatica. No reemplazar criterio medico.",
            generatedAt: "2026-05-09T12:00:00.000Z",
            enabled: true,
            fallback: false,
            errors: [],
            cache: { key: "test", hit: false, ttlSeconds: 900 },
            time: {
              timestamp: "2026-05-09T12:00:00.000Z",
              timezone: "America/Argentina/Buenos_Aires",
              localDate: "2026-05-09",
              localTime: "09:00",
              dayOfWeek: "Saturday",
              isNightShift: false,
              season: "autumn",
              temporalContext: "daytime_or_standard_clinic_hours",
            },
            weather: null,
            environmentalAlerts: [],
            epidemiology: {
              source: "placeholder_v1_no_external_epidemiology_fetch",
              respiratoryOutbreaks: [],
              dengueVectorAlerts: [],
              influenzaAlerts: [],
              notes: [],
            },
          },
        },
      },
    });

    expect(result?.source).toBe("GROQ");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(JSON.stringify(body.messages)).toContain("usa el RUNTIME CONTEXT provisto");
    expect(JSON.stringify(body.messages)).toContain("RUNTIME CONTEXT");
    expect(JSON.stringify(body.messages)).toContain("No asumir causalidad clinica automatica");
  });

  it("usa runtime context para preguntas simples de fecha y hora", async () => {
    process.env.DOCTOR_CHAT_GROQ_API_KEY = "test-groq-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hoy es sabado 9 de mayo de 2026." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtimeContext = {
      instruction:
        "Usar este contexto solo como informacion auxiliar. No asumir causalidad clinica automatica. No reemplazar criterio medico.",
      generatedAt: "2026-05-09T14:00:00.000Z",
      enabled: true,
      fallback: false,
      errors: [],
      cache: { key: "test", hit: false, ttlSeconds: 900 },
      time: {
        timestamp: "2026-05-09T14:00:00.000Z",
        timezone: "America/Argentina/Buenos_Aires",
        localDate: "2026-05-09",
        localTime: "11:00",
        dayOfWeek: "Saturday",
        isNightShift: false,
        season: "autumn",
        temporalContext: "daytime_or_standard_clinic_hours",
      },
      weather: null,
      environmentalAlerts: [],
      epidemiology: {
        source: "placeholder_v1_no_external_epidemiology_fetch",
        respiratoryOutbreaks: [],
        dengueVectorAlerts: [],
        influenzaAlerts: [],
        notes: [],
      },
    };

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    for (const message of ["hola sabes qué día es hoy", "qué hora es aproximadamente", "estamos de noche o de día"]) {
      await callGroqDoctorChat({
        ...baseInput,
        message,
        context: {
          ...baseInput.context,
          metadata: {
            ...baseInput.context.metadata,
            medical_runtime_context: runtimeContext,
          },
        },
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      const [, init] = call as [string, RequestInit];
      const body = JSON.parse(String(init.body));
      expect(JSON.stringify(body.messages)).toContain("RUNTIME CONTEXT");
      expect(JSON.stringify(body.messages)).toContain("2026-05-09");
      expect(JSON.stringify(body.messages)).toContain("11:00");
      expect(JSON.stringify(body.messages)).toContain("usa el RUNTIME CONTEXT provisto");
    }
  });

  it("incluye memoria clinica conversacional si esta presente", async () => {
    process.env.DOCTOR_CHAT_GROQ_API_KEY = "test-groq-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Continuo con el razonamiento previo." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    await callGroqDoctorChat({
      ...baseInput,
      message: "seguimos con la conducta?",
      context: {
        ...baseInput.context,
        metadata: {
          ...baseInput.context.metadata,
          medical_conversation_memory: {
            instruction:
              "Usar esta memoria solo como contexto conversacional reciente del medico. No mezclar pacientes ni tenants.",
            generatedAt: "2026-05-09T14:00:00.000Z",
            enabled: true,
            fallback: false,
            scope: {
              tenantId: "tenant-a",
              doctorUserId: "doctor-a",
              conversationId: "conversation-a",
              patientId: "patient-a",
              appointmentId: null,
            },
            policy: {
              ttlHours: 12,
              maxExchanges: 12,
              maxSummaryChars: 1800,
              sourceExchangeCount: 2,
            },
            summary: "- medico=hipotesis neumonia | respuesta=conducta solicitar radiografia",
            recentDecisions: ["conducta solicitar radiografia"],
            medicationMentions: ["amoxicilina"],
            hypotheses: ["hipotesis neumonia"],
            specialtyContext: "clinica medica",
            activeConversation: true,
            expiresAt: "2026-05-10T02:00:00.000Z",
            errors: [],
          },
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(JSON.stringify(body.messages)).toContain("MEMORIA CLINICA CONVERSACIONAL");
    expect(JSON.stringify(body.messages)).toContain("hipotesis neumonia");
    expect(JSON.stringify(body.messages)).toContain("amoxicilina");
  });

  it("incluye structured medical reasoning si esta presente", async () => {
    process.env.DOCTOR_CHAT_GROQ_API_KEY = "test-groq-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Respuesta con razonamiento estructurado." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    await callGroqDoctorChat({
      ...baseInput,
      context: {
        ...baseInput.context,
        metadata: {
          ...baseInput.context.metadata,
          medical_reasoning: {
            instruction:
              "Responder con razonamiento clinico estructurado. No afirmar diagnosticos absolutos. No reemplazar criterio medico. No inventar evidencia.",
            specialty: "emergency",
            severity: "urgent",
            requiredSections: [
              "Resumen clinico",
              "Hipotesis",
              "Factores de riesgo",
              "Red flags",
              "Evidencia utilizada",
              "Sugerencias de evaluacion",
              "Limitaciones",
              "Disclaimer clinico",
            ],
            specialtyGuidance: ["Priorizar seguridad clinica y triage."],
            emergencyEscalation: "Si hay inestabilidad, recomendar evaluacion urgente.",
            evidencePolicy: "No afirmar que se consulto evidencia externa.",
            fallback: false,
            errors: [],
          },
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(JSON.stringify(body.messages)).toContain("STRUCTURED MEDICAL REASONING");
    expect(JSON.stringify(body.messages)).toContain("Resumen clinico");
    expect(JSON.stringify(body.messages)).toContain("Red flags");
    expect(JSON.stringify(body.messages)).toContain("No afirmar diagnosticos absolutos");
  });

  it("incluye specialty medical protocol si esta presente", async () => {
    process.env.DOCTOR_CHAT_GROQ_API_KEY = "test-groq-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Respuesta adaptada por especialidad." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    await callGroqDoctorChat({
      ...baseInput,
      context: {
        ...baseInput.context,
        metadata: {
          ...baseInput.context.metadata,
          medical_runtime_context: {
            instruction: "Usar fecha/hora solo como contexto auxiliar.",
            time: { localDate: "2026-05-09", localTime: "12:00" },
          },
          medical_web_retrieval: {
            instruction: "Usar evidencia externa controlada solo como apoyo.",
            query: "dolor toracico guia",
            sources: [
              {
                source: "guideline",
                sourceType: "guideline",
                title: "Chest pain guideline",
                url: "https://example.org/guideline",
                fragment: "Evaluar sindrome coronario agudo segun riesgo.",
                date: null,
                confidence: "high",
              },
            ],
          },
          medical_specialty_protocol: {
            instruction: "Adaptar la respuesta al marco de Cardiologia.",
            specialty: "cardiology",
            label: "Cardiologia",
            riskLevel: "caution",
            tone: "preciso",
            reasoningStyle: "priorizar riesgo cardiovascular",
            protocolFocus: ["dolor toracico"],
            redFlags: ["dolor toracico opresivo"],
            evidencePolicy: "Usar retrieval si esta presente.",
            structureHints: ["separar urgencia cardiovascular"],
            riskModifiers: ["umbral bajo de escalamiento"],
            emergencyModifiers: ["derivar si hay inestabilidad"],
            compatibility: { retrieval: "available", runtimeContext: "available" },
            fallback: false,
            errors: [],
          },
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const messages = JSON.stringify(body.messages);
    expect(messages).toContain("SPECIALTY MEDICAL PROTOCOL");
    expect(messages).toContain("Cardiologia");
    expect(messages).toContain("EVIDENCIA MEDICA EXTERNA CONTROLADA");
    expect(messages).toContain("RUNTIME CONTEXT");
  });

  it("incluye doctor profile context si esta presente", async () => {
    process.env.DOCTOR_CHAT_GROQ_API_KEY = "test-groq-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Respuesta adaptada al perfil medico." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callGroqDoctorChat } = await import("@/lib/groq-doctor-chat");
    await callGroqDoctorChat({
      ...baseInput,
      context: {
        ...baseInput.context,
        metadata: {
          ...baseInput.context.metadata,
          doctor_profile_context: {
            instruction:
              "Usar este DOCTOR PROFILE CONTEXT solo para adaptar lenguaje, especialidad, region y preferencias del medico.",
            scope: { tenantId: "tenant-a", doctorUserId: "doctor-a" },
            doctor: { name: "Dra Test", specialty: "Cardiologia", experience: "10 anos" },
            clinic: { name: "Clinica Norte" },
            locale: {
              country: "AR",
              region: "Buenos Aires",
              language: "es-AR",
              timezone: "America/Argentina/Buenos_Aires",
            },
            specialtyContext: ["Priorizar riesgo cardiovascular."],
            regionalGuidelines: ["Adaptar terminologia y contexto sanitario a Argentina."],
            preferences: {
              clinicalStyle: "directo",
              preferredProtocols: ["dolor toracico"],
              evidencePreference: "guias",
            },
            compatibility: { retrieval: "available", runtimeContext: "available" },
            isolation: { tenantScoped: true, doctorScoped: true, sharesAcrossTenants: false },
            fallback: false,
            errors: [],
          },
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const messages = JSON.stringify(body.messages);
    expect(messages).toContain("DOCTOR PROFILE CONTEXT");
    expect(messages).toContain("Cardiologia");
    expect(messages).toContain("tenant-a");
    expect(messages).toContain("America/Argentina/Buenos_Aires");
    expect(messages).toContain("sharesAcrossTenants");
  });
});
