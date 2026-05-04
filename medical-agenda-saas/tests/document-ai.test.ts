import { afterEach, describe, expect, it, vi } from "vitest";

import {
  analyzeImageDocumentWithAI,
  buildLooseVisionFallbackFromRawText,
  isDocumentAIEnabled,
  isVisionSupportedMimeType,
} from "@/lib/document-ai";

function buildValidVisionJson() {
  return {
    document_type: "planilla mensual de atencion medica",
    language: "es",
    readability: "high",
    confidence_score: 0.93,
    doctor_name: "Jose Castro",
    specialty: "Cardiologia",
    license_number: "10021",
    month: "Abril",
    year: "2026",
    schedule: {
      lunes: ["8 a 12", "08:00-12:00", "de 8:00 a 12:00"],
      martes: [],
      miercoles: ["8-12"],
      jueves: [],
      viernes: ["08:00 a 12:00 hs"],
      sabado: [],
      domingo: [],
    },
  };
}

function setDocumentAiEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.DOCUMENT_AI_ENABLED = "true";
  process.env.DOCUMENT_AI_REQUIRE_SUCCESS = "false";
  process.env.DOCUMENT_AI_PROVIDER = "groq";
  process.env.DOCUMENT_AI_BASE_URL = "https://api.groq.com/openai/v1";
  process.env.DOCUMENT_AI_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
  process.env.DOCUMENT_AI_API_KEY = "test-key";
  process.env.DOCUMENT_AI_TIMEOUT_MS = "5000";
  process.env.DOCUMENT_AI_MAX_RETRIES = "2";

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DOCUMENT_AI_ENABLED;
  delete process.env.DOCUMENT_AI_REQUIRE_SUCCESS;
  delete process.env.DOCUMENT_AI_BASE_URL;
  delete process.env.DOCUMENT_AI_MODEL;
  delete process.env.DOCUMENT_AI_API_KEY;
  delete process.env.DOCUMENT_AI_PROVIDER;
  delete process.env.DOCUMENT_AI_TIMEOUT_MS;
  delete process.env.DOCUMENT_AI_MAX_RETRIES;
});

