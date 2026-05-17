import { afterEach, describe, expect, it } from "vitest";

describe("agenda import Groq secretaria config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("lee solo GROQ_API_KEY_SECRETARIA y GROQ_MODEL_SECRETARIA para /api/import/agenda/parse", async () => {
    const { getAgendaImportGroqConfig } = await import("@/app/api/import/agenda/parse/route");

    process.env.GROQ_API_KEY = "generic-key";
    process.env.AGENDA_IMPORT_GROQ_API_KEY = "legacy-agenda-key";
    process.env.DOCUMENT_AI_API_KEY = "document-key";
    process.env.DOCUMENT_AI_MODEL = "document-model";
    delete process.env.GROQ_API_KEY_SECRETARIA;
    process.env.GROQ_MODEL_SECRETARIA = "secretaria-model";

    expect(getAgendaImportGroqConfig()).toMatchObject({
      enabled: false,
      apiKey: "",
      apiKeyEnv: "GROQ_API_KEY_SECRETARIA",
      model: "secretaria-model",
      modelEnv: "GROQ_MODEL_SECRETARIA",
    });

    process.env.GROQ_API_KEY_SECRETARIA = "secretaria-key";

    expect(getAgendaImportGroqConfig()).toMatchObject({
      enabled: true,
      apiKey: "secretaria-key",
      apiKeyEnv: "GROQ_API_KEY_SECRETARIA",
      model: "secretaria-model",
      modelEnv: "GROQ_MODEL_SECRETARIA",
      baseUrl: "https://api.groq.com/openai/v1",
    });
  });
});
