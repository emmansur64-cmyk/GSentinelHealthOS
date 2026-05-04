"""Audita archivos de log o salida de docker logs en busca de datos sensibles.

Uso local (archivos):
    python scripts/audit_logs_sensitive.py --path /var/log/gsentinel/ --ext .log

Uso contra docker logs en vivo:
    docker logs sentinel-api 2>&1 | python scripts/audit_logs_sensitive.py --stdin

Uso contra múltiples contenedores:
    python scripts/audit_logs_sensitive.py --docker sentinel-api sentinel-brain sentinel-gateway

Exit code:
    0 -> sin datos sensibles detectados
    1 -> se encontraron coincidencias que deben revisarse
    2 -> error de ejecucion
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator


# ---------------------------------------------------------------------------
# Patrones sensibles
# ---------------------------------------------------------------------------

@dataclass
class SensitivePattern:
    name: str
    pattern: re.Pattern
    severity: str  # "CRITICAL", "HIGH", "MEDIUM"
    description: str


SENSITIVE_PATTERNS: list[SensitivePattern] = [
    SensitivePattern(
        name="access_token_bearer",
        pattern=re.compile(r"(?i)bearer\s+ey[a-zA-Z0-9_\-\.]{20,}"),
        severity="CRITICAL",
        description="Bearer JWT token (access_token real) en claro",
    ),
    SensitivePattern(
        name="access_token_key_value",
        pattern=re.compile(r"(?i)(access.?token|Authorization)\s*[:=]\s*['\"]?[A-Za-z0-9_\-\.]{30,}"),
        severity="CRITICAL",
        description="access_token en clave:valor en claro",
    ),
    SensitivePattern(
        name="app_secret_key_value",
        pattern=re.compile(r"(?i)(app.?secret|whatsapp.?secret|signing.?secret)\s*[:=]\s*['\"]?\S{10,}"),
        severity="CRITICAL",
        description="app_secret en clave:valor en claro",
    ),
    SensitivePattern(
        name="x_hub_signature_full",
        pattern=re.compile(r"(?i)x-hub-signature-256\s*[:=]\s*sha256=[a-f0-9]{64}"),
        severity="HIGH",
        description="Firma HMAC completa de Meta en logs (no debería loguearse entera)",
    ),
    SensitivePattern(
        name="secret_encryption_key",
        pattern=re.compile(r"(?i)(secret.?encryption.?key|SECRET_ENCRYPTION_KEY)\s*[:=]\s*\S{8,}"),
        severity="CRITICAL",
        description="Clave maestra de cifrado en logs",
    ),
    SensitivePattern(
        name="jwt_secret",
        pattern=re.compile(r"(?i)(jwt.?secret|JWT_SECRET)\s*[:=]\s*\S{8,}"),
        severity="CRITICAL",
        description="JWT_SECRET en logs",
    ),
    SensitivePattern(
        name="database_url_with_password",
        pattern=re.compile(r"(?i)postgresql://[^:]+:[^@]{6,}@"),
        severity="HIGH",
        description="DATABASE_URL con contraseña en texto claro",
    ),
    SensitivePattern(
        name="medical_record_dni",
        pattern=re.compile(r"(?i)(dni|cedula|cedula_identidad)\s*[:=]\s*\d{6,10}"),
        severity="MEDIUM",
        description="DNI/Cédula en logs (revisar si es necesario para diagnóstico)",
    ),
    SensitivePattern(
        name="patient_email_in_payload",
        pattern=re.compile(r"(?i)(\"email\"|\"patient_email\")\s*:\s*\"[^@\s]+@[^@\s]+\.[^@\s]+\""),
        severity="MEDIUM",
        description="Email de paciente en payload JSON completo en logs",
    ),
    SensitivePattern(
        name="graph_api_token_url",
        pattern=re.compile(r"graph\.facebook\.com/[^/]+/[^/]+\?.*access_token=\S+"),
        severity="CRITICAL",
        description="URL de Graph API con access_token como query param",
    ),
]


@dataclass
class Finding:
    source: str
    line_number: int
    line: str
    pattern_name: str
    severity: str
    description: str
    match: str


# ---------------------------------------------------------------------------
# Scanners
# ---------------------------------------------------------------------------

def _scan_lines(source: str, lines: Iterator[str]) -> list[Finding]:
    findings: list[Finding] = []
    for lineno, raw in enumerate(lines, start=1):
        line = raw.rstrip("\n")
        for sp in SENSITIVE_PATTERNS:
            m = sp.pattern.search(line)
            if m:
                findings.append(Finding(
                    source=source,
                    line_number=lineno,
                    line=line[:300],  # Truncar para evitar exponer datos completos en stdout
                    pattern_name=sp.name,
                    severity=sp.severity,
                    description=sp.description,
                    match=m.group(0)[:80],  # Solo el match, truncado
                ))
    return findings


def _scan_file(path: Path) -> list[Finding]:
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return _scan_lines(str(path), fh)
    except OSError as exc:
        print(f"  ⚠ No se pudo leer {path}: {exc}", file=sys.stderr)
        return []


def _scan_stdin() -> list[Finding]:
    return _scan_lines("<stdin>", sys.stdin)


def _scan_docker_container(container: str) -> list[Finding]:
    try:
        result = subprocess.run(
            ["docker", "logs", "--tail", "5000", container],
            capture_output=True,
            text=True,
            timeout=30,
        )
        all_output = result.stdout + result.stderr
        return _scan_lines(f"docker:{container}", iter(all_output.splitlines()))
    except FileNotFoundError:
        print("  ⚠ Docker no encontrado en PATH.", file=sys.stderr)
        return []
    except subprocess.TimeoutExpired:
        print(f"  ⚠ Timeout leyendo logs de {container}", file=sys.stderr)
        return []


# ---------------------------------------------------------------------------
# Reporte
# ---------------------------------------------------------------------------

_SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
_SEVERITY_SYMBOL = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡"}


def _print_report(findings: list[Finding]) -> None:
    if not findings:
        print("\n✅  Auditoría completada: no se encontraron datos sensibles en logs.\n")
        return

    findings.sort(key=lambda f: (_SEVERITY_ORDER.get(f.severity, 99), f.source, f.line_number))

    counts: dict[str, int] = {}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    print(f"\n{'='*70}")
    print(f"⚠  AUDITORÍA DE LOGS: {len(findings)} hallazgos detectados")
    for sev, count in sorted(counts.items(), key=lambda x: _SEVERITY_ORDER.get(x[0], 99)):
        symbol = _SEVERITY_SYMBOL.get(sev, "  ")
        print(f"   {symbol} {sev}: {count}")
    print(f"{'='*70}\n")

    for f in findings:
        symbol = _SEVERITY_SYMBOL.get(f.severity, "  ")
        print(f"{symbol} [{f.severity}] {f.pattern_name}")
        print(f"   Fuente:      {f.source}:{f.line_number}")
        print(f"   Descripción: {f.description}")
        print(f"   Match:       {f.match!r}")
        print(f"   Línea:       {f.line[:120]!r}")
        print()


def _print_summary_csv(findings: list[Finding]) -> None:
    print("severity,source,line_number,pattern_name,match")
    for f in findings:
        clean_match = f.match.replace(",", " ")
        print(f"{f.severity},{f.source},{f.line_number},{f.pattern_name},{clean_match}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Auditoría de logs: datos sensibles")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--path", type=str, help="Directorio o archivo de logs")
    group.add_argument("--stdin", action="store_true", help="Leer de stdin (pipe de docker logs)")
    group.add_argument("--docker", nargs="+", metavar="CONTAINER", help="Nombres de contenedores Docker")
    parser.add_argument("--ext", default=".log", help="Extensión de archivos a escanear con --path (default: .log)")
    parser.add_argument("--csv", action="store_true", help="Salida CSV además del reporte legible")
    parser.add_argument("--fail-on-medium", action="store_true", help="Salir con error 1 incluso en hallazgos MEDIUM")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    all_findings: list[Finding] = []

    if args.stdin:
        print("Leyendo desde stdin...", file=sys.stderr)
        all_findings.extend(_scan_stdin())

    elif args.docker:
        for container in args.docker:
            print(f"Analizando logs de contenedor: {container}", file=sys.stderr)
            all_findings.extend(_scan_docker_container(container))

    elif args.path:
        target = Path(args.path)
        if target.is_file():
            all_findings.extend(_scan_file(target))
        elif target.is_dir():
            ext = args.ext if args.ext.startswith(".") else f".{args.ext}"
            files = sorted(target.rglob(f"*{ext}"))
            if not files:
                print(f"No se encontraron archivos {ext} en {target}", file=sys.stderr)
            for f in files:
                print(f"  Analizando: {f}", file=sys.stderr)
                all_findings.extend(_scan_file(f))
        else:
            print(f"ERROR: {args.path} no existe.", file=sys.stderr)
            return 2
    else:
        # Por defecto: escanear logs del proyecto actual si existen
        default_log_dirs = [Path("logs"), Path("/var/log/gsentinel")]
        found_any = False
        for log_dir in default_log_dirs:
            if log_dir.exists():
                found_any = True
                for f in sorted(log_dir.rglob("*.log")):
                    all_findings.extend(_scan_file(f))
        if not found_any:
            print(
                "No se especificó fuente de logs y no se encontró directorio 'logs/'.\n"
                "Uso: python scripts/audit_logs_sensitive.py --help",
                file=sys.stderr,
            )
            return 2

    _print_report(all_findings)

    if args.csv and all_findings:
        print("\n--- CSV ---")
        _print_summary_csv(all_findings)

    critical_count = sum(1 for f in all_findings if f.severity == "CRITICAL")
    high_count = sum(1 for f in all_findings if f.severity == "HIGH")
    medium_count = sum(1 for f in all_findings if f.severity == "MEDIUM")

    if critical_count > 0 or high_count > 0:
        return 1
    if args.fail_on_medium and medium_count > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
