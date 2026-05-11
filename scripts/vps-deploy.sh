#!/usr/bin/env bash
# Run on the VPS from anywhere:  bash /var/www/erpvoltrix/scripts/vps-deploy.sh
# Or:  cd /var/www/erpvoltrix && npm run deploy:vps
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PM2_NAME="${PM2_APP_NAME:-voltrix-erp}"

echo "==> Reset local package-lock.json (fixes: merge would overwrite package-lock.json)"
git checkout -- package-lock.json 2>/dev/null || true

echo "==> git pull origin main"
git pull origin main

echo "==> npm install --omit=dev"
npm install --omit=dev

echo "==> prisma generate + migrate deploy"
npx prisma generate
npx prisma migrate deploy

echo "==> npm run build"
npm run build

echo "==> pm2 restart ${PM2_NAME}"
pm2 restart "${PM2_NAME}"

echo "==> Done."
