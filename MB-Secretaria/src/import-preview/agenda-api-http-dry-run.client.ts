import { Injectable } from '@nestjs/common';
import {
  AGENDA_APPLY_DISABLED_ERROR,
  AgendaApiClient,
} from './agenda-api-client';
import {
  AgendaApiDryRunResult,
  AgendaApiScheduleImportPayload,
} from './import-preview.types';
import { AgendaApiDryRunClient } from './agenda-api-dry-run.client';

type HttpTransport = (url: string, init: RequestInit) => Promise<Response>;

const REMOTE_DRY_RUN_CONTRACT_VERSION = 'mb-secretaria-import-v1';
const MUTATING_PATH_RE = /\b(apply|write|mutate|mutation|create|update|delete|patch|cancel|reschedule)\b/i;

@Injectable()
export class AgendaApiHttpDryRunClient implements AgendaApiClient {
  constructor(
    private readonly localClient: AgendaApiDryRunClient = new AgendaApiDryRunClient(),
    private readonly transport: HttpTransport = globalThis.fetch.bind(globalThis),
  ) {}

  async previewScheduleImport(payload: AgendaApiScheduleImportPayload): Promise<AgendaApiDryRunResult> {
    const localResult = await this.localClient.previewScheduleImport(payload);
    if (!this.httpEnabled()) return localResult;

    const target = this.resolveTarget();
    if (!target.ok) {
      return this.withRemoteFailure(localResult, target.errorCode, target.host, target.path);
    }

    const timeoutMs = this.timeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.transport(target.url.toString(), {
        method: 'POST',
        headers: this.headers(payload),
        body: JSON.stringify(this.remoteBody(payload)),
        signal: controller.signal,
      });

      return {
        ...localResult,
        mode: 'remote_dry_run_contract_validation',
        wouldSend: true,
        remoteDryRunAttempted: true,
        remoteDryRunSent: true,
        remoteDryRunHost: target.url.hostname,
        remoteDryRunPath: target.url.pathname,
        remoteDryRunStatus: response.status,
        remoteDryRunErrorCode: response.ok ? undefined : 'remote_non_2xx',
      };
    } catch (error) {
      return this.withRemoteFailure(
        localResult,
        error instanceof Error && error.name === 'AbortError' ? 'remote_timeout' : 'remote_request_failed',
        target.url.hostname,
        target.url.pathname,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async applyScheduleImport(_payload: AgendaApiScheduleImportPayload): Promise<never> {
    throw new Error(AGENDA_APPLY_DISABLED_ERROR);
  }

  private httpEnabled(): boolean {
    return String(process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED ?? 'false').toLowerCase() === 'true';
  }

  private resolveTarget():
    | { ok: true; url: URL }
    | { ok: false; errorCode: string; host?: string; path?: string } {
    const baseUrl = String(process.env.AGENDA_API_BASE_URL ?? '').trim();
    const path = this.dryRunPath();

    if (!baseUrl) return { ok: false, errorCode: 'missing_base_url', path };
    if (MUTATING_PATH_RE.test(path)) return { ok: false, errorCode: 'unsafe_dry_run_path', path };

    let url: URL;
    try {
      url = new URL(path, baseUrl);
    } catch {
      return { ok: false, errorCode: 'invalid_base_url', path };
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, errorCode: 'invalid_protocol', host: url.hostname, path: url.pathname };
    }
    if (!this.allowedHosts().includes(url.hostname)) {
      return { ok: false, errorCode: 'host_not_allowlisted', host: url.hostname, path: url.pathname };
    }
    if (url.pathname !== path) {
      return { ok: false, errorCode: 'path_resolution_mismatch', host: url.hostname, path: url.pathname };
    }

    return { ok: true, url };
  }

  private dryRunPath(): string {
    const path = String(process.env.AGENDA_API_DRY_RUN_PATH || '/admin/schedule-import/dry-run').trim();
    return path.startsWith('/') ? path : `/${path}`;
  }

  private allowedHosts(): string[] {
    return String(process.env.AGENDA_API_ALLOWED_HOSTS || 'localhost,127.0.0.1')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean);
  }

  private timeoutMs(): number {
    const configured = Number(process.env.AGENDA_API_TIMEOUT_MS ?? 3000);
    return Number.isFinite(configured) && configured > 0 ? configured : 3000;
  }

  private headers(payload: AgendaApiScheduleImportPayload): Record<string, string> {
    const authHeader = String(process.env.AGENDA_API_AUTH_HEADER || 'x-internal-api-key').trim();
    const authToken = String(process.env.AGENDA_API_AUTH_TOKEN || '').trim();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-tenant-id': payload.tenantId,
      'idempotency-key': payload.batchIdempotencyKey,
    };
    if (authHeader && authToken) headers[authHeader] = authToken;
    return headers;
  }

  private remoteBody(payload: AgendaApiScheduleImportPayload): Record<string, unknown> {
    return {
      tenantId: payload.tenantId,
      batchId: payload.batchId,
      batchIdempotencyKey: payload.batchIdempotencyKey,
      rows: payload.rows.map((row) => ({
        rowNumber: row.rowNumber,
        rowIdempotencyKey: row.rowIdempotencyKey,
        doctorName: row.doctorName,
        specialty: row.specialty,
        location: row.location,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
      })),
      mode: 'dry_run',
      apply: false,
      contractVersion: REMOTE_DRY_RUN_CONTRACT_VERSION,
    };
  }

  private withRemoteFailure(
    localResult: AgendaApiDryRunResult,
    errorCode: string,
    host?: string,
    path?: string,
  ): AgendaApiDryRunResult {
    return {
      ...localResult,
      remoteDryRunAttempted: true,
      remoteDryRunSent: false,
      remoteDryRunHost: host,
      remoteDryRunPath: path,
      remoteDryRunErrorCode: errorCode,
    };
  }
}
