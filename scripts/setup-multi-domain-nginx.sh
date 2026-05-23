#!/usr/bin/env bash
# Add voltrixpv.com and voltrix-power.com (same site as main VPS app on port 3000).
# Run on VPS as root:  bash /var/www/erpvoltrix/scripts/setup-multi-domain-nginx.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF_SSL="$ROOT/scripts/nginx/voltrix-domains.conf"
CONF_HTTP="$ROOT/scripts/nginx/voltrix-domains.http.conf"
CONF_DST="/etc/nginx/sites-available/voltrix-erp"
APP_PORT="${APP_PORT:-3000}"

echo "==> Domains: voltrixpv.com, voltrix-power.com, voltrixbatteries.com, voltrixev.com (+ www)"
echo "==> Backend: 127.0.0.1:${APP_PORT} (pm2: voltrix-erp)"

if [[ ! -f "$CONF_HTTP" ]]; then
  echo "ERROR: Missing $CONF_HTTP"
  exit 1
fi

mkdir -p /var/www/certbot

# Use HTTP-only config until certbot has created certificates (avoids nginx -t failure).
CERT_DIR=""
for d in voltrixpv.com voltrix-power.com; do
  if [[ -f "/etc/letsencrypt/live/${d}/fullchain.pem" ]]; then
    CERT_DIR="$d"
    break
  fi
done

if [[ -n "$CERT_DIR" && -f "$CONF_SSL" ]]; then
  echo "==> Install nginx config (SSL cert found: $CERT_DIR)"
  cp "$CONF_SSL" "$CONF_DST"
else
  echo "==> Install nginx config (HTTP only — no cert yet; run certbot after this)"
  cp "$CONF_HTTP" "$CONF_DST"
fi

ln -sf "$CONF_DST" /etc/nginx/sites-enabled/voltrix-erp

if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
  echo "==> Removed default nginx site (was conflicting)"
fi

echo "==> Test nginx config"
nginx -t

echo "==> Reload nginx"
systemctl reload nginx

echo ""
echo "==> DNS check (must point to this server's public IP):"
for host in voltrixpv.com voltrix-power.com; do
  echo -n "  $host: "
  dig +short A "$host" 2>/dev/null | head -1 || echo "(install dig or check DNS panel)"
done

echo ""
if [[ -z "$CERT_DIR" ]]; then
  echo "==> Issue SSL (run now if DNS is correct):"
  echo "sudo certbot --nginx \\"
  echo "  -d voltrixpv.com -d www.voltrixpv.com \\"
  echo "  -d voltrix-power.com -d www.voltrix-power.com \\"
  echo "  -d voltrixbatteries.com -d www.voltrixbatteries.com \\"
  echo "  -d voltrixev.com -d www.voltrixev.com"
  echo ""
  echo "Certbot will add HTTPS. To use the repo SSL template afterward:"
  echo "  sudo cp $CONF_SSL $CONF_DST && sudo nginx -t && sudo systemctl reload nginx"
fi

echo ""
echo "==> Ensure app is running:"
echo "  pm2 status voltrix-erp"
echo "  curl -sI http://127.0.0.1:${APP_PORT} | head -3"
echo ""
echo "Done."
