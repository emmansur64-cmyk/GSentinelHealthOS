import { NextResponse } from "next/server";

import {
  getScheduleImportDryRunMaxRows,
  isScheduleImportDryRunEnabled,
  isValidScheduleImportDryRunKey,
  validateScheduleImportDryRunPayload,
} from "@/lib/admin-schedule-import-dry-run";
import { logServer } from "@/lib/server-logger";

const ENDPOINT = "/admin/schedule-import/dry-run";

export async function POST(request: Request) {
  if (!isScheduleImportDryRunEnabled()) {
    logServer("warn", "agenda_import_dry_run.disabled", {
      endpoint: ENDPOINT,
    });
    return NextResponse.json(
      {
        status: "dry_run_rejected",
        apply: false,
        wouldWrite: false,
        errors: ["dry_run_endpoint_disabled"],
      },
      { status: 404 },
    );
  }

  if (!isValidScheduleImportDryRunKey(request.headers.get("x-internal-api-key"))) {
    logServer("warn", "agenda_import_dry_run.unauthorized", {
      endpoint: ENDPOINT,
    });
    return NextResponse.json(
      {
        status: "dry_run_rejected",
        apply: false,
        wouldWrite: false,
        errors: ["invalid_internal_api_key"],
      },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "dry_run_rejected",
        apply: false,
        wouldWrite: false,
        errors: ["invalid_json"],
      },
      { status: 400 },
    );
  }

  const result = validateScheduleImportDryRunPayload(payload, getScheduleImportDryRunMaxRows());
  if (!result.ok) {
    return NextResponse.json(result.response, { status: 422 });
  }

  return NextResponse.json(result.response, { status: 200 });
}
