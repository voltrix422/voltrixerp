#!/usr/bin/env bash
# Add voltrixpv.com and voltrix-power.com (same site as main VPS app on port 3000).
# Run on VPS as root:  bash /var/www/erpvoltrix/scripts/setup-multi-domain-nginx.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF_SRC="$ROOT/scripts/nginx/voltrix-domains.conf"
CONF_DST="/etc/nginx/sites-available/voltrix-erp"
APP_PORT="${APP_PORT:-3000}"

echo "==> Domains: voltrixpv.com, www.voltrixpv.com, voltrix-power.com, www.voltrix-power.com"
echo "==> Backend: 127.0.0.1:${APP_PORT} (pm2: voltrix-erp)"

if [[ ! -f "$CONF_SRC" ]]; then
  echo "ERROR: Missing $CONF_SRC"
  exit 1
fi

echo "==> Install nginx config"
cp "$CONF_SRC" "$CONF_DST"
ln -sf "$CONF_DST" /etc/nginx/sites-enabled/voltrix-erp

# Disable default site if it conflicts (optional)
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
  echo "==> Removed default nginx site (was conflicting)"
fi

mkdir -p /var/www/certbot

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
echo "==> Issue / renew SSL certificate (run after DNS propagates):"
echo "sudo certbot --nginx \\"
echo "  -d voltrixpv.com -d www.voltrixpv.com \\"
echo "  -d voltrix-power.com -d www.voltrix-power.com"
echo ""
echo "If you already have another domain on this server, add it to the same certbot command, e.g.:"
echo "  -d your-existing-domain.com -d www.your-existing-domain.com"
echo ""
echo "Then edit $CONF_DST server_name and ssl_certificate paths if certbot used a different folder."
echo ""
echo "==> Ensure app is running:"
echo "  pm2 status voltrix-erp"
echo "  curl -sI http://127.0.0.1:${APP_PORT} | head -3"
echo ""
echo "Done. Open https://voltrixpv.com and https://voltrix-power.com after DNS + certbot."
