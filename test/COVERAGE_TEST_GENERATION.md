# `test/` — coverage-driven test generation: agent runbook

> **What this document is.** A self-contained operating manual for an
> agent (or a human) running a session of "expand the `test/` matrix
> driven by the coverage report". The user invokes it via a one-line
> prompt of the form **"read `test/COVERAGE_TEST_GENERATION.md` and
> generate the next batch of tests"**. Everything the agent needs to
> do the work — and to police itself against the same `DESIGN.md`
> failures that prior rounds shipped — lives here or behind a link
> spelled out here.
>
> **What this document is NOT.** A replacement for `DESIGN.md`,
> `MAINTAINING.md`, `BUGS.md` or `FUTURE_CONNECTORS.md`. Those are the
> authoritative sources for *how a test is written* (DESIGN), *how
> the suite is maintained* (MAINTAINING), *what the lib has wrong*
> (BUGS) and *what each connector cannot do* (FUTURE_CONNECTORS).
> This runbook orchestrates them.
>
> **Why this exists.** Previous sessions of coverage-driven test
> generation shipped recurring `DESIGN.md §1` / §4 / §18 violations
> (`if (!ctx.realDbEnabled) { exact } else { weak }`, "Not supported
> on this dialect" stubs instead of full canonical bodies, blind
> copy-paste from `pg` to `bun_sql_postgres` re-decommenting the
> `Bun#29010` workarounds, `as any` casts to bypass typecheck on
> APIs TS rejects on purpose, proposed tests for APIs that don't
> exist, etc.). Every rule below corresponds to a real failure
> mode that has happened in this repo and that the per-wave
> validation gate (§7) is built to catch *before* the canonical
> cell propagates to the other sixteen.

---

## 0. Mandatory reading — before anything else

Before reading any coverage report, the agent must hold the
following documents in working memory **in full**. Do not skim and
do not refresh-only-the-section-you-think-relevant — past sessions
that did so shipped DESIGN-violating tests on the first wave.

1. **[`CLAUDE.md`](../CLAUDE.md)** at the repo root — repo-wide
   conventions, the `tests`/`tests:audit` command vocabulary, the
   test-loop discipline (start narrow, widen on need), the
   reserved `test*` names belonging to the user.
2. **[`DESIGN.md`](./DESIGN.md)** in full — normative. Pay specific
   attention to §1 (the value assertion is unconditional; the
   mirror-image smell is just as bad as the obvious one), §3
   (anatomy + `withRollback` / `withCommit` / `withReseed`), §4
   (symmetry rule + the commented-out-body discipline) and §18
   (mock-only is a smell — restructure before guarding).
3. **[`MAINTAINING.md`](./MAINTAINING.md)** in full — operational
   counterpart of DESIGN. Pay specific attention to:
   - § *Testing a runtime guard that is also typed at compile time*
     — the **only** sanctioned use of `as any` in the suite.
   - § *Mock-only is a smell — restructure before reaching for the
     guard* (including the mirror-image-smell subsection that
     specifically prescribes JS sorting + UPDATE-in-`withRollback`).
   - § *When the canonical cell can't compile the body* — the
     full-canonical-body-in-`/* */` discipline.
   - § *Imports used only from commented-out blocks* — the
     `void identifier` trick for `noUnusedLocals`.
   - § *If a new test surfaces a bug in `src/`* — the two-minute
     triage + handoff to `BUGS.md`.
