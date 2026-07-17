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
2. **Refresh the index**: `npm run tests:index` (gitignored).
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

Most defects this suite surfaces are a **silently wrong value** rather than a
rejection, and are invisible to the matrix until a test reaches them — so each
entry says under *Current workaround in the suite* why the matrix can't see it.
A `none` there is not "nothing to do": it means no test would notice a
regression either.

**Every entry below was confirmed against a real engine**, and the transcript is
included so you can re-run it rather than trust it. Each carries a **Decided**
line: the fix approach is already ruled by the project author — implement that
ruling, do not re-open it. Everything else (how, where, the propagation) is
yours.

**Two standing rules for this batch**, from the author:

1. **Extend or change the seed fixtures where needed**, even when that means
   adjusting other tests. Several of these defects **cannot be locked by any
   test with today's fixtures** (see each entry) — the fixture change is a
   prerequisite, not a follow-up. A fix shipped without a failing-before test
   locks nothing.
2. **This file is not permanent** — an entry is deleted the moment its bug is
   fixed, and so is any report it came from. So anything a future reader must not
   re-litigate belongs **in a code comment**, next to the code it explains. Each
   entry names what must be recorded that way under *Record in the code*.

A cross-cutting note for this batch: **three of the four are SQL Server type
fidelity.** `POWER` and `ISNULL` both return their *first argument's* type, and
`LEN` has its own trailing-blank rule. Treat "does SQL Server keep the first-arg
type here?" as one standing question, not three separate bugs — fix them with
that lens.

### `power()` on an int receiver truncates the fractional result to int on SQL Server

**Where**: base `_power` at `src/sqlBuilders/AbstractSqlBuilder.ts:3377` emits
`power(<receiver>, <exponent>)` with **no cast on the receiver**, and SQL Server
does **not** override `_power`. The construction declares the result **`double`**
(`src/internal/ValueSourceImpl.ts:646`).

**Reproduction**: T-SQL's `POWER` returns its *first argument's* type, so
`power(<int>, …)` computes and returns in int. `intCol.power(0.5)` (square root of
an int column — normal usage) returns a truncated integer.

```
POWER(CAST(2 AS INT),   0.5) = 1                 JS Math.pow(2,0.5) = 1.4142135623730951
POWER(CAST(2 AS INT),   -1)  = 0                 JS Math.pow(2,-1)  = 0.5
POWER(CAST(2 AS FLOAT), 0.5) = 1.4142135623730951
BaseType of POWER(int,0.5)   = 'int'
POWER(50000, 2) -> Msg 8115 Arithmetic overflow  (pg power(50000::int,2) = 2500000000)
```

**The precedent is already in the file**: `SqlServerSqlBuilder._cbrtRadicand`
(`:1027`) casts the base to float *for exactly this reason*, with a comment
saying so. `cbrt` was fixed; the public `power()` was not — an incomplete local
fix.

**Current workaround in the suite**: none. `grep` for a fractional or negative
exponent across ~4.1k files returns nothing; the one test emitting
`power(int, double)`
(`select.value-source.numeric-operand-coverage.test.ts:1006`) seeds `issue_id = 1`
(`POWER(1, …) = 1`, right and wrong coincide) and launders the assertion through
`Number(...)` + `toBeCloseTo(1, 5)`. A value-degenerate fixture and a laundered
assertion in one place.

**Decided**: fix — a `SqlServerSqlBuilder._power` override casting the base via
`_appendCastAsDouble`, mirroring `_cbrtRadicand`. Needs a fractional-exponent test
over a non-degenerate int base to lock.

**Record in the code**: that SQL Server `POWER` returns the first argument's type
(same root as the `ISNULL` entry below) — so any int-first-operand math on SQL
Server has to cast. Point at `_cbrtRadicand` as the precedent.

### `valueWhenNull` truncates a longer/wider fallback on SQL Server (`isnull` types by its first argument)

