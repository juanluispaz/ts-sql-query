#!/bin/bash
# Open the previously generated test report in the default browser
# without re-running tests. Useful when iterating on the same report
# (re-checking after closing the tab, etc.) or sharing the report
# between agents/humans. See `tests:reopen --help`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests:reopen [--help]

Opens the previously generated test report without running any
tests. Picks (in order):

  1. .test-report/index.html
        Vitest's test-execution SPA (from `--report`). Served via
        `bunx vite preview` because the page fetches metadata and
        browsers block that under file://; the server blocks until
        Ctrl+C.

  2. .test-report/coverage/index.html
        Plain istanbul coverage report — emitted by vitest when
        only `--coverage` was used (no `--report`), or by bun via
        our lcov-to-html glue. Opens directly via file:// and
        returns immediately.

Exits 1 if neither report exists yet; generate one first with
`tests --report` and/or `tests --coverage` (or any of the
coverage:* aliases).

Aliased to `tests:reopen` in package.json. User-facing aliases
(coverage:reopen, etc.) may also chain to this script.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
    "") ;;
    *) echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
esac

open_report_in_browser
