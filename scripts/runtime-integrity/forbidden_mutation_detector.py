#!/usr/bin/env python3
import fnmatch, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
patterns = ["*.ts", "*.tsx", "*.py", "*.env", "docker-compose*", "package.json", "prisma/schema.prisma", "**/migrations/*"]
violations = []
for p in ROOT.rglob("*"):
    if not p.is_file():
        continue
    rel = str(p.relative_to(ROOT)).replace("\\", "/")
    if any(fnmatch.fnmatch(rel, pat) or fnmatch.fnmatch(p.name, pat) for pat in patterns):
        violations.append(rel)
print(json.dumps(sorted(set(violations)), indent=2))
