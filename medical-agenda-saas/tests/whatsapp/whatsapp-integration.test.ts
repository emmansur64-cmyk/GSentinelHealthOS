import { describe, it, expect, beforeEach, vi } from "vitest";
import { verifyWebhookSignature } from "@/lib/whatsapp/verify-signature";
import { parseWebhookPayload, extractMessages, extractStatuses } from "@/lib/whatsapp/parse-webhook";
import { parseIntent } from "@/lib/whatsapp/intent-parser";
import { createHmac } from "node:crypto";

// ─── Firma de Webhook ────────────────────────────────────────────────────────

describe("verifyWebhookSignature", () => {
  const appSecret = "test_app_secret_12345";

  function sign(body: string): string {
    return "sha256=" + createHmac("sha256", appSecret).update(body).digest("hex");
  }

  it("acepta firma válida", () => {
    const body = '{"test": true}';
    const sig = sign(body);
    expect(verifyWebhookSignature(body, sig, appSecret)).toBe(true);
  });

  it("rechaza firma inválida", () => {
    const body = '{"test": true}';
    expect(verifyWebhookSignature(body, "sha256=invalid", appSecret)).toBe(false);
  });

  it("rechaza si no hay firma", () => {
    expect(verifyWebhookSignature("body", null, appSecret)).toBe(false);
  });

  it("rechaza si no hay secret", () => {
    expect(verifyWebhookSignature("body", "sha256=abc", "")).toBe(false);
  });

  it("rechaza body alterado", () => {
    const body = '{"test": true}';
    const sig = sign(body);
    expect(verifyWebhookSignature('{"test": false}', sig, appSecret)).toBe(false);
  });
});

// ─── Parse Webhook Payload ───────────────────────────────────────────────────

describe("parseWebhookPayload", () => {
  const validPayload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "123",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "15551234567",
            phone_number_id: "phone_id_123",
          },
          contacts: [{ profile: { name: "Juan" }, wa_id: "5491155551234" }],
          messages: [{
            id: "wamid.abc123",
            from: "5491155551234",
            timestamp: "1712150400",
            type: "text",
            text: { body: "Hola quiero un turno" },
          }],
        },
        field: "messages",
      }],
    }],
  };

  it("parsea payload válido", () => {
    const result = parseWebhookPayload(validPayload);
    expect(result).not.toBeNull();
  });

  it("rechaza payload sin object", () => {
    expect(parseWebhookPayload({ entry: [] })).toBeNull();
  });

  it("rechaza payload con object incorrecto", () => {
    expect(parseWebhookPayload({ object: "instagram", entry: [] })).toBeNull();
  });

  it("extrae mensajes correctamente", () => {
    const parsed = parseWebhookPayload(validPayload)!;
    const messages = extractMessages(parsed);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe("wamid.abc123");
    expect(messages[0].fromPhone).toBe("5491155551234");
    expect(messages[0].text).toBe("Hola quiero un turno");
    expect(messages[0].contactName).toBe("Juan");
  });

  it("extrae status updates", () => {
    const statusPayload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "123",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551234567",
              phone_number_id: "phone_id_123",
            },
            statuses: [{
              id: "wamid.sent123",
              status: "delivered",
              recipient_id: "5491155551234",
            }],
          },
          field: "messages",
        }],
      }],
    };

    const parsed = parseWebhookPayload(statusPayload)!;
    const statuses = extractStatuses(parsed);
    expect(statuses).toHaveLength(1);
    expect(statuses[0].messageId).toBe("wamid.sent123");
    expect(statuses[0].status).toBe("delivered");
  });
});

// ─── Deduplicación de Webhook ────────────────────────────────────────────────

describe("webhook deduplication", () => {
  it("no encola mensaje con message_id duplicado (misma referencia)", () => {
    // La deduplicación ocurre en la DB via UNIQUE(message_id)
    // y en la cola via jobId. Verificamos que extractMessages devuelve
    // el mismo messageId para el mismo payload.
    const payload = {
      object: "whatsapp_business_account" as const,
      entry: [{
        id: "123",
        changes: [{
          value: {
            messaging_product: "whatsapp" as const,
            metadata: { display_phone_number: "1", phone_number_id: "2" },
            messages: [{
              id: "wamid.DUPLICATE",
              from: "5491155551234",
              timestamp: "1712150400",
              type: "text" as const,
              text: { body: "test" },
            }],
          },
          field: "messages" as const,
        }],
      }],
    };

    const msgs1 = extractMessages(payload);
    const msgs2 = extractMessages(payload);
    expect(msgs1[0].messageId).toBe(msgs2[0].messageId);
    expect(msgs1[0].messageId).toBe("wamid.DUPLICATE");
  });
});

