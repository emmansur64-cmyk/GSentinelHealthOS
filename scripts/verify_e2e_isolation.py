"""Verifica el aislamiento entre Clínica A y Clínica B en base de datos.

Comprueba que no haya cruce de:
  - pacientes
  - turnos
  - tokens/credenciales WhatsApp
  - configuraciones

Uso:
    python scripts/verify_e2e_isolation.py --clinic-a <uuid> --clinic-b <uuid>
    python scripts/verify_e2e_isolation.py --auto   # usa e2e-clinica-a y e2e-clinica-b

Exit code:
    0 -> aislamiento correcto
    1 -> se detectaron violaciones o warnings
    2 -> error de ejecución
"""

from __future__ import annotations

import argparse
import sys
import os
import uuid
from dataclasses import dataclass, field

import psycopg
from psycopg.rows import dict_row

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@dataclass
class ClinicInfo:
    clinic_id: str
    client_id: str | None
    name: str
    whatsapp_accounts: list[dict] = field(default_factory=list)


@dataclass
class IsolationViolation:
    severity: str       # "CRITICAL", "WARNING"
    description: str
    detail: str = ""


def _normalize_dsn(raw: str) -> str:
    if raw.startswith("postgresql+psycopg://"):
        return "postgresql://" + raw[len("postgresql+psycopg://"):]
    if raw.startswith("postgresql+asyncpg://"):
        return "postgresql://" + raw[len("postgresql+asyncpg://"):]
    return raw


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL es obligatorio.")
    return _normalize_dsn(url)


def _table_exists(conn: psycopg.Connection, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables"
            " WHERE table_schema=current_schema() AND table_name=%s)",
            (table,),
        )
        return bool(cur.fetchone()[0])


def _column_exists(conn: psycopg.Connection, table: str, col: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns"
            " WHERE table_schema=current_schema() AND table_name=%s AND column_name=%s)",
            (table, col),
        )
        return bool(cur.fetchone()[0])


# ---------------------------------------------------------------------------
# Lectores de estado
# ---------------------------------------------------------------------------

def _fetch_clinic(conn: psycopg.Connection, clinic_id: str) -> ClinicInfo | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, name FROM clinics WHERE id=%s LIMIT 1",
            (clinic_id,),
        )
        row = cur.fetchone()
    if not row:
        return None

    # Buscar client_id si existe la columna
    client_id = None
    if _column_exists(conn, "clinics", "client_id"):
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT client_id FROM clinics WHERE id=%s", (clinic_id,))
            client_row = cur.fetchone()
            if client_row:
                client_id = str(client_row["client_id"]) if client_row["client_id"] else None

    # Buscar cuentas WhatsApp
    accounts: list[dict] = []
    if _table_exists(conn, "client_whatsapp_accounts"):
        where_col = "clinic_id" if _column_exists(conn, "client_whatsapp_accounts", "clinic_id") else "client_id"
        where_val = clinic_id if where_col == "clinic_id" else client_id
        if where_val:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    f"SELECT id, phone_number_id, verify_token, status, webhook_enabled, client_id, clinic_id"
                    f" FROM client_whatsapp_accounts WHERE {where_col}=%s",
                    (where_val,),
                )
                accounts = [dict(r) for r in cur.fetchall()]

    return ClinicInfo(
        clinic_id=clinic_id,
        client_id=client_id,
        name=str(row["name"]),
        whatsapp_accounts=accounts,
    )


def _clinic_by_slug(conn: psycopg.Connection, slug_name_pattern: str) -> str | None:
    """Busca clínica por slug o name pattern (para E2E fixtures)."""
    patterns = [f"%{slug_name_pattern}%", f"%{slug_name_pattern.replace('-', ' ')}%"]
    for pattern in patterns:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM clinics WHERE name ILIKE %s LIMIT 1", (pattern,))
            row = cur.fetchone()
            if row:
                return str(row[0])

    if _table_exists(conn, "clients") and _column_exists(conn, "clients", "slug"):
        with conn.cursor() as cur:
            cur.execute(
                "SELECT cl.id FROM clinics cl JOIN clients c ON c.id=cl.client_id"
                " WHERE c.slug ILIKE %s LIMIT 1",
                (f"%{slug_name_pattern}%",),
            )
            row = cur.fetchone()
            if row:
                return str(row[0])
    return None


# ---------------------------------------------------------------------------
# Verificaciones
# ---------------------------------------------------------------------------

