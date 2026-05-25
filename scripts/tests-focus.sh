#!/bin/bash
# Run tests for a single coordinate. See `tests:focus --help`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests:focus <coord> [<coord>…] [--mode <parallel|sequential>]
                                 [--docker] [--docker-mode <reuse|no-reuse>]
                                 [--docker-scope <all|newest>]
                                 [--scope <all|newest>]
                                 [--wasm]
                                 [--use-vitest] [--ui]
                                 [--report    [--report-format <name>]…]
                                 [--coverage  [--coverage-format <name>]…]
                                 [--open]
                                 [--help]
                                 [-- <args passed to runner>]

Runs tests for one coordinate under test/db/. Same flags as `tests`;
--wasm in focused mode is a single-pass override (real WASM for the
focused cell), not the two-phase split. `--ui` forces the vitest
path; `--report` works under bun (junit) and under vitest (html SPA).
See `tests --help` for the full runner trade-off.

<coord> = <db>[/<version>[/<connector>[/<file>]]]

  Literal coords:
    postgres
    postgres/newest
    postgres/newest/pg
    postgres/newest/pg/select.basic.test.ts

  Glob characters (`*`, `?`, `[`) and brace expansion (`{a,b,…}`)
  are supported. The script handles BOTH whether you quote the coord
  or not — quote when convenient (e.g. to avoid shell glob errors in
  your prompt), leave unquoted when convenient. Same result either
  way:
    'postgres/*/pg'                       # newest + oldest of pg
    postgres/*/pg                          # same (unmatched glob → literal pass-through)
    'postgres/*/{pg,postgres}'             # both drivers × every version
    postgres/*/{pg,postgres}              # same (shell expands braces → script glob-expands each)
    '{mariadb,mysql}/newest'              # two dbs, newest only
    '*/newest/*/select.basic.test.ts'     # one file pattern across every db

  Internally, when a coord contains any of `*`, `?`, `[`, or `{`, the
  script vets it against a strict whitelist (alphanumerics, `. _ / -`,
  and the pattern chars themselves) and then asks bash to expand the
  braces + globs in one shot. Anything outside that vocabulary is
  rejected.

  Multiple positional coords are supported and combined into one
  invocation — mix literals, globs, and brace-expanded sets freely:
    tests:focus 'postgres/*/pg' sqlite/newest/bun_sqlite
    tests:focus '{mariadb,mysql}/newest' postgres/newest/pg

  Under --scope newest, paths matching `*/oldest/*` are filtered out
  of the expansion before the runner is invoked (so
  `'postgres/*/pg' --scope newest` runs only postgres/newest/pg).
  A coord that literally names oldest under --scope newest is
  rejected outright as a contradiction.

Defaults
  --mode             parallel
  --docker           off
  --docker-mode      reuse
  --docker-scope     all (follows --scope when not given explicitly)
  --scope            all
  --wasm             off
  --use-vitest       off
  --ui               off (implies --use-vitest)
  --report           off (test-exec report)
  --report-format    html under vitest, junit under bun
  --coverage         off
  --coverage-format  html (when --coverage is on)
  --open             off

