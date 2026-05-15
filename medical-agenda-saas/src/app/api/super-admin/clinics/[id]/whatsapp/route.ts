import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { encryptText } from "@/lib/security/encryption";
import { requireSuperAdminApi, writeAdminAudit, getRequestIp } from "@/lib/super-admin";
import crypto from "node:crypto";

function hashVerifyToken(value: string): string {
  return crypto.createHash("sha256").update(value.trim(), "utf8").digest("hex");
}

const upsertSchema = z.object({
  phone_number_id: z.string().trim().min(4).max(40),
  waba_id: z.string().trim().min(4).max(40),
  display_phone_number: z.string().trim().max(30).optional(),
  access_token: z.string().min(10).max(1000),
  app_secret: z.string().min(4).max(200).optional(),
  verify_token: z.string().min(4).max(200).optional(),
  is_active: z.boolean().optional().default(true),
}).strict();

// GET /api/super-admin/clinics/[id]/whatsapp
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id: clinicId } = await params;

  const accounts = await prisma.clinicWhatsappAccount.findMany({
    where: { tenantId: clinicId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phoneNumberId: true,
      wabaId: true,
      displayPhoneNumber: true,
      // access_token y app_secret: no se exponen completos
      status: true,
      isActive: true,
      lastWebhookAt: true,
      lastErrorAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok(accounts);
}

// POST /api/super-admin/clinics/[id]/whatsapp — crear o actualizar cuenta
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id: clinicId } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: clinicId },
    select: { id: true },
  });
  if (!tenant) return fail("Clinica no encontrada", 404);

  const parsed = upsertSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

  const { phone_number_id, waba_id, display_phone_number, access_token, app_secret, verify_token, is_active } =
    parsed.data;

  try {
    const account = await prisma.clinicWhatsappAccount.upsert({
      where: {
        tenantId_phoneNumberId: {
          tenantId: clinicId,
          phoneNumberId: phone_number_id,
        },
      },
      create: {
        tenantId: clinicId,
        clinicId,
        phoneNumberId: phone_number_id,
        wabaId: waba_id,
        metaBusinessId: null,
        displayPhoneNumber: display_phone_number ?? null,
        accessTokenEncrypted: encryptText(access_token),
        appSecret: app_secret ? encryptText(app_secret) : null,
        verifyToken: verify_token ? hashVerifyToken(verify_token) : null,
        isActive: is_active,
        status: is_active ? "connected" : "disconnected",
      },
      update: {
        tenantId: clinicId,
        clinicId,
        wabaId: waba_id,
        displayPhoneNumber: display_phone_number ?? null,
        accessTokenEncrypted: encryptText(access_token),
        appSecret: app_secret ? encryptText(app_secret) : null,
        verifyToken: verify_token ? hashVerifyToken(verify_token) : null,
        isActive: is_active,
        status: is_active ? "connected" : "disconnected",
      },
      select: {
        id: true,
        phoneNumberId: true,
        wabaId: true,
        displayPhoneNumber: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAdminAudit({
      actorUserId: auth.user.userId,
      action: "whatsapp.upsert",
      targetType: "clinic_whatsapp_account",
      targetId: account.id,
      clinicId,
      metadata: { phone_number_id, waba_id, is_active },
      ipAddress: getRequestIp(request),
    });

    return ok(account, 200);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("Este phone_number_id ya esta asignado a otra clinica", 409, { code: "PHONE_NUMBER_ID_TAKEN" });
    }
    throw error;
  }
}

// PATCH /api/super-admin/clinics/[id]/whatsapp — activar/desactivar
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id: clinicId } = await params;

  const body = await request.json().catch(() => ({})) as { phone_number_id?: string; is_active?: boolean };
  if (!body.phone_number_id || typeof body.is_active !== "boolean") {
    return fail("Se requiere phone_number_id e is_active", 422);
  }

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: { phoneNumberId: body.phone_number_id, tenantId: clinicId },
    select: { id: true },
  });
  if (!account) return fail("Cuenta no encontrada para esta clinica", 404);

  const updated = await prisma.clinicWhatsappAccount.update({
    where: { id: account.id },
    data: {
      isActive: body.is_active,
      status: body.is_active ? "connected" : "disconnected",
    },
    select: { id: true, status: true, isActive: true, updatedAt: true },
  });

  await writeAdminAudit({
    actorUserId: auth.user.userId,
    action: body.is_active ? "whatsapp.activate" : "whatsapp.deactivate",
    targetType: "clinic_whatsapp_account",
    targetId: account.id,
    clinicId,
    ipAddress: getRequestIp(request),
  });

  return ok(updated);
}

