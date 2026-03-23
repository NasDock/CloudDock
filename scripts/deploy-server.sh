#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-dist/server}"

# Build shared + server first so dist exists
pnpm --filter @cloud-dock/shared... build
pnpm --filter @cloud-dock/server... build

# Create a deployable server package with production deps
rm -rf "${TARGET_DIR}"
pnpm --filter @cloud-dock/server deploy "${TARGET_DIR}" --prod

# Ensure output matches expected structure: dist/ package.json node_modules
find "${TARGET_DIR}" -maxdepth 1 -mindepth 1 \
  ! -name dist \
  ! -name package.json \
  ! -name node_modules \
  -exec rm -rf {} +
