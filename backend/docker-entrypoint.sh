#!/bin/sh
set -e

# Apply database migrations before starting the API.
echo "[entrypoint] running alembic migrations..."
alembic upgrade head

echo "[entrypoint] starting: $*"
exec "$@"