describe("document-ai", () => {
  it("detecta mime type de vision correctamente", () => {
    expect(isVisionSupportedMimeType("image/png")).toBe(true);
    expect(isVisionSupportedMimeType("image/jpeg")).toBe(true);
    expect(isVisionSupportedMimeType("application/pdf")).toBe(false);
  });

  it("extrae disponibilidad desde OCR local con dias y horarios", () => {
    const result = buildLooseVisionFallbackFromRawText(`
      Planilla mensual Abril 2026
      Dr. Jose Castro
      Lunes 8 a 12
      Miercoles: 14:00-18:00
      Viernes de 09 a 13 hs
    `);

    expect(result.schedule.lunes).toEqual(["08:00-12:00"]);
    expect(result.schedule.miercoles).toEqual(["14:00-18:00"]);
    expect(result.schedule.viernes).toEqual(["09:00-13:00"]);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.68);
  });

  it("expande rangos de dias desde OCR local", () => {
    const result = buildLooseVisionFallbackFromRawText("Lunes a viernes 08:00 a 12:00");

    expect(result.schedule.lunes).toEqual(["08:00-12:00"]);
    expect(result.schedule.martes).toEqual(["08:00-12:00"]);
    expect(result.schedule.miercoles).toEqual(["08:00-12:00"]);
    expect(result.schedule.jueves).toEqual(["08:00-12:00"]);
    expect(result.schedule.viernes).toEqual(["08:00-12:00"]);
    expect(result.schedule.sabado).toEqual([]);
  });

  it("expone flag de habilitacion", () => {
    process.env.DOCUMENT_AI_ENABLED = "true";
    expect(isDocumentAIEnabled()).toBe(true);
    process.env.DOCUMENT_AI_ENABLED = "false";
    expect(isDocumentAIEnabled()).toBe(false);
  });

  it("falla cuando esta habilitado sin API key", async () => {
    setDocumentAiEnv({ DOCUMENT_AI_API_KEY: "" });
    const file = new File([Buffer.from("image")], "agenda.png", { type: "image/png" });

    await expect(analyzeImageDocumentWithAI(file)).rejects.toThrow("DOCUMENT_AI_API_KEY");
  });

  it("parsea salida JSON valida del proveedor", async () => {
    setDocumentAiEnv();
    const payload = { output_text: JSON.stringify(buildValidVisionJson()) };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const file = new File([Buffer.from("image")], "agenda.png", { type: "image/png" });
    const result = await analyzeImageDocumentWithAI(file);

    expect(result.document_type).toBe("planilla mensual de atencion medica");
    expect(result.readability).toBe("high");
    expect(result.confidence_score).toBeGreaterThanOrEqual(0);
    expect(result.confidence_score).toBeLessThanOrEqual(1);
    expect(result.schedule.lunes).toEqual(["08:00-12:00"]);
    expect(result.schedule.miercoles).toEqual(["08:00-12:00"]);
    expect(result.schedule.viernes).toEqual(["08:00-12:00"]);
  });

  it("reintenta en error 500 y luego devuelve resultado", async () => {
    setDocumentAiEnv({ DOCUMENT_AI_MAX_RETRIES: "1" });

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "server error" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      )
       .mockResolvedValueOnce(
         new Response(JSON.stringify({ output_text: JSON.stringify(buildValidVisionJson()) }), {
           status: 200,
           headers: { "content-type": "application/json" },
         }),
       );

    const file = new File([Buffer.from("image")], "agenda.png", { type: "image/png" });
    const result = await analyzeImageDocumentWithAI(file);

    expect(result.doctor_name).toBe("Jose Castro");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplica entradas repetidas e ignora formatos no parseables", async () => {
    setDocumentAiEnv();
    const payload = {
      output_text: JSON.stringify({
        ...buildValidVisionJson(),
        confidence_score: 0.2,
        schedule: {
          lunes: ["8 a 12", "08:00-12:00", "texto invalido", "08:00-12:00"],
          martes: ["09:30-11:00", "9:30 a 11:00"],
          miercoles: [],
          jueves: [],
          viernes: [],
          sabado: [],
          domingo: [],
        },
      }),
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const file = new File([Buffer.from("image")], "agenda.png", { type: "image/png" });
    const result = await analyzeImageDocumentWithAI(file);

    expect(result.schedule.lunes).toEqual(["08:00-12:00"]);
    expect(result.schedule.martes).toEqual(["09:30-11:00"]);
    expect(result.schedule.miercoles).toEqual([]);
    expect(result.confidence_score).toBeGreaterThan(0.2);
  });

  it("usa endpoint compatible Groq cuando modelo y key son de Groq", async () => {
    setDocumentAiEnv({
      DOCUMENT_AI_BASE_URL: undefined,
      DOCUMENT_AI_MODEL: "meta-llama/llama-4-scout-17b-16e-instruct",
      DOCUMENT_AI_API_KEY: "gsk_test_key",
    });

    const payload = { choices: [{ message: { content: JSON.stringify(buildValidVisionJson()) } }] };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const file = new File([Buffer.from("image")], "agenda.png", { type: "image/png" });
    const result = await analyzeImageDocumentWithAI(file);

    expect(result.doctor_name).toBe("Jose Castro");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("https://api.groq.com/openai/v1/chat/completions");
  });

  it("permite configurar Groq por override sin tocar DOCUMENT_AI global", async () => {
    process.env.DOCUMENT_AI_BASE_URL = "https://api.groq.com/openai/v1";
    process.env.DOCUMENT_AI_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
    process.env.DOCUMENT_AI_API_KEY = "document-groq-test-key";

    const payload = { choices: [{ message: { content: JSON.stringify(buildValidVisionJson()) } }] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const file = new File([Buffer.from("image")], "agenda.png", { type: "image/png" });
    await analyzeImageDocumentWithAI(file, {
      provider: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      apiKey: "agenda-groq-test-key",
      maxRetries: 0,
    });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const calledInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(calledUrl).toContain("https://api.groq.com/openai/v1/chat/completions");
    expect(calledInit?.headers).toMatchObject({
      Authorization: "Bearer agenda-groq-test-key",
    });
  });

  it("normaliza respuestas Groq con legibilidad y schedule no estrictos", async () => {
    setDocumentAiEnv({
      DOCUMENT_AI_PROVIDER: "groq",
      DOCUMENT_AI_BASE_URL: "https://api.groq.com/openai/v1",
      DOCUMENT_AI_MODEL: "meta-llama/llama-4-scout-17b-16e-instruct",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  document_type: "planilla mensual de atencion medica",
                  language: "es",
                  readability: "buena",
                  confidence: "82%",
                  medico: "Castro Jose",
                  especialidad: "Cardiologia",
                  matricula: "10021",
                  mes: "Mayo",
                  anio: "2026",
                  schedule: {
                    lunes: "8 a 12",
                    miercoles: [{ start: "8", end: "12" }],
                    viernes: [{ horario: "08:00 a 12:00" }],
                  },
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const file = new File([Buffer.from("image")], "agenda.jpg", { type: "image/jpeg" });
    const result = await analyzeImageDocumentWithAI(file);

    expect(result.readability).toBe("high");
    expect(result.doctor_name).toBe("Castro Jose");
    expect(result.license_number).toBe("10021");
    expect(result.schedule.lunes).toEqual(["08:00-12:00"]);
    expect(result.schedule.miercoles).toEqual(["08:00-12:00"]);
    expect(result.schedule.viernes).toEqual(["08:00-12:00"]);
  });

  it("normaliza claves humanas de Groq para profesional y matricula", async () => {
    setDocumentAiEnv({
      DOCUMENT_AI_PROVIDER: "groq",
      DOCUMENT_AI_BASE_URL: "https://api.groq.com/openai/v1",
      DOCUMENT_AI_MODEL: "meta-llama/llama-4-scout-17b-16e-instruct",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  "Tipo de documento": "planilla mensual de atencion medica",
                  Idioma: "es",
                  Legibilidad: "media",
                  "Nombre del Médico": "Castro Jose",
                  Especialidad: "Cardiologia",
                  "Matrícula": "10021",
                  Mes: "Mayo",
                  "Año": "2026",
                  Horarios: {
                    Lunes: "8 a 12",
                  },
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const file = new File([Buffer.from("image")], "agenda.jpg", { type: "image/jpeg" });
    const result = await analyzeImageDocumentWithAI(file);

    expect(result.doctor_name).toBe("Castro Jose");
    expect(result.specialty).toBe("Cardiologia");
    expect(result.license_number).toBe("10021");
    expect(result.month).toBe("Mayo");
    expect(result.year).toBe("2026");
  });

});
