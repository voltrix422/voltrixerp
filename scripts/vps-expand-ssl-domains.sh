#!/usr/bin/env bash
# Add voltrixbatteries.com (and ensure all domains) on SSL cert + nginx.
# Run on VPS: sudo bash /var/www/erpvoltrix/scripts/vps-expand-ssl-domains.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF_SRC="$ROOT/scripts/nginx/voltrix-domains.conf"
CONF_DST="/etc/nginx/sites-available/voltrix-erp"
DOMAINS=(
  voltrixpv.com www.voltrixpv.com
  voltrix-power.com www.voltrix-power.com
  voltrixbatteries.com www.voltrixbatteries.com
  voltrixev.com www.voltrixev.com
)

echo "==> Update nginx site config (all domains → port 3000)"
if [[ -f "$CONF_SRC" ]] && [[ -f /etc/letsencrypt/live/voltrixpv.com/fullchain.pem ]]; then
  cp "$CONF_SRC" "$CONF_DST"
  ln -sf "$CONF_DST" /etc/nginx/sites-enabled/voltrix-erp
fi

# Ensure server_name includes voltrixbatteries on live config (certbot may have edited files)
for site in /etc/nginx/sites-enabled/*; do
  [[ -f "$site" ]] || continue
  if grep -q "ssl_certificate" "$site" 2>/dev/null && grep -q "voltrixpv.com\|voltrixbatteries\|proxy_pass" "$site" 2>/dev/null; then
    if ! grep -q "voltrixbatteries.com" "$site" 2>/dev/null; then
      echo "==> Add voltrixbatteries.com to server_name in $site (manual check recommended)"
    fi
  fi
done

nginx -t
systemctl reload nginx

echo "==> Expand Let's Encrypt certificate"
CERTBOT_ARGS=()
for d in "${DOMAINS[@]}"; do
  CERTBOT_ARGS+=(-d "$d")
done
certbot --nginx --expand "${CERTBOT_ARGS[@]}"

nginx -t
systemctl reload nginx

echo ""
echo "==> Done. Test:"
echo "  curl -sI https://voltrixbatteries.com | head -3"
echo "  openssl s_client -connect voltrixbatteries.com:443 -servername voltrixbatteries.com </dev/null 2>/dev/null | openssl x509 -noout -subject"
