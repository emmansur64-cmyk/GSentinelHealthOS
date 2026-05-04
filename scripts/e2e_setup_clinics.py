"""Crea dos clínicas de prueba E2E (Clínica A y Clínica B) con sus credenciales WhatsApp.

Uso:
    python scripts/e2e_setup_clinics.py [--dry-run] [--reset]

Flags:
    --dry-run   Solo imprime SQL generado, no aplica cambios.
    --reset     Borra y recrea clinicas E2E existentes (cuidado con datos de prueba).
    --show      Muestra estado actual de clínicas E2E (sin crear nada).

Requisitos:
    DATABASE_URL          -> URL de Postgres local/VPS.
    SECRET_ENCRYPTION_KEY -> Clave para cifrar access_token / app_secret.

Los campos access_token y app_secret de prueba son FICTICIOS y solo sirven para
verificar el flujo de cifrado/descifrado antes de conectar cuentas Meta reales.
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime

import psycopg
from psycopg.rows import dict_row

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.security.secrets import encrypt_secret, is_secret_encryption_key_configured


# ---------------------------------------------------------------------------
# Datos de prueba E2E
# ---------------------------------------------------------------------------

E2E_TAG = "e2e-test"

@dataclass
class ClinicE2EFixture:
    tag: str
    name: str
    legal_name: str
    timezone: str = "America/Argentina/Buenos_Aires"
    slug: str = ""
    # WhatsApp placeholder (serán reemplazados en Embedded Signup real)
    phone_number_id: str = ""
    phone_number: str = ""
    display_phone_number: str = ""
    verify_token: str = ""
    # Secretos ficticios para validar ciclo cifrado. En E2E real se pisan con Embedded Signup.
    access_token_placeholder: str = "PLACEHOLDER_TOKEN_REPLACE_VIA_EMBEDDED_SIGNUP"
    app_secret_placeholder: str = "PLACEHOLDER_SECRET_REPLACE_VIA_EMBEDDED_SIGNUP"


CLINICS_FIXTURE: list[ClinicE2EFixture] = [
    ClinicE2EFixture(
        tag="clinic-a",
        name="Clínica E2E - A",
        legal_name="Clínica de Prueba A S.A.",
        slug="e2e-clinica-a",
        phone_number_id="",          # completar con pnid real antes del E2E
        display_phone_number="",
        verify_token="E2E_VERIFY_TOKEN_CLINIC_A",
    ),
    ClinicE2EFixture(
        tag="clinic-b",
        name="Clínica E2E - B",
        legal_name="Clínica de Prueba B S.A.",
        slug="e2e-clinica-b",
        phone_number_id="",          # completar con pnid real antes del E2E
        display_phone_number="",
        verify_token="E2E_VERIFY_TOKEN_CLINIC_B",
    ),
]


# ---------------------------------------------------------------------------
# Helpers DB
# ---------------------------------------------------------------------------

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


def _column_exists(conn: psycopg.Connection, table: str, column: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns"
            " WHERE table_schema=current_schema() AND table_name=%s AND column_name=%s)",
            (table, column),
        )
        return bool(cur.fetchone()[0])


# ---------------------------------------------------------------------------
# Setup clínicas
# ---------------------------------------------------------------------------

def _upsert_client(conn: psycopg.Connection, slug: str, name: str, dry_run: bool) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM clients WHERE slug=%s LIMIT 1", (slug,))
        row = cur.fetchone()
        if row:
            return str(row[0])

    client_id = str(uuid.uuid4())
    sql = (
        "INSERT INTO clients (id, name, slug, status, created_at, updated_at)"
        " VALUES (%s, %s, %s, 'active', NOW(), NOW())"
    )
    if dry_run:
        print(f"  [DRY-RUN] INSERT client slug={slug} id={client_id}")
        return client_id

    with conn.cursor() as cur:
        cur.execute(sql, (client_id, name, slug))
    print(f"  ✓ Client creado: slug={slug} id={client_id}")
    return client_id


def _upsert_clinic(
    conn: psycopg.Connection,
    fixture: ClinicE2EFixture,
    client_id: str,
    dry_run: bool,
) -> str:
    with conn.cursor() as cur:
        # Buscar por slug en columna description/legal_name si existe, o por name
        cur.execute(
            "SELECT id FROM clinics WHERE name=%s LIMIT 1",
            (fixture.name,),
        )
        row = cur.fetchone()
        if row:
            clinic_id = str(row[0])
            print(f"  ✓ Clinic ya existe: {fixture.name} id={clinic_id}")
            return clinic_id

    clinic_id = str(uuid.uuid4())
    has_client_id = _column_exists(conn, "clinics", "client_id")
    has_legal_name = _column_exists(conn, "clinics", "legal_name")
    has_timezone = _column_exists(conn, "clinics", "timezone")
    has_status = _column_exists(conn, "clinics", "status")

    cols = ["id", "name", "active"]
    vals: list = [clinic_id, fixture.name, True]

    if has_client_id:
        cols.append("client_id")
        vals.append(client_id)
    if has_legal_name:
        cols.append("legal_name")
        vals.append(fixture.legal_name)
    if has_timezone:
        cols.append("timezone")
        vals.append(fixture.timezone)
    if has_status:
        cols.append("status")
        vals.append("active")

    cols += ["created_at", "updated_at"]
    vals += [datetime.utcnow(), datetime.utcnow()]

    placeholders = ", ".join(["%s"] * len(vals))
    col_names = ", ".join(cols)
    sql = f"INSERT INTO clinics ({col_names}) VALUES ({placeholders})"

    if dry_run:
        print(f"  [DRY-RUN] INSERT clinic name={fixture.name} id={clinic_id}")
        return clinic_id

    with conn.cursor() as cur:
        cur.execute(sql, vals)
    print(f"  ✓ Clinic creada: {fixture.name} id={clinic_id}")
    return clinic_id


def _upsert_whatsapp_account(
    conn: psycopg.Connection,
    fixture: ClinicE2EFixture,
    client_id: str,
    clinic_id: str,
    dry_run: bool,
) -> str:
    if not _table_exists(conn, "client_whatsapp_accounts"):
        print("  ⚠ Tabla client_whatsapp_accounts no existe. Ejecutar migraciones primero.")
        return ""

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM client_whatsapp_accounts WHERE client_id=%s LIMIT 1",
            (client_id,),
        )
        row = cur.fetchone()
        if row:
            account_id = str(row[0])
            print(f"  ✓ WhatsApp account ya existe: client_id={client_id} account_id={account_id}")
            return account_id

    account_id = str(uuid.uuid4())

    encrypted_token = ""
    encrypted_secret = ""
    if is_secret_encryption_key_configured():
        try:
            encrypted_token = encrypt_secret(fixture.access_token_placeholder)
            encrypted_secret = encrypt_secret(fixture.app_secret_placeholder)
            print(f"  ✓ Cifrado OK para {fixture.tag}")
        except Exception as exc:
            print(f"  ⚠ Error cifrando credenciales para {fixture.tag}: {exc}")
    else:
        print("  ⚠ SECRET_ENCRYPTION_KEY no configurada. Guardando placeholders sin cifrar.")

    has_clinic_id = _column_exists(conn, "client_whatsapp_accounts", "clinic_id")
    has_meta_fields = _column_exists(conn, "client_whatsapp_accounts", "meta_business_id")
    has_display_phone = _column_exists(conn, "client_whatsapp_accounts", "display_phone_number")

    cols = [
        "id", "client_id", "provider", "phone_number_id",
        "access_token_encrypted", "app_secret_encrypted",
        "verify_token", "webhook_enabled", "status",
        "created_at", "updated_at",
    ]
    vals: list = [
        account_id, client_id, "meta",
        fixture.phone_number_id or f"PLACEHOLDER_PNID_{fixture.tag.upper()}",
        encrypted_token or fixture.access_token_placeholder,
        encrypted_secret or fixture.app_secret_placeholder,
        fixture.verify_token, True, "active",
        datetime.utcnow(), datetime.utcnow(),
    ]

    if has_clinic_id:
        cols.insert(2, "clinic_id")
        vals.insert(2, clinic_id)
    if has_display_phone:
        cols.append("display_phone_number")
        vals.append(fixture.display_phone_number or "")

    placeholders = ", ".join(["%s"] * len(vals))
    col_names = ", ".join(cols)
    sql = f"INSERT INTO client_whatsapp_accounts ({col_names}) VALUES ({placeholders})"

    if dry_run:
        print(f"  [DRY-RUN] INSERT whatsapp_account client_id={client_id} account_id={account_id}")
        return account_id

    with conn.cursor() as cur:
        cur.execute(sql, vals)
    print(f"  ✓ WhatsApp account creada: {fixture.tag} account_id={account_id}")
    return account_id


def _show_state(conn: psycopg.Connection) -> None:
    print("\n=== Estado actual clínicas E2E ===")
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT id, name, active FROM clinics WHERE name LIKE 'Clínica E2E%' ORDER BY name"
            )
            rows = cur.fetchall()
        if not rows:
            print("  (No existen clínicas E2E)")
        for row in rows:
            print(f"  Clinic: {row['name']} | id={row['id']} | active={row['active']}")
    except Exception as exc:
        print(f"  ⚠ No se pudo leer clinics: {exc}")

    if not _table_exists(conn, "client_whatsapp_accounts"):
        print("  (Tabla client_whatsapp_accounts no existe)")
        return

    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT cwa.id, cwa.client_id, cwa.clinic_id, cwa.phone_number_id,
                       cwa.verify_token, cwa.status, cwa.webhook_enabled
                FROM client_whatsapp_accounts cwa
                JOIN clinics cl ON cl.id = cwa.clinic_id
                WHERE cl.name LIKE 'Clínica E2E%'
                ORDER BY cl.name
                """
            )
            rows = cur.fetchall()
        if not rows:
            print("  (No existen cuentas WhatsApp E2E)")
        for row in rows:
            print(
                f"  WA Account: clinic_id={row['clinic_id']} | pnid={row['phone_number_id']} "
                f"| verify_token={row['verify_token']} | status={row['status']}"
            )
    except Exception as exc:
        print(f"  ⚠ No se pudo leer client_whatsapp_accounts: {exc}")


