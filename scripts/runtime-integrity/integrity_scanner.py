#!/usr/bin/env python3
import os, hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "runtime_integrity"
OUT.mkdir(parents=True, exist_ok=True)
ALLOW_EXT = {".py", ".ts", ".tsx", ".js", ".json", ".yml", ".yaml", ".env", ".prisma"}
records = []
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts:
        continue
    if p.suffix.lower() in ALLOW_EXT or p.name in {"docker-compose.yml", "package.json"}:
        records.append({"path": str(p.relative_to(ROOT)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "size": p.stat().st_size})
out = OUT / "baseline_hashes.json"
out.write_text(json.dumps(records, indent=2), encoding="utf-8")
print(out)
