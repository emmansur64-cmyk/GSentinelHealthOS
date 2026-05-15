import { z } from "zod";

export const AGENDA_IMPORT_DRY_RUN_CONTRACT_VERSION = "mb-secretaria-import-v1";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dryRunRowSchema = z
  .object({
    rowNumber: z.number().int().positive(),
    rowIdempotencyKey: z.string().trim().min(1),
    doctorName: z.string().trim().min(1).optional(),
    specialty: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).optional(),
    dayOfWeek: z.string().trim().min(1).optional(),
    startTime: z.string().regex(TIME_PATTERN),
    endTime: z.string().regex(TIME_PATTERN),
  })
  .passthrough();

const dryRunRequestSchema = z
  .object({
    tenantId: z.string().trim().min(1),
    batchId: z.string().trim().min(1).optional(),
    batchIdempotencyKey: z.string().trim().min(1),
    rows: z.array(z.unknown()),
    mode: z.literal("dry_run"),
    apply: z.literal(false),
    contractVersion: z.literal(AGENDA_IMPORT_DRY_RUN_CONTRACT_VERSION),
  })
  .strict();

export type ScheduleImportDryRunRowResult = {
  rowNumber: number;
  rowIdempotencyKey: string;
  status: "accepted" | "rejected" | "warning";
  errors: string[];
  warnings: string[];
};

export type ScheduleImportDryRunResponse = {
  status: "dry_run_ok";
  apply: false;
  wouldWrite: false;
  tenantId: string;
  batchId: string;
  batchIdempotencyKey: string;
  summary: {
    receivedRows: number;
    acceptedRows: number;
    rejectedRows: number;
    warnings: number;
  };
  rows: ScheduleImportDryRunRowResult[];
};

export type ScheduleImportDryRunErrorResponse = {
  status: "dry_run_rejected";
  apply: false;
  wouldWrite: false;
  errors: string[];
};

export function isScheduleImportDryRunEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.AGENDA_IMPORT_DRY_RUN_ENABLED ?? "").trim().toLowerCase() === "true";
}

export function getScheduleImportDryRunMaxRows(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(String(env.AGENDA_IMPORT_DRY_RUN_MAX_ROWS ?? "500"), 10);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(parsed, 5000));
}

export function isValidScheduleImportDryRunKey(headerValue: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = String(env.AGENDA_IMPORT_DRY_RUN_API_KEY ?? "").trim();
  return expected.length > 0 && headerValue === expected;
}

export function validateScheduleImportDryRunPayload(
  payload: unknown,
  maxRows = 500,
): { ok: true; response: ScheduleImportDryRunResponse } | { ok: false; response: ScheduleImportDryRunErrorResponse } {
  const parsed = dryRunRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      response: {
        status: "dry_run_rejected",
        apply: false,
        wouldWrite: false,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`),
      },
    };
  }

  if (parsed.data.rows.length > maxRows) {
    return {
      ok: false,
      response: {
        status: "dry_run_rejected",
        apply: false,
        wouldWrite: false,
        errors: [`rows: max ${maxRows} rows allowed`],
      },
    };
  }

  const rows = parsed.data.rows.map((row, index): ScheduleImportDryRunRowResult => {
    const rowParsed = dryRunRowSchema.safeParse(row);
    if (!rowParsed.success) {
      return {
        rowNumber: inferRowNumber(row, index),
        rowIdempotencyKey: inferRowIdempotencyKey(row),
        status: "rejected",
        errors: rowParsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`),
        warnings: [],
      };
    }

    const errors: string[] = [];
    if (timeToMinutes(rowParsed.data.startTime) >= timeToMinutes(rowParsed.data.endTime)) {
      errors.push("startTime must be before endTime");
    }

    return {
      rowNumber: rowParsed.data.rowNumber,
      rowIdempotencyKey: rowParsed.data.rowIdempotencyKey,
      status: errors.length > 0 ? "rejected" : "accepted",
      errors,
      warnings: [],
    };
  });

  const acceptedRows = rows.filter((row) => row.status === "accepted").length;
  const rejectedRows = rows.filter((row) => row.status === "rejected").length;
  const warnings = rows.reduce((total, row) => total + row.warnings.length, 0);

  return {
    ok: true,
    response: {
      status: "dry_run_ok",
      apply: false,
      wouldWrite: false,
      tenantId: parsed.data.tenantId,
      batchId: parsed.data.batchId ?? "",
      batchIdempotencyKey: parsed.data.batchIdempotencyKey,
      summary: {
        receivedRows: parsed.data.rows.length,
        acceptedRows,
        rejectedRows,
        warnings,
      },
      rows,
    },
  };
}

function inferRowNumber(row: unknown, index: number): number {
  if (row && typeof row === "object" && "rowNumber" in row) {
    const value = Number((row as { rowNumber?: unknown }).rowNumber);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return index + 1;
}

function inferRowIdempotencyKey(row: unknown): string {
  if (row && typeof row === "object" && "rowIdempotencyKey" in row) {
    return String((row as { rowIdempotencyKey?: unknown }).rowIdempotencyKey ?? "");
  }
  return "";
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}
