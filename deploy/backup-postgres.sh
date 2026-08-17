#!/usr/bin/env bash
# Daily Postgres backup for loopstat prod.
#
# Strategy:
#   1. pg_dump from the running Postgres container (no downtime).
#   2. Compress + timestamp.
#   3. Keep the last 7 daily backups locally on the VPS.
#   4. Optionally rsync the latest to an off-VPS destination
#      (RSYNC_DEST env var) — recommended for disaster recovery.
#
# Install (on the VPS, as root):
#   1. scp this file to /opt/loopstat/deploy/backup-postgres.sh
#   2. chmod +x /opt/loopstat/deploy/backup-postgres.sh
#   3. Add a cron entry (run daily at 03:17, off-peak):
#      echo '17 3 * * * /opt/loopstat/deploy/backup-postgres.sh >> /var/log/loopstat-backup.log 2>&1' \
#        | crontab -
#   4. (Optional) Set RSYNC_DEST for off-VPS copy:
#      e.g. RSYNC_DEST="user@your-machine:/backups/loopstat/"
#
# Restore:
#   gunzip < <backup.sql.gz> | docker exec -i loopstat_postgres_prod \
#     psql -U loopstat -d loopstat

set -euo pipefail

BACKUP_DIR="/var/backups/loopstat"
RETENTION_DAYS=7
CONTAINER="loopstat_postgres_prod"
DB_NAME="loopstat"
DB_USER="loopstat"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/loopstat-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

# Dump + gzip, fail fast if pg_dump errors (PIPESTATUS).
docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" \
  --format=plain --no-owner --no-acl \
  | gzip -9 > "${BACKUP_FILE}"

if [[ "${PIPESTATUS[0]}" -ne 0 ]]; then
  echo "[ERROR] pg_dump failed, removing partial backup"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[OK] $(date -Iseconds) backup created: ${BACKUP_FILE} (${SIZE})"

# Off-VPS copy (if RSYNC_DEST is set).
if [[ -n "${RSYNC_DEST:-}" ]]; then
  if rsync -az "${BACKUP_FILE}" "${RSYNC_DEST}"; then
    echo "[OK] copied off-VPS to ${RSYNC_DEST}"
  else
    echo "[WARN] rsync to ${RSYNC_DEST} failed — backup still on VPS"
  fi
fi

# Retention : keep last 7 days locally.
find "${BACKUP_DIR}" -name "loopstat-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING="$(find "${BACKUP_DIR}" -name "loopstat-*.sql.gz" | wc -l | tr -d ' ')"
echo "[INFO] retention: ${REMAINING} backups kept locally"
