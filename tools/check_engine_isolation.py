"""Fail when an engine imports or names another engine implementation."""

import ast
import sys
from pathlib import Path

ROOT = Path("src/clinical_kernel/MOTORES")
ENGINE_IDS = frozenset({"CRE", "CEE", "CDR", "CPIE", "CCMP", "CES", "CCR", "CME", "CCFE", "CUE", "CXE"})
IMPLEMENTED_ENGINE_IDS = frozenset({"CDR"})


def violations() -> list[str]:
    found: list[str] = []
    for engine_id in sorted(IMPLEMENTED_ENGINE_IDS):
        directory = ROOT / engine_id
        if not directory.exists():
            found.append(f"{directory}: implemented engine directory is missing")
            continue
        forbidden = ENGINE_IDS - {engine_id}
        for path in directory.rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    names = {alias.name for alias in node.names}
                    for other in forbidden:
                        if any(f"MOTORES.{other}" in name for name in names):
                            found.append(f"{path}:{node.lineno}: imports {other}")
                elif isinstance(node, ast.ImportFrom):
                    module = node.module or ""
                    for other in forbidden:
                        if f"MOTORES.{other}" in module:
                            found.append(f"{path}:{node.lineno}: imports {other}")
                elif isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value in forbidden:
                    found.append(f"{path}:{node.lineno}: references engine ID {node.value}")
    return found


def main() -> int:
    found = violations()
    if found:
        print("\n".join(found))
        return 1
    print(f"engine isolation verified for {len(IMPLEMENTED_ENGINE_IDS)} implemented engine; {len(ENGINE_IDS)} IDs declared")
    return 0


if __name__ == "__main__":
    sys.exit(main())
