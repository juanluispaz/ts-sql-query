# shellcheck shell=bash
# Sourced by test.sh, focus-test.sh and wasm-test.sh. Not executable on
# its own. Defines:
#
#   detect_runtime              echoes "bun" or "npm"
#   run_phase <runtime> <mode> <paths…>  runs the test runner once
#
# `npm_config_user_agent` is set by both `npm run` and `bun run`; the
# token before the first `/` is what we branch on. When invoked
# directly (no var set) we default to bun, since day-to-day dev in
# this project prefers Bun.

detect_runtime() {
    local rt="${npm_config_user_agent%%/*}"
    if [ -z "$rt" ]; then rt="bun"; fi
    if [ "$rt" != "bun" ] && [ "$rt" != "npm" ]; then rt="npm"; fi
    printf '%s\n' "$rt"
}

# Run one test pass.
#
# Args: <runtime> <mode> <paths…>
#   <runtime> = "bun" | "npm"
#   <mode>    = "parallel" | "sequential"
#   <paths…>  = paths/files to pass to the runner, plus any
#               extra pass-through args.
#
# Returns the runner's exit code. bun:test's exit codes 99 and 100
# both indicate "fully green run + spurious shutdown signal":
#   - 99  : leaked handles on a green run (PGlite's worker threads
#           keep the loop alive even after all tests pass).
#   - 100 : same shape, raised when stdout is not a TTY (which is the
#           default under CI, under `tee`, or under any kind of
#           output redirect). Empirical: with 0 failures, a TTY run
#           returns 0 and a piped run returns 100 — bun's exit-time
#           handle accounting flips signal based on output mode.
# Remapping both to 0 keeps "0 fail" the contract.
run_phase() {
    local runtime="$1" mode="$2"
    shift 2
    local ec
    # Per-test timeout. bun's default of 5s (and vitest's) is too tight
    # for the docker-backed cells under heavy parallel load (an Oracle
    # `withReseed` drops + recreates the schema and can spike past 5s
    # during contention). 60s covers the worst legitimate cases without
    # masking hangs for long, and is mirrored in `vitest.config.ts`
    # (`testTimeout: 60_000`). `--timeout <N>` overrides it via the
    # TEST_TIMEOUT_MS global; left unset we keep the 60000 default.
    local tmo="${TEST_TIMEOUT_MS:-60000}"
    if [ "$runtime" = "bun" ]; then
        local parallel_flag=
        if [ "$mode" = "parallel" ]; then parallel_flag="--parallel"; fi
        # An empty "$@" turns into a literal "" token that `bun test`
        # interprets as a filter matching every project file AND exits 99.
        if [ "$#" -gt 0 ]; then
            bun test $parallel_flag --timeout "$tmo" "$@"
        else
            bun test $parallel_flag --timeout "$tmo"
        fi
        ec=$?
        if [ "$ec" -eq 99 ] || [ "$ec" -eq 100 ]; then ec=0; fi
    else
        local serial_flag=
        if [ "$mode" = "sequential" ]; then serial_flag="--no-file-parallelism"; fi
        # `passWithNoTests` and other shared knobs live in
        # vitest.config.ts so they apply to direct `npx vitest run`
        # invocations too — not just to runs that go through us. The CLI
        # `--testTimeout` wins over the config value, so passing it here
        # makes --timeout authoritative (and is a no-op at the default).
        vitest run $serial_flag --testTimeout="$tmo" "$@"
        ec=$?
    fi
    return $ec
}

# Paths that hit the in-process WASM connectors. The two-phase test
# script runs these as its dedicated sequential phase when --wasm is
# set in full-matrix mode.
WASM_PATHS=(
    test/db/postgres/newest/pglite/
    test/db/postgres/oldest/pglite/
    test/db/sqlite/newest/sqlite-wasm-OO1/
)

# Connector folder names by connection type. Used by the
# `--connections` flag to filter the cell set the runner visits.
# Mirrors the `RealDbBackend` type in `test/lib/backends.ts`:
#
#   wasm   : WebAssembly-based engines that bootstrap a real module
#            inside the JS process. Same gating profile as `--wasm`.
#   native : connectors that go real with no extra infrastructure
#            (no docker, no WASM bootstrap). Today the embedded SQLite
#            drivers — same `false` boolean overload that backends.ts
#            normalises to `'native'`.
#   docker : everything else — connectors that need a real container.
#            Computed as the complement of WASM + NATIVE at filter
#            time, so adding a new docker connector folder does not
#            require updating this file.
#
# Keep these two lists in sync with the connector folders under
# `test/db/<db>/<version>/`. Adding a WASM or NATIVE connector means
# adding its folder name here too.
WASM_CONNECTOR_NAMES=(pglite sqlite-wasm-OO1)
NATIVE_CONNECTOR_NAMES=(better-sqlite3 bun_sqlite node_sqlite sqlite3)

# Internal: connector folder name matches the given type.
# Returns 0 on match, 1 on miss. `docker` is the complement of WASM ∪
# NATIVE — see comment above.
_connector_matches_kind() {
    local cn="$1" kind="$2" item
    case "$kind" in
        wasm)
            for item in "${WASM_CONNECTOR_NAMES[@]}"; do
                [ "$item" = "$cn" ] && return 0
            done
            return 1 ;;
        native)
            for item in "${NATIVE_CONNECTOR_NAMES[@]}"; do
                [ "$item" = "$cn" ] && return 0
            done
            return 1 ;;
        docker)
            for item in "${WASM_CONNECTOR_NAMES[@]}"; do
                [ "$item" = "$cn" ] && return 1
            done
            for item in "${NATIVE_CONNECTOR_NAMES[@]}"; do
                [ "$item" = "$cn" ] && return 1
            done
            return 0 ;;
        *) return 1 ;;
    esac
}

# Emit every `test/db/<db>/<version>/<connector>/` folder in the
# project (one per line, trailing slash). Used by
# `apply_connection_type_filter` when it has to expand a broad path
# (test/, test/db/<db>/, …) to its connector children. Skips the
# `domain/` and `types.negative/` siblings of <version> — neither
# holds connector folders.
list_all_connector_paths() {
    local db version vname connector
    for db in test/db/*/; do
        [ -d "$db" ] || continue
        for version in "$db"*/; do
            [ -d "$version" ] || continue
            vname="${version%/}"; vname="${vname##*/}"
            case "$vname" in domain|types.negative) continue ;; esac
            for connector in "$version"*/; do
                [ -d "$connector" ] && printf '%s\n' "$connector"
            done
        done
    done
}

