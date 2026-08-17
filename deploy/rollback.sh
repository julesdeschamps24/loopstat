#!/usr/bin/env bash
# Rollback loopstat to a previous git ref.
#
# Run LOCALLY from the repo root. Pushes the chosen ref to the VPS and
# rebuilds the Docker stack. Fast: same flow as a normal deploy, just
# with --abbrev-commit of a known-good commit.
#
# Usage:
#   ./deploy/rollback.sh <git-ref>
#
# Examples:
#   ./deploy/rollback.sh HEAD~1                  # previous commit
#   ./deploy/rollback.sh 4ccbb85                 # specific SHA
#   ./deploy/rollback.sh v1.2.3                  # a tag
#
# Verification post-rollback:
#   - Caddy: curl -sI https://loopstat.tech | head -3
#   - Health: curl -s https://loopstat.tech/api/health
#   - Logs: ssh root@... 'docker logs --tail=50 loopstat_app'

set -euo pipefail

VPS="${LOOPSTAT_VPS:-root@204.168.178.52}"
TARGET_DIR="/opt/loopstat"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <git-ref>"
  echo "Examples: HEAD~1, 4ccbb85, v1.2.3"
  exit 1
fi

REF="$1"
SHA="$(git rev-parse --short "${REF}")" || { echo "[ERROR] unknown ref: ${REF}"; exit 1; }
MSG="$(git log -1 --format=%s "${REF}")"

echo "=== loopstat rollback ==="
echo "  Target ref:    ${REF} (${SHA})"
echo "  Commit msg:    ${MSG}"
echo "  VPS:           ${VPS}"
echo "  Target dir:    ${TARGET_DIR}"
echo
read -r -p "Proceed with rollback? [yes/NO] " confirm
if [[ "${confirm}" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# Checkout target ref locally in a detached HEAD (preserves current branch).
ORIGINAL_HEAD="$(git rev-parse HEAD)"
trap 'echo "Restoring local HEAD to ${ORIGINAL_HEAD}"; git checkout "${ORIGINAL_HEAD}" --quiet' EXIT

git checkout "${SHA}" --quiet

echo "[1/3] Syncing code to VPS..."
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude .import-tmp --exclude .claude --exclude .agents \
  --exclude '.env*' \
  ./ "${VPS}:${TARGET_DIR}/"

echo "[2/3] Rebuilding Docker stack on VPS..."
ssh "${VPS}" "cd ${TARGET_DIR} && \
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build"

echo "[3/3] Smoke test..."
sleep 5
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' https://loopstat.tech/api/health || echo "fail")"
if [[ "${HTTP_CODE}" == "200" ]]; then
  echo "[OK] /api/health returned 200 - rollback successful"
else
  echo "[WARN] /api/health returned ${HTTP_CODE} - check logs:"
  echo "  ssh ${VPS} 'docker logs --tail=50 loopstat_app'"
  exit 1
fi
