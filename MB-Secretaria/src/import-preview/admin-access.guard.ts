import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export interface AdminAccessHeaders {
  tenantId?: string;
  adminApiKey?: string;
  userRole?: string;
  userId?: string;
  userScope?: string;
}

export interface AdminAccessContext {
  tenantId: string;
  userId: string;
  userRole: string;
  scope: string;
  security: {
    authPassed: true;
    roleAllowed: true;
    scopeAllowed: true;
  };
}

export type AdminAccessRejectionReason =
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'invalid_role'
  | 'missing_scope'
  | 'invalid_scope'
  | 'missing_tenant'
  | 'missing_user';

export class AdminAccessError extends Error {
  constructor(
    readonly reason: AdminAccessRejectionReason,
    readonly httpError: BadRequestException | UnauthorizedException | ForbiddenException,
  ) {
    super(reason);
  }
}

const FORBIDDEN_ADMIN_CONTEXT_RE = /\b(patient|doctor_clinical|triage|imaging|diagnosis|diagnostico|diagnóstico|clinical|clinico|clínico)\b/i;

@Injectable()
export class AdminAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const headers = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>().headers;
    this.authorize({
      tenantId: this.header(headers, 'x-tenant-id'),
      adminApiKey: this.header(headers, 'x-admin-api-key'),
      userRole: this.header(headers, 'x-user-role'),
      userId: this.header(headers, 'x-user-id'),
      userScope: this.header(headers, 'x-user-scope'),
    });
    return true;
  }

  authorize(headers: AdminAccessHeaders): AdminAccessContext {
    const tenantId = this.clean(headers.tenantId);
    const adminApiKey = this.clean(headers.adminApiKey);
    const userRole = this.clean(headers.userRole).toLowerCase();
    const userId = this.clean(headers.userId);
    const userScope = this.clean(headers.userScope);
    const expectedApiKey = this.clean(process.env.MB_SECRETARIA_ADMIN_API_KEY);
    const allowedRoles = this.allowedRoles();
    const requiredScope = this.requiredScope();

    if (!tenantId) this.reject('missing_tenant', new BadRequestException('x-tenant-id requerido.'));
    if (!userId) this.reject('missing_user', new BadRequestException('x-user-id requerido.'));
    if (!adminApiKey) this.reject('missing_api_key', new UnauthorizedException('x-admin-api-key requerido.'));
    if (!expectedApiKey || adminApiKey !== expectedApiKey) this.reject('invalid_api_key', new UnauthorizedException('API key administrativa invalida.'));
    if (!userRole || !allowedRoles.includes(userRole) || FORBIDDEN_ADMIN_CONTEXT_RE.test(userRole)) {
      this.reject('invalid_role', new ForbiddenException('Rol administrativo no autorizado.'));
    }
    if (!userScope) this.reject('missing_scope', new ForbiddenException('x-user-scope requerido.'));
    if (!this.scopeAllowed(userScope, requiredScope) || FORBIDDEN_ADMIN_CONTEXT_RE.test(userScope)) {
      this.reject('invalid_scope', new ForbiddenException('Scope administrativo no autorizado.'));
    }

    return {
      tenantId,
      userId,
      userRole,
      scope: userScope,
      security: {
        authPassed: true,
        roleAllowed: true,
        scopeAllowed: true,
      },
    };
  }

  private allowedRoles(): string[] {
    return this.clean(process.env.MB_SECRETARIA_ALLOWED_ROLES || 'secretary,admin')
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  }

  private requiredScope(): string {
    return this.clean(process.env.MB_SECRETARIA_REQUIRED_SCOPE || 'schedule:import:preview');
  }

  private scopeAllowed(scopeHeader: string, requiredScope: string): boolean {
    return scopeHeader
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
      .includes(requiredScope);
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private clean(value: string | undefined): string {
    return String(value ?? '').trim();
  }

  private reject(reason: AdminAccessRejectionReason, httpError: BadRequestException | UnauthorizedException | ForbiddenException): never {
    throw new AdminAccessError(reason, httpError);
  }
}