# Print the connector-level cells (test/db/<db>/<version>/<connector>,
# no trailing slash) selected by the current MAIN_PATHS, one per line,
# sorted and de-duplicated. Powers --list-cells.
#
# Reads (globals): MAIN_PATHS[]
#
# MAIN_PATHS entries may sit at any level (test/, a <db>/, a <version>/,
# a connector/, or a single *.test.ts file) and may be glob-expanded.
# We intersect each against the full connector-cell inventory from
# list_all_connector_paths (which already drops domain/ + types.negative/):
# a cell is emitted when it equals the path, lives under it, or — for a
# file/connector path — contains it. Returns 1 (with a stderr note) when
# the selection resolves to no connector cell, e.g. a coord that names
# only a types.negative folder.
list_cells_from_main_paths() {
    local p cc cell
    local all=() out=()
    while IFS= read -r cell; do all+=("$cell"); done < <(list_all_connector_paths)
    for p in "${MAIN_PATHS[@]}"; do
        p="${p%/}"
        # A file target collapses to its connector directory.
        if [ -f "$p" ]; then p="${p%/*}"; fi
        for cell in "${all[@]}"; do
            cc="${cell%/}"
            # `"$cc/"` matches `"$p"/*` both when cc == p (the glob's `*`
            # accepts the empty tail) and when cc sits under p — so one
            # case covers exact-connector and broader-prefix paths alike.
            case "$cc/" in
                "$p"/*) out+=("$cc") ;;
            esac
        done
    done
    if [ "${#out[@]}" -eq 0 ]; then
        echo "--list-cells: the selection resolved to no connector cells (only domain/ or types.negative/?)." >&2
        return 1
    fi
    printf '%s\n' "${out[@]}" | sort -u
}

# Print the `*.test.ts` files selected by the current MAIN_PATHS, one per
# line, sorted and de-duplicated. Powers --list-files.
#
# Reads (globals): MAIN_PATHS[]
#
# Like list_cells_from_main_paths this is a pure filesystem walk (no
# runner), but it lists at file granularity. The `*.test.ts` glob mirrors
# the runner's own include (`test/**/*.test.ts` in vitest.config.ts; bun's
# default test-file pattern), so the output is exactly the file set a real
# run would visit — including any `types.negative/` files when they're in
# scope, since MAIN_PATHS is already scope/connection-filtered. Returns 1
# (with a stderr note) when nothing matches.
list_files_from_main_paths() {
    local p f out=()
    for p in "${MAIN_PATHS[@]}"; do
        p="${p%/}"
        if [ -f "$p" ]; then
            case "$p" in *.test.ts) out+=("$p") ;; esac
        elif [ -d "$p" ]; then
            while IFS= read -r f; do out+=("$f"); done < <(find "$p" -type f -name '*.test.ts')
        fi
    done
    if [ "${#out[@]}" -eq 0 ]; then
        echo "--list-files: the selection matched no *.test.ts files." >&2
        return 1
    fi
    printf '%s\n' "${out[@]}" | sort -u
}

# Resolve whether a cell that IS in the run runs against a REAL engine or
# the MOCK under the current flags, and why. Echoes one tab-separated record:
#
#     <verdict>\t<annotation>
#
#   verdict    ∈ real | mock   (never `skipped` — that's a path-exclusion
#              decision made by _cell_mode_classified, not a runtime gate)
#   annotation human-readable "(kind; reason)" suffix
#
# Arg: <cell-path>  e.g. test/db/postgres/newest/pg  (trailing slash ok)
# Reads (globals): DOCKER, DOCKER_SCOPE, WASM   (the resolved flag values
#                  from tests.sh) + env TS_SQL_QUERY_DBS.
#
# !!! MIRRORS isRealDbEnabled() in test/lib/backends.ts — KEEP IN SYNC. !!!
# That function is the runtime source of truth and returns real-or-not;
# whenever it returns false the cell falls back to the MOCK (it still runs).
# So every "false" reason here is a `mock` verdict, NOT a skip — including a
# db that's out of TS_SQL_QUERY_DBS scope (isBackendEnabled only feeds
# isRealDbEnabled; the test still executes against the mock). This is a bash
# projection of the same decision so --list-cells-with-mode /
# --validation-summary stay runner-free. If the gate logic there changes,
# change it here too
# (the CLAUDE.md maintenance note for the tests CLI points back here).
cell_mode() {
    local cell="${1%/}"
    local rest="${cell#test/db/}"
    local db="${rest%%/*}"
    local r2="${rest#*/}"; local version="${r2%%/*}"
    local connector="${rest##*/}"

    # db-in-scope gate (TS_SQL_QUERY_DBS): 'all'/empty → all; 'none' → none;
    # otherwise a comma list of database folder names. NOTE: a db out of
    # scope is NOT skipped — isBackendEnabled only feeds isRealDbEnabled, so
    # the real branch is gated OFF and the cell runs against the MOCK (the
    # test still executes). Verdict is therefore `mock`, not `skipped`.
    local dbs="${TS_SQL_QUERY_DBS:-all}"
    case "$dbs" in
        ''|all) ;;
        none)   printf 'mock\t(db out of TS_SQL_QUERY_DBS scope → real gated)\n'; return ;;
        *)
            case ",$dbs," in
                *",$db,"*) ;;
                *) printf 'mock\t(db out of TS_SQL_QUERY_DBS scope → real gated)\n'; return ;;
            esac ;;
    esac

    # Kind-of-backend gate, mirroring RealDbBackend classification.
    local kind
    if _connector_matches_kind "$connector" wasm; then kind=wasm
    elif _connector_matches_kind "$connector" native; then kind=native
    else kind=docker; fi

    case "$kind" in
        native)
            printf 'real\t(native)\n' ;;
        wasm)
            if [ "${WASM:-off}" = "on" ]; then printf 'real\t(wasm)\n'
            else printf 'mock\t(wasm; needs --wasm)\n'; fi ;;
        docker)
            if [ "${DOCKER:-off}" != "on" ]; then
                printf 'mock\t(docker; needs --docker)\n'
            elif [ "${DOCKER_SCOPE:-all}" = "newest" ] && [ "$version" != "newest" ]; then
                printf 'mock\t(docker; docker-scope=newest skips %s)\n' "$version"
            else
                printf 'real\t(docker)\n'
            fi ;;
    esac
}

# The cells the current COORDS match, IGNORING the --scope / --connections
# gating, one per line (no trailing slash). Used to tell "outside the coords
# you asked for" apart from "excluded by a filter" when annotating modes.
# Empty COORDS → the whole connector matrix.
#
# Implemented by re-resolving the coords with SCOPE/CONNECTIONS forced to
# `all` (so nothing is gated out), then restoring the real selection. Reads
# COORDS / FOCUSED indirectly via resolve_main_paths.
_coord_universe_cells() {
    local _scope="$SCOPE" _conn="$CONNECTIONS" rc
    local _main=("${MAIN_PATHS[@]}") _wasm=("${WASM_LIST[@]}")
    SCOPE=all
    CONNECTIONS=all
    if resolve_main_paths >/dev/null 2>&1; then
        list_cells_from_main_paths 2>/dev/null
        rc=$?
    else
        rc=1
    fi
    SCOPE="$_scope"; CONNECTIONS="$_conn"
    MAIN_PATHS=("${_main[@]}"); WASM_LIST=("${_wasm[@]}")
    return $rc
}

# Classify ONE cell against ALL of the current gates and explain why, for
# the full-matrix listing. Echoes "<verdict>\t<annotation>" with verdict ∈
# real | mock | skipped.
#
# `skipped` means the cell is EXCLUDED FROM THE RUN entirely (the runner
# never sees it) — only the path-level filters do that, checked here in
# precedence order: outside coords > --connections > --scope newest. If the
# cell survives those it IS in the run, and cell_mode decides real vs mock
# (TS_SQL_QUERY_DBS lives there as a real→mock gate, not a skip).
#
# Arg: <cell-path> <universe>   (<universe> = newline list from
#                                _coord_universe_cells)
# Reads (globals): SCOPE, CONNECTIONS (+ whatever cell_mode reads).
_cell_mode_classified() {
    local cell="${1%/}" universe="$2"
    local rest="${cell#test/db/}"
    local version connector
    rest="${rest#*/}"; version="${rest%%/*}"
    connector="${cell##*/}"

    case $'\n'"$universe"$'\n' in
        *$'\n'"$cell"$'\n'*) ;;  # inside the coord selection
        *) printf 'skipped\t(not selected: outside coords)\n'; return ;;
    esac
    if [ "${CONNECTIONS:-all}" != "all" ] && ! _connector_matches_kind "$connector" "$CONNECTIONS"; then
        printf 'skipped\t(excluded by --connections %s)\n' "$CONNECTIONS"; return
    fi
    if [ "${SCOPE:-all}" = "newest" ] && [ "$version" != "newest" ]; then
        printf 'skipped\t(excluded by --scope newest)\n'; return
    fi
    cell_mode "$cell"
}

# List EVERY connector cell in the matrix annotated with its real/mock/
# skipped mode under the current flags, one per line, aligned. Powers
# --list-cells-with-mode and --validation-summary.
#
# The universe is the whole matrix on purpose (the chosen semantics): a cell
# outside the current coords/scope/connections selection is shown as
# `skipped` WITH THE REASON it is off, rather than silently omitted. The
# filter then selects which verdicts to print:
#   running (default) cells that will run a body: real + mock.
#   all               every cell, including the off (skipped) ones.
#   real / mock / skipped   only that verdict.
#
# Footer tallies running cells (real + mock) and, separately, the count of
# OTHER cells that are skipped — independent of the display filter.
# Reads (globals): MAIN_PATHS[]/COORDS etc. via _coord_universe_cells.
list_cells_with_mode() {
    local filter="${1:-running}"
    local universe all_cells cell verdict annotation show shown=0
    local n_real=0 n_mock=0 n_skipped=0
    universe="$(_coord_universe_cells)"
    all_cells="$(list_all_connector_paths)"
    while IFS= read -r cell; do
        [ -n "$cell" ] || continue
        cell="${cell%/}"
        IFS=$'\t' read -r verdict annotation < <(_cell_mode_classified "$cell" "$universe")
        case "$verdict" in
            real)    n_real=$((n_real + 1)) ;;
            mock)    n_mock=$((n_mock + 1)) ;;
            skipped) n_skipped=$((n_skipped + 1)) ;;
        esac
        show=0
        case "$filter" in
            all)     show=1 ;;
            running) [ "$verdict" != "skipped" ] && show=1 ;;
            real)    [ "$verdict" = "real" ] && show=1 ;;
            mock)    [ "$verdict" = "mock" ] && show=1 ;;
            skipped) [ "$verdict" = "skipped" ] && show=1 ;;
        esac
        if [ "$show" -eq 1 ]; then
            printf '%-44s %-7s %s\n' "$cell" "$verdict" "$annotation"
            shown=$((shown + 1))
        fi
    done <<<"$all_cells"
    if [ "$shown" -eq 0 ]; then
        case "$filter" in
            real)    echo "(no cells run against a real engine under the current flags — add --docker and/or --wasm)" >&2 ;;
            mock)    echo "(no cells run as mock under the current flags — every running cell is real)" >&2 ;;
            skipped) echo "(no cells are off — every matrix cell is in the current selection)" >&2 ;;
        esac
    fi
    # Footer: running cells (real + mock) headline; the off ones counted
    # separately as "other cells skipped". Independent of the display filter.
    printf -- '-- %d running cells: %d real, %d mock; %d other cells skipped\n' \
        "$((n_real + n_mock))" "$n_real" "$n_mock" "$n_skipped"
}

# Filter MAIN_PATHS in-place against a connection-type. Each path is
# classified by its connector segment (4th component under test/db/):
#
#   * Paths at or below the connector level (test/db/<db>/<version>/<connector>/…)
#     are kept iff the connector matches the requested type.
#   * Paths above the connector level (test/, test/db/<db>/,
#     test/db/<db>/<version>/) are *expanded* to their connector
#     children, then filtered.
#   * `<db>/types.negative/` paths are dropped under any non-all
#     filter — they're dialect-level compile-time checks, not tied to
#     a connector.
#
# Reads (globals): MAIN_PATHS[], WASM_CONNECTOR_NAMES[],
#                  NATIVE_CONNECTOR_NAMES[].
# Writes (globals): MAIN_PATHS[] (replaced with the filtered set).
# Returns 0 if the filtered set is non-empty, 2 otherwise (caller
# typically prints a context-specific error then exits).
#
# No-op when kind == "all".
apply_connection_type_filter() {
    local kind="$1"
    [ "$kind" = "all" ] && return 0
    local filtered=() p rel parts cn cp cn_cp
    for p in "${MAIN_PATHS[@]}"; do
        rel="${p#test/db/}"
        rel="${rel%/}"
        IFS='/' read -ra parts <<< "$rel"
        if [ "${parts[1]:-}" = "types.negative" ]; then
            continue
        fi
        # Below the connector level (< 3 segments) → broad path: walk
        # every connector and keep the ones whose path starts with
        # this prefix AND match the type.
        if [ "${#parts[@]}" -lt 3 ]; then
            while IFS= read -r cp; do
                cn_cp="${cp%/}"; cn_cp="${cn_cp##*/}"
                if _connector_matches_kind "$cn_cp" "$kind"; then
                    case "$cp" in
                        "$p"*) filtered+=("$cp") ;;
                    esac
                fi
            done < <(list_all_connector_paths)
            continue
        fi
        cn="${parts[2]}"
        _connector_matches_kind "$cn" "$kind" && filtered+=("$p")
    done
    MAIN_PATHS=("${filtered[@]}")
    [ "${#MAIN_PATHS[@]}" -eq 0 ] && return 2
    return 0
}

# Emit newline-separated paths for the `--scope newest` filter — one
# `<db>/newest/` plus the dialect-agnostic `<db>/types.negative/` per
# database under `test/db/`. Different from `--docker-scope newest`
# (which only flips the real/mock gate on docker-backed cells): this
# narrows which TEST FILES the runner visits at all. Used by `tests`
# and `tests <coord>` to keep coverage runs short by skipping the
# older-version cells whose coverage is already produced by the
# matching newest cell.
expand_newest_paths() {
    local db_dir db
    for db_dir in test/db/*/; do
        [ -d "$db_dir" ] || continue
        db=${db_dir%/}
        db=${db##*/}
        if [ -d "${db_dir}newest" ]; then
            printf '%s\n' "${db_dir}newest/"
        fi
        if [ -d "${db_dir}types.negative" ]; then
            printf '%s\n' "${db_dir}types.negative/"
        fi
    done
}

# Keep only WASM_PATHS entries that pass through a `newest/` segment.
# Used by the `--scope newest` filter so the WASM phase
# skips e.g. `postgres/oldest/pglite/`.
filter_newest_wasm_paths() {
    local p
    for p in "${WASM_PATHS[@]}"; do
        case "$p" in
            */newest/*) printf '%s\n' "$p" ;;
        esac
    done
}

# Map the user-facing coverage format(s) to runner-specific flags.
# Echoes flags one per line so callers can `while IFS= read` them
# into an array. Errors go to stderr; return non-zero on unsupported
# formats so the caller can short-circuit.
#
# Args: <runtime> <format1> [<format2> ...]
#
# Bun (second-class for coverage — its V8 profile is collapsed to
# lcov.info before we ever see it, so column-level data is lost):
# native --coverage-reporter accepts repeated flags. Supported
# values are `text` (terminal) and `lcov` (file). `html` is
# synthesised by asking bun for lcov and post-processing the
# resulting lcov.info via test/lib/coverage/lcovToHtml.ts (lcov-parse +
# istanbul-reports). Any other format is vitest-only and triggers
# an error — the user must drop the format or pass --use-vitest.
#
# Vitest (the recommended path for coverage — V8-rich data, all
# reporters native via @vitest/coverage-v8): pass each format
# through as `--coverage.reporter=<name>`. Whatever vitest supports
# is supported here too; vitest validates the names.
coverage_runner_flags() {
    local runtime="$1"; shift
    case "$runtime" in
        bun)
            # `monocart` is the third "html-emitting" format alongside
            # the istanbul-html post-render. Both consume bun's
            # lcov.info, so the only extra step we ask bun for is
            # the lcov emission. The post-render itself happens in
            # finalize_report → render_coverage_monocart_bun.
            local emit_lcov=off
            local has_monocart=off
            local has_html=off
            for fmt in "$@"; do
                case "$fmt" in
                    text)
                        printf -- '--coverage-reporter=text\n' ;;
                    lcov)
                        emit_lcov=on ;;
                    html)
                        emit_lcov=on; has_html=on ;;
                    monocart)
                        emit_lcov=on; has_monocart=on ;;
                    *)
                        echo "coverage_runner_flags: bun does not support --coverage-format=$fmt — supported under bun: text|lcov|html|monocart (use --use-vitest for others)" >&2
                        return 1 ;;
                esac
            done
            # Both html and monocart write to
            # .test-report/coverage/index.html; one would clobber
            # the other. Force the user to pick. text + lcov stay
            # composable with either.
            if [ "$has_monocart" = "on" ] && [ "$has_html" = "on" ]; then
                echo "coverage_runner_flags: --coverage-format=monocart and =html both write to .test-report/coverage/index.html; pick one. (text and lcov can coexist with either.)" >&2
                return 1
            fi
            if [ "$emit_lcov" = "on" ]; then
                # Match vitest's `coverage.reportsDirectory` layout
                # (.test-report/coverage/) so both runners land
                # coverage artifacts under the same subdirectory —
                # only .test-report/index.html itself (vitest's
                # test-execution SPA) lives one level up.
                printf -- '--coverage-reporter=lcov\n'
                printf -- '--coverage-dir=./.test-report/coverage\n'
            fi ;;
        npm)
            # `monocart` under vitest swaps the coverage provider
            # entirely (vitest-monocart-coverage as a custom
            # provider, V8 raw data → MCR). It can't be combined
            # with other --coverage-format values because the V8
            # provider that emits istanbul-style reports isn't
            # running. Errors out instead of silently dropping the
            # other formats.
            local has_monocart=off
            for fmt in "$@"; do
                if [ "$fmt" = "monocart" ]; then has_monocart=on; break; fi
            done
            if [ "$has_monocart" = "on" ]; then
                if [ "$#" -gt 1 ]; then
                    echo "coverage_runner_flags: --coverage-format=monocart under vitest replaces the coverage provider — it can't be combined with other --coverage-format values. Pass monocart on its own; configure additional MCR reports in mcr.config.ts." >&2
                    return 1
                fi
                printf -- '--coverage.provider=custom\n'
                printf -- '--coverage.customProviderModule=vitest-monocart-coverage\n'
            else
                for fmt in "$@"; do
                    printf -- '--coverage.reporter=%s\n' "$fmt"
                done
            fi ;;
        *)
            echo "coverage_runner_flags: unsupported runtime=$runtime" >&2
            return 1 ;;
    esac
}

# Map the user-facing test-execution report format(s) to runner-
# specific flags. Echoes flags one per line, mirroring
# coverage_runner_flags.
#
# Args: <runtime> <format1> [<format2> ...]
#
# Bun is single-valued for `--reporter` (the last value wins inside
# bun's parser, so passing two would silently lose one). We honour
# the first format and warn loudly that the rest were dropped — the
# user still gets an artifact, which matches the "warn-not-error
# when something usable remains" rule. Supported under bun:
#   junit  → bun's JUnit XML reporter, written to
#            .test-report/junit.xml. No browser viewer comes with
#            it; pair with --use-vitest if you want the html SPA.
#   dots   → terminal-only progress dots; produces no file.
# Any other value (notably `html`) is vitest-only and errors.
#
# The compact progress reporter is the one place the runners disagree
# on a format NAME (not just a flag spelling): bun calls it `dots`,
# vitest calls it `dot`. We accept either as a synonym and normalise to
# the active runner's real name, so the documented canonical `dot`
# works under bun and a `dots` carried over from bun works under vitest.
#
# Vitest accepts any number of `--reporter=<name>` flags and
# validates the names itself.
report_runner_flags() {
    local runtime="$1"; shift
    case "$runtime" in
        bun)
            if [ "$#" -eq 0 ]; then return 0; fi
            if [ "$#" -gt 1 ]; then
                echo "Warning: bun's --reporter is single-valued; keeping --report-format=$1 and dropping: ${*:2}" >&2
            fi
            case "$1" in
                junit)
                    printf -- '--reporter=junit\n'
                    printf -- '--reporter-outfile=./.test-report/junit.xml\n' ;;
                dot|dots)
                    # bun's reporter is `dots`; accept vitest's `dot`
                    # spelling as a synonym and normalise to bun's name.
                    printf -- '--reporter=dots\n' ;;
                *)
                    echo "report_runner_flags: bun does not support --report-format=$1 — supported under bun: junit|dot|dots (use --use-vitest for html and the rest)" >&2
                    return 1 ;;
            esac ;;
        npm)
            for fmt in "$@"; do
                case "$fmt" in
                    dots)
                        # vitest's reporter is `dot`; normalise bun's
                        # `dots` spelling so either name works here too.
                        printf -- '--reporter=dot\n' ;;
                    *)
                        printf -- '--reporter=%s\n' "$fmt" ;;
                esac
            done ;;
        *)
            echo "report_runner_flags: unsupported runtime=$runtime" >&2
            return 1 ;;
    esac
}

# Map the two runner-narrowing knobs (snapshot refresh + test-name
# filter) to runner-specific spelling, mirroring report_runner_flags /
# coverage_runner_flags. Echoes flags one per line; the test-name
# pattern's VALUE goes on its own line so it survives embedded spaces
# when the caller reads back with `IFS= read -r`.
#
# Args: <runtime> <update:on|off> <pattern>
#
# bun and vitest share the short forms (`-u`, `-t`) but diverge on the
# long ones — that divergence (plus npm's `-- --` pass-through dance) is
# exactly what these first-class flags hide:
#   snapshot refresh : bun `--update-snapshots`  | vitest `--update`
#   test-name filter : bun `--test-name-pattern` | vitest `--testNamePattern`
narrowing_runner_flags() {
    local runtime="$1" update="$2" pattern="$3"
    case "$runtime" in
        bun)
            [ "$update" = "on" ] && printf -- '--update-snapshots\n'
            if [ -n "$pattern" ]; then
                printf -- '--test-name-pattern\n'
                printf -- '%s\n' "$pattern"
            fi ;;
        npm)
            [ "$update" = "on" ] && printf -- '--update\n'
            if [ -n "$pattern" ]; then
                printf -- '--testNamePattern\n'
                printf -- '%s\n' "$pattern"
            fi ;;
        *)
            echo "narrowing_runner_flags: unsupported runtime=$runtime" >&2
            return 1 ;;
    esac
}

# Coverage scope defaults live in bunfig.toml (`coveragePathIgnorePatterns`)
# for bun and in vitest.config.ts (`test.coverage.exclude`) for vitest.
# Both runners read their own config file natively; we don't need to
# duplicate the patterns here because we don't provide a CLI override
# for the scope (bun ignores `--config=<path>` for coverage settings,
# so a CLI override would only ever apply to one of the two runners
# and that asymmetry isn't worth the complexity). To narrow scope ad
# hoc, agents edit bunfig.toml / vitest.config.ts directly, or use
# `tests <coord>` which already restricts to a single cell.

# Wipe ./.test-report/ so previous artifacts don't contaminate the
# next run, then recreate it empty. All test-report output lives
# under this single root:
#   .test-report/index.html       — vitest test-execution SPA
#                                   (`--report-format=html`)
#   .test-report/junit.xml        — bun JUnit report
#                                   (`--report-format=junit`)
#   .test-report/coverage/        — coverage report (any format)
#                                   from either runner
# The legacy ./coverage/ is also wiped so an old checkout doesn't
# leak stale files into the new layout. We mkdir -p .test-report
# eagerly because bun's --reporter-outfile and --coverage-dir don't
# create parent directories themselves; vitest creates them, so the
# eager mkdir is purely for the bun path's benefit but is harmless
# under vitest. Idempotent.
clean_report_dir() {
    rm -rf .test-report coverage
    mkdir -p .test-report
}

# Append a "Round details" markdown block to $GITHUB_STEP_SUMMARY
# describing what the phase actually covered. Sits next to vitest's
# auto-injected summary (under npm) and our own bun summary block
# (under bun), so the Actions UI distinguishes back-to-back reports
# that look identical otherwise. Driven by the flags/paths the caller
# passes in — does not hard-code phase order.
#
# Args: <phase-label> <mode> <wasm-real> <docker> <docker-scope> <path-scope> <runtime> [<path>…]
#   <phase-label>  free-form, e.g. "WASM phase", "Main phase", "Coverage run"
#   <mode>         "parallel" | "sequential"
#   <wasm-real>    "on"  → real WASM modules loaded, non-WASM cells excluded
#                  "off" → WASM connectors fall through to mocks
#                  "mixed" → real WASM inside a single full-matrix pass
#                            (the coverage-mode flow when --wasm is set)
#   <docker>       "on"  → docker-backed cells hit real DB containers
#                  "off" → docker-backed cells fall through to mocks
#                  "n/a" → phase doesn't exercise docker-backed cells
#                          (e.g. the WASM-only phase)
#   <docker-scope> "all"     → every docker cell hits its real DB
#                  "newest"  → only `<db>/newest/*` cells hit a real DB;
#                              older versions fall back to the mock
#                  Free-form values are echoed verbatim. Ignored unless
#                  <docker> is "on".
#   <path-scope>   "all"     → every cell under `test/db/<db>/*` runs
#                  "newest"  → only `<db>/newest/*` (+ `<db>/types.negative/*`)
#                              cells run; the rest are excluded from the
#                              invocation (different from <docker-scope>:
#                              <path-scope> narrows file selection, not
#                              just the real/mock gate)
#                  "n/a"     → phase runs a fixed path set (WASM-only phase
#                              or a focused coord that already specifies
#                              the version)
#   <runtime>      "bun" | "npm" (for the runner line)
#   <path>…        paths the runner was invoked with; verbatim in the
#                  rendered "Cells" list so the legend reflects the
#                  actual invocation rather than an inferred shape.
#
# Silently no-ops when $GITHUB_STEP_SUMMARY is unset (local runs).
emit_phase_legend() {
    local label="$1" mode="$2" wasm_real="$3" docker="$4" docker_scope_val="$5" path_scope_val="$6" runtime="$7"; shift 7
    if [ -z "${GITHUB_STEP_SUMMARY:-}" ]; then return 0; fi

    local wasm_scope docker_scope path_scope runner
    case "$wasm_real" in
        on)    wasm_scope='real WASM modules loaded; non-WASM cells excluded from this round' ;;
        off)   wasm_scope='WASM connectors fall through to mocks' ;;
        mixed) wasm_scope='real WASM modules loaded inside a single full-matrix pass' ;;
        *)     wasm_scope="$wasm_real" ;;
    esac
    case "$docker" in
        on)
            case "$docker_scope_val" in
                all)    docker_scope='real DB containers — every docker-backed cell hits its real DB' ;;
                newest) docker_scope='real DB containers — only `<db>/newest/*` cells hit a real DB (older versions fall back to mocks)' ;;
                *)      docker_scope="real DB containers (scope: $docker_scope_val)" ;;
            esac ;;
        off) docker_scope='docker-backed cells fall through to mocks' ;;
        n/a) docker_scope='not applicable (phase does not exercise docker-backed cells)' ;;
        *)   docker_scope="$docker" ;;
    esac
    case "$path_scope_val" in
        all)    path_scope='every cell under `test/db/<db>/*` runs' ;;
        newest) path_scope='only `<db>/newest/*` and `<db>/types.negative/*` cells run; older versions are excluded from the invocation' ;;
        n/a)    path_scope='not applicable (phase runs a fixed path set)' ;;
        *)      path_scope="$path_scope_val" ;;
    esac
    case "$runtime" in
        bun) runner='bun test' ;;
        npm) runner='vitest' ;;
        *)   runner="$runtime" ;;
    esac

    {
        printf '### Round details\n\n'
        printf -- '- **Phase:** %s\n' "$label"
        printf -- '- **Runner:** %s\n' "$runner"
        printf -- '- **Mode:** %s\n' "$mode"
        printf -- '- **WASM connectors:** %s\n' "$wasm_scope"
        printf -- '- **Docker backends:** %s\n' "$docker_scope"
        printf -- '- **Path scope:** %s\n' "$path_scope"
        if [ "$#" -gt 0 ]; then
            printf -- '- **Cells:**\n'
            for p in "$@"; do
                printf -- '  - `%s`\n' "$p"
            done
        fi
        printf '\n'
    } >> "$GITHUB_STEP_SUMMARY"
}

# Parse a captured bun-test log and append a markdown block to
# $GITHUB_STEP_SUMMARY that mirrors the auto-injected vitest
# `github-actions` reporter. Bun ships no equivalent reporter, so
# CI summaries would otherwise be empty on the bun job while the
# node matrix shows full per-phase numbers (`tests.sh --wasm`
# invokes the runner twice, so vitest emits two summary blocks).
# This keeps both runtimes visually symmetric in the Actions UI.
#
# Args: <phase-label> <captured-log-file>
#
# Silently no-ops when $GITHUB_STEP_SUMMARY is unset (local runs)
# or the log file is empty / missing.
emit_bun_github_summary() {
    local label="$1" logfile="$2"
    if [ -z "${GITHUB_STEP_SUMMARY:-}" ] || [ ! -s "$logfile" ]; then return 0; fi

    # bun's end-of-run summary looks like:
    #     N pass
    #     M fail
    #     K skip          (only when skips > 0)
    #     ...
    #   Ran T tests across F files. [D]
    local pass fail skip total files duration summary
    pass=$(grep -Eo '^[[:space:]]*[0-9]+ pass([[:space:]]|$)' "$logfile" | tail -1 | grep -Eo '[0-9]+' || true)
    fail=$(grep -Eo '^[[:space:]]*[0-9]+ fail([[:space:]]|$)' "$logfile" | tail -1 | grep -Eo '[0-9]+' || true)
    skip=$(grep -Eo '^[[:space:]]*[0-9]+ skip([[:space:]]|$)' "$logfile" | tail -1 | grep -Eo '[0-9]+' || true)
    summary=$(grep -E 'Ran [0-9]+ tests? across [0-9]+ files?' "$logfile" | tail -1)
    total=$(printf '%s' "$summary" | grep -Eo 'Ran [0-9]+' | grep -Eo '[0-9]+' || true)
    files=$(printf '%s' "$summary" | grep -Eo 'across [0-9]+' | grep -Eo '[0-9]+' || true)
    duration=$(printf '%s' "$summary" | grep -Eo '\[[^]]+\]' || true)

    local icon="✅"
    if [ "${fail:-0}" -gt 0 ]; then icon="❌"; fi
    local results="${icon} ${pass:-0} passes"
    if [ "${fail:-0}" -gt 0 ]; then results="${results} · ❌ ${fail} fails"; fi
    if [ -n "${skip:-}" ] && [ "$skip" -gt 0 ]; then results="${results} · ⏭️ ${skip} skipped"; fi
    results="${results} · ${total:-0} total"

    {
        printf '## Bun Test Report — %s\n\n' "$label"
        printf '### Summary\n\n'
        printf -- '- Test Files: %s %s total\n' "$icon" "${files:-0}"
        printf -- '- Test Results: %s\n' "$results"
        if [ -n "$duration" ]; then printf -- '- Duration: %s\n' "$duration"; fi
        printf '\n'
    } >> "$GITHUB_STEP_SUMMARY"
}

# Render .test-report/coverage/lcov.info → .test-report/coverage/
# (so it sits next to vitest's coverage output, same layout). Glue
# lives in test/lib/coverage/lcovToHtml.ts — runs UNDER BUN (not
# node) so the bun path stays bun-only. The file lives under test/
# rather than scripts/ so `validate:tests` typechecks its
# assumptions about LCOV and istanbul shapes. It wires lcov-parse
# and istanbul-reports (transitive via @vitest/coverage-v8); each
# does one job, our glue is only the format adapter.
#
# The lcov is already filtered by bun via bunfig.toml's
# coveragePathIgnorePatterns, so rendering reflects the project's
# coverage scope.
render_coverage_html_bun() {
    if [ ! -f .test-report/coverage/lcov.info ]; then
        echo "Warning: .test-report/coverage/lcov.info not produced; cannot render coverage HTML." >&2
        return 1
    fi
    bun test/lib/coverage/lcovToHtml.ts .test-report/coverage/lcov.info .test-report/coverage
}

# Render .test-report/coverage/lcov.info as monocart-coverage-reports
# under bun. Same pipeline shape as render_coverage_html_bun, but the
# entry point uses MCR (html-spa + console-summary) instead of plain
# istanbul-reports. Validation in coverage_runner_flags already
# guarantees this isn't called alongside the istanbul-html renderer
# (they'd both write index.html into the same dir).
render_coverage_monocart_bun() {
    if [ ! -f .test-report/coverage/lcov.info ]; then
        echo "Warning: .test-report/coverage/lcov.info not produced; cannot render monocart report." >&2
        return 1
    fi
    bun test/lib/coverage/lcovToMonocart.ts .test-report/coverage/lcov.info .test-report/coverage
}

# Open the most useful HTML report in the default browser. The two
# possible locations correspond to the two kinds of report and need
# DIFFERENT delivery mechanisms:
#
#   1. .test-report/index.html
#         — Vitest's test-execution SPA (from `--report-format=html`,
#           requires @vitest/ui). The page fetches metadata, which
#           browsers refuse to do under file://, so we serve it via
#           `bunx vite preview --outDir .test-report --open` (a
#           static-file server, NOT the interactive runner from
#           --ui). The command blocks until Ctrl+C.
#
#   2. .test-report/coverage/index.html
#         — Plain istanbul coverage report. Emitted by vitest when
#           `--coverage-format=html` is set without
#           `--report-format=html`, or by bun via our lcov-to-html
#           glue. It's static HTML and opens fine over file://, so
#           we hand it straight to the OS opener — no server.
#
# Preference: if (1) exists, use it (richest report). Otherwise
# fall back to (2).
#
# Used by `--open` (after a test run) and by `tests:reopen` (no test
# run, just open).
open_report_in_browser() {
    if [ -f .test-report/index.html ]; then
        echo "Serving .test-report/ via vite preview (Ctrl+C to stop)…" >&2
        bunx vite preview --outDir .test-report --open
        return $?
    fi
    if [ -f .test-report/coverage/index.html ]; then
        local target=".test-report/coverage/index.html"
        if command -v open >/dev/null 2>&1; then
            open "$target"
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$target"
        elif command -v start >/dev/null 2>&1; then
            start "$target"
        else
            echo "No open/xdg-open/start on PATH — open $target manually." >&2
            return 1
        fi
        return 0
    fi
    echo "Error: no report at .test-report/index.html or .test-report/coverage/index.html. Generate it with --coverage --report-format=html (recommended) or --coverage --coverage-format=html first." >&2
    return 1
}

# Resolve the path set the runner will visit, plus the WASM subset for
# the two-phase split. Splits cleanly between the full-matrix flow
# (`COORDS` empty) and the focused flow (one or more coords).
#
# Reads (globals):
#   COORDS[]         — positional coord args from the caller (may be empty).
#   SCOPE            — "all" | "newest".
#   FOCUSED          — "on" | "off". Set by the caller from `${#COORDS[@]}`.
#   WASM_PATHS[]     — the canonical WASM path list (defined above).
#
# Writes (globals):
#   MAIN_PATHS[]     — paths the main pass will run on. In full-matrix
#                      mode this is `(test/)` or the newest-only expansion;
#                      in focused mode it's the union of expanded coords.
#   WASM_LIST[]      — paths the optional WASM phase will run on
#                      (full-matrix mode only; ignored in focused mode
#                      where --wasm is a single-pass override).
#
# Exit codes:
#   0 on success. Non-zero (with an error to stderr) on:
#     * --scope newest matches no paths (full matrix or bare-db coord),
#     * a coord with `oldest` under --scope newest (explicit conflict),
#     * a glob/brace coord that matches nothing,
#     * a deep coord that doesn't exist on disk,
#     * a coord with characters outside the strict whitelist
#       (alphanumerics, `. _ / -`, and `{,} * ? [ ]`).
#
# Why the eval in the focused/expand branch: brace expansion only
# fires on tokens written literally in the source — running it on a
# variable's contents requires re-tokenisation. Glob expansion would
# work without eval, but routing both through a single eval keeps
# the cartesian-product semantics consistent for `{a,b}/*/c`. The
# whitelist guards the eval so a hostile coord (`; rm -rf /`) is
# rejected before any expansion runs.
resolve_main_paths() {
    WASM_LIST=("${WASM_PATHS[@]}")
    if [ "$FOCUSED" = "off" ]; then
        MAIN_PATHS=(test/)
        if [ "$SCOPE" = "newest" ]; then
            MAIN_PATHS=()
            while IFS= read -r p; do MAIN_PATHS+=("$p"); done < <(expand_newest_paths)
            if [ "${#MAIN_PATHS[@]}" -eq 0 ]; then
                echo "Error: --scope newest matched no paths under test/db/. Add a <db>/newest/ folder or drop --scope newest." >&2
                return 2
            fi
            WASM_LIST=()
            while IFS= read -r p; do WASM_LIST+=("$p"); done < <(filter_newest_wasm_paths)
        fi
        return 0
    fi

    # Focused mode: classify, expand, filter each coord.
    #   bare-db : single segment (`postgres`).
    #   expand  : contains `*`, `?`, `[`, or `{` — glob and/or brace
    #             expansion. Both quoted (`'postgres/*/pg'`) and
    #             unquoted (`postgres/*/pg`) forms work; quoted braces
    #             (`'postgres/*/{pg,postgres}'`) are re-tokenised via
    #             the vetted eval so the same cartesian product runs
    #             either way.
    #   deep    : slash-separated literal (`postgres/newest/pg/file.test.ts`).
    MAIN_PATHS=()
    local coord shape matches added t i
    for coord in "${COORDS[@]}"; do
        case "$coord" in
            *[*?[{]*)       shape=expand ;;
            */*)            shape=deep ;;
            *)              shape=bare-db ;;
        esac
        if [ "$SCOPE" = "newest" ]; then
            case "$coord" in
                */oldest|*/oldest/*)
                    echo "Error: --scope newest is incompatible with a coord pointing at oldest: $coord" >&2
                    return 2 ;;
            esac
        fi
        case "$shape" in
            expand)
                if [[ "$coord" == *[!a-zA-Z0-9._/,*?{}\[\]-]* ]]; then
                    echo "Error: coord '$coord' contains a disallowed character. Allowed: alphanumerics, '. _ / -', and the pattern chars '{,} * ? [ ]'." >&2
                    return 2
                fi
                shopt -s nullglob
                # shellcheck disable=SC2294  # eval is intentional; input vetted above
                eval "matches=(test/db/$coord)"
                shopt -u nullglob
                if [ "${#matches[@]}" -eq 0 ]; then
                    echo "Coordinate $coord matched no paths under test/db/" >&2
                    return 1
                fi
                MAIN_PATHS+=("${matches[@]}")
                ;;
            bare-db)
                if [ "$SCOPE" = "newest" ]; then
                    added=0
                    for sub in newest types.negative; do
                        if [ -d "test/db/$coord/$sub" ]; then
                            MAIN_PATHS+=("test/db/$coord/$sub/")
                            added=1
                        fi
                    done
                    if [ "$added" -eq 0 ]; then
                        echo "Error: --scope newest matched no subfolders under test/db/$coord/ (looked for newest/ + types.negative/)." >&2
                        return 2
                    fi
                else
                    t="test/db/$coord"
                    if [ ! -e "$t" ]; then
                        echo "Coordinate not found: $coord (looked for $t)" >&2
                        return 1
                    fi
                    MAIN_PATHS+=("$t")
                fi
                ;;
            deep)
                t="test/db/$coord"
                if [ ! -e "$t" ]; then
                    echo "Coordinate not found: $coord (looked for $t)" >&2
                    return 1
                fi
                MAIN_PATHS+=("$t")
                ;;
        esac
    done

    # Final --scope newest pass: drop `*/oldest/*` matches that a glob
    # may have pulled in (bare-db was already scope-expanded above).
    if [ "$SCOPE" = "newest" ]; then
        local filtered=()
        for t in "${MAIN_PATHS[@]}"; do
            case "$t" in
                */oldest|*/oldest/*) ;;
                *) filtered+=("$t") ;;
            esac
        done
        MAIN_PATHS=("${filtered[@]}")
        if [ "${#MAIN_PATHS[@]}" -eq 0 ]; then
            echo "Error: --scope newest left no paths to run for ${COORDS[*]}." >&2
            return 2
        fi
    fi

    # Append `/` for directory targets so the runner treats them as
    # path filters, not project-name filters. Idempotent: the bare-db +
    # --scope newest branch already appends a trailing slash, and a
    # double slash (`…/newest//`) breaks the single-`%/` strip in
    # list_cells_from_main_paths / list_files_from_main_paths.
    for i in "${!MAIN_PATHS[@]}"; do
        case "${MAIN_PATHS[$i]}" in
            */) ;;
            *) if [ -d "${MAIN_PATHS[$i]}" ]; then MAIN_PATHS[$i]="${MAIN_PATHS[$i]}/"; fi ;;
        esac
    done
}

# Fill in runtime-aware defaults for the report/coverage format arrays
# when the user enabled the flag but didn't pin a format. Also injects
# `default` alongside `html` under vitest so the user isn't left
# staring at a frozen prompt during the SPA boot (vitest's html
# reporter prints only a single line on completion).
#
# Reads (globals): REPORT, COVERAGE, runtime
# Reads/Writes (globals): REPORT_FORMAT[], COVERAGE_FORMAT[]
#
# The choice of default depends on runtime because bun and vitest
# don't share a usable format:
#   * Vitest's html reporter is the SPA viewer (the recommended
#     path's default).
#   * Bun can't emit html for test-execution — junit is the only
#     file artifact it produces, so that's bun's default.
# The user can always override with --report-format / --coverage-format;
# the helpers `report_runner_flags` and `coverage_runner_flags`
# validate per runtime and error if an unsupported format is asked
# for.
resolve_runner_format_defaults() {
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
    # Inject `default` when vitest's only reporter is `html` (which is
    # silent during the SPA boot). Bun reporters all print to the
    # terminal natively, so the injection is vitest-only.
    if [ "$REPORT" = "on" ] && [ "$runtime" = "npm" ]; then
        local fmt has_terminal_reporter=off
        for fmt in "${REPORT_FORMAT[@]}"; do
            case "$fmt" in
                html) ;;
                *) has_terminal_reporter=on; break ;;
            esac
        done
        if [ "$has_terminal_reporter" = "off" ]; then
            REPORT_FORMAT=("default" "${REPORT_FORMAT[@]}")
        fi
    fi
}

