#!/usr/bin/env bash
# Add HSTS to nginx SSL site (run on VPS after certbot). Idempotent.
set -euo pipefail

CONF="/etc/nginx/sites-available/voltrix-erp"
MARKER="Strict-Transport-Security"

if [[ ! -f "$CONF" ]]; then
  echo "ERROR: $CONF not found"
  exit 1
fi

if grep -q "$MARKER" "$CONF"; then
  echo "==> HSTS already present in $CONF"
else
  echo "==> Adding HSTS header"
  sed -i '/ssl_dhparam/a\    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;' "$CONF"
fi

nginx -t
systemctl reload nginx
echo "==> Done. Expand cert if voltrixev.com is used:"
echo "sudo bash scripts/vps-expand-ssl-domains.sh"
