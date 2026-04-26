import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-logger", () => ({
  logServer: vi.fn(),
  logServerError: vi.fn(),
}));
vi.mock("@/lib/observability/metrics", () => ({
  incDoctorChatFetchFailed: vi.fn(),
}));

describe("callBrainDecide", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.BRAIN_API_URL = "http://localhost:8001";
    process.env.BRAIN_API_KEY = "brain-test-key";
    process.env.BRAIN_TIMEOUT_MS = "3000";
    process.env.BRAIN_RETRY_ATTEMPTS = "1";
    process.env.BRAIN_RETRY_DELAY_MS = "0";
    process.env.BRAIN_FAILURE_ALERT_THRESHOLD = "2";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("envia el contexto clinico completo al endpoint /orchestrate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "Analisis clinico generado",
        session_id: "doctor:1:patient:2",
        metadata: { confidence: 0.97 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callBrainDecide } = await import("@/lib/brain-client");

    const response = await callBrainDecide({
      role: "DOCTOR",
      message: "Paciente con CK elevada y orina oscura",
      context: {
        doctor_id: "doctor-1",
        patient: { id: "patient-2", name: "Ana", notes: "dolor muscular" },
        current_appointment: {
          id: "appt-3",
          datetime: "2026-04-23T09:00:00.000Z",
          status: "scheduled",
          notes: "Control",
        },
        recent_history: [{ id: "appt-2", datetime: "2026-04-22T09:00:00.000Z", status: "completed" }],
        conversation_history: [
          {
            doctor_message: "Tiene dolor muscular",
            response: "Considera rabdomiolisis",
          },
        ],
        clinical_state: "CK 12000 y creatinina 1.9",
        metadata: {
          conversation_id: "doctor:doctor-1:patient:patient-2:appointment:appt-3",
          source: "doctor-chat",
        },
      },
    });

    expect(response).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://localhost:8001/orchestrate");
    expect(calledInit.method).toBe("POST");

    const body = JSON.parse(String(calledInit.body));
    expect(body.user_input).toBe("Paciente con CK elevada y orina oscura");
    expect(body.session_id).toBe("doctor:doctor-1:patient:patient-2:appointment:appt-3");
    expect(body.context.doctor_id).toBe("doctor-1");
    expect(body.context.patient.name).toBe("Ana");
    expect(body.context.current_appointment.id).toBe("appt-3");
    expect(body.context.conversation_history).toEqual([
      {
        doctor_message: "Tiene dolor muscular",
        response: "Considera rabdomiolisis",
      },
    ]);
    expect(body.context.clinical_state).toBe("CK 12000 y creatinina 1.9");
  });
});