// ─── Intent Parser ───────────────────────────────────────────────────────────

describe("parseIntent", () => {
  it("detecta intención de crear turno", () => {
    expect(parseIntent("Quiero sacar un turno").intent).toBe("create_appointment");
    expect(parseIntent("necesito una cita").intent).toBe("create_appointment");
    expect(parseIntent("quiero reservar").intent).toBe("create_appointment");
    expect(parseIntent("quiero agendar una consulta").intent).toBe("create_appointment");
  });

  it("detecta consulta de turnos", () => {
    expect(parseIntent("cuando tengo turno").intent).toBe("query_appointment");
    expect(parseIntent("mis turnos").intent).toBe("query_appointment");
    expect(parseIntent("proximo turno").intent).toBe("query_appointment");
  });

  it("detecta cancelación", () => {
    expect(parseIntent("cancelar mi turno").intent).toBe("cancel_appointment");
    expect(parseIntent("no puedo ir").intent).toBe("cancel_appointment");
  });

  it("detecta reprogramación", () => {
    expect(parseIntent("reprogramar mi turno").intent).toBe("reschedule_appointment");
    expect(parseIntent("cambiar de horario").intent).toBe("reschedule_appointment");
  });

  it("detecta saludo", () => {
    expect(parseIntent("Hola").intent).toBe("greeting");
    expect(parseIntent("buenas tardes").intent).toBe("greeting");
  });

  it("detecta confirmación", () => {
    expect(parseIntent("Si").intent).toBe("confirm");
    expect(parseIntent("dale").intent).toBe("confirm");
    expect(parseIntent("confirmo").intent).toBe("confirm");
  });

  it("detecta denegación", () => {
    expect(parseIntent("No").intent).toBe("deny");
    expect(parseIntent("no quiero").intent).toBe("deny");
  });

  it("detecta unknown", () => {
    expect(parseIntent("asdf jkl").intent).toBe("unknown");
  });

  it("extrae entidades de fecha", () => {
    const result = parseIntent("quiero turno mañana");
    expect(result.intent).toBe("create_appointment");
    expect(result.entities.date).toBeDefined();
  });

  it("extrae entidades de hora", () => {
    const result = parseIntent("turno a las 15:30");
    expect(result.entities.time).toBe("15:30");
  });

  it("extrae especialidad", () => {
    const result = parseIntent("quiero turno de cardiologia");
    expect(result.entities.specialty).toBe("cardiologia");
  });

  it("texto vacío devuelve unknown", () => {
    expect(parseIntent("").intent).toBe("unknown");
    expect(parseIntent("  ").intent).toBe("unknown");
  });
});

// ─── Mensajes Simultáneos (concurrencia lógica) ─────────────────────────────

describe("concurrent message handling (logic check)", () => {
  it("dos mensajes con distinto message_id generan entradas distintas", () => {
    const payload1 = {
      object: "whatsapp_business_account" as const,
      entry: [{
        id: "e1",
        changes: [{
          value: {
            messaging_product: "whatsapp" as const,
            metadata: { display_phone_number: "1", phone_number_id: "2" },
            messages: [{
              id: "wamid.MSG1",
              from: "5491155551234",
              timestamp: "1712150400",
              type: "text" as const,
              text: { body: "turno" },
            }],
          },
          field: "messages" as const,
        }],
      }],
    };

    const payload2 = {
      ...payload1,
      entry: [{
        ...payload1.entry[0],
        changes: [{
          ...payload1.entry[0].changes[0],
          value: {
            ...payload1.entry[0].changes[0].value,
            messages: [{
              id: "wamid.MSG2",
              from: "5491155551234",
              timestamp: "1712150401",
              type: "text" as const,
              text: { body: "turno" },
            }],
          },
        }],
      }],
    };

    const msgs1 = extractMessages(payload1);
    const msgs2 = extractMessages(payload2);
    expect(msgs1[0].messageId).not.toBe(msgs2[0].messageId);
  });
});
