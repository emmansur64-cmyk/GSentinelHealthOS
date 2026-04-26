/**
 * Integration Tests: WhatsApp → Webhook → Worker → DB → Response
 *
 * Tests de flujo completo usando infraestructura LOCAL:
 * - PostgreSQL en localhost:5432
 * - Redis en localhost:6379
 *
 * Ejecutar: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import {
  getTestPrisma,
  getTestRedis,
  disconnectPrisma,
  disconnectRedis,
  cleanDatabase,
  createTestFixtures,
  deleteTestFixtures,
  type TestFixtures,
} from "./test-isolation";

// ─── Constants ───────────────────────────────────────────────────────────────

const TEST_PHONE = "+5491155551234";
const TEST_PHONE_2 = "+5491155555678";
const TEST_APP_SECRET = "test_webhook_secret_12345";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const sentMessages: Array<{ phone: string; message: string }> = [];

vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppMessage: vi.fn(async (phone: string, message: string) => {
    sentMessages.push({ phone, message });
    return { success: true };
  }),
  updateOutgoingStatus: vi.fn(),
}));

// ─── Test State ──────────────────────────────────────────────────────────────

let fixtures: TestFixtures;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateMessageId(): string {
  return `wamid.${uuidv4().replace(/-/g, "")}`;
}

async function simulateWebhook(
  messageId: string,
  phone: string,
  text: string,
): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.incomingMessage.create({
    data: {
      message_id: messageId,
      from_phone: phone,
      payload_json: {
        text,
        type: "text",
        contactName: "Test User",
        timestamp: Math.floor(Date.now() / 1000),
      },
      status: "pending",
    },
  });
}

async function processMessageDirect(messageId: string): Promise<void> {
  const { processIncomingMessage } = await import("@/lib/whatsapp/conversation-engine");
  await processIncomingMessage(messageId);
}

async function getIncomingMessageStatus(
  messageId: string,
): Promise<{ status: string } | null> {
  const prisma = getTestPrisma();
  return prisma.incomingMessage.findUnique({
    where: { message_id: messageId },
    select: { status: true },
  });
}

async function messageExists(messageId: string): Promise<boolean> {
  const prisma = getTestPrisma();
  const msg = await prisma.incomingMessage.findUnique({
    where: { message_id: messageId },
    select: { id: true },
  });
  return msg !== null;
}

async function countActiveAppointments(patientId: string): Promise<number> {
  const prisma = getTestPrisma();
  return prisma.appointment.count({
    where: {
      patient_id: patientId,
      status: { in: ["planned", "confirmed"] },
      deleted_at: null,
    },
  });
}

async function createTestPatientDirect(phone: string, name: string): Promise<{ id: string }> {
  const prisma = getTestPrisma();
  return prisma.patient.create({
    data: { name, phone },
  });
}

async function createTestAppointment(
  doctorId: string,
  patientId: string,
  datetime: Date,
  status: string,
): Promise<{ id: string }> {
  const prisma = getTestPrisma();
  return prisma.appointment.create({
    data: {
      doctor_id: doctorId,
      patient_id: patientId,
      datetime,
      duration: 30,
      status,
      source: "test",
    },
  });
}

function signWebhookPayload(payload: object, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest("hex")}`;
}

function createWebhookPayload(params: {
  messageId: string;
  fromPhone: string;
  text: string;
}): object {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "123456789",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15551234567", phone_number_id: "123" },
              contacts: [{ profile: { name: "Test User" }, wa_id: params.fromPhone }],
              messages: [
                {
                  from: params.fromPhone,
                  id: params.messageId,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: params.text },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Integration: WhatsApp Brain Flow", () => {
  beforeAll(async () => {
    // Verificar que los contenedores están corriendo
    const prisma = getTestPrisma();
    await prisma.$queryRaw`SELECT 1`;

    const redis = await getTestRedis();
    await redis.ping();

    // Crear fixtures
    fixtures = await createTestFixtures(uuidv4());
  });

  afterAll(async () => {
    // Cleanup
    try {
      await deleteTestFixtures(fixtures);
    } catch {
      // Ignore - may already be cleaned
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  beforeEach(async () => {
    sentMessages.length = 0;
    // Limpiar mensajes pero mantener fixtures
    const prisma = getTestPrisma();
    await prisma.incomingMessage.deleteMany();
    await prisma.outgoingMessage.deleteMany();
    await prisma.conversationState.deleteMany();
  });

  describe("Flujo de creación de turno", () => {
    it("procesa saludo y muestra menú", async () => {
      const messageId = generateMessageId();

      await simulateWebhook(messageId, TEST_PHONE, "Hola");
      await processMessageDirect(messageId);

      const status = await getIncomingMessageStatus(messageId);
      expect(status?.status).toBe("done");
      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0].phone).toBe(TEST_PHONE);
      expect(sentMessages[0].message.toLowerCase()).toContain("turno");
    });

    it("inicia flujo de crear turno", async () => {
      const messageId = generateMessageId();

      await simulateWebhook(messageId, TEST_PHONE, "Quiero sacar un turno");
      await processMessageDirect(messageId);

      const status = await getIncomingMessageStatus(messageId);
      expect(status?.status).toBe("done");
      expect(sentMessages.length).toBeGreaterThan(0);
    });

    it("consulta turnos existentes", async () => {
      const messageId = generateMessageId();

      // Crear paciente y turno
      const patient = await createTestPatientDirect(TEST_PHONE, "Juan Test");
      await createTestAppointment(
        fixtures.doctor.userId,
        patient.id,
        new Date(Date.now() + 48 * 60 * 60 * 1000),
        "planned",
      );

      await simulateWebhook(messageId, TEST_PHONE, "Quiero ver mis turnos");
      await processMessageDirect(messageId);

      const status = await getIncomingMessageStatus(messageId);
      expect(status?.status).toBe("done");
      expect(sentMessages.length).toBeGreaterThan(0);
    });
  });

  describe("Flujo de cancelación de turno", () => {
    it("inicia flujo de cancelación", async () => {
      const messageId = generateMessageId();

      // Crear paciente y turno
      const patient = await createTestPatientDirect(TEST_PHONE, "Maria Test");
      await createTestAppointment(
        fixtures.doctor.userId,
        patient.id,
        new Date(Date.now() + 72 * 60 * 60 * 1000),
        "planned",
      );

      await simulateWebhook(messageId, TEST_PHONE, "Quiero cancelar mi turno");
      await processMessageDirect(messageId);

      const status = await getIncomingMessageStatus(messageId);
      expect(status?.status).toBe("done");
      expect(sentMessages.length).toBeGreaterThan(0);
    });
  });

  describe("Idempotencia: duplicación de mensajes", () => {
    it("ignora mensaje duplicado con mismo message_id", async () => {
      const messageId = generateMessageId();

      await simulateWebhook(messageId, TEST_PHONE, "Hola duplicado");
      await processMessageDirect(messageId);

      const firstSentCount = sentMessages.length;
      expect(firstSentCount).toBe(1);

      const existsBefore = await messageExists(messageId);
      expect(existsBefore).toBe(true);

      // Procesar de nuevo - debería ser no-op
      await processMessageDirect(messageId);
      expect(sentMessages.length).toBe(firstSentCount);
    });

    it("procesa mensajes diferentes del mismo usuario", async () => {
      const messageId1 = generateMessageId();
      const messageId2 = generateMessageId();

      await simulateWebhook(messageId1, TEST_PHONE, "Primer mensaje");
      await processMessageDirect(messageId1);

      await simulateWebhook(messageId2, TEST_PHONE, "Segundo mensaje");
      await processMessageDirect(messageId2);

      const status1 = await getIncomingMessageStatus(messageId1);
      const status2 = await getIncomingMessageStatus(messageId2);

      expect(status1?.status).toBe("done");
      expect(status2?.status).toBe("done");
      expect(sentMessages.length).toBe(2);
    });

    it("no crea turnos duplicados con mismo idempotency_key", async () => {
      const prisma = getTestPrisma();
      const patient = await createTestPatientDirect(TEST_PHONE, "Test Idem");
      const initialCount = await countActiveAppointments(patient.id);
      const idempotencyKey = `manual-test-${Date.now()}`;

      await prisma.appointment.create({
        data: {
          doctor_id: fixtures.doctor.userId,
          patient_id: patient.id,
          datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          duration: 30,
          status: "planned",
          source: "whatsapp",
          idempotency_key: idempotencyKey,
        },
      });

      // Intentar crear duplicado - debe fallar
      await expect(
        prisma.appointment.create({
          data: {
            doctor_id: fixtures.doctor.userId,
            patient_id: patient.id,
            datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            duration: 30,
            status: "planned",
            source: "whatsapp",
            idempotency_key: idempotencyKey,
          },
        }),
      ).rejects.toThrow();

      const finalCount = await countActiveAppointments(patient.id);
      expect(finalCount).toBe(initialCount + 1);
    });
  });

  describe("Mensajes inválidos", () => {
    it("maneja mensaje vacío gracefully", async () => {
      const messageId = generateMessageId();

      await simulateWebhook(messageId, TEST_PHONE, "");
      await processMessageDirect(messageId);

      const status = await getIncomingMessageStatus(messageId);
      expect(status?.status).toBe("done");
      expect(sentMessages.length).toBeGreaterThan(0);
    });

    it("maneja caracteres especiales", async () => {
      const messageId = generateMessageId();
      const specialText = "Hola! Cómo estás? Quiero un turno";

      await simulateWebhook(messageId, TEST_PHONE, specialText);
      await processMessageDirect(messageId);

      const status = await getIncomingMessageStatus(messageId);
      expect(status?.status).toBe("done");
    });

    it("maneja intent desconocido", async () => {
      const messageId = generateMessageId();

      await simulateWebhook(messageId, TEST_PHONE, "asdfghjkl random gibberish xyz123");
      await processMessageDirect(messageId);

      const status = await getIncomingMessageStatus(messageId);
      expect(status?.status).toBe("done");
      expect(sentMessages.length).toBeGreaterThan(0);
    });
  });

  describe("Concurrencia: usuarios diferentes", () => {
    it("procesa mensajes de usuarios diferentes en paralelo", async () => {
      await createTestPatientDirect(TEST_PHONE, "Juan Concurrent");
      await createTestPatientDirect(TEST_PHONE_2, "Maria Concurrent");

      const messageId1 = generateMessageId();
      const messageId2 = generateMessageId();

      await Promise.all([
        simulateWebhook(messageId1, TEST_PHONE, "Hola soy Juan"),
        simulateWebhook(messageId2, TEST_PHONE_2, "Hola soy Maria"),
      ]);

      await Promise.all([
        processMessageDirect(messageId1),
        processMessageDirect(messageId2),
      ]);

      const status1 = await getIncomingMessageStatus(messageId1);
      const status2 = await getIncomingMessageStatus(messageId2);

      expect(status1?.status).toBe("done");
      expect(status2?.status).toBe("done");
      expect(sentMessages.length).toBe(2);

      const phones = sentMessages.map((m) => m.phone);
      expect(phones).toContain(TEST_PHONE);
      expect(phones).toContain(TEST_PHONE_2);
    });
  });
});

// ─── Webhook Signature Tests ─────────────────────────────────────────────────

describe("Integration: Webhook Signature Verification", () => {
  it("genera firma válida con secret correcto", () => {
    const payload = createWebhookPayload({
      messageId: generateMessageId(),
      fromPhone: TEST_PHONE,
      text: "test signature",
    });

    const signature = signWebhookPayload(payload, TEST_APP_SECRET);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("firmas diferentes para payloads diferentes", () => {
    const payload1 = createWebhookPayload({
      messageId: generateMessageId(),
      fromPhone: TEST_PHONE,
      text: "mensaje 1",
    });

    const payload2 = createWebhookPayload({
      messageId: generateMessageId(),
      fromPhone: TEST_PHONE,
      text: "mensaje 2",
    });

    const sig1 = signWebhookPayload(payload1, TEST_APP_SECRET);
    const sig2 = signWebhookPayload(payload2, TEST_APP_SECRET);

    expect(sig1).not.toBe(sig2);
  });

  it("firma cambia con secret diferente", () => {
    const payload = createWebhookPayload({
      messageId: generateMessageId(),
      fromPhone: TEST_PHONE,
      text: "test",
    });

    const sig1 = signWebhookPayload(payload, "secret1");
    const sig2 = signWebhookPayload(payload, "secret2");

    expect(sig1).not.toBe(sig2);
  });
});

// ─── Database Lock Tests ─────────────────────────────────────────────────────

describe("Integration: PostgreSQL Advisory Locks", () => {
  it("pg_advisory_xact_lock bloquea correctamente", async () => {
    const prisma = getTestPrisma();
    const phone = "+5491199999999";
    const lockKey = `wa_user:${phone}`;

    let firstStarted = false;
    let firstFinished = false;
    let secondStarted = false;

    const first = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        firstStarted = true;

        // Simular trabajo
        await new Promise((r) => setTimeout(r, 100));

        firstFinished = true;
        return 1;
      },
      { timeout: 10000 },
    );

    // Esperar un poco para que la primera transacción adquiera el lock
    await new Promise((r) => setTimeout(r, 20));

    const second = prisma.$transaction(
      async (tx) => {
        // Este debería bloquearse hasta que el primero termine
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        secondStarted = true;

        // Si llegamos aquí, el primero ya debería haber terminado
        expect(firstFinished).toBe(true);

        return 2;
      },
      { timeout: 10000 },
    );

    // Esperar ambos
    const [result1, result2] = await Promise.all([first, second]);

    expect(result1).toBe(1);
    expect(result2).toBe(2);
    expect(firstStarted).toBe(true);
    expect(secondStarted).toBe(true);
  });

  it("locks de usuarios diferentes no se bloquean entre sí", async () => {
    const prisma = getTestPrisma();
    const phone1 = "+5491188881111";
    const phone2 = "+5491188882222";

    let tx1InLock = false;
    let tx2InLock = false;

    const first = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa_user:${phone1}`}))`;
        tx1InLock = true;

        // Esperar un poco para dar tiempo a la segunda transacción
        await new Promise((r) => setTimeout(r, 50));

        // En este punto, si los locks fueran exclusivos globalmente,
        // la segunda transacción no habría podido entrar
        expect(tx2InLock).toBe(true);

        return 1;
      },
      { timeout: 10000 },
    );

    // Pequeño delay para empezar la segunda
    await new Promise((r) => setTimeout(r, 10));

    const second = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wa_user:${phone2}`}))`;
        tx2InLock = true;

        // Esperar un poco
        await new Promise((r) => setTimeout(r, 30));

        return 2;
      },
      { timeout: 10000 },
    );

    const [result1, result2] = await Promise.all([first, second]);

    expect(result1).toBe(1);
    expect(result2).toBe(2);
  });
});

// ─── Redis Queue Tests ───────────────────────────────────────────────────────

describe("Integration: Redis Operations", () => {
  it("Redis set/get funciona correctamente", async () => {
    const redis = await getTestRedis();
    const key = `test:key:${uuidv4()}`;
    const value = "test_value_123";

    await redis.set(key, value);
    const result = await redis.get(key);

    expect(result).toBe(value);
  });

  it("Redis pub/sub funciona", async () => {
    const redis = await getTestRedis();
    const channel = `test:channel:${uuidv4()}`;
    const message = "hello_world";
    let received = "";

    // Crear subscriber en cliente separado
    const subscriber = redis.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(channel, (msg) => {
      received = msg;
    });

    // Pequeño delay para asegurar suscripción
    await new Promise((r) => setTimeout(r, 50));

    // Publicar
    await redis.publish(channel, message);

    // Esperar recepción
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toBe(message);

    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  });

  it("Redis incremento atómico funciona", async () => {
    const redis = await getTestRedis();
    const key = `test:counter:${uuidv4()}`;

    const result1 = await redis.incr(key);
    const result2 = await redis.incr(key);
    const result3 = await redis.incr(key);

    expect(result1).toBe(1);
    expect(result2).toBe(2);
    expect(result3).toBe(3);
  });
});
