#!/usr/bin/env python3
import subprocess, json
out = subprocess.check_output(["git", "status", "--short", "--untracked-files=all"], text=True)
print(json.dumps({"git_status_short": out.splitlines()}, indent=2))