# Validate --open against the resolved REPORT/COVERAGE state. --open
# needs html among the requested formats AND at least one of --report
# / --coverage actually on, otherwise there's nothing to open. The
# `monocart` value also satisfies --open because it writes its own
# index.html (MCR html-spa under bun, MCR v8 SPA under vitest).
#
# Reads (globals): OPEN_AFTER, REPORT, COVERAGE, REPORT_FORMAT[],
#                  COVERAGE_FORMAT[], runtime
# No writes.
# Exit codes: 0 on valid combo or --open=off; 2 on misconfiguration
# (with a runtime-aware error message to stderr).
validate_open_request() {
    if [ "$OPEN_AFTER" != "on" ]; then return 0; fi
    if [ "$REPORT" = "off" ] && [ "$COVERAGE" = "off" ]; then
        echo "Error: --open requires --report or --coverage." >&2
        return 2
    fi
    local fmt has_html=off
    if [ "$REPORT" = "on" ]; then
        for fmt in "${REPORT_FORMAT[@]}"; do
            if [ "$fmt" = "html" ]; then has_html=on; break; fi
        done
    fi
    if [ "$has_html" = "off" ] && [ "$COVERAGE" = "on" ]; then
        for fmt in "${COVERAGE_FORMAT[@]}"; do
            case "$fmt" in
                html|monocart) has_html=on; break ;;
            esac
        done
    fi
    if [ "$has_html" = "off" ]; then
        if [ "$runtime" = "bun" ]; then
            echo "Error: --open requires html among the requested formats. Under bun, html is only available for coverage — pass --coverage-format=html (or =monocart), or add --use-vitest for the html test-execution SPA." >&2
        else
            echo "Error: --open requires html among the requested formats — pass --report-format=html, --coverage-format=html, or --coverage-format=monocart." >&2
        fi
        return 2
    fi
    return 0
}