Flags
  --mode <parallel|sequential>          default parallel
  --docker                              real docker backends
  --docker-mode <reuse|no-reuse>        default reuse
  --docker-scope <all|newest>           default all. `newest` narrows
                                        the real-DB gate to cells
                                        under `<db>/newest/*`; older
                                        versions fall back to the mock.
                                        No-op without --docker. Follows
                                        --scope when not given.
  --scope <all|newest>                  default all. `newest` filters
                                        the file set: when the coord is
                                        just a <db>, the runner is
                                        invoked on `<db>/newest/` +
                                        `<db>/types.negative/` instead
                                        of the full `<db>/`. Coords
                                        that already specify a version
                                        (or deeper) are honoured
                                        verbatim — a coord pointing at
                                        `*/oldest/*` with --scope newest
                                        is rejected as inconsistent.
                                        Implies --docker-scope=newest
                                        unless --docker-scope was given
                                        explicitly.
  --wasm                                real WASM for this run
  --use-vitest                          force vitest runtime
  --ui                                  @vitest/ui (implies --use-vitest)
  --report                              emit test-execution report at
                                        .test-report/ (html SPA under
                                        vitest, junit.xml under bun)
  --report-format <name>                repeatable; default html under
                                        vitest, junit under bun.
                                        Setting it implies --report.
                                        Under bun, only junit|dots are
                                        supported; html is vitest-only.
  --coverage                            emit a coverage report at
                                        .test-report/coverage/. The
                                        report dir is wiped before
                                        each run. Forbidden with
                                        --wasm under --mode parallel.
  --coverage-format <name>              repeatable; default html when
                                        --coverage is on. Under
                                        vitest, any @vitest/coverage-v8
                                        reporter, plus the special
                                        `monocart` value (switches
                                        provider to
                                        vitest-monocart-coverage).
                                        Under bun, restricted to
                                        html|text|lcov|monocart
                                        (monocart post-renders the
                                        lcov via MCR; multiple values
                                        are honoured but
                                        monocart + html error since
                                        both write index.html).
                                        Scope set in bunfig.toml +
                                        vitest.config.ts; MCR options
                                        live in mcr.config.mjs.
  --open                                open the most useful report
                                        (test-exec SPA via vite preview
                                        if present, else coverage html
                                        via file://). Requires html in
                                        --report-format or
                                        --coverage-format.
  -h, --help                            show this help

Pass-through args after --:
  bun run tests:focus postgres/newest/pg -- -t inner-join
  bun run tests:focus postgres/newest/pg --docker -- --update-snapshots
  npm  run tests:focus postgres/newest/pg --docker -- -- -u

Examples
  bun run tests:focus postgres/newest/pg
  bun run tests:focus postgres/newest/pg --docker
  bun run tests:focus postgres/oldest/pglite --wasm --mode sequential
  bun run tests:focus postgres/newest/pg/select.basic.test.ts -- -t inner-join
  bun run tests:focus postgres --use-vitest --coverage --open
  bun run tests:focus postgres --report --coverage --open
  bun run tests:focus postgres --scope newest --coverage  # skip oldest cells
  bun run tests:focus postgres --ui --coverage           # interactive UI
EOF
}

COORDS=()
MODE=parallel
DOCKER=off
DOCKER_MODE=reuse
# Empty sentinel: see tests.sh for the rationale (distinguishes
# explicit `all` from the unset default so `--scope newest` can
# promote it without overriding the user's choice).
DOCKER_SCOPE=
SCOPE=all
WASM=off
USE_VITEST=off
UI=off
REPORT=off
REPORT_FORMAT=()
COVERAGE=off
COVERAGE_FORMAT=()
OPEN_AFTER=off
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
    case "$1" in
        --mode)                 MODE="$2"; shift 2 ;;
        --mode=*)               MODE="${1#--mode=}"; shift ;;
        --docker)               DOCKER=on; shift ;;
        --docker-mode)          DOCKER_MODE="$2"; shift 2 ;;
        --docker-mode=*)        DOCKER_MODE="${1#--docker-mode=}"; shift ;;
        --docker-scope)         DOCKER_SCOPE="$2"; shift 2 ;;
        --docker-scope=*)       DOCKER_SCOPE="${1#--docker-scope=}"; shift ;;
        --scope)                SCOPE="$2"; shift 2 ;;
        --scope=*)              SCOPE="${1#--scope=}"; shift ;;
        --wasm)                 WASM=on; shift ;;
        --use-vitest)           USE_VITEST=on; shift ;;
        --ui)                   UI=on; USE_VITEST=on; shift ;;
        --report)               REPORT=on; shift ;;
        --report-format)        REPORT=on; REPORT_FORMAT+=("$2"); shift 2 ;;
        --report-format=*)      REPORT=on; REPORT_FORMAT+=("${1#--report-format=}"); shift ;;
        --coverage)             COVERAGE=on; shift ;;
        --coverage-format)      COVERAGE_FORMAT+=("$2"); shift 2 ;;
        --coverage-format=*)    COVERAGE_FORMAT+=("${1#--coverage-format=}"); shift ;;
        --open)                 OPEN_AFTER=on; shift ;;
        -h|--help)              print_help; exit 0 ;;
        --)                     shift; EXTRA_ARGS=("$@"); break ;;
        --*)                    echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
        *)
            # Accept N positional coords; each goes through the same
            # shape detection + glob expansion below. Brace expansion
            # (`postgres/*/{pg,postgres}`) is handled by the user's
            # shell and lands here as multiple args.
            COORDS+=("$1")
            shift
            ;;
    esac
done

if [ "${#COORDS[@]}" -eq 0 ]; then
    echo "Missing <coord>. Run \`tests:focus --help\` for usage." >&2
    exit 2