**Where**: `src/sqlBuilders/SqlServerSqlBuilder.ts:840` — `_valueWhenNull` emits
`isnull(a, b)`. Every other dialect emits `coalesce`/`nvl`/`ifnull`, which type
the result as the *widest* operand; `isnull` types it as its **first argument**
and coerces the fallback to it.

**Reproduction**:

```
declare @c varchar(3) = null;
  isnull(@c, 'abcdef')   = 'abc'        <- fallback truncated to varchar(3)
  coalesce(@c, 'abcdef') = 'abcdef'
BaseType of isnull(tinyint, 100000) = 'tinyint'   <- narrows a wider numeric fallback too
```

`.valueWhenNull('abcdef')` on a NULL `varchar(3)` column returns `'abc'`; every
other dialect returns `'abcdef'`. `docs/keywords/functions-oprators.md:85` maps
`ISNULL → valueWhenNull` but does not warn about the coercion.

**Current workaround in the suite**: none — `valueWhenNull` fixtures use short
values (`0`, names) whose width already matches the receiver.

**Decided**: fix — emit `coalesce` instead of `isnull` on SQL Server (the author's
principle: prefer what the database natively provides over an opt-in, and
`coalesce` resolves it). `coalesce` expands to a `CASE` that **double-evaluates
its first argument** — accepted, because that argument is the receiver, almost
always a column (repeating it is free); it only matters for an expensive
value-source receiver, which is rare here. Keep the `convert(nvarchar(36), …)`
uuid wrappers on those lines exactly as they are (orthogonal to the change).
Related to the `valueWhenNull` type-promotion entry below — the same method;
handle both together.

