# `test/` — coverage and test-execution reports

Companion to [`README.md`](./README.md). Read this when you are running
coverage, generating test-execution reports, switching between vitest's
istanbul `html` and monocart, or comparing the two reporters.

- [Quick start](#quick-start)
- [Vitest is the recommended path for coverage](#vitest-is-the-recommended-path-for-coverage)
- [Report and coverage flags](#report-and-coverage-flags)
- [Bun reports (best-effort)](#bun-reports-best-effort)
- [Monocart under vitest (V8 byte-range)](#monocart-under-vitest-v8-byte-range)
- [`html` vs `monocart` under vitest](#html-vs-monocart-under-vitest)
- [Scope (which source files end up in the report)](#scope-which-source-files-end-up-in-the-report)
- [Aliases](#aliases)
- [Forbidden combo](#forbidden-combo)

## Quick start

Pass `--coverage` to any of the test CLIs; output lands under
`.test-report/coverage/`:

```bash
# Whole matrix, mock-only, parallel — fastest coverage pass.
bun run tests --coverage

# Full real coverage (docker + WASM). Sequential because --wasm +
# parallel + coverage is forbidden — see "Forbidden combo" below.
bun run tests --coverage --docker --wasm --mode sequential

# One cell.
bun run tests postgres/newest/pg --coverage

# Just the WASM cells.
bun run tests --connections wasm --wasm --coverage

# Under npm/vitest, prefix flags with `--`:
npm run tests -- --coverage
```

## Vitest is the recommended path for coverage

Bun ships a minimal coverage facility today — lcov/text only,
line-level data with no column or branch info — and its test-exec
reporter is limited to `junit` and `dots`. The html test-execution
SPA is vitest-only. Bun handles both `--report` and `--coverage`
in the test CLI, but the artifacts are leaner. **Vitest is the
recommended path for coverage and rich reporting**:

- V8-collected coverage with column-level statement, branch and
  function maps.
- Every `@vitest/coverage-v8` reporter native: `html`, `text`,
  `text-summary`, `lcov`, `lcovonly`, `clover`, `cobertura`, `json`,
  `json-summary`, `teamcity`. All composable in one run.
- Pass-through to vitest's test-execution reporters (`default`,
  `verbose`, `dot`, `tap`, `tap-flat`, `junit`, `json`, `tree`,
  `github-actions`, etc.) via `--report-format`.
- **`@vitest/ui`**: a browser-based interactive UI for navigating
  tests AND coverage. Add `--ui` to any test CLI.

To force vitest even when invoking via `bun run` (so you keep bun's
faster daily test loop and still get vitest's coverage stack), pass
`--use-vitest`. `--ui` implies it.

## Report and coverage flags

The CLI carries two INDEPENDENT outputs you can opt into:
**`--report`** (test-execution report) and **`--coverage`** (coverage
report). Either, both or neither. `--open` covers either. Both
runners honour both flags — the artifacts just differ.

| Flag | Effect | Default |
|---|---|---|
| `--use-vitest` | Force vitest runtime even under `bun run`. | off |
| `--ui` | Launch `@vitest/ui` (implies `--use-vitest`). | off |
| `--report` | Emit test-execution report under `.test-report/`: vitest writes the html SPA (`index.html`); bun writes `junit.xml`. | off |
| `--report-format <name>` | Repeatable. Default depends on runtime — `html` under vitest, `junit` under bun. Setting it implies `--report`. Under vitest: pass-through (`html`, `default`, `verbose`, `dot`, `tap`, `junit`, `json`, etc.). Under bun: only `junit` (file) and `dots` (terminal); other formats error. | `html`/`junit` |
| `--coverage` | Emit coverage report under `.test-report/coverage/`. | off |
| `--coverage-format <name>` | Repeatable. Default `html` when `--coverage` is on. Under vitest: any `@vitest/coverage-v8` reporter, plus `monocart` (switches provider to `vitest-monocart-coverage` for native V8 byte-range coverage). Under bun: `html\|text\|lcov\|monocart` (multiple values honoured natively, except `monocart + html` which both write `index.html`); other formats error. | `html` |
| `--open` | After a green run, open the richest available HTML report — vitest's `.test-report/index.html` (served via `bunx vite preview`, blocks until Ctrl+C — page is a SPA that needs HTTP) if present, else `.test-report/coverage/index.html` (plain static, `file://`). Requires `html` in `--report-format` or `--coverage-format`. Under bun, html lives only in coverage, so `--open` pairs with `--coverage-format=html`. | off |

Example invocations:

```bash
# Bun: test-execution junit + coverage html, opened via file://:
bun run tests --report --coverage --open

# Vitest: full SPA (test-exec html + coverage html), opened via vite preview:
bun run tests --use-vitest --report --coverage --open

# Coverage only (html, vitest):
bun run tests --use-vitest --coverage --open

# Several coverage formats at once (vitest only):
bun run tests --use-vitest --coverage \
    --coverage-format=html \
    --coverage-format=lcov \
    --coverage-format=cobertura \
    --coverage-format=json-summary

# Live interactive UI (Ctrl+C to stop the server):
bun run tests --ui --coverage --docker

# Verbose test execution output (no html):
bun run tests --use-vitest --report-format=verbose

# Bun + multi-format coverage (text terminal + html browseable):
bun run tests --coverage --coverage-format=text --coverage-format=html

# Monocart under bun (html-spa from lcov):
bun run tests --coverage --coverage-format=monocart --open

# Monocart under vitest (native V8 byte-range, MCR's v8 SPA):
bun run tests --use-vitest --coverage --coverage-format=monocart --open

# Focused report+coverage on one cell:
bun run tests postgres/newest/pg --use-vitest --report --coverage --open
```

## Bun reports (best-effort)

The bun path honours `--report` and `--coverage` natively. The
artifacts are leaner than vitest's (no html SPA for test execution,
line-level coverage instead of V8 byte ranges), but everything you
ask for either lands on disk or errors out cleanly — no silent
no-ops.

**Test-execution report under bun (`--report`)** lands under
`.test-report/`:

- `--report-format=junit` (default) → `.test-report/junit.xml`.
  Standard JUnit XML, consumable by CI systems and report
  aggregators.
- `--report-format=dots` → terminal-only progress dots; produces
  no file.
- `--report-format=html` and the other vitest reporters → ERROR.
  Pass `--use-vitest` for the html SPA.
- Multiple `--report-format` values are not supported (bun's
  `--reporter` is single-valued) — the first one wins and a
  warning is printed about the dropped ones.

**Coverage report under bun (`--coverage`)** lands under
`.test-report/coverage/`:

- `--coverage-format=text` → bun's stdout table.
- `--coverage-format=lcov` → `.test-report/coverage/lcov.info`.
- `--coverage-format=html` (default) → lcov + a post-render via
  [`test/lib/coverage/lcovToHtml.ts`](lib/coverage/lcovToHtml.ts)
  (uses `lcov-parse` + transitive `istanbul-reports`, all under
  bun, no node spawned). Lands at `.test-report/coverage/index.html`.
- `--coverage-format=monocart` → lcov + a post-render via
  [`test/lib/coverage/lcovToMonocart.ts`](lib/coverage/lcovToMonocart.ts),
  which feeds `monocart-coverage-reports` an istanbul-shaped
  coverage map and asks for `html-spa` + `console-summary`.
  Lands at `.test-report/coverage/index.html` (the SPA) with
  per-file `*.ts.html` drill-down pages alongside. Mutually
  exclusive with `--coverage-format=html` (both target the same
  filename). MCR's loader calls `v8.setFlagsFromString` at
  import time, which bun has not implemented; we side-step that
  by shimming `globalThis.gc` to a no-op before a dynamic
  import (see the comment block in `lcovToMonocart.ts`).

  The bun+monocart output is structurally **different** from the
  vitest+monocart output — the SPA itself is at index.html in
  both cases, but the bun path also emits per-file static .html
  pages because MCR's `html-spa` report bundles them as
  drill-downs. We do NOT use MCR's premium `v8` report under bun
  because that report renders byte-range coverage and would need
  V8 raw coverage data (with byte offsets + sourcemaps) that
  bun's lcov simply doesn't expose. Trying to fabricate it from
  line-only data either inflates or zeroes the percentages
  depending on how the V8 range tree is shaped — there's no
  honest middle ground. The percentages you see under bun
  monocart match exactly what bun's lcov reports natively.
- Other vitest reporters (`cobertura`, `json-summary`, etc.) → ERROR.
- Multiple values ARE supported natively (bun's
  `--coverage-reporter` is repeatable). `text + html` and
  `text + monocart` are common pairings.

## Monocart under vitest (V8 byte-range)

When `--coverage-format=monocart` is paired with `--use-vitest`,
the run swaps the @vitest/coverage-v8 provider for
[`vitest-monocart-coverage`](https://github.com/cenfun/vitest-monocart-coverage)
— a custom vitest coverage provider that captures native V8
byte-range coverage and hands it to MCR for rendering. The
output landing under `.test-report/coverage/` includes:

- `index.html` — MCR's V8 SPA (token-level coverage; the
  showcase MCR report).
- `coverage-data.js` + `assets/` — bundle the SPA depends on.
- `lcov.info` — additional lcov export (toggled by the
  `lcov: true` option in `mcr.config.mjs`).

MCR options come from
[`mcr.config.mjs`](../mcr.config.mjs) at the repo root. The
file is `.mjs` (not `.ts`) because MCR's config loader uses
Node's native `require/import` chain — it has no TypeScript
transformer in scope — but is JSDoc-typed against
`CoverageReportOptions`. Adjust `reports`, `name`, watermarks
etc. there.

Importantly, `mcr.config.mjs` is also where the source-file
filter lives (`sourceFilter` + `entryFilter`). MCR does **not**
read vitest's `coverage.exclude` when used as a custom
provider — its own filtering is the only path. The patterns in
`mcr.config.mjs` are kept in sync with `vitest.config.ts`
(`test.coverage.exclude`) and `bunfig.toml`
(`coveragePathIgnorePatterns`) so all three entry points
produce coverage for the same set of files: the library's public
source surface, excluding `src/examples/**` (the documentation
suite) and `test/**` (the test matrix itself).

Caveats:
- `--coverage-format=monocart` under vitest is mutually
  exclusive with every other `--coverage-format` value (the
  provider isn't running, so no other reporter wires up).
- vitest-monocart-coverage 4.0.x still imports a deprecated
  `vitest/coverage` re-export; you'll see one deprecation
  warning at startup. Upstream issue.

For any real coverage work, reach for `--use-vitest`: vitest's
V8 coverage is byte-range accurate (token-level highlighting in
the SPA), exposes branch and function maps, and every
`@vitest/coverage-v8` reporter is available. `--coverage-format=monocart`
is the richest variant of that path.

## `html` vs `monocart` under vitest

Both vitest paths consume the same source of truth — V8 byte-
range coverage collected by `@vitest/coverage-v8`. They differ in
what they do with it.

**Data granularity**

- `html` (istanbul-reports): projects bytes back to lines, paints
  each whole line green/red. Same UI lineage as nyc/jest from a
  decade ago — instantly familiar.
- `monocart` (MCR `v8` SPA): keeps the byte-range data and
  paints **tokens** inside a line. Adds a `Bytes` metric the
  istanbul path doesn't have. Inside `a ?? b ? c : d` you can
  literally see which sub-expression fired.

**Output shape**

| | `--coverage-format=html` | `--coverage-format=monocart` |
|---|---|---|
| Files | `index.html` + one `*.ts.html` per source file + istanbul assets | `index.html` + `coverage-data.js` + `assets/monocart-coverage-app.js` |
| Footprint | grows linearly with the source tree | compact; the data is one minified `.js` |
| Browser delivery | static pages, `file://` works | single SPA loading `coverage-data.js` via a `<script>` tag, `file://` works |

Both open straight from `file://`; neither needs `vite preview`
(the `bunx vite preview` dance is only for the test-execution
SPA at `.test-report/index.html`, which is a different report).

**UI/UX**

- `html`: tabular file list → click → per-file source view with
  green/red gutters. Zero learning curve, same as every other
  istanbul-driven coverage report.
- `monocart`: tree + filters + a file view with token-level
  highlighting. Pays off on branchy expressions (`??`, `&&`,
  ternaries, switch arms) where istanbul's line-level paint
  hides which branch fired. Overkill for "which files have no
  tests at all" surveys.

**Operational friction**

- `html` honours `coverage.exclude` from `vitest.config.ts`. One
  source of truth for the filter.
- `monocart` ignores vitest's exclude (it's running as a custom
  provider) and reads `sourceFilter` / `entryFilter` from
  [`mcr.config.mjs`](../mcr.config.mjs). The patterns there are
  kept in sync with `vitest.config.ts` and `bunfig.toml` by
  hand. Drift = `test/**` or `node_modules/**` quietly creeping
  into the report.
- vitest-monocart-coverage 4.0.x still imports a deprecated
  `vitest/coverage` re-export — one deprecation warning per
  run. Upstream issue; harmless.

**When to pick which**

- **Day-to-day coverage / CI green-red gate** → `html`. Battle-
  tested, every external tool understands the output (the
  `lcov.info` it can also emit, the per-file pages, etc.). It's
  the default of `--coverage-format` for a reason.
- **Investigating a specific gap** ("why is this branch
  reported uncovered?", "which token of this builder method
  never runs?") → `monocart`. The byte-level paint will show
  you exactly what istanbul's line summary hides.
- **CI emitting several formats in one pass** (codecov +
  cobertura + html + json-summary together) → either works
  under vitest, but monocart centralises everything in
  `mcr.config.mjs` (vs. listing every reporter on the CLI for
  the istanbul path).

The two are complementary tools, not substitutes — they live
in `.test-report/coverage/` and can be re-run on demand.

## Scope (which source files end up in the report)

Defaults live in the project's three config files (kept in sync):

- [`bunfig.toml`](../../bunfig.toml): `coveragePathIgnorePatterns`
- [`vitest.config.ts`](../../vitest.config.ts): `test.coverage.exclude`
- [`mcr.config.mjs`](../../mcr.config.mjs): `sourceFilter` / `entryFilter`

All three exclude `src/examples/**` (legacy examples) and `test/**`
(the test suite itself) so the report focuses on the library's
public surface.

There's no CLI flag to override the scope at run time. To narrow the
report for a specific cell, use `tests <coord>` — coverage
then only sees files imported by that cell's tests. To change the
project-wide scope, edit the three config files.

`.test-report/` is wiped at the start of every run with `--report`
or `--coverage`, so older reports or different-format artifacts
never seed the next one.

## Aliases

Canonical (project-level):

| Alias | Equivalent |
|---|---|
| `tests:reopen` | Opens the previously generated report without re-running tests. Errors out clearly if neither `.test-report/index.html` nor `.test-report/coverage/index.html` exists. |

User-level shortcuts (personal — feel free to adjust). They wrap
`--report --coverage --open` under vitest:

| Alias | Equivalent |
|---|---|
| `coverage:fast` | `tests --report --coverage --open` |
| `coverage:no-docker` | `tests --report --wasm --coverage --mode sequential --open` |
| `coverage:complete` | `tests --report --docker --wasm --coverage --mode sequential --open` |
| `coverage:reopen` | Same script as `tests:reopen`. |

## Forbidden combo

`--coverage --wasm --mode parallel` is rejected with exit 2.
Coverage requires a single runner invocation, but `--wasm` in
parallel mode splits the matrix into two phases (real WASM
sequential + main parallel mocked) and merging the two coverage
shards is fragile. Pass `--mode sequential`, drop `--wasm`, or
drop `--coverage`.

When `--coverage` is set, `tests --wasm` bypasses the two-phase
split entirely and runs everything in one invocation with WASM real
(sequential is implied). The single-pass coverage report ends up
cleaner than two separately-collected shards would be.
