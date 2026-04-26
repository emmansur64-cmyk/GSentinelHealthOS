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
});
