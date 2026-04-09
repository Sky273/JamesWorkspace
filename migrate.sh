#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
    echo "Missing required command: node" >&2
    exit 1
fi

cd "${ROOT_DIR}"
node server/scripts/docker-migrate.js "$@"
node server/scripts/ensure-default-admin.js
