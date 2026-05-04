"""Backfill controlado de clinic_id para datos existentes.

Uso seguro:
  python scripts/backfill_clinic_id.py --clinic-id <uuid>

Aplicar cambios:
  python scripts/backfill_clinic_id.py --clinic-id <uuid> --apply

El script no crea clinicas, no inventa datos y solo actualiza filas con clinic_id IS NULL.
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from dataclasses import dataclass

import psycopg
from psycopg.rows import dict_row


TABLES_WITH_CLINIC_ID = (
    "patients",
    "doctors",
    "appointments",
    "notification_outbox",
    "google_outbox",
    "bot_knowledge_base",
    "time_slots",
    "slot_audit_log",
    "doctor_schedule_config",
    "appointments_v2",
    "audit_logs",
    "whatsapp_sessions",
    "whatsapp_messages",
    "medical_files",
)


@dataclass(frozen=True)
class TableBackfillPlan:
    table_name: str
    exists: bool
    has_clinic_id: bool
    null_count: int = 0


def _normalize_dsn(raw: str) -> str:
    if raw.startswith("postgresql+psycopg://"):
        return "postgresql://" + raw[len("postgresql+psycopg://") :]
    if raw.startswith("postgresql+asyncpg://"):
        return "postgresql://" + raw[len("postgresql+asyncpg://") :]
    return raw


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL es obligatorio para ejecutar backfill")
    return _normalize_dsn(database_url)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill controlado de clinic_id")
    parser.add_argument("--clinic-id", required=True, help="UUID de clinics.id existente")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica UPDATE. Sin este flag solo muestra dry-run.",
    )
    parser.add_argument(
        "--tables",
        nargs="*",
        default=list(TABLES_WITH_CLINIC_ID),
        help="Subset opcional de tablas a backfillear",
    )
    return parser.parse_args()


def _validate_clinic_id(raw: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise SystemExit(f"--clinic-id invalido: {raw}") from exc


def _table_exists(conn: psycopg.Connection, table_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = current_schema()
                AND table_name = %s
            )
            """,
            (table_name,),
        )
        return bool(cur.fetchone()[0])


def _has_column(conn: psycopg.Connection, table_name: str, column_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND table_name = %s
                AND column_name = %s
            )
            """,
            (table_name, column_name),
        )
        return bool(cur.fetchone()[0])


def _clinic_exists(conn: psycopg.Connection, clinic_id: uuid.UUID) -> bool:
    if not _table_exists(conn, "clinics"):
        raise SystemExit("La tabla clinics no existe. Ejecuta primero la migracion del Paso 2.")

    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM clinics WHERE id = %s LIMIT 1", (clinic_id,))
        return cur.fetchone() is not None


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _build_plan(conn: psycopg.Connection, tables: list[str]) -> list[TableBackfillPlan]:
    plan: list[TableBackfillPlan] = []
    for table_name in tables:
        exists = _table_exists(conn, table_name)
        if not exists:
            plan.append(TableBackfillPlan(table_name=table_name, exists=False, has_clinic_id=False))
            continue

        has_clinic_id = _has_column(conn, table_name, "clinic_id")
        if not has_clinic_id:
            plan.append(TableBackfillPlan(table_name=table_name, exists=True, has_clinic_id=False))
            continue

        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {_quote_identifier(table_name)} WHERE clinic_id IS NULL")
            null_count = int(cur.fetchone()[0])

        plan.append(
            TableBackfillPlan(
                table_name=table_name,
                exists=True,
                has_clinic_id=True,
                null_count=null_count,
            )
        )
    return plan


def _apply_plan(conn: psycopg.Connection, plan: list[TableBackfillPlan], clinic_id: uuid.UUID) -> None:
    with conn.cursor() as cur:
        for item in plan:
            if not item.exists or not item.has_clinic_id or item.null_count == 0:
                continue
            cur.execute(
                f"UPDATE {_quote_identifier(item.table_name)} SET clinic_id = %s WHERE clinic_id IS NULL",
                (clinic_id,),
            )


def _print_plan(plan: list[TableBackfillPlan], *, apply: bool) -> None:
    mode = "APPLY" if apply else "DRY-RUN"
    print(f"Modo: {mode}")
    print("Tabla\tEstado\tFilas clinic_id NULL")
    for item in plan:
        if not item.exists:
            print(f"{item.table_name}\tNO_EXISTE\t-")
        elif not item.has_clinic_id:
            print(f"{item.table_name}\tSIN_COLUMNA_CLINIC_ID\t-")
        else:
            print(f"{item.table_name}\tOK\t{item.null_count}")


def main() -> int:
    args = _parse_args()
    clinic_id = _validate_clinic_id(args.clinic_id)
    dsn = _database_url()

    with psycopg.connect(dsn, autocommit=False, row_factory=dict_row) as conn:
        if not _clinic_exists(conn, clinic_id):
            raise SystemExit(f"No existe clinics.id={clinic_id}. No se aplica backfill.")

        plan = _build_plan(conn, args.tables)
        _print_plan(plan, apply=args.apply)

        total = sum(item.null_count for item in plan if item.exists and item.has_clinic_id)
        if total == 0:
            print("No hay filas pendientes de backfill.")
            conn.rollback()
            return 0

        if not args.apply:
            print("Dry-run completo. Reejecuta con --apply para actualizar.")
            conn.rollback()
            return 0

        _apply_plan(conn, plan, clinic_id)
        conn.commit()
        print(f"Backfill aplicado. Filas actualizadas: {total}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