**Record in the code**: why `coalesce` over `isnull` (`isnull` narrows the result
to its first argument's type; `coalesce` widens) and the double-evaluation
tradeoff that was accepted.

### `minValue` / `maxValue` — PostgreSQL and SQL Server ignore a NULL operand, contradicting the library's own declared type

**Where**: `minValue`/`maxValue` build `_minimumBetweenTwoValues` /
`_maximumBetweenTwoValues`. Base `least(a,b)` / `greatest(a,b)`
(`src/sqlBuilders/AbstractSqlBuilder.ts:3389`) — reached by PostgreSQL, Oracle,
MySQL, MariaDB. SQLite overrides with scalar `min`/`max`
(`SqliteSqlBuilder.ts:333`). SQL Server overrides
(`SqlServerSqlBuilder.ts:1046`): `least`/`greatest` at
`compatibilityVersion >= 16_000_000`, else `iif(a < b, a, b)`.

**Reproduction — the library's TYPE already promises NULL propagation.**
`minValue`/`maxValue` compute their result optionality with `mergeOptional`
(`src/internal/ValueSourceImpl.ts:2054` via `getOptionalType2`; the compile-time
mirror is `MergeOptional` in the signature at `src/expressions/values.ts:420`).
`mergeOptional('optional', 'required')` = **`optional`** — the result is optional
whenever *either* operand is optional. That is exactly the **NULL-propagates**
(poison) contract, and it is the same rule `add` / `subtract` / `concat` use. The
only reason a required receiver with an optional argument is typed optional is
that the library anticipates the argument's NULL flowing into the result; under an
ignore-NULL reading it would be typed `required`. So the declared type is built
for poison — and four dialects already deliver it, while PostgreSQL and SQL Server
do not:

```
minValue(5, NULL), exact emitted form per dialect:
  PostgreSQL          least(5, NULL)  = 5      <- ignores NULL (deviates)
  SQL Server >=2022   least(5, NULL)  = 5      <- ignores NULL (deviates)
  SQL Server <2022    iif(5<NULL,5,NULL) -> depends on operand ORDER (asymmetric, worse)
  MySQL / MariaDB     least(5, NULL)  = NULL   <- poison (matches the type)
  Oracle              least(5, NULL)  = NULL
  SQLite              min(5, NULL)    = NULL
```

(Not the row aggregate `min(col)`/`max(col)` over rows — those ignore NULL on every
engine, standard SQL, and are not affected. This is the scalar two-value
least/greatest.)

**Current workaround in the suite**: none — min/max tests use non-null operands,
where every dialect coincides.

**Decided**: **normalize PostgreSQL and SQL Server to poison** (match the declared
type, the other four dialects, and `concat`). This is a deliberate behaviour
change on those two dialects. The full design:

- **Emit the leanest query the build-time information allows.** The optionality of
  each operand is known while building, so only null-check the operands that *can*
  be null:
  - both operands required → `least(a, b)` (no `CASE` — nothing can be null).
  - one operand optional → `case when <that one> is null then null else least(a,b) end`.
  - both optional → `case when a is null or b is null then null else least(a,b) end`.
  The other four dialects are **unchanged** (native `least`/`greatest`/`min`/`max`
  already poison). On SQL Server the `CASE` also **collapses the `>=16M`/`<16M`
  version split** and fixes the `<2022` `iif` asymmetry.
- **Opt-out**: a connection flag to keep the native ignore-NULL behaviour on
  PostgreSQL / SQL Server for users who prefer it.
- **User-function opt-in**: a connection option naming a user-provided
  null-propagating min/max function, emitted as `func(a, b)` so the operands are
  not repeated (the `OracleConnection.concatFunction` pattern). Preferred over the
  `CASE` when set, because it avoids the repetition.
- **Changelog**: declare the behaviour break for PostgreSQL and SQL Server (a
  value change, not just a spelling change).

Probed normalization forms (all correct): `case when a is null or b is null then
null else least(a,b) end` on PostgreSQL; the same collapses the version split on
SQL Server.

**Record in the code**: that the `mergeOptional` (OR) optionality rule **is** the
poison contract, so the native ignore-NULL behaviour of PostgreSQL / SQL Server
contradicts the type the library declares; the opt-out flag; the user-function
opt-in; and why the SQL Server version split collapses.

### `intCol.valueWhenNull(doubleSource)` declares `int` but can return a fraction, so the marshaller throws

**Where**: `valueWhenNull` declares the result as the **receiver's**
`__valueType` (`src/internal/ValueSourceImpl.ts:608`), with no numeric promotion —
unlike `minValue`/`maxValue`, which route through
`createSqlOperation1ofOverloadedNumber` and promote to `double` when the operands
mix.

**Reproduction**: `intCol.valueWhenNull(doubleCol)` is declared `int` but emits
`coalesce(<int>, <double>)`. When the int is NULL and the double is fractional, the
engine returns the fraction and the marshaller's `int` arm
(`src/connections/AbstractConnection.ts:1181`) **throws**
`INVALID_VALUE_RECEIVED_FROM_DATABASE: Invalid int value received from the db:
9.99` — while the `double` arm would accept it. A legal, typed query crashes at
runtime on legal data. All six dialects (the marshaller is dialect-agnostic).

**Current workaround in the suite**: none — no test combines an int receiver with
a fractional double fallback over a NULL int row.

**Decided**: fix — promote `valueWhenNull` to `double` when the operand is a double
source, the way `createSqlOperation1ofOverloadedNumber` already does for
`minValue`/`maxValue`. Same method as the `isnull`→`coalesce` entry above; handle
both together.

**Record in the code**: that `valueWhenNull` must promote the numeric type from
its operand like the other overloaded-number operations, or the declared type
lies and the marshaller rejects a valid result.

## Coverage gaps carried over (not bugs — no entry to fix)

These are **not** defects and there is nothing in `src/` to change. They are the
places where a fix that landed has **no test holding it down**, so a regression
would be silent. Kept here because the loudest lesson of the round that fixed
them was that a defect survives exactly as long as no fixture can express it.

*(none)*

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
