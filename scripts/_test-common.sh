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
    if [ "$runtime" = "bun" ]; then
        local parallel_flag=
        if [ "$mode" = "parallel" ]; then parallel_flag="--parallel"; fi
        # An empty "$@" turns into a literal "" token that `bun test`
        # interprets as a filter matching every project file AND exits 99.
        if [ "$#" -gt 0 ]; then
            bun test $parallel_flag "$@"
        else
            bun test $parallel_flag
        fi
        ec=$?
        if [ "$ec" -eq 99 ] || [ "$ec" -eq 100 ]; then ec=0; fi
    else
        local serial_flag=
        if [ "$mode" = "sequential" ]; then serial_flag="--no-file-parallelism"; fi
        vitest run $serial_flag "$@"
        ec=$?
    fi
    return $ec
}

# Paths that hit the in-process WASM connectors. The two-phase test
# script and the standalone wasm-test script both run against these.
WASM_PATHS=(
    test/db/postgres/newest/pglite/
    test/db/postgres/oldest/pglite/
    test/db/sqlite/newest/sqlite-wasm-OO1/
)
