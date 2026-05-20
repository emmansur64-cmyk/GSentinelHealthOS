import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MODULE_DIR = join(process.cwd(), "src", "lib", "whatsapp-clinical-notifier");
const FILES = ["config.ts", "index.ts", "intent.ts", "message.ts", "notifier.ts", "phone.ts", "service.ts", "types.ts"];

describe("whatsapp clinical notifier isolation", () => {
  it("no importa modulos prohibidos de whatsapp/turnos", () => {
    for (const file of FILES) {
      const content = readFileSync(join(MODULE_DIR, file), "utf8");
      expect(content).not.toMatch(/@\/lib\/whatsapp\//);
      expect(content).not.toMatch(/conversation-engine/);
      expect(content).not.toMatch(/agenda/);
      expect(content).not.toMatch(/worker/);
      expect(content).not.toMatch(/appointment/);
    }
  });
});
