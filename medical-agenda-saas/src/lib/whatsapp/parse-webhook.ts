import { z } from "zod";

/**
 * Esquema estricto de parsing del payload entrante del webhook de WhatsApp Cloud API.
 */

const textMessageSchema = z.object({
  type: z.literal("text"),
  text: z.object({ body: z.string() }),
});

const interactiveReplySchema = z.object({
  type: z.literal("interactive"),
  interactive: z.object({
    type: z.enum(["button_reply", "list_reply"]),
    button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
  }),
});

const messageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
}).and(z.union([textMessageSchema, interactiveReplySchema, z.object({ type: z.string() })]));

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  recipient_id: z.string().optional(),
});

const valueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(z.object({
    profile: z.object({ name: z.string() }),
    wa_id: z.string(),
  })).optional(),
  messages: z.array(messageSchema).optional(),
  statuses: z.array(statusSchema).optional(),
});

const webhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: valueSchema,
      field: z.literal("messages"),
    })),
  })),
});

export type ParsedWebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type ParsedMessage = z.infer<typeof messageSchema>;
export type ParsedStatus = z.infer<typeof statusSchema>;

export type ExtractedMessage = {
  messageId: string;
  fromPhone: string;
  contactName: string;
  text: string;
  timestamp: string;
  type: string;
  interactiveReplyId?: string;
};

export type ExtractedStatus = {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipientId?: string;
};

/**
 * Parsea y valida payload de webhook.
 * Retorna null si el payload no es válido.
 */
export function parseWebhookPayload(body: unknown): ParsedWebhookPayload | null {
  const result = webhookPayloadSchema.safeParse(body);
  return result.success ? result.data : null;
}

/**
 * Extrae mensajes entrantes del payload parseado.
 */
export function extractMessages(payload: ParsedWebhookPayload): ExtractedMessage[] {
  const messages: ExtractedMessage[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      if (!value.messages) continue;

      for (const msg of value.messages) {
        let text = "";
        let interactiveReplyId: string | undefined;

        if (msg.type === "text" && "text" in msg) {
          text = msg.text.body;
        } else if (msg.type === "interactive" && "interactive" in msg) {
          const reply = msg.interactive.button_reply ?? msg.interactive.list_reply;
          text = reply?.title ?? "";
          interactiveReplyId = reply?.id;
        }

        const contact = value.contacts?.find((c) => c.wa_id === msg.from);

        messages.push({
          messageId: msg.id,
          fromPhone: msg.from,
          contactName: contact?.profile.name ?? msg.from,
          text,
          timestamp: msg.timestamp,
          type: msg.type,
          interactiveReplyId,
        });
      }
    }
  }

  return messages;
}

/**
 * Extrae status updates del payload.
 */
export function extractStatuses(payload: ParsedWebhookPayload): ExtractedStatus[] {
  const statuses: ExtractedStatus[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      if (!value.statuses) continue;

      for (const s of value.statuses) {
        statuses.push({
          messageId: s.id,
          status: s.status,
          recipientId: s.recipient_id,
        });
      }
    }
  }

  return statuses;
}
