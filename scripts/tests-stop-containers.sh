#!/bin/bash
# Stop and remove the docker containers spun up by the ts-sql-query
# test suite. See `tests:stop-containers --help`.

print_help() {
    cat <<'EOF'
Usage:
  tests:stop-containers [--help]

Stops and removes every running docker container started by the
ts-sql-query test runners (matched by image prefix), plus the
testcontainers Ryuk sidecar. Safe to call any time — never touches
containers from other testcontainers projects on the same host.

When `tests --docker --docker-mode reuse` (or `tests:focus … --docker`
with the default reuse) is used, the containers survive process exit
so the next invocation can attach to a warm container. Run this
script when you want to start fresh — for example after editing one
of the test/db/<database>/domain/schema.sql files, or to free RAM at
the end of the day.

Images matched:
  postgres:*
  mariadb*
  mysql:*
  gvenzl/oracle-free*
  mcr.microsoft.com/mssql/server*
  testcontainers/ryuk*
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

set -e

# Each entry is an image-tag prefix used by a runner under
# `test/db/<database>/runners.ts`, plus the testcontainers ryuk sidecar.
# Keep in sync if any image is renamed.
image_prefixes=(
    'postgres:'
    'mariadb'
    'mysql:'
    'gvenzl/oracle-free'
    'mcr.microsoft.com/mssql/server'
    'testcontainers/ryuk'
)

# Build a list of container IDs whose image starts with any of the
# prefixes above. Using `docker ps --format` lets us match the image tag
# directly without spawning a `docker inspect` per container.
running=$(docker ps --format '{{.ID}} {{.Image}}' 2>/dev/null)
echo "$running" | while IFS= read -r row; do
    [ -z "$row" ] && continue
    cid=$(printf '%s' "$row" | awk '{print $1}')
    image=$(printf '%s' "$row" | awk '{print $2}')
    for prefix in "${image_prefixes[@]}"; do
        case "$image" in
            "$prefix"*)
                printf '%s\n' "$cid"
                break
                ;;
        esac
    done
done > /tmp/.ts-sql-query-stop-ids.$$

ids=$(sort -u /tmp/.ts-sql-query-stop-ids.$$)
rm -f /tmp/.ts-sql-query-stop-ids.$$

if [ -z "$ids" ]; then
    echo "No ts-sql-query test containers are running."
    exit 0
fi

echo "Stopping ts-sql-query test containers:"
printf '%s\n' "$ids" | xargs -I{} docker inspect --format '  {{.Id}}  {{.Config.Image}}  ({{.Name}})' {}
printf '%s\n' "$ids" | xargs docker stop >/dev/null
printf '%s\n' "$ids" | xargs docker rm   >/dev/null
echo "Done."
