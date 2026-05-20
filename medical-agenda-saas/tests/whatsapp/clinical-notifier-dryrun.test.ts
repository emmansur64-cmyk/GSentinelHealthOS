import { describe, expect, it } from "vitest";

import * as notifier from "@/lib/whatsapp-clinical-notifier/notifier";

describe("clinical notifier dry-run safety", () => {
  it("no ejecuta fetch real cuando dry-run esta activo", async () => {
    process.env.WHATSAPP_CLINICAL_NOTIFIER_ENABLED = "true";
    process.env.WHATSAPP_CLINICAL_NOTIFIER_DRY_RUN = "true";

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    // @ts-expect-error test override
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called");
    };

    try {
      const result = await notifier.sendClinicalWhatsAppNotification({
        tenantId: "default",
        to: "+5491111111111",
        body: "test",
      });

      expect(result.dryRun).toBe(true);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
