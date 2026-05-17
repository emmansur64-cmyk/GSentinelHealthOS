import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("commercial login boundary", () => {
  it("excludes super_admin from commercial auth login", () => {
    const route = readFileSync(
      join(process.cwd(), "src", "app", "api", "auth", "login", "route.ts"),
      "utf8",
    );

    expect(route.includes("u.role::text <> 'super_admin'")).toBe(true);
    expect(route.includes("El acceso super admin solo esta permitido en Panel-SuperAdmin")).toBe(true);
    expect(route.includes("ensureSuperAdminAccount")).toBe(false);
  });
});
