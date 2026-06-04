#!/usr/bin/env bash
# Run on the VPS from anywhere:  bash /var/www/erpvoltrix/scripts/vps-deploy.sh
# Or:  cd /var/www/erpvoltrix && npm run deploy:vps
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PM2_NAME="${PM2_APP_NAME:-voltrix-erp}"

echo "==> Reset local package-lock.json (fixes: merge would overwrite package-lock.json)"
git checkout -- package-lock.json 2>/dev/null || true

# Live catalog edits on the server (admin saves) must not block deploy pulls.
if [ -n "$(git status --porcelain data/products.json 2>/dev/null)" ]; then
  PRODUCTS_BACKUP="data/products.json.vps-backup-$(date +%Y%m%d-%H%M%S)"
  echo "==> Stashing local data/products.json (backup: $PRODUCTS_BACKUP)"
  cp data/products.json "$PRODUCTS_BACKUP"
  git stash push -m "vps-products-json-$(date +%Y%m%d-%H%M%S)" -- data/products.json
fi

echo "==> git pull origin main"
git pull origin main

if git stash list | grep -q "vps-products-json"; then
  echo "==> Restoring live data/products.json from stash"
  if ! git stash pop; then
    echo "WARN: stash pop conflict — keeping newest backup copy"
    LATEST="$(ls -t data/products.json.vps-backup-* 2>/dev/null | head -1)"
    if [ -n "${LATEST:-}" ]; then
      cp "$LATEST" data/products.json
      git checkout -- data/products.json 2>/dev/null || true
    fi
  fi
fi

echo "==> npm install --omit=dev"
npm install --omit=dev

echo "==> prisma generate + migrate deploy"
npx prisma generate
npx prisma migrate deploy

echo "==> Backup uploads (product photos, proofs, etc.) before build"
if [ -d "public/uploads" ] && [ "$(ls -A public/uploads 2>/dev/null)" ]; then
  BACKUP_DIR="/var/backups/erpvoltrix-uploads-$(date +%Y%m%d-%H%M%S)"
  mkdir -p /var/backups
  cp -a public/uploads "$BACKUP_DIR" && echo "    Saved to $BACKUP_DIR"
fi

echo "==> Ensure upload directories exist"
mkdir -p public/uploads/payment-proofs public/uploads/petty-cash public/uploads/misc \
  public/uploads/products public/uploads/crm-leads public/uploads/client-images \
  public/uploads/fulfillment public/uploads/imported-po-docs public/uploads/daily-reports

echo "==> Product image health check"
node scripts/check-product-images.mjs || echo "WARN: some product image files are missing — re-upload in Website → Products"

echo "==> npm run build"
npm run build

echo "==> pm2 restart ${PM2_NAME}"
pm2 restart "${PM2_NAME}"

if [ -f "public/Voltrix installers Leads 19 May 2026.csv" ]; then
  echo "==> Backfill lead phones from Facebook installers CSV"
  node scripts/sync-all-lead-phones.mjs || echo "WARN: phone sync failed (run: npm run sync-lead-phones)"
fi

echo "==> Done."
