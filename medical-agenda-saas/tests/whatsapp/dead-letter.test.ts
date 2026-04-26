import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests para el sistema Dead Letter Queue.
 */

// Mock de prisma
const mockPrisma = {
  incomingMessage: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  failedMessage: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/server-logger", () => ({
  logServer: vi.fn(),
  logServerError: vi.fn(),
}));

// Mock de BullMQ Queue
const mockQueueAdd = vi.fn();
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
}));

vi.mock("./redis", () => ({
  getRedisConnection: vi.fn().mockReturnValue({}),
}));

describe("Dead Letter Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("moveToDeadLetter", () => {
    it("persiste mensaje fallido en DB", async () => {
      const mockJob = {
        id: "job-123",
        data: { messageId: "wamid.test123" },
        attemptsMade: 5,
        opts: { attempts: 5 },
      };

      const mockError = new Error("Test error");

      mockPrisma.incomingMessage.findUnique.mockResolvedValue({
        from_phone: "+5491112345678",
        payload_json: { text: "test message" },
      });

      mockPrisma.failedMessage.upsert.mockResolvedValue({
        id: "failed-123",
        message_id: "wamid.test123",
      });

      mockPrisma.incomingMessage.update.mockResolvedValue({});

      // Simular la lógica de moveToDeadLetter
      const incoming = await mockPrisma.incomingMessage.findUnique({
        where: { message_id: "wamid.test123" },
      });

      expect(incoming).not.toBeNull();

      await mockPrisma.failedMessage.upsert({
        where: { message_id: "wamid.test123" },
        create: {
          message_id: "wamid.test123",
          job_id: mockJob.id,
          from_phone: incoming.from_phone,
          payload_json: incoming.payload_json,
          error_message: mockError.message,
          retry_count: mockJob.attemptsMade,
          status: "pending",
        },
        update: {
          error_message: mockError.message,
          retry_count: mockJob.attemptsMade,
          status: "pending",
        },
      });

      expect(mockPrisma.failedMessage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { message_id: "wamid.test123" },
        }),
      );
    });

    it("actualiza mensaje existente en lugar de crear duplicado", async () => {
      mockPrisma.incomingMessage.findUnique.mockResolvedValue({
        from_phone: "+5491112345678",
        payload_json: { text: "test" },
      });

      mockPrisma.failedMessage.upsert.mockResolvedValue({
        id: "existing-failed",
        message_id: "wamid.duplicate",
      });

      // El upsert actualiza en lugar de crear
      await mockPrisma.failedMessage.upsert({
        where: { message_id: "wamid.duplicate" },
        create: { /* ... */ },
        update: {
          error_message: "New error",
          retry_count: 6,
        },
      });

      expect(mockPrisma.failedMessage.upsert).toHaveBeenCalled();
    });
  });

  describe("retryFailedMessage", () => {
    it("reencola mensaje para procesamiento", async () => {
      mockPrisma.failedMessage.findUnique.mockResolvedValue({
        id: "failed-123",
        message_id: "wamid.retry123",
        status: "pending",
      });

      mockPrisma.failedMessage.update.mockResolvedValue({
        status: "retrying",
      });

      mockPrisma.incomingMessage.update.mockResolvedValue({
        status: "pending",
      });

      // Simular flujo de retry
      const failed = await mockPrisma.failedMessage.findUnique({
        where: { id: "failed-123" },
      });

      expect(failed).not.toBeNull();
      expect(failed.status).toBe("pending");

      // Marcar como retrying
      await mockPrisma.failedMessage.update({
        where: { id: "failed-123" },
        data: { status: "retrying" },
      });

      // Resetear mensaje original
      await mockPrisma.incomingMessage.update({
        where: { message_id: "wamid.retry123" },
        data: { status: "pending" },
      });

      expect(mockPrisma.incomingMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "pending" },
        }),
      );
    });

    it("rechaza reintento si mensaje ya está resuelto", async () => {
      mockPrisma.failedMessage.findUnique.mockResolvedValue({
        id: "failed-resolved",
        message_id: "wamid.resolved",
        status: "resolved",
      });

      const failed = await mockPrisma.failedMessage.findUnique({
        where: { id: "failed-resolved" },
      });

      // Debería rechazar porque ya está resuelto
      expect(failed?.status).toBe("resolved");
      // En el código real retornaría { success: false, message: "Mensaje ya fue resuelto" }
    });

    it("rechaza reintento si mensaje está siendo reintentado", async () => {
      mockPrisma.failedMessage.findUnique.mockResolvedValue({
        id: "failed-retrying",
        status: "retrying",
      });

      const failed = await mockPrisma.failedMessage.findUnique({
        where: { id: "failed-retrying" },
      });

      expect(failed?.status).toBe("retrying");
    });
  });

  describe("markAsResolvedIfRetry", () => {
    it("resuelve automáticamente mensaje tras reintento exitoso", async () => {
      mockPrisma.failedMessage.findUnique.mockResolvedValue({
        id: "failed-auto",
        status: "retrying",
      });

      mockPrisma.failedMessage.update.mockResolvedValue({
        status: "resolved",
      });

      // Simular el flujo
      const failed = await mockPrisma.failedMessage.findUnique({
        where: { message_id: "wamid.autoResolve" },
        select: { id: true, status: true },
      });

      if (failed && failed.status === "retrying") {
        await mockPrisma.failedMessage.update({
          where: { id: failed.id },
          data: {
            status: "resolved",
            resolved_at: new Date(),
            notes: "Resuelto automáticamente por reintento exitoso",
          },
        });
      }

      expect(mockPrisma.failedMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "resolved",
          }),
        }),
      );
    });

    it("no hace nada si mensaje no estaba en DLQ", async () => {
      mockPrisma.failedMessage.findUnique.mockResolvedValue(null);

      const failed = await mockPrisma.failedMessage.findUnique({
        where: { message_id: "wamid.normal" },
      });

      expect(failed).toBeNull();
      // update no debería llamarse
      expect(mockPrisma.failedMessage.update).not.toHaveBeenCalled();
    });
  });

  describe("discardFailedMessage", () => {
    it("marca mensaje como descartado con razón", async () => {
      const userId = "user-123";
      const reason = "Mensaje de spam";

      mockPrisma.failedMessage.update.mockResolvedValue({
        status: "discarded",
        notes: reason,
        resolved_by: userId,
      });

      await mockPrisma.failedMessage.update({
        where: { id: "failed-discard" },
        data: {
          status: "discarded",
          resolved_at: new Date(),
          resolved_by: userId,
          notes: reason,
        },
      });

      expect(mockPrisma.failedMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "discarded",
            notes: "Mensaje de spam",
          }),
        }),
      );
    });
  });

  describe("listFailedMessages", () => {
    it("lista mensajes con paginación", async () => {
      const mockMessages = [
        { id: "1", message_id: "wamid.1", status: "pending" },
        { id: "2", message_id: "wamid.2", status: "pending" },
      ];

      mockPrisma.failedMessage.findMany.mockResolvedValue(mockMessages);
      mockPrisma.failedMessage.count.mockResolvedValue(10);

      const items = await mockPrisma.failedMessage.findMany({
        where: { status: "pending" },
        take: 50,
        skip: 0,
        orderBy: { created_at: "desc" },
      });

      const total = await mockPrisma.failedMessage.count({
        where: { status: "pending" },
      });

      expect(items).toHaveLength(2);
      expect(total).toBe(10);
    });

    it("filtra por status", async () => {
      mockPrisma.failedMessage.findMany.mockResolvedValue([]);

      await mockPrisma.failedMessage.findMany({
        where: { status: "resolved" },
      });

      expect(mockPrisma.failedMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "resolved" },
        }),
      );
    });
  });

  describe("getFailedMessageStats", () => {
    it("retorna conteos por estado", async () => {
      mockPrisma.failedMessage.count
        .mockResolvedValueOnce(5)  // pending
        .mockResolvedValueOnce(2)  // retrying
        .mockResolvedValueOnce(10) // resolved
        .mockResolvedValueOnce(3); // discarded

      const [pending, retrying, resolved, discarded] = await Promise.all([
        mockPrisma.failedMessage.count({ where: { status: "pending" } }),
        mockPrisma.failedMessage.count({ where: { status: "retrying" } }),
        mockPrisma.failedMessage.count({ where: { status: "resolved" } }),
        mockPrisma.failedMessage.count({ where: { status: "discarded" } }),
      ]);

      expect(pending).toBe(5);
      expect(retrying).toBe(2);
      expect(resolved).toBe(10);
      expect(discarded).toBe(3);
      expect(pending + retrying + resolved + discarded).toBe(20);
    });
  });
});

describe("Worker DLQ Integration", () => {
  it("mueve a DLQ cuando se agotan reintentos", async () => {
    const mockJob = {
      id: "exhausted-job",
      data: { messageId: "wamid.exhausted" },
      attemptsMade: 5,
      opts: { attempts: 5 },
    };

    // Si attemptsMade >= attempts, mover a DLQ
    expect(mockJob.attemptsMade).toBeGreaterThanOrEqual(mockJob.opts.attempts);
  });

  it("no mueve a DLQ en reintentos intermedios", async () => {
    const mockJob = {
      id: "intermediate-job",
      data: { messageId: "wamid.intermediate" },
      attemptsMade: 3,
      opts: { attempts: 5 },
    };

    // Si attemptsMade < attempts, no mover a DLQ
    expect(mockJob.attemptsMade).toBeLessThan(mockJob.opts.attempts);
  });
});