def _check_whatsapp_credential_isolation(
    a: ClinicInfo,
    b: ClinicInfo,
) -> list[IsolationViolation]:
    violations: list[IsolationViolation] = []

    # Tokens duplicados entre clínicas
    tokens_a = {acc.get("access_token_encrypted", "") for acc in a.whatsapp_accounts if acc.get("access_token_encrypted")}
    tokens_b = {acc.get("access_token_encrypted", "") for acc in b.whatsapp_accounts if acc.get("access_token_encrypted")}
    overlap_tokens = tokens_a & tokens_b
    if overlap_tokens:
        violations.append(IsolationViolation(
            severity="CRITICAL",
            description="Mismo access_token_encrypted compartido entre Clínica A y Clínica B",
            detail=f"Tokens compartidos: {len(overlap_tokens)}",
        ))

    # phone_number_id compartido
    pnids_a = {acc.get("phone_number_id", "") for acc in a.whatsapp_accounts}
    pnids_b = {acc.get("phone_number_id", "") for acc in b.whatsapp_accounts}
    overlap_pnids = pnids_a & pnids_b - {""}
    if overlap_pnids:
        violations.append(IsolationViolation(
            severity="CRITICAL",
            description="Mismo phone_number_id compartido entre Clínica A y Clínica B",
            detail=f"pnids: {overlap_pnids}",
        ))

    return violations


def _check_patient_isolation(
    conn: psycopg.Connection,
    a: ClinicInfo,
    b: ClinicInfo,
) -> list[IsolationViolation]:
    violations: list[IsolationViolation] = []

    if not (_table_exists(conn, "patients") and _column_exists(conn, "patients", "clinic_id")):
        return violations

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, phone FROM patients WHERE clinic_id=%s",
            (a.clinic_id,),
        )
        patients_a = {str(r["id"]): r.get("phone") for r in cur.fetchall()}

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id FROM patients WHERE clinic_id=%s AND id = ANY(%s)",
            (b.clinic_id, list(patients_a.keys())),
        )
        leaked_ids = [str(r["id"]) for r in cur.fetchall()]

    if leaked_ids:
        violations.append(IsolationViolation(
            severity="CRITICAL",
            description="Pacientes de Clínica A son visibles en Clínica B con el mismo ID",
            detail=f"IDs: {leaked_ids[:5]}",
        ))

    return violations


def _check_appointment_isolation(
    conn: psycopg.Connection,
    a: ClinicInfo,
    b: ClinicInfo,
) -> list[IsolationViolation]:
    violations: list[IsolationViolation] = []

    if not (_table_exists(conn, "appointments") and _column_exists(conn, "appointments", "clinic_id")):
        return violations

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id FROM appointments WHERE clinic_id=%s",
            (a.clinic_id,),
        )
        appts_a = {str(r["id"]) for r in cur.fetchall()}

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id FROM appointments WHERE clinic_id=%s AND id = ANY(%s)",
            (b.clinic_id, list(appts_a)),
        )
        leaked = [str(r["id"]) for r in cur.fetchall()]

    if leaked:
        violations.append(IsolationViolation(
            severity="CRITICAL",
            description="Turnos de Clínica A visibles en Clínica B con el mismo ID",
            detail=f"IDs: {leaked[:5]}",
        ))

    return violations


def _check_doctors_not_shared(
    conn: psycopg.Connection,
    a: ClinicInfo,
    b: ClinicInfo,
) -> list[IsolationViolation]:
    violations: list[IsolationViolation] = []

    if not (_table_exists(conn, "doctors") and _column_exists(conn, "doctors", "clinic_id")):
        return violations

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM doctors WHERE clinic_id=%s", (a.clinic_id,))
        doctors_a = {str(r["id"]) for r in cur.fetchall()}

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id FROM doctors WHERE clinic_id=%s AND id = ANY(%s)",
            (b.clinic_id, list(doctors_a)),
        )
        shared = [str(r["id"]) for r in cur.fetchall()]

    if shared:
        violations.append(IsolationViolation(
            severity="WARNING",
            description="Mismo doctor_id existe en ambas clínicas (podría ser intencional si es multi-clínica)",
            detail=f"IDs: {shared[:5]}",
        ))

    return violations


