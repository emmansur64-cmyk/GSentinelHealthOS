import { describe, expect, it } from "vitest";

import { pickPreferredLoginCandidate } from "../../src/lib/auth-login-selection";

describe("pickPreferredLoginCandidate", () => {
  it("sin tenant solicitado prioriza el primer candidato", () => {
    const selected = pickPreferredLoginCandidate(
      [
        { id: "clinic-user", role: "clinic_admin", tenant_id: "default" },
        { id: "sa-user", role: "super_admin", tenant_id: "default" },
      ],
      null,
    );

    expect(selected?.id).toBe("clinic-user");
  });

  it("con slug/tenant solicitado, prioriza el usuario del tenant", () => {
    const selected = pickPreferredLoginCandidate(
      [
        { id: "sa-user", role: "super_admin", tenant_id: "default" },
        { id: "tenant-user", role: "clinic_admin", tenant_id: "tenant-b" },
      ],
      "tenant-b",
    );

    expect(selected?.id).toBe("tenant-user");
  });

  it("si no existe usuario del tenant solicitado, usa el primer candidato disponible", () => {
    const selected = pickPreferredLoginCandidate(
      [
        { id: "sa-user", role: "super_admin", tenant_id: "default" },
        { id: "tenant-user", role: "clinic_admin", tenant_id: "tenant-a" },
      ],
      "tenant-b",
    );

    expect(selected?.id).toBe("sa-user");
  });
});
