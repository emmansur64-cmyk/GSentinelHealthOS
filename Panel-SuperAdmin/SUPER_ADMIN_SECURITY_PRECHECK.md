# Super Admin Security Precheck

Date: 2026-05-17
Scope: Panel-SuperAdmin security hardening preproduction (no deploy, no production changes)

## Evidence Reviewed
- src/app/api/auth/login/route.ts
- src/lib/super-admin-credentials.ts
- src/app/api/tenants/[id]/route.ts
- src/app/api/audit-logs/route.ts
- src/services/admin-api/admin-api.client.ts
- src/lib/request-id.ts
- src/config/app.config.ts
- src/middleware.ts.bak.RUNTIME_HARDEN_20260516_140647
- .env.example

## Risks and Required Changes
1. Login brute-force exposure
- Risk: no per-IP/user rate-limit or lockout.
- Change: add in-memory login attempt guard with configurable window/max attempts/lockout.
- Compatibility: safe for current single-instance preproduction runtime.

2. Plain password fallback
- Risk: SUPER_ADMIN_PASSWORD plain-text acceptance.
- Change: enforce hash-only auth path; optional explicit transition flag disabled by default.
- Compatibility: requires SUPER_ADMIN_PASSWORD_HASH configured.

3. Sensitive payload logging
- Risk: tenant update logs full payload.
- Change: sanitize and whitelist payload summary before logging.
- Compatibility: no API contract changes.

4. Unbounded audit metadata
- Risk: arbitrary metadata forwarded without strict sanitization.
- Change: metadata sanitization (depth, size, key filtering, truncation).
- Compatibility: preserves audit flow with safe fallback.

5. Silent audit failures
- Risk: catch-empty in createAuditLog hides failures.
- Change: return observable status + structured warning logs.
- Compatibility: keep non-blocking behavior for non-audit-critical operations.

6. Weak request id source
- Risk: Date.now + Math.random predictability.
- Change: crypto.randomUUID / randomBytes fallback.
- Compatibility: request id string format preserved.

7. Health timeout parsing
- Risk: parseInt without robust fallback/clamping.
- Change: safe int parse with min/max and warning.
- Compatibility: default behavior preserved with safer parsing.

8. .bak file in src
- Risk: accidental confusion/drift in source tree.
- Change: verify references and move to backup folder outside src.
- Compatibility: runtime unchanged.

## Expected Compatibility
- Login flow remains same endpoint and cookie behavior.
- Role checks unchanged.
- Internal API contracts unchanged.
- Runtime behavior hardened, not redesigned.

## Rollback Suggestion
- Revert only touched files with git checkout of the specific paths.
- Restore previous login and credential behavior only if emergency access issue occurs.
- Keep backup file relocation reversible by moving file back.