def _reset_e2e(conn: psycopg.Connection) -> None:
    print("\n=== Eliminando datos E2E existentes ===")
    with conn.cursor() as cur:
        if _table_exists(conn, "client_whatsapp_accounts"):
            cur.execute(
                """
                DELETE FROM client_whatsapp_accounts
                WHERE client_id IN (
                    SELECT id FROM clients WHERE slug IN ('e2e-clinica-a', 'e2e-clinica-b')
                )
                """
            )
            print(f"  Deleted {cur.rowcount} whatsapp accounts")
        cur.execute(
            "DELETE FROM clinics WHERE name LIKE 'Clínica E2E%'"
        )
        print(f"  Deleted {cur.rowcount} clinics")
        cur.execute(
            "DELETE FROM clients WHERE slug IN ('e2e-clinica-a', 'e2e-clinica-b')"
        )
        print(f"  Deleted {cur.rowcount} clients")


def main() -> int:
    parser = argparse.ArgumentParser(description="Setup E2E: Clínicas A y B con credenciales WhatsApp")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--reset", action="store_true", help="Borra y recrea datos E2E")
    parser.add_argument("--show", action="store_true", help="Solo muestra estado actual")
    args = parser.parse_args()

    dsn = _database_url()

    with psycopg.connect(dsn, autocommit=False, row_factory=dict_row) as conn:
        if args.show:
            _show_state(conn)
            conn.rollback()
            return 0

        if args.reset and not args.dry_run:
            _reset_e2e(conn)
            conn.commit()

        results: dict[str, dict] = {}

        for fixture in CLINICS_FIXTURE:
            print(f"\n--- Setup {fixture.tag}: {fixture.name} ---")
            client_slug = f"client-{fixture.tag}"
            client_id = _upsert_client(conn, client_slug, fixture.name, args.dry_run)
            clinic_id = _upsert_clinic(conn, fixture, client_id, args.dry_run)
            account_id = _upsert_whatsapp_account(conn, fixture, client_id, clinic_id, args.dry_run)
            results[fixture.tag] = {
                "client_id": client_id,
                "clinic_id": clinic_id,
                "account_id": account_id,
                "phone_number_id": fixture.phone_number_id or f"PLACEHOLDER_PNID_{fixture.tag.upper()}",
                "verify_token": fixture.verify_token,
            }

        if not args.dry_run:
            conn.commit()
            print("\n=== ✓ Commit aplicado ===")
        else:
            conn.rollback()
            print("\n=== DRY-RUN completado. Sin cambios en BD. ===")

        print("\n=== Resumen de IDs E2E ===")
        for tag, ids in results.items():
            print(f"\n  {tag}:")
            for k, v in ids.items():
                print(f"    {k}: {v}")

        if not args.dry_run:
            _show_state(conn)

    print(
        "\nSiguiente paso: ejecutar Embedded Signup real para cada clínica"
        " y actualizar phone_number_id / access_token / app_secret en client_whatsapp_accounts."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
