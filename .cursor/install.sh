#!/usr/bin/env bash
# Idempotent dependency bootstrap for the yunyingbu operations dashboard.
# Runs after the repository is checked out. Safe to run repeatedly.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing workspace dependencies (npm ci)"
if [ -f package-lock.json ]; then
  npm ci
else
  # Fallback for environments where the lockfile is absent for any reason.
  npm install
fi

echo "==> Type-checking all workspaces"
npm run typecheck

echo "==> Install complete"
