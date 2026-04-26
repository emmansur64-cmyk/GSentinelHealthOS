#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/opt/GSentinelHealthOS}"
SERVICE_FILE="${PROJECT_ROOT}/deploy/systemd/gsentinel-outbox-scheduler.service"
TARGET_SERVICE="/etc/systemd/system/gsentinel-outbox-scheduler.service"

if [[ ! -f "${SERVICE_FILE}" ]]; then
  echo "Service file not found: ${SERVICE_FILE}" >&2
  exit 1
fi

sudo mkdir -p /var/log/gsentinel
sudo cp "${SERVICE_FILE}" "${TARGET_SERVICE}"
sudo systemctl daemon-reload
sudo systemctl enable gsentinel-outbox-scheduler
sudo systemctl restart gsentinel-outbox-scheduler
sudo systemctl status gsentinel-outbox-scheduler --no-pager

echo "Outbox scheduler service installed and started."
