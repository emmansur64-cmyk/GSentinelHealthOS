#!/usr/bin/env python3
import json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "artifacts" / "runtime_integrity" / "baseline_hashes.json"
if not BASE.exists():
    raise SystemExit("baseline missing; run integrity_scanner.py")
baseline = {r["path"]: r["sha256"] for r in json.loads(BASE.read_text(encoding="utf-8"))}
changed = []
for rel, sha in baseline.items():
    p = ROOT / rel
    if not p.exists():
        changed.append({"path": rel, "status": "deleted"})
        continue
    if hashlib.sha256(p.read_bytes()).hexdigest() != sha:
        changed.append({"path": rel, "status": "modified"})
print(json.dumps(changed, indent=2))
raise SystemExit(1 if changed else 0)
