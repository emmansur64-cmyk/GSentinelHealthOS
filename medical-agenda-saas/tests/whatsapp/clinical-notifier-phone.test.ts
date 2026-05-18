import { describe, expect, it } from "vitest";

import { isValidArMobileE164 } from "@/lib/whatsapp-clinical-notifier/phone";

describe("clinical notifier phone validation", () => {
  it("acepta numero +549 valido", () => {
    expect(isValidArMobileE164("+5492634725131")).toBe(true);
  });

  it("rechaza numero sin +549", () => {
    expect(isValidArMobileE164("+54112634725131")).toBe(false);
  });
});