4. **[`BUGS.md`](./BUGS.md)** — every entry. A bug entry is a
   contract: it lists which tests are wrapped in `/* */`, which
   workarounds are forbidden ("don't make this 'work' by changing
   the test to use the documented workaround the lib happens to
   accept — that's exactly what hides the bug"), and what the
   final fix has to do. Coverage-driven generation routinely
   surfaces the same bug a second time and proposes a workaround;
   reading the entry first prevents that.
5. **[`LIMITATIONS.md`](./LIMITATIONS.md)** — every entry.
   These are **library limitations the project author has
   declared as such** — deliberate gaps, not bugs to fix. A
   coverage-driven proposal that tries to write a test for "the
   lib should throw `MISSING_GROUP_BY_COLUMN` when the user
   forgets one" or "the lib should detect that the deployed
   engine is too old for this SQL" is doomed: the lib has
   explicitly chosen not to do those things. Reading
   `LIMITATIONS.md` first prevents that whole class of proposals.
   When a test runs into a limitation (rather than declaring
   one new), the affected line gets `// TODO[LIMITATION]` and
   the rationale lives in the matching entry of this file.
6. **[`FUTURE_CONNECTORS.md`](./FUTURE_CONNECTORS.md)** — every
   "Dialect-specific notes" subsection. These are the caveats
   already in force on today's matrix: the `sqlite3` driver's
   BigInt-binding gap, the missing `uuid_str` on `sqlite3` /
   `sqlite-wasm-OO1`, `Bun#29010` on `bun_sql_postgres`,
   MySQL's no-RETURNING, Oracle/SqlServer/MariaDB on-conflict
   shapes, etc. A test that copies clean from the `pg` canonical
   to `bun_sql_postgres` *without* re-applying the Bun#29010
   wrappers is a regression every time, because the user catches
   it during visual inspection. The runbook's §8 makes this
   sweep mechanical, but the agent must know the catalog exists
   to apply it.

If any of these documents has changed since the last successful
round, the changes take priority over whatever this runbook
remembers; this runbook is a synthesis, not the source of truth.

---

## 0.5. Staleness safeguard — this runbook is a living document

The matrix changes over time: new connectors land, old ones get
retired, `compatibilityVersion` subfolders are added, new caveats
accumulate in `FUTURE_CONNECTORS.md`, the bug list in `BUGS.md`
shifts as the fixing agent picks entries off, the
[`coverage:for-discover-tests`](./COVERAGE.md#the-discovery-alias)
alias may grow / shrink its flag set. Any concrete number,
filename, command, anchor or cross-reference in **this** file is
a snapshot of when it was last touched; do not let it overrule
the working tree.

**Pre-flight at session start — three quick checks before reading
anything else in this runbook**:

1. **Run the audit to enumerate the matrix as it stands today**:
   ```bash
   bun run tests:audit
   ```
   The summary line per database (`postgres: N cells, M test
   files, K tests per cell`) is the authoritative count for this
   session. Wherever the runbook quotes a specific count, treat
   the runbook as illustrative and the audit output as truth.

2. **Diff this runbook's "last touched" markers against today's
   state**. Quick spot-checks that catch most drift:
   - Does the FUTURE_CONNECTORS catalog the runbook lists in
     §4.4 / §7 / §8 still match the headings under
     `FUTURE_CONNECTORS.md § "Dialect-specific notes (already
     wired in today's matrix)"`?
   - Are the open entries in `BUGS.md` the ones the runbook
     points at, or has the fixing agent picked some off and
     the workaround wrap pattern no longer applies?
   - Is the canonical path the runbook proposes (`postgres/newest/pg/`
     for most families, `sqlite/newest/bun_sqlite/` for `docs.*`)
     still where `canonicalForDocs: true` is wired?

3. **If drift is observed, fix this runbook in the same session**.
   The change is part of the work — see "Maintenance contract"
   below. Do not silently work around stale text; the next
   session inherits the same noise.

**Maintenance contract — when this runbook must be updated**:

Any change to **any** of the following requires a paired update
to this file before the change is considered done:

- The matrix shape: adding or removing a `<database>/`,
  `<version>/` or `<connector>/` cell. The runbook §4.4 sweep,
  §8 propagation list, §10 operational reminders, and any
  numeric counts must be re-walked.
- The canonical paths: changing which cell is `canonicalForDocs:
  true`, changing the dialect designated "canonical for most
  families". §6.1 of this runbook documents both — update them
  here when the choice moves.
- The discovery alias: changing
  `package.json#scripts.coverage:for-discover-tests` (formats it
  emits, scope it applies, exclusions). §2 of this runbook
  describes what the alias does — keep it true.
- The `tests` CLI: adding / renaming flags this runbook calls
  out (`--scope`, `--connections`, `--docker-scope`, etc.).
  §1 / §6 / §8 commands must be re-checked.
- `DESIGN.md`, `MAINTAINING.md`, `BUGS.md`, `LIMITATIONS.md`,
  `FUTURE_CONNECTORS.md`: anchors this runbook deep-links into
  (and there are many) move when those files are refactored.
  Whoever moves them must search this runbook for the link
  and update it.

When the maintenance contract isn't honoured, the runbook
silently rots. The §0.5 pre-flight is the cheap remediation; the
contract is the discipline that prevents the rot from spreading
faster than the pre-flight can catch.

---

## 1. The loop, end to end

One session of coverage-driven test generation runs this sequence
exactly once. Each step has a dedicated section below; this is
the index.

```
   §2  Discover         coverage report → list of in-scope src/ files
   §3  Discount sesgos  istanbul-shape biases to filter out
   §4  Pre-flight       grep src/ + tests + BUGS + LIMITATIONS +
                        FUTURE_CONNECTORS
   §5  Propose          generous wave list with explicit justification
       ─ user OK ─
   §6  Execute          write canonical cell only (postgres/newest/pg
                        for most families; sqlite/newest/bun_sqlite
                        for docs.*)
   §7  Validate         delegate review of the canonical to a
                        validation sub-agent BEFORE propagating
       ─ fix or accept ─
   §8  Propagate        cp to every valid cell, re-bake per cell,
                        re-apply per-connector caveats from
                        FUTURE_CONNECTORS.md
   §9  Close            tests:audit + validate:tests +
                        validate:tests:tsc + full mock run
```

Step §7 is the gate the previous rounds were missing. Skipping it
ships DESIGN-violating tests to every cell of the matrix, which
the user catches during visual inspection. The cost of running it
is one sub-agent invocation per canonical file; the cost of
shipping is hours of cleanup the next session.

---

## 2. Discovery

The user runs `bun run coverage:for-discover-tests` **before** the
session so the agent doesn't burn time on it. The alias produces
`.test-report/coverage/coverage-summary.json` and
`coverage-final.json` in istanbul JSON format, scoped to
`--scope newest` (older `<db>/<version>/` cells skipped — those
re-emit the same SQL as `newest` for symmetric changes) and
excluding `src/queryRunners/**` (docker-backed driver
implementations; their `.catch(...)` arms are the dominant
uncov, and they require docker to exercise).

The agent reads both files and surfaces the in-scope `src/` files
sorted by `lines%` ascending. Files in `src/internal/` and
`src/utils/` appear in coverage but **are not** part of the
public surface (`package.json` `exports` does not enumerate them
outside the `__UNSUPPORTED__/*` escape hatch). Tests must never
import from there; their coverage is whatever happens to flow
through the public surface, no more.

---

## 3. Discount the coverage sesgos

`coverage-summary.json`'s `lines%` is the rawest signal. Several
artefacts of the istanbul format inflate the uncov count without
representing real gaps. Filter them out before proposing waves —
otherwise the proposal will be ~60% redundant on grep, which is
exactly what happened in the round before this runbook existed.

| Sesgo | Where it shows up | How to recognise it | How to discount it |
|---|---|---|---|
| **TypeScript overload signature duplication** | `Table.ts`, `View.ts`, `Values.ts`, `AbstractConnection.column*`, every `virtualColumnFromFragment*` | `fnMap` entries whose `loc` covers <2 lines and whose `name` is one of `column`/`optionalColumn`/`autogeneratedPrimaryKey`/etc. The impl runs; the 20 overload signatures above it count as 20 uncov functions. | Treat `fnMap` entries whose `loc.start.line` equals `loc.end.line` as type-level and not coverable. Look at the actual `if/else` branches of the impl to see what's reachable. |
| **`ValueSourceImpl` wrapper-hook explosion** | `src/internal/ValueSourceImpl.ts` (52% branches, 64% lines) | ~80 wrapper classes × ~6 propagation hooks (`__addWiths`, `__registerTableOrView`, `__registerRequiredColumn`, `__getOldValues`, `__getValuesForInsert`, `__isAllowed`). The hooks fire only in specific contexts: CTEs, `oldValues()`, `valuesForInsert()`, `allowWhen(false)`. | Measure coverage **per wrapper class** (≥1 hook hit = class exercised), not per hook aggregated. Most of the apparent gap is the SAME class missing 5 of 6 hooks in the same execution context. |
| **`.catch(e => throw)` arms** | every `executeSelect*`/`executeInsert*`/`executeUpdate*`/`executeDelete*` | uncov line is exactly the `throw new TsSqlQueryExecutionError(source, …)` inside a `.catch((e) => …)` wrapping a driver promise. | Driver-rejection paths require docker; coverage runs mock-only. **Never** propose a test for these. The driver-error catch arms get exercised by the user's separate docker validation pass. |
| **Anonymous `.then` / `.map` closures uncov** | every query builder when the happy path took a shortcut | `fnMap` entry `name: "anonymous_NN"` with a small `loc` near a `.then`/`.map`/`.catch` | Closure isn't separately reachable from public API; either the call sequence happens to short-circuit before it or it's a `.catch` arm. Discount as above. |
| **`lines% − branches% > 10`** | mixed `??`, `?.`, `&&`, default-arg evaluation | The number under `branches.pct` is much lower than `lines.pct` | Branch coverage is the honest signal for branchy code. Whenever the gap is double-digit, look at the `branchMap` for that file to see which short-circuit operands stayed evaluated to the same side. Those branches usually need an input that flips a `null` to a value (or vice versa) somewhere in the call chain. |

After applying these filters, the in-scope file list often shrinks
to 6-12 files with material uncov, not the 30+ the raw `lines%`
sort suggests.

---

## 4. Pre-proposal pre-flight

For every file that survives §3, run **four** grep passes before
proposing a wave. Each one has caught a separate class of failure
in previous rounds.

### 4.1 Verify the API actually exists in `src/`

```bash
grep -rn "<api-symbol>\b" src/ | head -10
```

If `grep` returns nothing, the API is a hallucination. Don't propose
a test for a symbol that doesn't exist — propose a follow-up to
discuss with the user whether the documented behaviour is
implemented elsewhere or whether the docs are stale. Past
example: `aggregateAsObject` did not exist; the only API in the
neighbourhood was `aggregateAsArray`. Whole proposed wave dropped.

### 4.2 Verify the existing test inventory

For each candidate API and connector, list every test file that
already references it:

```bash
grep -rln "<api-symbol>" test/db/postgres/newest/pg/ | head
grep -rln "<api-symbol>" test/db/sqlite/newest/bun_sqlite/ | head
```

If matches exist, **read those tests in full** (not just the test
names). The previous round proposed wave after wave whose
"missing" coverage was in fact exhaustively covered already —
`delete.execute-variants.test.ts` already pins `MINIMUM_ROWS_NOT_REACHED`,
`select.one-column-and-count.test.ts` already pins `NO_RESULT`,
`dynamic-condition.operators.test.ts` already pins 12 operator
variants, `errors.transaction-attachments.test.ts` already pins
`attachTransactionSource` + `attachTransactionError` +
`attachAdditionalError`. Read first, propose second.

If the existing test covers the API but the asserted *value* is
weak (e.g. `expect(rows.length).toBe(2)` instead of
`expect(rows).toEqual([{…}, {…}])`), the wave is not "add a test"
but "strengthen the existing test". Frame it that way in the
proposal so the user can decide whether to spend the round on
strengthening vs. breadth.

### 4.3 Check `BUGS.md` for prior characterizations

If the wave touches an API that already has a `BUGS.md` entry,
that entry **dictates** how the wave is written:

- If the bug is "TS rejects an API the lib is supposed to support",
  the test stays block-commented with the canonical bare body —
  see §6 below. Workarounds (interpolating an irrelevant column to
  satisfy the typer, casting through `as any`) are explicitly
  forbidden by the entry; they hide the bug from the very test
  that surfaced it.
- If the bug is "the lib emits SQL the engine rejects", the test
  is mock-only with a comment naming the engine + the SQL the
  test pins, exactly per `MAINTAINING.md` § Mock-only is a smell.

If the wave **finds** a new bug, the test author writes the
`BUGS.md` entry per `MAINTAINING.md` § *If a new test surfaces a
bug in src/* (two-minute triage; no diagnosis; no fix), wraps
the test in `/* */` with `// TODO[BUG] see test/BUGS.md` on the
line above, and continues with the next test. The fixing agent
takes the entry from there.

### 4.4 Check `LIMITATIONS.md` for declared library gaps

A coverage gap inside a `src/` branch may exist because the lib
**deliberately chose not to support** that path. `LIMITATIONS.md`
catalogues those:

- The lib does not enforce GROUP BY column rules even on strict
  engines (the engine errors out at runtime; that error surfaces
  verbatim).
- The lib does not type-flag aggregate functions, so `expression
  + connection.count(...)` compiles when it shouldn't.
- The lib does not detect deployed-engine version mismatches and
  does not throw pre-emptively when emitting SQL the deployed
  server will reject — `compatibilityVersion` switches between
  valid forms of the same SQL, not between version-gate
  exceptions. **A test that asserts a `MISSING_GROUP_BY_COLUMN`
  or "deployed engine too old" error coming from the library
  is wrong** — the error comes from the engine, only under real
  DB, and only when the configuration mismatches.
- `pglite` does not bundle the latest PostgreSQL; newest dialect
  features will fail there.
- MariaDB's UPDATE … RETURNING requires 13.0.1+ but
  `mariadb:latest` still ships 12.x.
- Window functions are not exposed through the fluent API today.
- Query introspection (`__isAllowed`) has no public API; tests
  reach internals via a single helper.

A wave proposal that assumes one of the above is a wrong wave.
Cross-check before proposing.

### 4.5 Check `FUTURE_CONNECTORS.md` for per-connector caveats

Every wave that adds tests propagating across the matrix must
sweep `FUTURE_CONNECTORS.md` first and produce a list of
`(test_name, cell)` pairs that need post-propagation re-wrapping.
The catalog as of writing includes:

- `sqlite/newest/sqlite3/` — no `BigInt` parameter binding (NOT
  NULL violation on `view_count`), no `uuid_str` function. Any
  UPDATE that sends a `bigint` value, any SELECT that projects
  `'customUuid'` columns under the default strategy, must be
  re-wrapped here.
- `sqlite/newest/sqlite-wasm-OO1/` — no `uuid_str`. Same wrap as
  above for uuid-projecting tests.
- `postgres/newest/bun_sql_postgres/` and
  `postgres/oldest/bun_sql_postgres/` — Bun#29010 (every `Date`
  parameter for `localDate` / `localDateTime` is mis-serialised).
  Any test whose params include a `new Date(...)` for those types
  must be re-wrapped here with the canonical Bun#29010 reason
  header (verbatim from existing tests).
- MySQL — no RETURNING. Any new `.returning(...)` / `.returningOneColumn(...)`
  test wraps in `mysql/newest/mysql2/`.
- Oracle — no `ON CONFLICT`; one of `level` OR `accessMode` on
  `isolationLevel(...)`, not both.
- SQL Server — no `ON CONFLICT`; `isolationLevel(level)` only,
  no access mode.

The sweep is a single grep against the post-bake canonical:

```bash
# Did this wave's canonical pass `Date` / `bigint` / `customUuid` /
# `.returning(` / `onConflict` / `isolationLevel(.*,` to any
# API path likely to trip the catalog above?
grep -nE "new Date\(|n[^a-zA-Z0-9]|customUuid|\.returning\(|onConflict|isolationLevel\(" test/db/postgres/newest/pg/<new-file>.test.ts
```

The list this produces is what §8 re-wraps after propagation.

---

## 5. Proposing waves

Generous batches. The user runs the full validation matrix
(`bun run tests --docker --wasm`) once per round, ~7 minutes
including warm container reuse; concentrate as much work as
possible into one round so the validation cost amortises.

**Each wave entry must answer**:

1. **What public API does it cover?** (Symbol-level, not file-level.)
2. **What concrete uncov lines does the proposal target?** (After
   discounting the sesgos in §3.)
3. **Why isn't it redundant?** Cite the existing tests grep
   surfaced in §4.2 and explain what semantically new shape the
   proposal adds.
4. **Which cells does it touch?** Cells where the API is supported
   (full body) + cells where it isn't (commented-out body with
   the full canonical preserved inside `/* */`, per §6/§8).
5. **Does it surface a known caveat?** Cross-reference the FUTURE_CONNECTORS
   list from §4.4.

**Each wave entry should disclose its risks**:

- "Mocks-only is currently green; docker may reveal X" is honest.
- "Real-DB behaviour for SqlServer's JSON aggregate wrap of
  `bigint` (`convert(nvarchar, …)`) may diverge from this
  snapshot" is the kind of disclosure that lets the user know
  what to expect during the validation pass.

Honest reporting beats wave count. **A wave the user has to
reject after grep-checking is worse than no wave at all**; it
burns the user's review budget on noise.

---

## 6. Executing one wave — canonical cell only

The canonical cell is **one** file. Get that file right before
copying it anywhere else.

### 6.1 Default canonical paths

- `postgres/newest/pg/` for most families: `select.*`, `insert.*`,
  `update.*`, `delete.*`, `errors.*`, `transaction.*`,
  `fragments.*`, `raw-fragment.*`, `with-values.*`,
  `customize-query.*`, `dynamic-condition.*`.
- `sqlite/newest/bun_sqlite/` for `docs.*` files — the
  `canonicalForDocs: true` cell.
- The cell that owns the dialect-specific behaviour for tests
  that only run on one dialect: `postgres/newest/pg/` for
  `select.postgres-const-force-type-cast.test.ts`,
  `sqlite/newest/bun_sqlite/` for `config.datetime-formats.test.ts`,
  `sqlserver/newest/mssql/` for SqlServer-only assertions on
  `SqlServerSqlBuilder` JSON emission, etc.

PostgreSQL is the **superset** dialect (sequences, RETURNING,
LATERAL, ON CONFLICT, JSON, MERGE on newer versions, etc.).
Writing the canonical there first means the test exercises the
fullest surface the lib supports; porting *down* to sqlite or
sqlserver later is one pass of comment-outs for not-applicable
features, not a re-write from a smaller starting point.

### 6.2 Inviolable rules while writing the canonical

The validation gate in §7 enforces every one of these. The list
is **the** signal of past round failures.

1. **DESIGN §1**: every `expect(...).toEqual(...)` runs
   unconditionally. No `if (!ctx.realDbEnabled) { exact } else
   { weak }`. No `if (ctx.realDbEnabled) return`. The mirror-image
   smell is the same smell.

2. **DESIGN §1 + MAINTAINING § Mock-only is a smell**: when the
   real-DB result would diverge from a strong mock, apply the
   cheapest deterministic fix and keep the assertion
   unconditional:
   - `ORDER BY` on the projected key — **only when the test's
     premise allows it**. Some tests deliberately omit `ORDER BY`
     to assert exactly what the lib emits without one (default
     ordering, dialect tie-breaking, presence/absence of a
     synthesised `ORDER BY` from a hook); adding a gratuitous
     one defeats the test's purpose.
   - **Sort in JS** the dimension the engine doesn't guarantee
     order on (JSON aggregate inner array is the canonical
     example: `rows.map(r => ({ ...r, items: [...r.items].sort(cmp) }))`).
     Also the right fix when the test deliberately avoids
     SQL-level `ORDER BY` per the above.
   - **UPDATE inside `ctx.withRollback`** when the seed default
     trivialises the assertion (`view_count` defaults to `0n` on
     every issue; the aggregate is `[0n, 0n]` for project 1 with
     no UPDATEs; that's not a test). Pattern in MAINTAINING §
     mirror-image smell.
   - `expect(ctx.lastSql)` still captures the SELECT because the
     UPDATEs run before it; the rollback reverts schema for the
     next test.

3. **DESIGN §1.3 + MAINTAINING § Testing a runtime guard**: if
   TypeScript rejects the call, the API IS NOT AVAILABLE on
   that connection. Read this twice:
   - `as any` to "make TS shut up so the test compiles" is
     explicitly forbidden. The runtime-guard sub-section of
     MAINTAINING is the **only** sanctioned use, and that
     sub-section pin-points which `as any` casts (cast the
     narrowest edge of the fluent chain, never the whole chain).
   - The lib bug `BUGS.md` § *virtualColumnFromFragment + bare-
     literal fragment fails TS overload resolution* is a real
     example: the canonical form is `fragment.sql\`'open'\``;
     the workaround "interpolate `${this.someColumn}`" makes
     TS accept the call, **but the workaround hides the bug**.
     Tests for this surface block-comment the bare-literal
     canonical with `// TODO[BUG] see test/BUGS.md` and stay
     dormant until the lib types are fixed.

4. **DESIGN §3 + lib/testContext**: side-effecting tests open a
   `ctx.withRollback(async () => { … })` block. Tests that need
   their effects to commit use `ctx.withCommit`. Tests that
   manage their own `connection.transaction(...)` block use
   `ctx.withReseed`. Don't open a raw transaction without one
   of these wrappers — the schema state leaks to the next test
   in the worker.

5. **DESIGN §4 + MAINTAINING § When the canonical cell can't
   compile the body**: if even the canonical can't compile the
   body (the feature is only typed on other dialects), write
   the test directly into the canonical as a comment-out block
   with the canonical body preserved, then mirror to every other
   cell. Add `void identifier` to satisfy `noUnusedLocals` for
   imports referenced only inside the block.

6. **DESIGN §10 + library docs**: test scenarios must read like
   real product code on the shared "project management" domain
   (`organization` / `app_user` / `project` / `issue`). No
   `select a, b from T` synthetic queries. If the realistic
   scenario requires extending the shared domain, the wave's
   scope grows to "extend the domain in lockstep across all
   `test/db/<db>/domain/{connection.ts,schema.sql,seed.sql}`"
   — call that out in the proposal in §5 so the user can decide
   whether to accept the cost.

7. **No comments narrating what well-named identifiers already
   say.** `// We update issue 1 then issue 2 then we select`
   adds nothing. The test's `// …` should explain *why* — the
   constraint that forced a withRollback wrapper, the dialect
   that produces the divergent snapshot, the cross-reference
   to a BUGS entry, the seed value the assertion relies on.

8. **Snapshots are `toMatchInlineSnapshot()` with no argument
   when freshly written**, and get baked by
   `bun run tests <path> -- --update-snapshots`. Never type
   the snapshot by hand; the bake either confirms your guess
   or rewrites it, and either way the diff against the prior
   state is what the next reader sees.

### 6.3 Baking the canonical

Iterate locally:

```bash
bun run tests <canonical-path> -- --update-snapshots
```

Bun's test runner is fast (sub-second for one file). Read the
diff of every test you added before moving on. The user will
read it too; submitting un-reviewed bakes is how the previous
round shipped weaknesses like `expect(rows.length).toBeGreaterThan(0)`
and `assertType<Exact<{...; externalRef: string | undefined; ...}>>>`
both at once.

---

## 7. The validation gate — sub-agent review BEFORE propagation

Before copying the canonical to the other cells, delegate a
focused review to a sub-agent. The point is to surface DESIGN /
MAINTAINING violations that the writing agent missed in its own
work — past sessions consistently caught violations of their own
on visual inspection from the *user*, after fixing them across
every cell of the matrix was already a sunk cost. Catching them
once, on one file, is the entire economic case for this step.

### 7.1 When to invoke

After the canonical cell bakes green and before any propagation
script runs. One sub-agent invocation per canonical file. If a
single wave touches multiple canonical files (e.g. one
`select.*.test.ts` and one `errors.*.test.ts`), invoke the
sub-agent once per file.

### 7.2 The invocation

Use the `Explore` sub-agent type. Hand it the canonical path,
the wave's intent, and the checklist below. Ask for a short,
prioritised report.

```
Agent({
  description: "Validate canonical wave X against DESIGN",
  subagent_type: "Explore",
  prompt: `
Review this freshly-baked canonical test file against the project's
DESIGN.md and MAINTAINING.md before it propagates to the rest of the
matrix. This is a quality gate: the user reads every diff at the
end of the session, and DESIGN-violating tests that ship to every
cell of the matrix cost the next session disproportionately to
clean up.

Path: <test/db/postgres/newest/pg/<file>.test.ts>
Intent of the wave: <one-sentence summary of which uncov src/ branches
                    the wave targets>

Read these in full before reviewing:
  - test/DESIGN.md §1, §3, §4, §18
  - test/MAINTAINING.md § "Testing a runtime guard that is also typed
    at compile time", § "Mock-only is a smell — restructure before
    reaching for the guard" (including the mirror-image smell
    subsection), § "When the canonical cell can't compile the body"
  - test/BUGS.md (every entry — the test may be wrapped against an
    existing bug, or may have surfaced a new one)
  - test/LIMITATIONS.md (every entry — the test may be assuming
    behaviour the lib has explicitly chosen not to support, e.g.
    pre-emptive enforcement of GROUP BY column requirements or
    engine-version feature gating)
  - test/FUTURE_CONNECTORS.md (every "Dialect-specific notes"
    subsection — the canonical's snapshot or test body may need to
    be re-wrapped on certain cells when propagated)

Then read the file. For every test() block in it, check:

  1. DESIGN §1: Is every expect(result).toEqual(...) unconditional?
     - Flag any "if (!ctx.realDbEnabled) { ... } else { ... }"
       patterns, especially the form where the mock branch is
       expect.toEqual(exact) and the real-DB branch is
       expect.length.toBe(N) / .toBeGreaterThan(0) /
       Array.isArray(...). That is the mirror-image smell that
       SHOULD have been fixed by JS sorting or
       UPDATE-in-withRollback (see MAINTAINING § Mock-only is a
       smell).
     - Flag any "if (ctx.realDbEnabled) return" without a
       documented constraint.

  2. DESIGN §1.3 / MAINTAINING § Testing a runtime guard:
     - Flag every "as any" cast in the file. Verify each one is at
       the narrowest possible spot of a fluent chain AND that the
       test is dedicated to reaching a runtime guard the typer
       blocks on purpose. Whole-chain casts, casts to satisfy
       generic inference, or casts to silence a TS overload
       rejection on a feature that should be supported — all
       fail this check. The latter category usually means a
       BUGS.md entry should be opened and the test block-
       commented with the canonical bare-literal body.

  3. DESIGN §3 + lib/testContext:
     - Side-effecting tests (UPDATEs / INSERTs / DELETEs outside
       a transaction the test body itself manages) must be inside
       ctx.withRollback / ctx.withCommit / ctx.withReseed. Flag
       raw mutations without a wrapper.

  4. DESIGN §4 + MAINTAINING § When the canonical can't compile:
     - If the test body is inside a /* */ block (canonical
       can't host it), the body must be the FULL canonical the
       supporting dialect would run — not a stub like
       "// Not supported on this dialect: X is not typed".
       Flag stub-style bodies.
     - The line above /* */ must name a specific reason.
       Generic "Not applicable" without identifying the
       dialect, the engine, the driver or the BUGS.md entry is
       not enough.

  5. DESIGN §10 + library docs:
     - Test scenarios should read like real product code on the
       shared project-management domain. Flag synthetic queries
       (select a, b from T-style; throwaway values like 'x', 1,
       2, 3 outside seed-aware contexts).

  6. BUGS.md cross-check:
     - If any test() uses an API that has a BUGS.md entry, the
       test must follow that entry's prescribed shape (block-
       commented with TODO[BUG] for the typing-rejected case;
       mock-only with a documented constraint for the
       engine-rejected case). Flag deviations.
     - If the file appears to have surfaced a NEW bug, flag it
       — the test author should open the BUGS.md entry and wrap
       the test before propagation.

  7. LIMITATIONS.md cross-check:
     - Flag any assertion that assumes the library will
       pre-emptively detect / enforce / throw for something
       LIMITATIONS.md says it does not. Most common shape:
       "the lib should throw before the engine does" — the
       engine throws, the lib propagates verbatim, and that's
       intentional. The test's expected error must be the
       engine's error (which only appears under real DB), not
       a lib-side guard reason.
     - When a test deliberately depends on a documented
       limitation (e.g. the GROUP-BY laxness), the assertion
       gets `// TODO[LIMITATION]` and links the entry.

  8. FUTURE_CONNECTORS.md sweep — list which propagation targets
     will need post-copy re-wrapping. Concretely:
     - new Date(...) params → bun_sql_postgres newest/oldest
       (Bun#29010).
     - bigint values in UPDATE / mockNext / set({...:Nn}) →
       sqlite3 cell (NOT NULL violation).
     - customUuid columns projected / aggregated → sqlite3 and
       sqlite-wasm-OO1 (no uuid_str function).
     - .returning(...) / .returningOneColumn(...) → mysql cell.
     - onConflict family → oracle / sqlserver cells.
     - isolationLevel(level, accessMode) → oracle / sqlserver
       cells.
     - tTable.oldValues() / deleteFrom(...).using(...) /
       connection.isolationLevel(...) on sqlite cells.
     Report a (test_name, target_cells) list the propagation
     script can re-wrap mechanically.

  9. Connector-default symmetry:
     - The canonical's value assertion uses the form
       expect(rows).toEqual([...]) with concrete expected values.
       Per-cell propagation MUST keep the same shape; the
       reviewer should sanity-check the expected values are
       achievable across every active cell after the per-
       connector wraps in (7) — i.e. the cells that remain
       active actually return the asserted value, not a
       dialect-truncated subset.

Report format — please use this exact shape:

  Verdict: { GREEN | YELLOW: minor | RED: blockers }
  Critical issues (must fix before propagation):
    - <test_name>: <one-line description> [DESIGN §X / MAINTAINING § Y]
  Minor issues (worth addressing if cheap):
    - <test_name>: <one-line description>
  FUTURE_CONNECTORS sweep — re-wrap on propagation:
    - <test_name> on <cell>: <reason from FUTURE_CONNECTORS>
  BUGS.md cross-references:
    - <test_name> uses <api>; existing entry "<title>" applies / new entry needed for <symptom>.

Keep the report under 400 words. The point is to catch failures,
not produce a treatise.
`,
})
```

### 7.3 What the writing agent does with the report

- **GREEN**: propagate per §8.
- **YELLOW**: fix the minors at the writing agent's discretion;
  the user can override either way at end-of-session inspection.
- **RED**: fix every critical issue, re-bake the canonical,
  re-invoke the validation sub-agent on the fixed file. **Do not
  propagate until the verdict is GREEN or YELLOW with intent to
  accept**.

The validation sub-agent is independent: it has no incentive to
defend the writing agent's choices, and the prompt deliberately
asks it to read DESIGN/MAINTAINING/BUGS/FUTURE_CONNECTORS itself
rather than trust a summary. Use this independence. If the
sub-agent flags an issue the writing agent disagrees with,
explain *to the user* in the wrap-up — not to the sub-agent —
why the original choice stands.

---

## 8. Propagation

Once the canonical is GREEN/YELLOW, propagate via a small Python
script (or `cp` + Edit) following the recipe in `MAINTAINING.md`:

1. **Identify active cells from the working tree** — never rely
   on a count this document hardcoded. Inventory drifts: new
   connectors land, old ones are retired, new `compatibilityVersion`
   subfolders show up. Recompute fresh at the start of every
   round (and certainly before propagation):

   ```bash
   for db in test/db/*/; do
       for v in "$db"*/; do
           [ "$(basename "$v")" = "domain" ]          && continue
           [ "$(basename "$v")" = "types.negative" ]  && continue
           for c in "$v"*/; do
               [ -d "$c" ] && printf '%s\n' "$c"
           done
       done
   done | sort
   ```

   That listing is your propagation target set. The single
   normative count is `bun run tests:audit`'s output, which prints
   one summary line per database (`postgres: N cells, …`).
   Anywhere this document quotes a specific number of cells, treat
   it as illustration of a past snapshot — read the live tree.

2. **Copy the canonical** to each active cell. For tests that
   don't apply to a cell (per DESIGN §4 or per the
   FUTURE_CONNECTORS sweep from §4.4 / §7), prepare a `/* */`
   wrap with the canonical body preserved inside and a one-line
   reason header above. **Never** replace the body with a stub
   like `// Not supported on this dialect: X is not typed.` — the
   commented body must read like the canonical so the future
   uncomment + re-bake is mechanical.

3. **Bake snapshots per cell**:
   ```bash
   bun run tests '<db>/<version>/<connector>/<file>.test.ts' -- --update-snapshots
   ```
   Each dialect emits its own SQL; the snapshots diverge but the
   bodies stay identical.

4. **Apply the FUTURE_CONNECTORS re-wrap list from §4.4 / §7.2.**
   Block-comment the relevant tests in the affected cells with
   the canonical body preserved and the documented reason header.
   The current catalog mechanically requires:
   - Bun#29010 wrap on `bun_sql_postgres` (newest + oldest) for
     every test passing a `Date` parameter typed `localDate` /
     `localDateTime`.
   - Bigint wrap on `sqlite/newest/sqlite3/` for any test
     UPDATE-ing a `bigint` column.
   - uuid_str wrap on `sqlite3` + `sqlite-wasm-OO1` for any test
     projecting a `customUuid` column under the default strategy.

5. **For stub-only "not typed on this dialect" cells** (today:
   mariadb / mysql for the `Values` family, sqlite for
   `.oldValues()` / `deleteFrom(...).using(...)` / `isolationLevel(...)`):
   write the FULL canonical body inside `/* */`, not a stub. The
   reason header on the line above names the dialect limitation
   and links the supporting cell whose body is being mirrored.

6. **Audit symmetry**:
   ```bash
   bun run tests:audit
   ```
   Must pass before the round closes. The audit walks `/* */`
   blocks too, so commented tests still count toward symmetry.

7. **Typecheck**:
   ```bash
   bun run validate:tests
   bun run validate:tests:tsc
   ```
   Both must pass. `tsgo` is the inner loop; `tsc` is the
   authoritative check before pushing. Errors here often signal
   that the cell's connection type rejects an API used in the
   test — re-check whether the right answer is "this dialect
   doesn't support it" (block-comment with canonical body) or
   "we hit the lib bug from §4.3 (`BUGS.md`)" (block-comment
   with TODO[BUG]).

---

## 9. Closing the round

In order:

1. `bun run tests:audit` — symmetry, must be green.
2. `bun run validate:tests` (tsgo) — must be green.
3. `bun run validate:tests:tsc` — must be green.
4. `bun run tests` — full mock matrix end to end, must be green.
5. **Report to the user**:
   - Which waves shipped, which were rejected (with grep
     evidence — never a one-line "redundant").
   - Which cells got commented-out tests for which reason
     (cross-reference FUTURE_CONNECTORS and BUGS).
   - Which assertions ended up under `if (ctx.realDbEnabled) return`
     and what specific constraint forced them (per `MAINTAINING.md`
     § Mock-only is a smell § 3). The honest answer is "none in
     this round" most of the time.
   - Caveats for the user's docker matrix run — what dialects
     might surface a divergent snapshot, what cells were
     deliberately taken off the docker path (e.g. sqlite3
     bigint), what the docker pass should verify that mock-only
     can't.
6. **Stop**. Do not propose the next round. The user starts the
   next round by re-running this runbook against fresh coverage
   data, and the next session may be days away — close cleanly.

---

## 10. Operational rules (one-line each, for the agent to skim)

- **Bun first**. `bun run …` always; `npm run …` only on user request.
- **Never** touch the user's `test` / `test:*` aliases in
  `package.json`. They are reserved. Canonical CLI vocabulary
  is `tests` / `tests:audit` / `tests:stop-containers` / `tests:reopen`.
- **Never** commit / push / open PRs unless the user explicitly
  asks. End the session with the changes on the working tree.
- **Never** create cells for new `compatibilityVersion`s or new
  connectors during a coverage-driven session. Those are
  separate, scheduled rounds — the user calls them out
  explicitly when they're on the agenda.
- **Never** `as any` to make TS accept an overload-rejection on
  a public API. If you're tempted, you're looking at a `BUGS.md`
  entry waiting to be written — see §4.3 + §6.2 rule 3.
- **Never** silently truncate coverage. If the round is bounded
  ("top-N waves only", "newest cells only", "skip docker"), log
  the truncation when reporting back to the user — it reads as
  "covered everything" otherwise.
- **Never** ship a wave whose validation sub-agent verdict was
  RED. Fix the canonical, re-bake, re-validate.
- **Test scenarios are realistic queries on the shared domain**.
  Synthetic `select a, b from T` patterns fail the validation
  sub-agent's DESIGN §10 check.

---

## 11. Where this runbook ends and the rest of the project begins

This runbook orchestrates. The authoritative sources stay
authoritative:

- *How a test is written* → [`DESIGN.md`](./DESIGN.md).
- *How the suite is maintained* → [`MAINTAINING.md`](./MAINTAINING.md).
- *What the lib has wrong today* → [`BUGS.md`](./BUGS.md).
- *What each connector cannot do today* →
  [`FUTURE_CONNECTORS.md`](./FUTURE_CONNECTORS.md).
- *What the lib cannot do today* →
  [`LIMITATIONS.md`](./LIMITATIONS.md).
- *How to run things* → [`README.md`](./README.md).
- *Coverage flags and report layout* → [`COVERAGE.md`](./COVERAGE.md).
- *Docker, mutation safety, parallel* → [`CONTAINERS.md`](./CONTAINERS.md).

When this runbook contradicts any of those (it shouldn't, but
documents drift), **those are the source of truth and this is
the synthesis**. The agent reads them all per §0 and uses the
runbook as the orchestration layer, not as an excuse to skip
reading them.
