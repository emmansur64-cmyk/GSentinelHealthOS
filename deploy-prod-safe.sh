#!/usr/bin/env bash
set -euo pipefail

# Wrapper para ejecutar el deploy seguro desde la raiz del repo.
exec ./scripts/deploy-prod-safe.sh "$@"