def _check_null_clinic_ids(
    conn: psycopg.Connection,
    a: ClinicInfo,
    b: ClinicInfo,
) -> list[IsolationViolation]:
    violations: list[IsolationViolation] = []

    for table in ("patients", "doctors", "appointments"):
        if not (_table_exists(conn, table) and _column_exists(conn, table, "clinic_id")):
            continue
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE clinic_id IS NULL")
            count = cur.fetchone()[0]
        if count > 0:
            violations.append(IsolationViolation(
                severity="WARNING",
                description=f"Tabla '{table}' tiene {count} filas sin clinic_id (datos legacy sin backfill)",
                detail="Ejecutar: python scripts/backfill_clinic_id.py --help",
            ))

    return violations


# ---------------------------------------------------------------------------
# Reporte
# ---------------------------------------------------------------------------

def _print_report(
    a: ClinicInfo,
    b: ClinicInfo,
    violations: list[IsolationViolation],
) -> None:
    print(f"\n{'='*65}")
    print("VERIFICACIÓN DE AISLAMIENTO A/B")
    print(f"{'='*65}")
    print(f"  Clínica A: {a.name} | clinic_id={a.clinic_id}")
    print(f"             client_id={a.client_id} | WA accounts={len(a.whatsapp_accounts)}")
    if a.whatsapp_accounts:
        for acc in a.whatsapp_accounts:
            print(f"             pnid={acc.get('phone_number_id')} | status={acc.get('status')}")
    print()
    print(f"  Clínica B: {b.name} | clinic_id={b.clinic_id}")
    print(f"             client_id={b.client_id} | WA accounts={len(b.whatsapp_accounts)}")
    if b.whatsapp_accounts:
        for acc in b.whatsapp_accounts:
            print(f"             pnid={acc.get('phone_number_id')} | status={acc.get('status')}")
    print(f"{'='*65}\n")

    if not violations:
        print("✅  Aislamiento correcto: no se detectaron violaciones ni cruces de datos.\n")
        return

    critical = [v for v in violations if v.severity == "CRITICAL"]
    warnings = [v for v in violations if v.severity == "WARNING"]

    if critical:
        print(f"🔴  VIOLACIONES CRÍTICAS: {len(critical)}")
        for v in critical:
            print(f"  • {v.description}")
            if v.detail:
                print(f"    {v.detail}")
        print()

    if warnings:
        print(f"🟡  ADVERTENCIAS: {len(warnings)}")
        for v in warnings:
            print(f"  • {v.description}")
            if v.detail:
                print(f"    {v.detail}")
        print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verificación de aislamiento A/B en BD")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--clinic-a", help="UUID de Clínica A")
    group.add_argument("--auto", action="store_true", help="Buscar clínicas E2E fixtures automáticamente")
    parser.add_argument("--clinic-b", help="UUID de Clínica B (requerido con --clinic-a)")
    parser.add_argument("--fail-on-warning", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    dsn = _database_url()

    with psycopg.connect(dsn, autocommit=True, row_factory=dict_row) as conn:
        if args.auto:
            clinic_a_id = _clinic_by_slug(conn, "clinica-a") or _clinic_by_slug(conn, "E2E - A")
            clinic_b_id = _clinic_by_slug(conn, "clinica-b") or _clinic_by_slug(conn, "E2E - B")
            if not clinic_a_id or not clinic_b_id:
                print(
                    "No se encontraron clínicas E2E. "
                    "Ejecutar primero: python scripts/e2e_setup_clinics.py",
                    file=sys.stderr,
                )
                return 2
        else:
            clinic_a_id = args.clinic_a
            clinic_b_id = args.clinic_b
            if not clinic_b_id:
                print("--clinic-b es requerido con --clinic-a", file=sys.stderr)
                return 2

        info_a = _fetch_clinic(conn, clinic_a_id)
        info_b = _fetch_clinic(conn, clinic_b_id)

        if info_a is None:
            print(f"Clínica A no encontrada: {clinic_a_id}", file=sys.stderr)
            return 2
        if info_b is None:
            print(f"Clínica B no encontrada: {clinic_b_id}", file=sys.stderr)
            return 2

        all_violations: list[IsolationViolation] = []
        all_violations.extend(_check_whatsapp_credential_isolation(info_a, info_b))
        all_violations.extend(_check_patient_isolation(conn, info_a, info_b))
        all_violations.extend(_check_appointment_isolation(conn, info_a, info_b))
        all_violations.extend(_check_doctors_not_shared(conn, info_a, info_b))
        all_violations.extend(_check_null_clinic_ids(conn, info_a, info_b))

        _print_report(info_a, info_b, all_violations)

    critical = any(v.severity == "CRITICAL" for v in all_violations)
    warnings = any(v.severity == "WARNING" for v in all_violations)

    if critical:
        return 1
    if args.fail_on_warning and warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
