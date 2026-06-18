#!/usr/bin/env bash
# Full ERP backup: PostgreSQL + uploads + product catalog + .env
# Run on VPS:  cd /var/www/erpvoltrix && bash scripts/weekly-backup.sh
# Download:    scp root@YOUR_VPS_IP:/var/backups/erpvoltrix/erp-weekly-*.tar.gz .
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_ROOT="${ERP_BACKUP_DIR:-/var/backups/erpvoltrix}"
STAMP="$(date +%Y%m%d-%H%M)"
WORKDIR="$BACKUP_ROOT/erp-weekly-$STAMP"
ARCHIVE="$BACKUP_ROOT/erp-weekly-$STAMP.tar.gz"
KEEP_DAYS="${ERP_BACKUP_KEEP_DAYS:-56}"

mkdir -p "$BACKUP_ROOT" "$WORKDIR"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $ROOT"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set in .env"
  exit 1
fi

echo "==> ERP weekly backup — $STAMP"
echo "    App:    $ROOT"
echo "    Output: $ARCHIVE"

echo "==> Database (PostgreSQL)"
pg_dump "$DATABASE_URL" -Fc -f "$WORKDIR/database.dump"

echo "==> Uploads (payment proofs, receipts, images, PO docs, …)"
if [ -d public/uploads ]; then
  cp -a public/uploads "$WORKDIR/uploads"
else
  mkdir -p "$WORKDIR/uploads"
fi

echo "==> Product catalog + environment"
cp -a data/products.json "$WORKDIR/products.json" 2>/dev/null || echo '[]' > "$WORKDIR/products.json"
cp -a .env "$WORKDIR/env.backup"

echo "==> Backup report"
{
  echo "Voltrix ERP weekly backup"
  echo "Created: $(date -Iseconds)"
  echo "Server: $(hostname -f 2>/dev/null || hostname)"
  echo "App path: $ROOT"
  echo ""
  echo "Contents:"
  du -sh "$WORKDIR"/* 2>/dev/null || true
  echo ""
  echo "Database tables (count):"
  psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "  (could not query)"
  echo ""
  echo "Upload folders:"
  find "$WORKDIR/uploads" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | while read -r dir; do
    name="$(basename "$dir")"
    count="$(find "$dir" -type f 2>/dev/null | wc -l | tr -d ' ')"
    size="$(du -sh "$dir" 2>/dev/null | cut -f1)"
    echo "  $name — $count files, $size"
  done
} > "$WORKDIR/BACKUP-REPORT.txt"

echo "==> Compress archive"
tar -czf "$ARCHIVE" -C "$BACKUP_ROOT" "erp-weekly-$STAMP"
rm -rf "$WORKDIR"

echo "==> Remove backups older than ${KEEP_DAYS} days"
find "$BACKUP_ROOT" -name "erp-weekly-*.tar.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo ""
echo "Done."
echo "  File: $ARCHIVE"
echo "  Size: $SIZE"
echo ""
echo "Download to your PC (PowerShell):"
echo "  scp root@YOUR_VPS_IP:\"$ARCHIVE\" \$env:USERPROFILE\\Desktop\\"
echo ""
echo "Or list all weekly backups:"
echo "  ls -lh $BACKUP_ROOT/erp-weekly-*.tar.gz"
