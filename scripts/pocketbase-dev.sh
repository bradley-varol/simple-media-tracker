#!/usr/bin/env bash
# Starts PocketBase for local development, fetching the pinned executable first
# if it is not already here.
set -euo pipefail

cd "$(dirname "$0")/.."

PB_HTTP_ADDR="${PB_HTTP_ADDR:-127.0.0.1:8091}"

# A no-op when the pinned version is already here, and an update when the
# Dockerfile's pin has moved on since the executable was last fetched.
bash scripts/fetch-pocketbase.sh

exec ./pocketbase serve --http "$PB_HTTP_ADDR" --dir ./pb_data --migrationsDir ./pb_migrations --hooksDir ./pb_hooks
