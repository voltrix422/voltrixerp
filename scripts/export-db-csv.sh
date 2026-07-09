#!/usr/bin/env bash
# Export every database table to CSV (Excel-friendly). Runs on the VPS.
# Prints the final archive path on the last line.
set -euo pipefail

cd /var/www/erpvoltrix
set -a
# shellcheck disable=SC1091
source .env
set +a

STAMP="$(date +%Y%m%d-%H%M)"
OUT="/var/backups/erpvoltrix/db-excel-$STAMP"
mkdir -p "$OUT"

psql "$DATABASE_URL" -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" | while read -r table; do
  [ -z "$table" ] && continue
  psql "$DATABASE_URL" -c "\copy \"$table\" TO '$OUT/$table.csv' WITH CSV HEADER" > /dev/null
  echo "  exported $table.csv"
done

tar -czf "$OUT.tar.gz" -C /var/backups/erpvoltrix "db-excel-$STAMP"
rm -rf "$OUT"
echo "$OUT.tar.gz"
