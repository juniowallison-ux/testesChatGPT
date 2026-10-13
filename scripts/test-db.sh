#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container_id=$(docker run -d -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine)
trap 'docker rm -f "$container_id" >/dev/null' EXIT
for attempt in $(seq 1 30); do
  if docker exec "$container_id" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container_id" pg_isready -U postgres >/dev/null
for sql_file in tests/supabase-fixture.sql supabase/migrations/202610130001_initial.sql tests/database.sql; do
  docker exec -i "$container_id" psql -U postgres -v ON_ERROR_STOP=1 < "$sql_file"
done
