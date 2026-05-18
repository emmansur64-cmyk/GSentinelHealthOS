import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendClinical = vi.fn();
const mockAuditLog = vi.fn(async () => undefined);
const mockFindFirst = vi.fn();
const mockCount = vi.fn();
const mockDoctorProfileFindFirst = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/whatsapp-clinical-notifier/notifier", () => ({
  sendClinicalWhatsAppNotification: mockSendClinical,
}));

vi.mock("@/lib/compliance/audit-log", () => ({
  auditLog: mockAuditLog,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findFirst: mockFindFirst,
      create: mockCreate,
    },
    appointment: {
      count: mockCount,
    },
    doctorProfile: {
      findFirst: mockDoctorProfileFindFirst,
    },
  },
}));

describe("whatsapp clinical notifier service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_CLINICAL_NOTIFIER_ENABLED = "false";
    process.env.WHATSAPP_CLINICAL_NOTIFIER_DRY_RUN = "true";

    mockCount.mockResolvedValue(1);
    mockDoctorProfileFindFirst.mockResolvedValue({ matricula: "MP-123", user: { name: "Dra. Ana" } });
    mockFindFirst.mockResolvedValue(null);
    mockSendClinical.mockResolvedValue({
      sent: false,
      dryRun: true,
      providerMessageId: null,
      providerStatus: null,
      providerResponse: "dry_run",
    });
  });

  it("pide datos faltantes de matricula/celular", async () => {
    const { maybeHandleTransferProtocolNotification } = await import("@/lib/whatsapp-clinical-notifier/service");

    const result = await maybeHandleTransferProtocolNotification({
      tenantId: "default",
      actorUserId: "doctor-1",
      doctorId: "doctor-1",
      conversationId: "doctor:1:patient:p1:appointment:none",
      message: "Envia protocolo de traslado por WhatsApp +5492634725131",
      patient: { id: "p1", name: "Paciente Uno" },
      appointment: null,
      clinicalState: "estable",
      metadata: {},
    });

    expect(result?.action).toBe("SEND_TRANSFER_PROTOCOL_WHATSAPP_MISSING_DATA");
    expect(mockSendClinical).not.toHaveBeenCalled();
  });

  it("sin confirmacion explicita no envia, solo genera preview", async () => {
    const { maybeHandleTransferProtocolNotification } = await import("@/lib/whatsapp-clinical-notifier/service");

    const result = await maybeHandleTransferProtocolNotification({
      tenantId: "default",
      actorUserId: "doctor-1",
      doctorId: "doctor-1",
      conversationId: "doctor:1:patient:p1:appointment:none",
      message: "Envia protocolo de traslado por WhatsApp +5492634725131",
      patient: { id: "p1", name: "Paciente Uno" },
      appointment: null,
      clinicalState: "estable",
      metadata: {
        transfer_sender_license: "MP-123",
        transfer_sender_direct_phone: "+5491122334455",
      },
    });

    expect(result?.action).toBe("SEND_TRANSFER_PROTOCOL_WHATSAPP_CONFIRM_REQUIRED");
    expect(mockSendClinical).not.toHaveBeenCalled();
  });

  it("con confirmacion explicita crea dispatch en dry-run", async () => {
    const { maybeHandleTransferProtocolNotification } = await import("@/lib/whatsapp-clinical-notifier/service");

    mockFindFirst.mockResolvedValue({
      payload_after: {
        destinationPhone: "+5492634725131",
        patientId: "p1",
        contentHash: "hash123",
        messageBody: "Aviso de traslado clinico",
      },
    });

    const result = await maybeHandleTransferProtocolNotification({
      tenantId: "default",
      actorUserId: "doctor-1",
      doctorId: "doctor-1",
      conversationId: "doctor:1:patient:p1:appointment:none",
      message: "Confirmo enviar este protocolo por WhatsApp al numero +5492634725131",
      patient: { id: "p1", name: "Paciente Uno" },
      appointment: null,
      clinicalState: "estable",
      metadata: {},
    });

    expect(result?.action).toBe("SEND_TRANSFER_PROTOCOL_WHATSAPP_DRY_RUN");
    expect(mockSendClinical).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
  });
});
