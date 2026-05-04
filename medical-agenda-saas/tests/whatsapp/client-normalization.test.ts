import { describe, expect, it } from "vitest";

import { normalizeWhatsAppRecipient } from "../../src/lib/whatsapp/client";

describe("normalizeWhatsAppRecipient", () => {
  it("normalizes Argentina mobile 9 to Meta test recipient format", () => {
    expect(normalizeWhatsAppRecipient("5492634723151")).toBe("54263154723151");
  });

  it("keeps already normalized Argentina recipient", () => {
    expect(normalizeWhatsAppRecipient("54263154723151")).toBe("54263154723151");
  });

  it("strips formatting characters", () => {
    expect(normalizeWhatsAppRecipient("+54 9 263 472 3151")).toBe("54263154723151");
  });
});
