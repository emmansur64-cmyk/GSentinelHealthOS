#!/usr/bin/env bash
# Deploy medical-agenda-saas and point the public domain to it through nginx.
#
# Run on the VPS from the repo root:
#   bash scripts/deploy_medical_agenda_domain.sh
#
# Optional env:
#   DOMAIN=gsentinelhealth.com.ar WEB_PORT=3000 bash scripts/deploy_medical_agenda_domain.sh
set -euo pipefail

DOMAIN="${DOMAIN:-gsentinelhealth.com.ar}"
WEB_PORT="${WEB_PORT:-3000}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-${PROJECT_ROOT}/medical-agenda-saas}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
NGINX_SITE_NAME="${NGINX_SITE_NAME:-medical-agenda-saas}"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE_NAME}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}.conf"
UPSTREAM="http://127.0.0.1:${WEB_PORT}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Falta comando requerido: $1" >&2
    exit 1
  fi
}

require_cmd docker
require_cmd curl
require_cmd sudo

if [ ! -d "${APP_DIR}" ]; then
  echo "No existe APP_DIR=${APP_DIR}" >&2
  exit 1
fi

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "Falta ${APP_DIR}/.env con variables de produccion." >&2
  echo "Crear desde medical-agenda-saas/.env.example antes de desplegar." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "Falta docker compose." >&2
  exit 1
fi

echo "==> Build y arranque de medical-agenda-saas"
cd "${APP_DIR}"
"${DC[@]}" -f "${COMPOSE_FILE}" up -d --build

echo "==> Esperando healthcheck en ${UPSTREAM}/api/health"
for i in $(seq 1 60); do
  if curl -fsS --max-time 5 "${UPSTREAM}/api/health" >/tmp/medical-agenda-health.json; then
    echo "Health OK"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "La app no responde en ${UPSTREAM}/api/health" >&2
    echo "Logs recientes:" >&2
    "${DC[@]}" -f "${COMPOSE_FILE}" logs --tail=80 web >&2 || true
    exit 1
  fi
  sleep 2
done

echo "==> Preparando nginx para ${DOMAIN} -> ${UPSTREAM}"
TMP_CONF="$(mktemp)"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

if sudo test -f "${CERT_DIR}/fullchain.pem" && sudo test -f "${CERT_DIR}/privkey.pem"; then
  cat >"${TMP_CONF}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;

    client_max_body_size 50m;

    location = /home { return 307 /; }
    location = /panel { return 307 /dashboard/agenda; }
    location = /panel-secretaria { return 307 /dashboard/agenda; }

    location ^~ /api/ {
      proxy_pass ${UPSTREAM};
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 120s;
      proxy_send_timeout 120s;
      proxy_intercept_errors off;
    }

    location ^~ /_next/ {
      proxy_pass ${UPSTREAM};
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 120s;
      proxy_send_timeout 120s;
      proxy_intercept_errors off;
    }

    location / {
        proxy_pass ${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_intercept_errors on;
        error_page 404 =307 /login;
    }
}
EOF
else
  cat >"${TMP_CONF}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 50m;

  location = /home { return 307 /; }
  location = /panel { return 307 /dashboard/agenda; }
  location = /panel-secretaria { return 307 /dashboard/agenda; }

  location ^~ /api/ {
    proxy_pass ${UPSTREAM};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    proxy_intercept_errors off;
  }

  location ^~ /_next/ {
    proxy_pass ${UPSTREAM};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    proxy_intercept_errors off;
  }

    location / {
        proxy_pass ${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_intercept_errors on;
        error_page 404 =307 /login;
    }
}
EOF
  echo "Aviso: no encontre certificado en ${CERT_DIR}; configure HTTP. Luego ejecutar certbot para HTTPS." >&2
fi

sudo install -m 0644 "${TMP_CONF}" "${NGINX_AVAILABLE}"
rm -f "${TMP_CONF}"
sudo ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

echo "==> Buscando configs nginx que tambien declaren ${DOMAIN}"
CONFLICTS="$(sudo grep -RslE "server_name .*(${DOMAIN}|www\.${DOMAIN})" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -v "${NGINX_ENABLED}" || true)"
if [ -n "${CONFLICTS}" ]; then
  echo "Hay configs duplicadas para el dominio. Se deshabilitan para evitar que nginx use el upstream viejo:"
  echo "${CONFLICTS}"
  while IFS= read -r file; do
    [ -z "${file}" ] && continue
    sudo mv "${file}" "${file}.disabled.$(date +%Y%m%d%H%M%S)"
  done <<<"${CONFLICTS}"
fi

sudo nginx -t
sudo systemctl reload nginx

echo "==> Verificando dominio publico"
curl -fsSI --max-time 15 "https://${DOMAIN}/" | head -n 10 || {
  echo "No pude verificar HTTPS publico. Revisar: sudo journalctl -u nginx -n 80 --no-pager" >&2
  exit 1
}

echo "Deploy listo: https://${DOMAIN}"