# One entry point used by tests.sh
# after a successful run. Two things happen here:
#
#   1. Bun coverage post-render: when bun emitted lcov and html was
#      among the requested COVERAGE formats, we run lcovToHtml.ts
#      so .test-report/coverage/index.html exists. Vitest writes
#      its own HTML natively, so this is a no-op there.
#
#   2. Optional browser open: when --open is on, hand off to
#      open_report_in_browser (which picks vitest's test-exec SPA
#      via vite preview if present, else the plain static coverage
#      report via file://).
#
# Args: <runtime> <open_after> <coverage_format1> [<coverage_format2> ...]
finalize_report() {
    local runtime="$1" open_after="$2"
    shift 2
    local has_html_coverage=off
    local has_monocart_coverage=off
    for fmt in "$@"; do
        case "$fmt" in
            html)     has_html_coverage=on ;;
            monocart) has_monocart_coverage=on ;;
        esac
    done
    # Bun post-render: the two html-producing formats run their own
    # converters against the lcov.info bun emitted. Validation in
    # coverage_runner_flags guarantees they're mutually exclusive,
    # so at most one of these branches executes per run.
    if [ "$runtime" = "bun" ] && [ "$has_html_coverage" = "on" ]; then
        render_coverage_html_bun || return 1
    fi
    if [ "$runtime" = "bun" ] && [ "$has_monocart_coverage" = "on" ]; then
        render_coverage_monocart_bun || return 1
    fi
    if [ "$open_after" = "on" ]; then
        open_report_in_browser || return 1
    fi
}
