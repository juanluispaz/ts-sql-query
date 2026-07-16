# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## Read this file in full — this section is the one to internalise

Whether you're **documenting** a new bug or **picking up an entry to
fix**, read every section of this file (every open entry below, the
"How to write an entry" recipe, the bug-shape presets at the bottom).
None is optional. This section in particular is the one prior sessions
skipped — internalise it before any `grep` or `Read` over `src/`:

1. **Read [`CODE_SEARCH.md`](./CODE_SEARCH.md) in full** once at session
   start (the doors, the sections, the presets, the cross-cutting reading
   conventions — all of it is operational). Pay special attention to
   [§ "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search):
   it defines when `tests:where-is` answers the question (symbol
   declarations, overload sites, type-arg blast radius, call-chain,
   neg-types, cell caveats) and when `grep` / the compiler still win
   (literal prose, byte-anchored edits, assignability decisions).
2. **Refresh the index**: `npm run tests:index` (~2 min, ~12 GB peak, gitignored).
3. **Treat the entry's `Where:` / `Reproduction:` lines as starting
   points, not ground truth.** The test author wrote them from what
   they saw; the searcher gives you every declaration site, every
   implementing class, every test that exercises the API, every
   first-class reason marker that names the symbol (`// TODO[BUG]`,
   `// TODO[LIMITATION]`, `// NOT-APPLICABLE`), and the wrap shape
   across cells — in one report.

   Recent miss: an entry on `virtualColumnFromFragment` named
   `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`.
   A fix that grepped only the two listed files would have left
   `Table.ts` regressed. `--declared full` lists all three.

The presets for the two main bug shapes live in
[§ "Common bug shapes"](#common-bug-shapes-for-the-fixing-agent) below
(read them, even if your bug is "obvious"); the searcher-first triage
flow for test authors lives in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## How to write an entry (test author)

Keep it short — enough to reproduce, no deeper. The fixing agent
takes it from there. Recommended structure:

```markdown
## <One-line title naming the symptom>

**Where**: file + line, or class/method, or docs page reference.
**Reproduction**: the test that surfaces it, the SQL the lib emits
(if applicable), the runtime/type error observed.
**Current workaround in the suite**: which tests are wrapped /
marked, and with what reason line.
```

That's the contract. Do **not** spend time diagnosing the root cause,
choosing a category, or proposing a fix — the fixing agent owns all
of that. Two minutes of triage and one paragraph is the bar.

## Open Bugs

All three below were surfaced by running the `--docker` matrix. Each was
introduced mock-baked and had never been real-validated, so each has been
red since the test that covers it landed — none is a regression.

## MySQL: `cbrt()` loses precision because the emulation divides in DECIMAL

**Where**: `AbstractSqlBuilder._cbrt` (~line 3016), the shared base used by
MySQL / MariaDB / SQLite / Oracle.

**Reproduction**: the emission is
`sign(x) * power(abs(x), 1.0 / 3.0)`. MySQL evaluates `1.0 / 3.0` as DECIMAL
division and truncates it to the scale set by `div_precision_increment`
(default 4) → `0.33333`, so the exponent loses ~11 digits:

```
mysql> SELECT 1.0/3.0, power(8, 1.0/3.0), power(8, 1.0e0/3.0e0);
+---------+---------------------+-----------------------+
| 0.33333 | 1.999986137104434   | 2                     |
```

`cbrt(8)` therefore returns `1.999986137104434` instead of `2`. A float
divisor (`1.0e0 / 3.0e0`) yields exactly `2`.

MariaDB emits the same SQL but its `POWER` returns exactly `2`, which is why
only the mysql cell fails — MariaDB masks the defect rather than avoiding it.
Note the SQL Server override at `SqlServerSqlBuilder._cbrt` (~1043) carries the
same `1.0 / 3.0` literal.

**Current workaround in the suite**:
`mysql/newest/mysql2/select.numeric-ops.test.ts`, test
`optional-double-receiver-unary-f1-fan-out` — the `cb` assertion pins the wrong
value the engine returns today under a `// TODO[BUG]`.

## Oracle: an inline scalar subquery keeps its `ORDER BY`, which Oracle rejects

**Where**: the `forUseAsInlineQueryValue()` emission path (the inline-scalar
branch, as opposed to the aggregated-array branch).

**Reproduction**: a one-column select carrying `orderBy` consumed via
`.forUseAsInlineQueryValue()` renders as
`(select ... from t window w1 as (...) order by "result")` in the SELECT list.
Oracle rejects it with **ORA-00907: missing right parenthesis**.

Probed directly against `gvenzl/oracle-free:23-slim-faststart` — the WINDOW
clause is NOT the trigger:

| variant | result |
|---|---|
| top-level `window` + `order by` | OK |
| scalar subquery, `window`, no `order by` | OK |
| scalar subquery, `window` + `order by` | **ORA-00907** |
| **scalar subquery, `order by`, NO window** | **ORA-00907** |
| derived table, `window` + `order by` | OK |

So the rule is simply that Oracle forbids `ORDER BY` inside a scalar subquery
in the select list. The aggregated-array sibling
(`...-in-inline-aggregated-array-value`) wraps its select in a derived table and
runs fine on Oracle, so the wrap is the shape that already works here.

**Current workaround in the suite**:
`oracle/newest/oracledb/customize-query.select.test.ts`, test
`customize-recursive-one-column-custom-window-and-ordering-in-inline-scalar-value`
— commented out with a `// TODO[BUG]` (line comments, because the body embeds
`/* hint */` fragments).

## SQL Server: `asBigint()` on a double declares `bigint` but emits `float`

**Where**: `src/internal/ValueSourceImpl.ts:454` (`asBigint`; `asInt` at :448 has
the same shape) + `SqlServerSqlBuilder._modulo` (~1005).

**Reproduction**: `tIssue.priority.asDouble().asBigint().modulo(2n)` emits
`round(cast(priority as float), 0) % @1` and SQL Server rejects it with
*"The data types float and bigint are incompatible in the modulo operator"*.

`asBigint()` on a double builds `SqlOperation0ValueSource('_round', this,
'bigint', 'bigint', ...)`: the declared type becomes `bigint` but the SQL
expression is still `float` — no cast is emitted. SQL Server's `%` does not
accept float, and the `_modulo` override that works around this by casting both
operands to `numeric(38, 16)` only fires when the receiver is a **declared**
double. After `asBigint()` it is a declared bigint, so the guard is skipped and
the invalid `float % bigint` reaches the engine.

Needs a design decision: there is no `_asInt` / `_asBigint` hook on
`SqlBuilder` today, so a dialect cannot make the cast explicit
(e.g. `cast(round(x, 0) as bigint)`).

**Current workaround in the suite**:
`sqlserver/newest/mssql/select.value-source.casts.test.ts`, test
`asBigint-on-double-chained-into-bigint-op` — commented out with a `// TODO[BUG]`.

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

**First, locate every declaration site of the symbol** —
`npm run tests:where-is -- --search <symbol> --declared full` lists ALL
declaration sites. Trust the index over the entry: the files named in
the open entry are the ones known when it was filed, and they can be
**incomplete**. (Past miss: an entry on `virtualColumnFromFragment`
named `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`
and a fix that grepped only the two listed files would have left
`Table.ts` regressed.)

Then gather the context appropriate to the bug's shape:

- **SQL-emission bug** (the lib emits SQL the engine rejects, or the
  emitted SQL is wrong) — `npm run tests:where-is -- --search <symbol> --for emission-bug`
  bundles `emitted-sql full · implemented-by full (non-overriders) ·
  version-gates · bugs full · limitation · not-applicable · chain
  none`: the SQL the symbol emits across tests and docs, every
  implementing class, the compatibility-version branches that gate
  the method, sibling `// TODO[BUG]` markers and any declared
  `// TODO[LIMITATION]` / `// NOT-APPLICABLE` that names the symbol.
  `chain` is off on purpose — emission happens after the call-chain,
  so the chain never reaches the emission site; use
  `--emits-keyword <sql-fragment>` to walk back from the SQL token
  to the builder code instead.
- **Type-system bug** (overload selection, variance, assignability —
  the symbol's typing rejects or accepts something it shouldn't) —
  `npm run tests:where-is -- --search <symbol> --for type-bug` bundles
  `declared full · signature full · ref-type-arg full · neg-types
  full · bugs summary · limitation summary · not-applicable summary ·
  chain none`: every declaration + signature, every place the type is
  **used as a type argument** (the blast radius of an alias), the
  existing `@ts-expect-error` locks and sibling markers. The route
  for a type
  bug is the signature, not the call-chain — `chain` is off for the
  same reason as `emission-bug`. Before inventing a new helper or
  type alias, run `--search-pattern-summary '<shared-token>'` to
  check whether the shape already exists under a different name
  (past near-miss: nearly re-introduced `AllowsNoTableOrViewRequired`
  by hand).

Each entry above usually falls into one of these:

- **TS accepts something runtime rejects** — a method typed on a
  connection class whose dialect refuses the SQL it emits. Mock
  cells silently pass (the SQL is never executed); only the real-DB
  cell surfaces the rejection. Treat as a typing gap: the type
  should narrow. The fix is two-step: tighten the connection's typed
  surface in `src/connections/<DB>Connection.ts` (or wherever the
  method is exposed), then add a `@ts-expect-error` rule under
  `test/db/<db>/types.negative/` that locks the new narrower
  contract. Example shipped: commit `9b5ab1c` on
  `PostgreSqlConnection.onConflictDoUpdateSet`.
- **TS rejects something the docs page describes** — the docs show a
  call that doesn't typecheck on the connection that snippet is
  supposed to demonstrate. Either the docs page is stale or the lib
  types are too tight. The fix is either to widen the type or to
  update the docs page; check both before assuming one.
- **Two equivalent forms documented but only one is typed** — the
  docs describe two interchangeable forms per dialect (e.g.
  "MariaDB/MySQL use bare `.onConflictDoUpdateSet({...})`;
  PostgreSQL/SQLite use `.onConflictOn(col).doUpdateSet({...})`")
  and the lib types let you use the wrong form on a given dialect.
  The fix narrows the typed surface for the dialect that should not
  accept that form.
- **A snippet references a public symbol that no longer exists** in
  the current `exports` map of [`package.json`](../package.json) —
  the page is stale or the symbol was removed. The fix is to update
  the docs page or restore the export.

When the fix lands:

1. Patch `src/` and add the negative-type test (where applicable).
2. Remove the corresponding entry from the open list above.
3. **Walk every place that reflected the old behaviour**:
   `npm run tests:where-is -- --search <symbol> --for post-fix-sync` bundles
   `emitted-sql full · docs full · examples full · tests detail · bugs
   · chain none` — every asserted SQL across tests and docs, the doc
   pages that explain it, the legacy `src/examples/` occurrences,
   per-test references, and any remaining `// TODO[BUG]` markers that
   still mention the symbol (typically the entry you're closing here).
   Anything still naming the old behaviour needs refreshing.
4. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or **switch the
   marker to its final category**. If the fix establishes that the
   feature simply doesn't exist on this dialect, the right marker is
   `// NOT-APPLICABLE: <reason>; see test/db/<db>/types.negative/<file>.ts
   for the compile-time negative` — a permanent dialect boundary, not
   pending work. If the bug exposed an unsolved library gap, use
   `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` instead.
5. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
