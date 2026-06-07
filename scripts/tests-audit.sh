#!/bin/bash
# Run the test-symmetry audit. See `tests:audit --help`.

print_help() {
    cat <<'EOF'
Usage:
  tests:audit [<coord>…] [--explain] [--strict] [--all] [--only <rule>] [--help]

Mechanical checks over test/db/. Exit 0 if clean, 1 on any error-severity
finding. Static only — no docker, no WASM, no DB.

Positional <coord> args scope the run, same as the `tests` CLI:
<db>[/<version>[/<connector>[/<file>]]] with `*` globs and `{a,b}` braces
(e.g. postgres/newest/pg, 'postgres/*/pg', '{mariadb,mysql}/newest'). No
coord = the whole matrix. A coord matching nothing is an error (exit 2).

Checks:
  symmetry      every cell of a database declares the same .test.ts files with
                the same test names in the same order (executed OR commented
                out). DESIGN § Symmetry. Always blocking.
  mock-only        the test never validates against the real engine — either
                   `if (ctx.realDbEnabled) return` (mock-only) or a catch that
                   rethrows only on the mock (swallows the real-DB error). Most
                   severe. DESIGN § Real-DB validation. [warn]
  mirror-image     two-sided ctx.realDbEnabled guard where the mock branch
                   asserts a value (deep equality) but the real-DB branch only
                   checks shape — a regression slips through under --docker.
                   DESIGN §1 / ANTIPATTERNS #1. [warn]
  one-sided-guard  a ctx.realDbEnabled guard where only ONE mode validates the
                   value (the other gets no branch, or returns early). The
                   value must be checked in both mock and real DB. DESIGN §1.
                   [warn]
  uuid-literal     a string literal that looks like a UUID (8-4-4-4-12 shape)
                   but is not valid hex — the mock accepts any string, a real
                   engine rejects it, so it passes mock-only. [warn]
  as-any           a cast to `any` bypassing the public typed API — the symptom
                   of a query not built the supported way. Exception tests,
                   allow-when (isQueryAllowed) and the marshalling fromDbValue
                   helper are tolerated; the rest is a rewrite backlog. [warn]
  any-type         an `any` TYPE annotation (`x: any`, `(v: any) =>`, `any[]`,
                   …) — defeats type-checking, hides unrealistic tests. Use a
                   precise type or `unknown`. Separate from as-any. [warn]
  non-public-api   a relative import past the supported surface: into a src
                   module that is not a package.json export, or into a
                   non-admitted test/lib file. [warn]
  commented-test-reason  a commented-out test with no `// TODO[LIMITATION]: …`
                   or `// TODO[BUG]: …` saying why it is disabled. [warn]
  focused-test     a committed `test.only` / `it.only` / `describe.only` —
                   focuses the runner and silently skips the rest of the file,
                   so the cell looks green while almost nothing ran. Never
                   legitimate in committed code. [warn]
  empty-snapshot   an empty `toMatchInlineSnapshot()` in live code — pins
                   nothing (auto-fills on the next run), so it asserts nothing
                   until baked. Snapshots inside commented-out tests are
                   naturally exempt (not live code). [warn]
  ts-ignore        `@ts-ignore` / `@ts-nocheck` — silences every type error on
                   the next line. Forbidden everywhere in the tests, including
                   the negative-type cells (use `@ts-expect-error` there). [warn]
  ts-expect-error  `@ts-expect-error` outside a `types.negative/` cell — a
                   type-error bypass where the line should compile cleanly.
                   Inside `types.negative/` it is the expected tool. [warn]
  eslint-disable-type   an `eslint-disable` of a type-soundness lint
                   (`no-explicit-any` / `no-unsafe-*` / `ban-ts-comment`, or a
                   bare disable) — the lint twin of as-any / any-type. [warn]
  eslint-disable-other  an `eslint-disable` of any other (non-type) lint —
                   tracked separately so the type bucket stays clean. [warn]
  skipped-test-reason   `test.skip` / `it.skip` / `describe.skip` / `test.todo`
                   with no `// TODO[LIMITATION]: …` / `// TODO[BUG]: …` reason —
                   the `.skip` twin of commented-test-reason. [warn]
  skip-real-db     `test.skipIf(ctx.realDbEnabled)` / `runIf(!realDbEnabled)` —
                   a mock-only evasion at the registration level (the test never
                   runs against the real engine). [warn]
  tautology        a provably-constant assertion that validates nothing —
                   `expect(true).toBe(true)`, `expect(x).toBe(x)`, or
                   `expect(x.length).toBeGreaterThanOrEqual(0)` (.length is
                   always >= 0). Only provable shapes; weak-but-real ones are
                   the sub-agent's call. [warn]
  no-assertion-runtime  a test that runs a query (an `execute*` call) but has no
                   assertion (`expect` / `assertType` / `toThrow`) — it executes
                   and validates nothing. (Type-only demos are not flagged.) [warn]
  empty-catch      an empty `catch { }` swallows the error unconditionally, so a
                   real failure can't surface. Swallowing an `execute*` to assert
                   only the captured SQL is a mock-only pattern. A deliberate
                   `throw` in the try (e.g. to force a rollback) is exempt. [warn]
  weak-boolean     `expect(x).toBeTruthy()` / `toBeFalsy()` — pins only
                   truthiness, not the value. Assert the exact value. [warn]
  weak-matcher     an asymmetric matcher (`expect.arrayContaining` /
                   `objectContaining` / `any` / `anything`) or `.toContain` /
                   `.toMatch` on a value — pins shape/membership, not the exact
                   value. Approximate matching is reserved for a diagnostic blob
                   (error message / stack trace); elsewhere pin the value
                   (normalise id/timestamp + `toEqual`, the full SQL snapshot;
                   a real string is deterministic). [warn]
  close-to         `toBeCloseTo` outside a real-DB branch — approximate float
                   comparison is warranted only against the real engine's
                   rounding; the mock returns exact values, pin with `toBe`. A
                   separate, lenient rule. [warn]
  no-op-expect     an `expect(...)` chain with no matcher invoked (`expect(x)`,
                   `expect(x).not`, `await expect(p).rejects`) — a no-op that
                   always passes. Call a matcher or remove it. [warn]
  non-deterministic-input  `new Date()` (no arg) / `Date.now()` / `Math.random()`
                   used as a query input — non-deterministic params/snapshot. Use
                   a fixed value; allowed only as mock data (`mockNext`). [warn]

Suppress a content finding with a reason (eslint/oxlint syntax; reason required):
  // tests-audit-disable-next-line <rule> -- <reason>   (line above the finding)
  someCode() // tests-audit-disable-line <rule> -- <reason>   (trailing, same line)

Flags:
  --explain     print the fix hint for each finding
  --strict      treat every warning as an error (trial a promotion)
  --all         list every warning (default groups a large backlog per rule)
  --only <rule> run a single content rule (mock-only | mirror-image |
                one-sided-guard | uuid-literal | as-any | any-type |
                non-public-api | commented-test-reason | focused-test |
                empty-snapshot | ts-ignore | ts-expect-error |
                eslint-disable-type | eslint-disable-other |
                skipped-test-reason | skip-real-db | tautology |
                no-assertion-runtime | empty-catch | weak-boolean |
                weak-matcher | close-to | no-op-expect |
                non-deterministic-input)

Design doc: test/lib/audit/AUDIT.md.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

exec tsx test/lib/audit/main.ts "$@"
