#!/bin/bash
# Stop and remove the docker containers spun up by the ts-sql-query
# test suite. See `tests:stop-containers --help`.

print_help() {
    cat <<'EOF'
Usage:
  tests:stop-containers [--help]

Stops and removes every docker container started by the ts-sql-query
test runners, plus the testcontainers Ryuk sidecar. Includes
containers in any state — running, paused, exited, created — so a
host reboot that left them in `exited` state is also cleaned up.

Two filters narrow the scope:
  - `label=org.testcontainers=true` (added by the testcontainers SDK)
    so containers the user spun up by hand are left alone even when
    their image matches one of the test prefixes.
  - image-prefix match against the list below so unrelated
    testcontainers projects on the same host stay untouched.

`docker rm -v` is used so the **anonymous** volumes those images
auto-create (postgres / mariadb / mysql / oracle / mssql all declare
`VOLUME /var/lib/...` in their Dockerfile) are removed in the same
shot — without `-v` they remain dangling and need a manual
`docker volume prune`. Named volumes (those a user explicitly
created) are not touched by `-v`.

When `tests --docker --docker-mode reuse` (or `tests:focus … --docker`
with the default reuse) is used, the containers survive process exit
so the next invocation can attach to a warm container. Run this
script when you want to start fresh — for example after editing one
of the test/db/<database>/domain/schema.sql files, after a host
reboot left the containers in `exited` state, or to free RAM at the
end of the day.

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
# prefixes above AND which testcontainers itself created. Two filters:
#
#   1. `docker ps -a` lists containers in any state (running, paused,
#      exited, created) — required so a host reboot that left them
#      stopped is still cleaned up.
#   2. `--filter label=org.testcontainers=true` restricts to containers
#      testcontainers' SDK created. Any container the user spun up
#      manually (e.g. a personal `contenedor_mysql` they're using for
#      something else) is left alone even when its image matches one
#      of our prefixes. The label is added by the testcontainers SDK
#      itself; see `node_modules/testcontainers/build/utils/labels.js`.
#
# `docker stop` on an already-stopped container is a no-op (exits 0
# silently) in modern Docker, so we don't need a separate code path.
candidates=$(docker ps -a --filter label=org.testcontainers=true --format '{{.ID}} {{.Image}}' 2>/dev/null)
echo "$candidates" | while IFS= read -r row; do
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
    echo "No ts-sql-query test containers found."
    exit 0
fi

echo "Stopping ts-sql-query test containers:"
printf '%s\n' "$ids" | xargs -I{} docker inspect --format '  {{.Id}}  {{.Config.Image}}  ({{.Name}})' {}
printf '%s\n' "$ids" | xargs docker stop  >/dev/null
# `-v` removes the anonymous volumes the engine auto-creates for each
# container (postgres / mariadb / mysql / oracle / mssql all declare a
# `VOLUME /var/lib/...` in their Dockerfile, so each fresh container
# binds a fresh anonymous volume). Without `-v`, `docker rm` leaves them
# dangling and `docker system df` keeps reporting "Local Volumes" until
# the user runs `docker volume prune` by hand. Named volumes — those a
# user explicitly created — survive `-v`, so this is safe.
printf '%s\n' "$ids" | xargs docker rm -v >/dev/null
echo "Done."
