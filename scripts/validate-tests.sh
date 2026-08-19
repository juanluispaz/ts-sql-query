#!/bin/bash
# Type-check the test/ matrix with tsgo, split one tsgo program PER CONNECTOR
# so each slice fits the 16 GB GitHub-hosted CI runners.
#
# Why split at all: compiling the whole matrix + src in a single tsgo
# program peaks past ~17 GB, which the Linux OOM killer terminates with
# SIGKILL on the 16 GB runners (and on smaller dev machines). The OS
# reclaims all memory between invocations, so the overall peak is the
# single largest slice rather than the sum of the matrix.
#
# Why PER CONNECTOR (not per database): sqlite alone has grown to ~11 k test
# files across ~10 connectors (each query runner + its -sync twin), so a
# single sqlite program peaks ~13 GB and OOM-kills the runner. Splitting per
# database is no longer enough for sqlite, and rather than special-case one
# database this script splits EVERY database the same way — one program per
# connector. Each connector is ~0.5–1.3 k files and peaks ~6 GB, with huge
# headroom under 16 GB; the whole-run peak is now the single largest
# connector, not the largest database.
#
# The per-connector configs are generated on the fly from the connector
# directories on disk (test/db/<db>/<version>/<connector>), so a newly added
# connector — or a whole new database — is picked up with NO edit here,
# mirroring the INCLUDE-driven philosophy of test/tsconfig.newest.json. There
# are no committed test/tsconfig.<db>.json files to keep in sync anymore.
#
# Every slice still type-checks all the shared files (test/lib,
# test/db/general, test/templates, each db's runners.ts + types.negative +
# domain, src, src/examples) — nothing is dropped, the TEST CELLS are just
# partitioned. Per-connector cells are independent .test.ts files with no
# type dependency between connectors, so partitioning them is sound.
#
# COORDINATES. With no argument this is `npm run validate:tests`, the
# authoritative test-scope typecheck CI/release gates on: every connector of
# every database. With one or more <coord> positionals it narrows to the cells
# they select, using the SAME coordinate vocabulary as the `tests` CLI
# (`<db>[/<version>[/<connector>[/<file>]]]`, glob and brace expansion, quoted
# or not). The cells are still grouped one tsgo program per (database,
# connector), so the memory profile of a narrowed run can only be smaller.
#
# Narrowing matters because the matrix is SYMMETRIC: the same test names exist
# in all 67 cells, so one type error appears 67 times. Fixing it against a
# single cell first, then one cell per database, then the remaining connectors
# and version tiers, reads each error once instead of 67 times. A single cell
# type-checks in ~3 s against ~86 s for the full split, which is the difference
# between an inner loop and a wait.
#
# tsgo is a standalone binary (runtime-agnostic), so this script is the
# same whether invoked by `npm run validate:tests` or `bun run
# validate:tests`; the package manager puts node_modules/.bin on PATH.

set -e

print_usage() {
    cat <<'USAGE'
validate:tests — type-check the test/ matrix with tsgo (one program per connector)

  validate:tests [<coord>…]

  <coord> = <db>[/<version>[/<connector>[/<file>]]]

  With no coord, every connector of every database is checked — the
  authoritative gate CI and the release flow run.

  With coords, only the cells they select are checked. Same coordinate rules
  as the `tests` CLI: glob (`*`) and brace (`{a,b}`) expansion, quoted or not,
  and a coord matching no cell is an error rather than a silent empty run.

  Examples:
    validate:tests                              # everything (the gate)
    validate:tests postgres/newest/pg           # one cell, ~3 s
    validate:tests postgres                     # every postgres connector
    validate:tests '*/types.negative'           # the negative-type cells
    validate:tests 'postgres/*/{pg,postgres}'   # two connectors, all versions
    validate:tests mariadb/newest/mariadb mysql/newest/mysql2

  Under npm the coords ride behind the `--` separator:
    npm run validate:tests -- postgres/newest/pg
USAGE
}

COORDS=()
for arg in "$@"; do
    case "$arg" in
        -h|--help) print_usage; exit 0 ;;
        -*)
            echo "Error: unknown option '$arg'. This script takes coordinates only; see --help." >&2
            exit 2 ;;
        *) COORDS+=("$arg") ;;
    esac
done

# Remove any generated per-connector config, even on failure / interrupt,
# so an aborted run never dirties the tree. The pattern is also gitignored.
trap 'rm -f test/tsconfig.*.generated.json' EXIT

databases=(mariadb mysql oracle postgres sqlite sqlserver)

# Emit one tsgo program: shared infra + src + the given cell includes, which
# are paths relative to test/ (where `extends: ./tsconfig.json` resolves).
run_slice() {
    local db="$1" label="$2"; shift 2
    local cfg="test/tsconfig.$db.$label.generated.json"
    local includes="" path
    for path in "$@"; do
        includes+="        \"$path\",
"
    done
    cat > "$cfg" <<EOF
{
    "extends": "./tsconfig.json",
    "include": [
        "lib/**/*.ts",
        "templates/**/*.ts",
        "db/general/**/*.ts",
        "db/$db/runners.ts",
        "db/$db/types.negative/**/*.ts",
        "db/$db/domain/**/*.ts",
$includes        "../src/**/*.ts"
    ]
}
EOF
    echo ""
    echo ">>> validate:tests — $db/$label"
    tsgo -p "$cfg" --noEmit
    rm -f "$cfg"
}

