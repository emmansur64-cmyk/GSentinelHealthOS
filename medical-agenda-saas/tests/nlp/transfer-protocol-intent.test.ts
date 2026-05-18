import { describe, expect, it } from "vitest";

import { detectTransferProtocolIntent } from "@/lib/whatsapp-clinical-notifier/intent";

describe("transfer protocol intent detection", () => {
  it("detecta intencion de envio de protocolo de traslado por WhatsApp", () => {
    const intent = detectTransferProtocolIntent("Envia el protocolo de traslado al WhatsApp +5492634725131");
    expect(intent.isTransferProtocolIntent).toBe(true);
    expect(intent.destinationPhone).toBe("+5492634725131");
  });

  it("detecta confirmacion explicita", () => {
    const intent = detectTransferProtocolIntent("Confirmo enviar este protocolo por WhatsApp al numero +5492634725131");
    expect(intent.isExplicitConfirmation).toBe(true);
  });
});