fi
case "$MODE" in parallel|sequential) ;; *)
    echo "Invalid --mode: $MODE (expected parallel|sequential)" >&2; exit 2 ;;
esac
case "$DOCKER_MODE" in reuse|no-reuse) ;; *)
    echo "Invalid --docker-mode: $DOCKER_MODE (expected reuse|no-reuse)" >&2; exit 2 ;;
esac
case "$SCOPE" in all|newest) ;; *)
    echo "Invalid --scope: $SCOPE (expected all|newest)" >&2; exit 2 ;;
esac
# Resolve the docker-scope default. Empty means "user didn't pass it":
# follow --scope.
if [ -z "$DOCKER_SCOPE" ]; then
    if [ "$SCOPE" = "newest" ]; then DOCKER_SCOPE=newest; else DOCKER_SCOPE=all; fi
fi
case "$DOCKER_SCOPE" in all|newest) ;; *)
    echo "Invalid --docker-scope: $DOCKER_SCOPE (expected all|newest)" >&2; exit 2 ;;
esac

# Classify each coord. Three shapes drive expansion:
#   bare-db : a single segment, e.g. `postgres`. Resolves to the db
#             root; under --scope newest expands to newest/ +
#             types.negative/.
#   glob    : contains a glob char (`*`, `?`, `[`). Expanded relative
#             to test/db/ with nullglob; the runner is invoked on
#             every match. Quote the coord in the shell
#             (`'postgres/*/pg'`) so the user shell doesn't try to
#             expand it before we get our hands on it.
#   deep    : a slash-separated literal coord, e.g.
#             `postgres/newest/pg/select.basic.test.ts`. Used verbatim.
#
# Brace expansion (`postgres/*/{pg,postgres}`) is bash's own and
# happens BEFORE this script sees the args — leaving it as multiple
# positional coords that each go through the loop below independently.
# Mix freely: `tests:focus 'postgres/*/pg' sqlite/newest --scope newest`.
TARGETS=()
for coord in "${COORDS[@]}"; do
    # Detect glob (`*`, `?`, `[`) AND brace (`{`) chars: both go
    # through the same eval-based expansion path below. Quoted braces
    # (`'postgres/*/{pg,postgres}'`) reach us as a literal `{…}` in
    # the variable; unquoted braces are expanded by the user shell
    # into multiple positional args before the script runs, and each
    # of those lands here as a deep coord.
    case "$coord" in
        *[*?[{]*)       shape=expand ;;
        */*)            shape=deep ;;
        *)              shape=bare-db ;;
    esac
    # Reject explicit oldest under --scope newest at coord-classification
    # time so the user sees the contradiction immediately, not after
    # expansion produces an empty set.
    if [ "$SCOPE" = "newest" ]; then
        case "$coord" in
            */oldest|*/oldest/*)
                echo "Error: --scope newest is incompatible with a coord pointing at oldest: $coord" >&2
                exit 2 ;;
        esac
    fi
    case "$shape" in
        expand)
            # Brace expansion (`{a,b,…}`) only fires on tokens written
            # literally in the source — running it on the contents of
            # a variable requires re-tokenisation, which bash exposes
            # only via `eval`. Glob expansion (`*`, `?`, `[`) would
            # work without eval, but routing both through the same
            # eval keeps the cartesian-product semantics consistent
            # (`{a,b}/*/c` expands to a×glob, b×glob).
            #
            # Strict whitelist guards the eval — only the characters
            # used by coord vocabulary are allowed through. Anything
            # outside (`;`, `$`, backtick, space, etc.) is rejected
            # before the eval ever runs, so a hostile coord cannot
            # smuggle a shell command past us.
            if [[ "$coord" == *[!a-zA-Z0-9._/,*?{}\[\]-]* ]]; then
                echo "Error: coord '$coord' contains a disallowed character. Allowed: alphanumerics, '. _ / -', and the pattern chars '{,} * ? [ ]'." >&2
                exit 2
            fi
            shopt -s nullglob
            # shellcheck disable=SC2294  # eval is intentional; input vetted above
            eval "matches=(test/db/$coord)"
            shopt -u nullglob
            if [ "${#matches[@]}" -eq 0 ]; then
                echo "Coordinate $coord matched no paths under test/db/" >&2
                exit 1
            fi
            TARGETS+=("${matches[@]}")
            ;;
        bare-db)
            if [ "$SCOPE" = "newest" ]; then
                # Mirror what `tests --scope newest` does for one DB:
                # only newest/ + types.negative/ (older versions are
                # not enumerated). The runner never sees them.
                added=0
                for sub in newest types.negative; do
                    if [ -d "test/db/$coord/$sub" ]; then
                        TARGETS+=("test/db/$coord/$sub/")
                        added=1
                    fi
                done
                if [ "$added" -eq 0 ]; then
                    echo "Error: --scope newest matched no subfolders under test/db/$coord/ (looked for newest/ + types.negative/)." >&2
                    exit 2
                fi
            else
                t="test/db/$coord"
                if [ ! -e "$t" ]; then
                    echo "Coordinate not found: $coord (looked for $t)" >&2
                    exit 1
                fi
                TARGETS+=("$t")
            fi
            ;;
        deep)
            t="test/db/$coord"
            if [ ! -e "$t" ]; then
                echo "Coordinate not found: $coord (looked for $t)" >&2
                exit 1
            fi
            TARGETS+=("$t")
            ;;
    esac
done

# Apply --scope newest filter to glob/deep expansions: drop any path
# passing through an `oldest` segment. (bare-db coords were already
# scope-expanded above; glob expansion may have pulled in oldest
# paths that we need to filter out here.)
if [ "$SCOPE" = "newest" ]; then
    FILTERED=()
    for t in "${TARGETS[@]}"; do
        case "$t" in
            */oldest|*/oldest/*) ;;
            *) FILTERED+=("$t") ;;
        esac
    done
    TARGETS=("${FILTERED[@]}")
    if [ "${#TARGETS[@]}" -eq 0 ]; then
        echo "Error: --scope newest left no paths to run for ${COORDS[*]}." >&2
        exit 2
    fi
fi

# Append `/` for directory targets so the runner treats them as path
# filters, not project-name filters.
for i in "${!TARGETS[@]}"; do
    if [ -d "${TARGETS[$i]}" ]; then TARGETS[$i]="${TARGETS[$i]}/"; fi
done

runtime="$(detect_runtime)"
if [ "$USE_VITEST" = "on" ]; then runtime="npm"; fi
export TS_SQL_QUERY_DOCKER="$DOCKER"
if [ "$DOCKER_MODE" = "reuse" ]; then export TESTCONTAINERS_REUSE_ENABLE=true; fi
if [ "$DOCKER" = "on" ]; then export TS_SQL_QUERY_DOCKER_SCOPE="$DOCKER_SCOPE"; fi
if [ "$MODE" = "sequential" ]; then export TSSQLQUERY_PARALLEL_DBS=false; fi
# In focused mode --wasm is a single-pass override. The user gets
# real WASM for this run; main test still uses the two-phase split.
if [ "$WASM" = "on" ]; then
    export TS_SQL_QUERY_WASM=on
else
    export TS_SQL_QUERY_WASM=off
fi

# Runtime-dependent format defaults: html under vitest (SPA), junit
# under bun (the only file artifact bun can emit). See tests.sh for
# the long-form rationale.
if [ "$REPORT" = "on" ] && [ "${#REPORT_FORMAT[@]}" -eq 0 ]; then
    if [ "$runtime" = "bun" ]; then
        REPORT_FORMAT=("junit")
    else
        REPORT_FORMAT=("html")
    fi
fi
if [ "$COVERAGE" = "on" ] && [ "${#COVERAGE_FORMAT[@]}" -eq 0 ]; then
    COVERAGE_FORMAT=("html")
fi

# Vitest's html reporter prints only `HTML Report is generated …` —
# no progress, no summary. Pair it with `default` so terminal feedback
# is always present. Bun reporters (junit, dots) already print to the
# terminal natively, so this injection only applies to the vitest path.
if [ "$REPORT" = "on" ] && [ "$runtime" = "npm" ]; then
    HAS_TERMINAL_REPORTER=off
    for fmt in "${REPORT_FORMAT[@]}"; do
        case "$fmt" in
            html) ;;
            *) HAS_TERMINAL_REPORTER=on; break ;;
        esac
    done
    if [ "$HAS_TERMINAL_REPORTER" = "off" ]; then
        REPORT_FORMAT=("default" "${REPORT_FORMAT[@]}")
    fi
fi

if [ "$OPEN_AFTER" = "on" ]; then
    if [ "$REPORT" = "off" ] && [ "$COVERAGE" = "off" ]; then
        echo "Error: --open requires --report or --coverage." >&2; exit 2
    fi
    HAS_HTML=off
    if [ "$REPORT" = "on" ]; then
        for fmt in "${REPORT_FORMAT[@]}"; do
            if [ "$fmt" = "html" ]; then HAS_HTML=on; break; fi
        done
    fi
    if [ "$HAS_HTML" = "off" ] && [ "$COVERAGE" = "on" ]; then
        # `monocart` also writes an index.html (MCR's html-spa under
        # bun, MCR's `v8` SPA under vitest), so it satisfies --open
        # the same way `html` does.
        for fmt in "${COVERAGE_FORMAT[@]}"; do
            case "$fmt" in
                html|monocart) HAS_HTML=on; break ;;
            esac
        done
    fi
    if [ "$HAS_HTML" = "off" ]; then
        if [ "$runtime" = "bun" ]; then
            echo "Error: --open requires html among the requested formats. Under bun, html is only available for coverage — pass --coverage-format=html (or =monocart), or add --use-vitest for the html test-execution SPA." >&2
        else
            echo "Error: --open requires html among the requested formats — pass --report-format=html, --coverage-format=html, or --coverage-format=monocart." >&2
        fi
        exit 2
    fi
fi

# Same forbidden combo as `tests` — under parallel workers each emits
# its own coverage shard; combined with WASM CPU contention this
# yields an unreliable report. Force the user to pick sequential or
# drop one of --wasm / --coverage.
if [ "$COVERAGE" = "on" ] && [ "$WASM" = "on" ] && [ "$MODE" = "parallel" ]; then
    echo "Error: --coverage cannot be combined with --wasm under --mode parallel." >&2
    echo "  Pass --mode sequential, drop --wasm, or drop --coverage." >&2
    exit 2
fi

# Wipe .test-report/ when generating either report so each run starts
# clean.
if [ "$REPORT" = "on" ] || [ "$COVERAGE" = "on" ]; then
    clean_report_dir
fi

RUNNER_FLAGS=()
if [ "$COVERAGE" = "on" ]; then
    RUNNER_FLAGS+=(--coverage)
    COV_RUNNER_OUT="$(coverage_runner_flags "$runtime" "${COVERAGE_FORMAT[@]}")" || exit 2
    while IFS= read -r flag; do RUNNER_FLAGS+=("$flag"); done <<<"$COV_RUNNER_OUT"
fi
if [ "$REPORT" = "on" ]; then
    REP_RUNNER_OUT="$(report_runner_flags "$runtime" "${REPORT_FORMAT[@]}")" || exit 2
    while IFS= read -r flag; do
        if [ -n "$flag" ]; then RUNNER_FLAGS+=("$flag"); fi
    done <<<"$REP_RUNNER_OUT"
fi
if [ "$runtime" = "npm" ] && [ "$UI" = "on" ]; then RUNNER_FLAGS+=(--ui); fi

RUN_LOG=
if [ "$runtime" = "bun" ] && [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    RUN_LOG="$(mktemp)"
    trap 'rm -f "$RUN_LOG"' EXIT
fi

PHASE_LABEL="Focused run: ${COORDS[*]}"
if [ -n "$RUN_LOG" ]; then
    run_phase "$runtime" "$MODE" "${TARGETS[@]}" "${RUNNER_FLAGS[@]}" "${EXTRA_ARGS[@]}" 2>&1 | tee "$RUN_LOG"
    ec=${PIPESTATUS[0]}
    emit_bun_github_summary "$PHASE_LABEL" "$RUN_LOG"
else
    run_phase "$runtime" "$MODE" "${TARGETS[@]}" "${RUNNER_FLAGS[@]}" "${EXTRA_ARGS[@]}"
    ec=$?
fi
# In focused mode --wasm is a single-pass override (real WASM for the
# coord), not a separate phase. Pass that through to the legend so the
# Actions UI distinguishes a focused real-WASM run from a focused
# mocked one — same coord, different scope.
WASM_SCOPE=off
if [ "$WASM" = "on" ]; then WASM_SCOPE=on; fi
emit_phase_legend "$PHASE_LABEL" "$MODE" "$WASM_SCOPE" "$DOCKER" "$DOCKER_SCOPE" "$SCOPE" "$runtime" "${TARGETS[@]}"

if [ "$ec" -eq 0 ]; then
    if [ "$COVERAGE" = "on" ]; then
        finalize_report "$runtime" "$OPEN_AFTER" "${COVERAGE_FORMAT[@]}" || true
    elif [ "$OPEN_AFTER" = "on" ]; then
        open_report_in_browser || true
    fi
fi
exit "$ec"
