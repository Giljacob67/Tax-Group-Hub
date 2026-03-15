#!/bin/bash
set -e

echo "=== Building API server ==="
pnpm --filter @workspace/api-server run build

echo "=== Building frontend ==="
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/tax-group-hub run build

echo "=== Copying frontend to api-server dist ==="
cp -r artifacts/tax-group-hub/dist/public artifacts/api-server/dist/public

echo "=== Build complete ==="