if [ "${#COORDS[@]}" -eq 0 ]; then
    for db in "${databases[@]}"; do
        # Connector directories live at test/db/<db>/<version>/<connector>; the
        # distinct basenames at that depth are the connectors (includes
        # `documentation`; excludes the depth-1 shared `types.negative`/`domain`).
        connectors=$(find "test/db/$db" -mindepth 2 -maxdepth 2 -type d | sed -E 's#.*/##' | sort -u)
        for connector in $connectors; do
            run_slice "$db" "$connector" "db/$db/*/$connector/**/*.ts"
        done
    done
    echo ""
    echo ">>> validate:tests — all connectors type-checked OK"
    exit 0
fi

# Focused mode. Expand each coord to concrete paths under test/db/, mirroring
# `resolve_main_paths` in _test-common.sh so both CLIs accept the same input:
#   bare-db : single segment (`postgres`) — every connector of that database.
#   expand  : contains `*`, `?`, `[` or `{` — glob and/or brace expansion.
#             Quoted and unquoted forms both work; the quoted one is
#             re-tokenised through the vetted eval below.
#   deep    : slash-separated literal (`postgres/newest/pg`).
matched=()
for coord in "${COORDS[@]}"; do
    case "$coord" in
        *[*?[{]*) shape=expand ;;
        */*)      shape=deep ;;
        *)        shape=bare-db ;;
    esac
    case "$shape" in
        expand)
            if [[ "$coord" == *[!a-zA-Z0-9._/,*?{}\[\]-]* ]]; then
                echo "Error: coord '$coord' contains a disallowed character. Allowed: alphanumerics, '. _ / -', and the pattern chars '{,} * ? [ ]'." >&2
                exit 2
            fi
            shopt -s nullglob
            # shellcheck disable=SC2294  # eval is intentional; input vetted above
            eval "hits=(test/db/$coord)"
            shopt -u nullglob
            if [ "${#hits[@]}" -eq 0 ]; then
                echo "Coordinate $coord matched no paths under test/db/" >&2
                exit 1
            fi
            matched+=("${hits[@]}")
            ;;
        bare-db)
            if [ ! -d "test/db/$coord" ]; then
                echo "Coordinate $coord matched no paths under test/db/" >&2
                exit 1
            fi
            # Connector cells only — the same depth-2 directory walk the
            # full-matrix loop uses, so the depth-1 shared `domain`/`types.negative`
            # folders (and the plain files inside them) never become slices.
            while IFS= read -r hit; do matched+=("$hit"); done \
                < <(find "test/db/$coord" -mindepth 2 -maxdepth 2 -type d | sort)
            ;;
        deep)
            if [ ! -e "test/db/$coord" ]; then
                echo "Coordinate $coord matched no paths under test/db/" >&2
                exit 1
            fi
            matched+=("test/db/$coord")
            ;;
    esac
done

# Group the matched paths one slice per (database, connector), so a narrowed
# run keeps the same memory shape as the full one. `<db>/types.negative` is not
# a connector cell — it is shared infra every slice already carries — so a coord
# naming it resolves to that database's own slice with no extra cell include.
# Two parallel indexed arrays instead of an associative one: this project's
# scripts run under the bash 3.2 macOS ships, which has no `declare -A`.
group_keys=()
group_includes=()
for path in "${matched[@]}"; do
    rest="${path#test/db/}"
    db="${rest%%/*}"
    tail="${rest#*/}"
    case "$tail" in
        types.negative|types.negative/*)
            label="types-negative"; include="" ;;
        domain|domain/*)
            # Shared infra every slice already carries; naming it selects the
            # database's shared-only slice rather than adding a cell.
            label="domain"; include="" ;;
        */*)
            label="${tail#*/}"; label="${label%%/*}"
            if [ -d "$path" ]; then include="db/$db/${tail%/}/**/*.ts"; else include="db/$db/$tail"; fi ;;
        *)
            echo "Error: coord path '$path' names a version folder with no connector; add one (e.g. $rest/<connector>)." >&2
            exit 2 ;;
    esac
    key="$db|$label"
    idx=-1
    for i in "${!group_keys[@]}"; do
        if [ "${group_keys[$i]}" = "$key" ]; then idx=$i; break; fi
    done
    if [ "$idx" -lt 0 ]; then
        group_keys+=("$key")
        group_includes+=("")
        idx=$(( ${#group_keys[@]} - 1 ))
    fi
    if [ -n "$include" ]; then
        case "${group_includes[$idx]}" in
            *"$include"$'\n'*) ;;  # already collected (two coords hitting one cell)
            *) group_includes[$idx]="${group_includes[$idx]}$include"$'\n' ;;
        esac
    fi
done

for i in "${!group_keys[@]}"; do
    key="${group_keys[$i]}"
    db="${key%%|*}"
    label="${key#*|}"
    includes=()
    while IFS= read -r line; do [ -n "$line" ] && includes+=("$line"); done <<< "${group_includes[$i]}"
    run_slice "$db" "$label" "${includes[@]}"
done

echo ""
echo ">>> validate:tests — ${#group_keys[@]} slice(s) type-checked OK"
