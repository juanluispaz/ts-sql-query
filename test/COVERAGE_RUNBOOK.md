# `test/` — coverage-driven test generation: agent runbook

> **What this document is.** A self-contained operating manual for an agent
> (or a human) running a session of "expand the `test/` matrix driven by the
> coverage report". The user invokes it via a one-line prompt of the form
> **"read `test/COVERAGE_RUNBOOK.md` and generate the next batch of tests"**.
> Everything the agent needs is here or behind a link spelled out here.
>
> **What this document is NOT.** A re-statement of the design rules. The
> rules live in [`DESIGN.md`](./DESIGN.md) (normative). The mechanics live
> in [`WRITING_TESTS.md`](./WRITING_TESTS.md) (how-to). This runbook
> orchestrates them; it does not duplicate them.
>
> **Why this exists.** Previous sessions of coverage-driven test generation
> shipped recurring rule violations. Every antipattern caught here has a
> matching entry in [`ANTIPATTERNS.md`](./ANTIPATTERNS.md) — read both
> before starting a round.

- [§0 Mandatory reading](#mandatory-reading)
- [§0.5 Staleness safeguard](#staleness-safeguard)
- [§1 The loop, end to end](#the-loop-end-to-end)
- [§2 Discovery](#discovery)
- [§3 Discount the coverage biases](#discount-the-coverage-biases)
- [§4 Pre-proposal pre-flight](#pre-proposal-pre-flight)
- [§5 Proposing waves](#proposing-waves)
- [§6 Executing one wave — canonical cell only](#executing-one-wave)
- [§7 The validation gate](#the-validation-gate)
- [§8 Propagation](#propagation)
- [§9 Closing the round](#closing-the-round)
- [§10 Operational rules](#operational-rules)
- [§11 Where this runbook ends](#where-this-runbook-ends)

## Mandatory reading

Before reading any coverage report, hold the following in working memory
**in full**. Do not skim. Past rounds that skimmed shipped rule-violating
tests on the first wave.

1. **[`CLAUDE.md`](../CLAUDE.md)** at the repo root — repo-wide conventions,
   the `tests` / `tests:audit` command vocabulary, the reserved `test*`
   names.
2. **[`DESIGN.md`](./DESIGN.md)** in full — the normative core. Pay
   specific attention to:
   - § Real-DB validation — the `mock-validated` vs `real-validated`
     vocabulary that closes the round.
   - § Symmetry rule + § Full-canonical-body discipline — commented bodies
     must be the full canonical.
   - § Mock-only is a smell (both forms) — most common past failure.
   - § The `as any` runtime-guard exception — the ONLY sanctioned `as any`
     in test bodies.
3. **[`WRITING_TESTS.md`](./WRITING_TESTS.md)** — operational counterpart.
   The sections the runbook deep-links into:
   - § Testing a runtime guard that is also typed at compile time.
   - § When the canonical cell can't compile the body.
   - § Imports used only from commented-out blocks.
   - § When a test surfaces a bug in `src/`.
4. **[`BUGS.md`](./BUGS.md)** — every entry. A bug entry is a contract:
   it lists which tests are wrapped, which workarounds are forbidden, and
   what the final fix has to do. Reading the entry first prevents
   re-surfacing the same bug and proposing a workaround.
5. **[`LIMITATIONS.md`](./LIMITATIONS.md)** — every entry. These are
   declared library gaps. A wave that assumes the lib will throw
   `MISSING_GROUP_BY_COLUMN`, gate by deployed-engine-version, or
   enforce something `LIMITATIONS.md` says it will not enforce is doomed.
6. **[`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md)** — every
   "Dialect-specific notes" subsection. These are the caveats in force on
   today's matrix: `sqlite3` BigInt, missing `uuid_str`, `Bun#29010`,
   MySQL no RETURNING, Oracle/SqlServer/MariaDB on-conflict shapes. The
   §8 propagation sweep is mechanical only if the agent knows the
   catalog.
7. **[`ANTIPATTERNS.md`](./ANTIPATTERNS.md)** — every entry. Catalogue of
   past failures, the rule each violated and the gate adopted. If a
   proposed wave matches an entry by shape, you're about to repeat
   history.

If any of these has changed since the last successful round, the changes
take priority over what this runbook remembers; this runbook is a
synthesis, not the source of truth.

## Staleness safeguard

The matrix changes over time: new connectors land, old ones get retired,
`compatibilityVersion` subfolders are added, new caveats accumulate in
`EXTERNAL_CAVEATS.md`, the bug list shifts as the fixing agent picks
entries off, the `coverage:for-discover-tests` alias may grow / shrink
its flag set. Any concrete number, filename, command, anchor or
cross-reference in **this** file is a snapshot of when it was last
touched; do not let it overrule the working tree.

**Pre-flight at session start — three quick checks**:

1. **Run the audit to enumerate the matrix as it stands today**:
   ```bash
   bun run tests:audit
   ```
   The summary line per database (`postgres: N cells, M test files, K
   tests per cell`) is the authoritative count for this session.

   For a flat, machine-readable listing of every active cell (sorted, one
   per line, no audit narrative), use `bun run tests --list-cells` — same
   set, no test execution. Useful when verifying the propagation target
   set in §8 before copy-baking.

2. **Diff this runbook's "last touched" markers against today's state**.
   Quick spot-checks:
   - Does the EXTERNAL_CAVEATS catalog this runbook lists in §4.5 / §7 /
     §8 still match the headings under
     [`EXTERNAL_CAVEATS.md` § "Dialect-specific notes (already wired in today's matrix)"](./EXTERNAL_CAVEATS.md)?
   - Are the open entries in `BUGS.md` the ones the runbook points at, or
     has the fixing agent picked some off?
   - Is the canonical path the runbook proposes still where
     `canonicalForDocs: true` is wired (see
     [`WRITING_TESTS.md` § Canonical setup per database](./WRITING_TESTS.md#canonical-setup-per-database))?

3. **If drift is observed, fix this runbook in the same session**. The
   change is part of the work — see "Maintenance contract" below.

**Maintenance contract**:

- Matrix shape changes (new/removed cell): re-walk §4.5, §8, §10.
- Canonical path changes: update §6.1.
- Discovery alias changes: keep §2 true.
- `tests` CLI flag changes (`--run-versions`, `--run-connectors`, etc.): re-check
  §1, §6, §8.
- Anchor moves in DESIGN.md / WRITING_TESTS.md / BUGS.md /
  LIMITATIONS.md / EXTERNAL_CAVEATS.md / ANTIPATTERNS.md: whoever moves
  them searches this runbook + the prompt at
  [`test/lib/canonical-cell-review-prompt.md`](./lib/canonical-cell-review-prompt.md)
  and updates both.

## The loop, end to end

One session runs this sequence exactly once.

```
   §2  Discover         coverage report → list of in-scope src/ files
   §3  Discount biases  istanbul-shape artifacts to filter out
   §4  Pre-flight       grep src/ + tests + BUGS + LIMITATIONS +
                        EXTERNAL_CAVEATS + ANTIPATTERNS
   §5  Propose          generous wave list with explicit justification
       ─ user OK ─
   §6  Execute          write canonical cell only (postgres/newest/pg for
                        most families; sqlite/newest/bun_sqlite for docs.*)
                        + bake snapshots + real-DB validate the canonical
   §7  Validate         delegate canonical review to a sub-agent BEFORE
                        propagating  (QUALITY_GATE.md)
       ─ fix or accept ─
   §8  Propagate        cp to every active cell, re-bake per cell, re-apply
                        per-connector caveats from EXTERNAL_CAVEATS.md
   §9  Close            tests:audit + validate:tests + validate:tests:tsc +
                        full mock run; report mock-validated vs
                        real-validated per test
```

§7 is the gate prior rounds were missing. Skipping it ships rule-violating
tests to every cell, which the user catches during visual inspection. The
cost of running it is one sub-agent invocation per canonical file; the
cost of shipping is hours of cleanup the next session.

## Discovery

The user runs `bun run coverage:for-discover-tests` **before** the
session. The alias produces
`.test-report/coverage/coverage-summary.json` and `coverage-final.json` in
istanbul JSON format, scoped to `--run-versions newest` (older `<db>/<version>/`
cells skipped — they re-emit the same SQL as `newest` for symmetric
changes) and excluding `src/queryRunners/**` (docker-backed driver
implementations; their `.catch(...)` arms are the dominant uncov, and
they require docker to exercise). Full alias definition in
[`CLI.md` § Aliases — coverage:for-discover-tests](./CLI.md#coverage-for-discover-tests-alias).

The agent reads both files and surfaces the in-scope `src/` files sorted
by `lines%` ascending. Files in `src/internal/` and `src/utils/` appear
in coverage but **are not** part of the public surface (`package.json`
`exports` does not enumerate them outside the `__UNSUPPORTED__/*` escape
hatch). Tests must never import from there; their coverage is whatever
flows through the public surface, no more.

## Discount the coverage biases

`coverage-summary.json`'s `lines%` is the rawest signal. Several artefacts
of the istanbul format inflate the uncov count without representing real
gaps. Filter them out before proposing waves.

| Bias | Where it shows up | How to recognise it | How to discount it |
|---|---|---|---|
| **TypeScript overload signature duplication** | `Table.ts`, `View.ts`, `Values.ts`, `AbstractConnection.column*`, every `virtualColumnFromFragment*` | `fnMap` entries whose `loc` covers <2 lines and whose `name` is one of `column`/`optionalColumn`/`autogeneratedPrimaryKey`/etc. The impl runs; the 20 overload signatures above it count as 20 uncov functions. | Treat `fnMap` entries whose `loc.start.line` equals `loc.end.line` as type-level and not coverable. Look at the actual `if/else` branches of the impl to see what's reachable. |
| **`ValueSourceImpl` wrapper-hook explosion** | `src/internal/ValueSourceImpl.ts` (52% branches, 64% lines) | ~80 wrapper classes × ~6 propagation hooks (`__addWiths`, `__registerTableOrView`, `__registerRequiredColumn`, `__getOldValues`, `__getValuesForInsert`, `__isAllowed`). The hooks fire only in specific contexts: CTEs, `oldValues()`, `valuesForInsert()`, `allowWhen(false)`. | Measure coverage **per wrapper class** (≥1 hook hit = class exercised), not per hook aggregated. Most of the apparent gap is the SAME class missing 5 of 6 hooks in the same execution context. |
| **`.catch(e => throw)` arms** | every `executeSelect*` / `executeInsert*` / `executeUpdate*` / `executeDelete*` | uncov line is exactly the `throw new TsSqlQueryExecutionError(source, …)` inside a `.catch((e) => …)` wrapping a driver promise. | Driver-rejection paths require docker; coverage runs mock-only. **Never** propose a test for these. |
| **Anonymous `.then` / `.map` closures uncov** | every query builder when the happy path took a shortcut | `fnMap` entry `name: "anonymous_NN"` with a small `loc` near a `.then`/`.map`/`.catch` | Closure isn't separately reachable from public API; either the call sequence happens to short-circuit before it or it's a `.catch` arm. Discount as above. |
| **`lines% − branches% > 10`** | mixed `??`, `?.`, `&&`, default-arg evaluation | The number under `branches.pct` is much lower than `lines.pct` | Branch coverage is the honest signal for branchy code. Look at the `branchMap` for that file to see which short-circuit operands stayed evaluated to the same side. |

After applying these filters, the in-scope file list often shrinks to
6-12 files with material uncov, not the 30+ the raw `lines%` sort
suggests.

## Pre-proposal pre-flight

For every file that survives §3, run **five** grep passes before proposing
a wave. Each one has caught a separate class of failure in previous
rounds.

### Verify the API actually exists

```bash
grep -rn "<api-symbol>\b" src/ | head -10
```

If `grep` returns nothing, the API is a hallucination. Don't propose a
test for a symbol that doesn't exist — propose a follow-up to discuss
with the user whether the documented behaviour is implemented elsewhere
or whether the docs are stale. See
[`ANTIPATTERNS.md` § Hallucinated API](./ANTIPATTERNS.md#5-hallucinated-api).

### Verify the existing test inventory

For each candidate API and connector, list every test file that already
references it:

```bash
grep -rln "<api-symbol>" test/db/postgres/newest/pg/ | head
grep -rln "<api-symbol>" test/db/sqlite/newest/bun_sqlite/ | head
```

If matches exist, **read those tests in full** (not just the test names).
If the existing test covers the API but the asserted *value* is weak
(e.g. `expect(rows.length).toBe(2)` instead of `expect(rows).toEqual(...)`),
the wave is not "add a test" but "strengthen the existing test". Frame it
that way in the proposal.

### Check `BUGS.md` for prior characterizations

If the wave touches an API that already has a `BUGS.md` entry, that entry
**dictates** how the wave is written:

- If the bug is "TS rejects an API the lib is supposed to support", the
  test stays block-commented with the canonical bare body per
  [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).
  Workarounds (interpolating an irrelevant column to satisfy the typer,
  casting through `as any`) are explicitly forbidden by the entry; they
  hide the bug from the very test that surfaced it.
- If the bug is "the lib emits SQL the engine rejects", the test is
  mock-only with a comment naming the engine + the SQL the test pins,
  per [`DESIGN.md` § Mock-only smell](./DESIGN.md#mock-only-smell).

If the wave **finds** a new bug, the test author follows
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src)
(two-minute triage; no diagnosis; no fix), wraps the test in `/* */` with
`// TODO[BUG] see test/BUGS.md` on the line above, and continues. The
fixing agent takes the entry from there.

### Check `LIMITATIONS.md` for declared library gaps

A coverage gap inside a `src/` branch may exist because the lib
**deliberately chose not to support** that path:

- GROUP BY column rules even on strict engines (engine errors at runtime;
  that error surfaces verbatim).
- Aggregate functions not type-flagged.
- Deployed-engine version mismatches (no pre-emptive throws).
- `pglite` doesn't bundle the latest PostgreSQL.
- MariaDB's UPDATE … RETURNING requires 13.0.1+ but `mariadb:latest` still
  ships 12.x.
- Window functions not exposed through the fluent API.
- Query introspection (`__isAllowed`) has no public API.

A wave proposal that assumes one of the above is a wrong wave. Cross-check
[`LIMITATIONS.md`](./LIMITATIONS.md) before proposing.

### Check `EXTERNAL_CAVEATS.md` for per-connector caveats

Every wave that adds tests propagating across the matrix must sweep
[`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) first and produce a list of
`(test_name, cell)` pairs that need post-propagation re-wrapping. The
sweep is a single grep against the post-bake canonical:

```bash
# Did this wave's canonical pass `Date` / `bigint` / `customUuid` /
# `.returning(` / `onConflict` / `isolationLevel(.*,` to any
# API path likely to trip the catalog?
grep -nE "new Date\(|n[^a-zA-Z0-9]|customUuid|\.returning\(|onConflict|isolationLevel\(" test/db/postgres/newest/pg/<new-file>.test.ts
```

The list this produces is what §8 re-wraps after propagation.

## Proposing waves

Generous batches. The user runs the full validation matrix
(`bun run tests --docker --wasm`) once per round, ~7 minutes including
warm container reuse; concentrate as much work as possible into one round
so the validation cost amortises.

**Each wave entry must answer**:

1. **What public API does it cover?** (Symbol-level, not file-level.)
2. **What concrete uncov lines does it target?** (After discounting the
   biases in §3.)
3. **Why isn't it redundant?** Cite the existing tests grep surfaced in
   §4.2 and explain what semantically new shape the proposal adds.
4. **Which cells does it touch?** Cells where the API is supported (full
   body) + cells where it isn't (commented-out body with the full
   canonical preserved inside `/* */`, per
   [`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule)).
5. **Does it surface a known caveat?** Cross-reference the
   `EXTERNAL_CAVEATS` list from §4.5.

**Each wave entry should disclose its risks**:

- "Mocks-only is currently green; docker may reveal X" is honest.
- "Real-DB behaviour for SqlServer's JSON aggregate wrap of `bigint`
  (`convert(nvarchar, …)`) may diverge from this snapshot" is the kind
  of disclosure that lets the user know what to expect.

Honest reporting beats wave count. **A wave the user has to reject after
grep-checking is worse than no wave at all** — it burns the user's review
budget on noise.

## Executing one wave

The canonical cell is **one** file. Get that file right before copying it
anywhere else.

### Default canonical paths

- `postgres/newest/pg/` for most families: `select.*`, `insert.*`,
  `update.*`, `delete.*`, `errors.*`, `transaction.*`, `fragments.*`,
  `raw-fragment.*`, `with-values.*`, `customize-query.*`,
  `dynamic-condition.*`.
- `sqlite/newest/bun_sqlite/` for `docs.*` files — the
  `canonicalForDocs: true` cell.
- The cell that owns the dialect-specific behaviour for tests that only
  run on one dialect (`postgres/newest/pg/` for
  `select.postgres-const-force-type-cast.test.ts`,
  `sqlite/newest/bun_sqlite/` for `config.datetime-formats.test.ts`,
  etc.).

PostgreSQL is the **superset** dialect (sequences, RETURNING, LATERAL, ON
CONFLICT, JSON, MERGE on newer versions). Writing the canonical there
first means the test exercises the fullest surface the lib supports.

### Rules

Every rule lives in [`DESIGN.md`](./DESIGN.md) and
[`WRITING_TESTS.md`](./WRITING_TESTS.md). The runbook **does not**
restate them — it lists which one to reach for and links to it.

| Concern | Authoritative section |
|---|---|
| Unconditional value assertion (no mirror-image smell) | [`DESIGN.md` § Mock-only smell — Mirror-image form](./DESIGN.md#mirror-image-form) |
| When the SQL the test pins is mock-only by design | [`DESIGN.md` § Mock-only smell — Skip-real form](./DESIGN.md#skip-real-form) |
| `as any` is forbidden except for runtime-guard tests | [`DESIGN.md` § The `as any` runtime-guard exception](./DESIGN.md#as-any-runtime-guard) |
| Mutation safety (`withRollback` / `withCommit` / `withReseed`) | [`TEST_LIB.md` § Mutation safety contract](./TEST_LIB.md#testcontextts--mutation-safety-contract) |
| When the canonical can't compile the body | [`WRITING_TESTS.md` § When the canonical cell can't compile the body](./WRITING_TESTS.md#when-the-canonical-cell-cant-compile-the-body) |
| `void import` for commented-block-only imports | [`WRITING_TESTS.md` § Imports used only from commented-out blocks](./WRITING_TESTS.md#imports-used-only-from-commented-out-blocks) |
| Test scenarios are realistic queries on the shared domain | [`DESIGN.md` § Principles 10](./DESIGN.md#principles) |
| The body inside `/* */` is the FULL canonical, not a stub | [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body) |
| Snapshots are `toMatchInlineSnapshot()` with no argument, then baked | [`WRITING_TESTS.md` § Updating snapshots](./WRITING_TESTS.md#updating-snapshots) |

If a finding fits one of these, the section name + anchor is what goes
in the proposal / report — not a re-paraphrase.

### Baking the canonical + real-DB validation

Iterate locally:

```bash
bun run tests <canonical-path> --update-snapshots
```

Read the diff of every test you added before moving on. The user will
read it too; submitting un-reviewed bakes is how prior rounds shipped
weaknesses like `expect(rows.length).toBeGreaterThan(0)` and
`assertType<Exact<{...; externalRef: string | undefined; ...}>>>` at the
same time.

**Then promote the canonical from mock-validated to real-validated for
its cell**, before propagating. Per
[`DESIGN.md` § Real-DB validation](./DESIGN.md#real-db-validation):

- **Canonical is SQLite native** (`sqlite/newest/bun_sqlite`, also
  `better-sqlite3`/`node_sqlite`/`sqlite3`): the bake above already ran
  real-DB. The canonical is real-validated; no flag needed.
- **Canonical is docker-backed** (`postgres/newest/pg`, mariadb / mysql /
  oracle / sqlserver canonical cells): run
  `bun run tests <canonical-path> --docker`.
- **Canonical is WASM** (rare for canonical, but in some dialect-specific
  tests): run `bun run tests <canonical-path> --wasm`.

The above runs the path AND the kind's full real layer. If you want only
the canonical cell to come up real while the rest of the run stays mock
(useful when the wave touches a `SqlBuilder` branch shared with siblings
and you want a fast sanity sweep of the whole family with one cell
real-validated), pass the cell as the flag's argument:
`bun run tests <wave-coord-glob> --docker postgres/newest/pg` — only
`postgres/newest/pg` comes up against its real engine; every other docker
cell falls through to the mock. Same shape for `--wasm <cell>` and
`--native <cell>`.
See [`CLI.md` § Flags — Axis 2](./CLI.md#flags).

If the real-DB run reveals a divergence (different value, different
ordering, different affected-row count), that divergence is the signal
the assertion needs adjustment — either by sorting, by UPDATE-in-rollback,
or by splitting the assertion with a documented constraint, per
[`DESIGN.md` § Mirror-image form](./DESIGN.md#mirror-image-form). The
canonical that propagates must be the **strongest unconditional
assertion you can defend**.

## The validation gate

After the canonical cell bakes green AND has been real-validated for its
cell, delegate the review to a sub-agent — see
[`QUALITY_GATE.md`](./QUALITY_GATE.md) for the full protocol. Short
version:

1. One sub-agent invocation per canonical file.
2. Use the `Explore` sub-agent type.
3. Pass the prompt from
   [`test/lib/canonical-cell-review-prompt.md`](./lib/canonical-cell-review-prompt.md)
   with `<canonical-path>` and `<intent>` filled in.
4. **Verdict GREEN** → propagate per §8.
   **Verdict YELLOW** → fix minors at the writing agent's discretion;
   propagate. The user can override at end-of-session inspection.
   **Verdict RED** → fix every critical issue, re-bake, re-validate the
   canonical against real-DB, re-invoke the sub-agent on the fixed file.
   **Do not propagate** until GREEN or YELLOW.
5. The sub-agent also produces the **EXTERNAL_CAVEATS sweep** —
   `(test_name, target_cells)` list to re-wrap mechanically in §8.

## Propagation

Once the canonical is GREEN/YELLOW, propagate via a small `cp` script (or
`cp` + Edit) following the recipe in
[`WRITING_TESTS.md`](./WRITING_TESTS.md):

1. **Identify active cells from the working tree** — never rely on a
   count this document hardcoded. Inventory drifts: new connectors land,
   old ones are retired, new `compatibilityVersion` subfolders show up.
   Recompute fresh with `--list-cells` (runner-free, deterministic, skips
   `domain/` + `types.negative/` for you):

   ```bash
   bun run tests --list-cells              # every active cell, sorted
   ```

   It honours the path filters, so you can preview exactly the set a
   scoped propagation will touch before copy-baking:

   ```bash
   bun run tests 'postgres/*/{pg,postgres}' --run-versions newest --list-cells
   ```

   The single normative count is `bun run tests:audit`'s output, which
   prints one summary line per database (`postgres: N cells, …`).

2. **Copy the canonical** to each active cell. For tests that don't apply
   to a cell (per the [Symmetry rule](./DESIGN.md#symmetry-rule) or per
   the EXTERNAL_CAVEATS sweep), prepare a `/* */` wrap with the canonical
   body preserved and a one-line reason header. **Never** replace the body
   with a stub like `// Not supported on this dialect: X is not typed.` —
   see [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body)
   and [`ANTIPATTERNS.md` § Stub as commented test](./ANTIPATTERNS.md#2-stub-as-commented-test).

3. **Bake snapshots per cell**:
   ```bash
   bun run tests '<db>/<version>/<connector>/<file>.test.ts' --update-snapshots
   ```

4. **Apply the EXTERNAL_CAVEATS re-wrap list from §4.5 / §7.** Block-comment
   the relevant tests in the affected cells with the canonical body
   preserved and the documented reason header. The current catalog
   mechanically requires:
   - Bun#29010 wrap on `bun_sql_postgres` (newest + oldest) for every test
     passing a `Date` parameter typed `localDate` / `localDateTime`.
   - Bigint wrap on `sqlite/newest/sqlite3/` for any test UPDATE-ing a
     `bigint` column.
   - uuid_str wrap on `sqlite3` + `sqlite-wasm-OO1` for any test
     projecting a `customUuid` column under the default strategy.

5. **For stub-only "not typed on this dialect" cells** (today: mariadb /
   mysql for the `Values` family, sqlite for `.oldValues()` /
   `deleteFrom(...).using(...)` / `isolationLevel(...)`): write the FULL
   canonical body inside `/* */`, not a stub. The reason header on the
   line above names the dialect limitation and links the supporting cell
   whose body is being mirrored.

6. **Audit symmetry**:
   ```bash
   bun run tests:audit
   ```
   Must pass before the round closes.

7. **Typecheck**:
   ```bash
   bun run validate:tests
   bun run validate:tests:tsc
   ```
   Both must pass. Errors often signal that the cell's connection type
   rejects an API used in the test — re-check whether the right answer is
   "this dialect doesn't support it" (block-comment with canonical body)
   or "we hit the lib bug from §4.3" (block-comment with TODO[BUG]).

## Closing the round

In order:

1. `bun run tests:audit` — symmetry, must be green.
2. `bun run validate:tests` (tsgo) — must be green.
3. `bun run validate:tests:tsc` — must be green.
4. `bun run tests` — full mock matrix end to end, must be green.
5. **Report to the user** with the new vocabulary:

   For every test the wave shipped, list its state:

   - **`real-validated en <cell>`** — the cell's bake-green pass included
     a real-DB run (SQLite native automatically; docker / WASM cells if
     the agent ran the matching `--docker` / `--wasm` flag). The cells
     the wave touched that are in this state are validated by an engine.
   - **`mock-validated only`** — the cell's snapshots pass the mock
     round-trip but no engine has run the test. Typically every cell
     other than the canonical when the agent only real-validated the
     canonical per §6.3.

   The report shape:

   ```
   Wave: <one-line summary>
   real-validated in:
     - postgres/newest/pg (docker)
     - sqlite/newest/bun_sqlite (native)
   mock-validated only (pending real-DB pass):
     - postgres/oldest/pg
     - postgres/newest/postgres
     - sqlite/newest/better-sqlite3
     - … <all other cells>
   commented out per dialect / driver caveat:
     - bun_sql_postgres newest+oldest (Bun#29010, Date parameter wrap)
     - sqlite/newest/sqlite3 (uuid_str unavailable)
     - mysql/newest/mysql2 (no RETURNING)
   ```

   This report is what tells the user which cells to expect changes in
   when they run their `bun run tests --docker --wasm` pass over the full
   matrix.

6. **Additional fields in the report**:
   - Which waves shipped, which were rejected (with grep evidence — never
     a one-line "redundant").
   - Which cells got commented-out tests for which reason (cross-reference
     `EXTERNAL_CAVEATS.md` and `BUGS.md`).
   - Which assertions ended up under `if (ctx.realDbEnabled) return` and
     what specific constraint forced them, per
     [`DESIGN.md` § Mock-only smell — Skip-real form](./DESIGN.md#skip-real-form).
     The honest answer is "none in this round" most of the time.

7. **Stop**. Do not propose the next round. The user starts the next
   round by re-running this runbook against fresh coverage data; close
   cleanly.

## Operational rules

- **Bun first**. `bun run …` always; `npm run …` only on user request.
- **Never** touch the user's `test` / `test:*` aliases in `package.json`.
  They are reserved. Canonical CLI vocabulary is `tests` / `tests:audit`
  / `tests:stop-containers` / `tests:reopen` (see
  [`CLI.md`](./CLI.md)).
- **Never** commit / push / open PRs unless the user explicitly asks. End
  the session with the changes on the working tree.
- **Never** create cells for new `compatibilityVersion`s or new
  connectors during a coverage-driven session. Those are separate,
  scheduled rounds — see [`NEW_DATABASE.md`](./NEW_DATABASE.md).
- **Never** `as any` to make TS accept an overload-rejection on a public
  API. If tempted, you're looking at a `BUGS.md` entry waiting to be
  written — see [`DESIGN.md` § The `as any` runtime-guard exception](./DESIGN.md#as-any-runtime-guard)
  and [`ANTIPATTERNS.md` § As any to bypass typer rejection](./ANTIPATTERNS.md#4-as-any-to-bypass-typer-rejection).
- **Never** silently truncate coverage. If the round is bounded
  ("top-N waves only", "newest cells only", "skip docker"), log the
  truncation when reporting back to the user.
- **Never** ship a wave whose validation sub-agent verdict was RED. Fix
  the canonical, re-bake, re-validate.
- **Test scenarios are realistic queries on the shared domain.**
  Synthetic `select a, b from T` patterns fail the validation sub-agent's
  DESIGN principle-10 check.

## Where this runbook ends

This runbook orchestrates. The authoritative sources stay authoritative:

- *How a test is written* → [`DESIGN.md`](./DESIGN.md) (rules) +
  [`WRITING_TESTS.md`](./WRITING_TESTS.md) (how-to).
- *What the lib has wrong today* → [`BUGS.md`](./BUGS.md).
- *What the lib cannot do today* → [`LIMITATIONS.md`](./LIMITATIONS.md).
- *What each connector cannot do today* →
  [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md).
- *Past failure modes + gates* → [`ANTIPATTERNS.md`](./ANTIPATTERNS.md).
- *Validation gate protocol* → [`QUALITY_GATE.md`](./QUALITY_GATE.md) +
  [`lib/canonical-cell-review-prompt.md`](./lib/canonical-cell-review-prompt.md).
- *How to run things* → [`README.md`](./README.md) (map) +
  [`CLI.md`](./CLI.md) (reference).
- *Engine / container infra* → [`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md).
- *test/lib/ reference* → [`TEST_LIB.md`](./TEST_LIB.md).

When this runbook contradicts any of those, **those are the source of
truth and this is the synthesis**.
