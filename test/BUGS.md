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
2. **Refresh the index**: `bun run tests:index` (~28 s, gitignored).
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

## `disallowIfNoValueWhen` drops the `MISSING_KEYS` narrowing its runtime-twin `disallowIfNoValue` applies

**Where**: `src/expressions/insert.ts` — the four `*MissingKeys*` insert
interfaces. On each, `disallowIfNoValue<COLUMNS>` narrows the missing-keys
set via `Exclude<MISSING_KEYS, COLUMNS>` but `disallowIfNoValueWhen` returns
`MISSING_KEYS` unchanged (and isn't generic over `COLUMNS`):
- `MissingKeysInsertExpression`: `disallowIfNoValue` :281-282 vs `disallowIfNoValueWhen` :309-310
- `ShapedMissingKeysInsertExpression`: :340-341 vs :368-369
- `MissingKeysMultipleInsertExpression`: :515-516 vs :543-544
- `ShapedMissingKeysMultipleInsertExpression`: :574-575 vs :602-603

**Reproduction**: `InsertQueryBuilder.disallowIfNoValueWhen(when, error, ...columns)`
(`src/queryBuilders/InsertQueryBuilder.ts:1567-1569`) delegates straight to
`this.disallowIfNoValue(error, ...columns)` when `when === true`, so
`disallowIfNoValueWhen(true, e, ...cols) ≡ disallowIfNoValue(e, ...cols)` and
their result types must coincide. They don't. Coordinator compile-repro (tsgo)
on the single-row twin:
```ts
const direct = ctx.conn.insertInto(tIssue).dynamicSet()
    .disallowIfNoValue('required', 'projectId', 'number', 'title', 'status', 'priority')
const whenTrue = ctx.conn.insertInto(tIssue).dynamicSet()
    .disallowIfNoValueWhen(true, 'required', 'projectId', 'number', 'title', 'status', 'priority')
assertType<Exact<typeof direct, typeof whenTrue>>()   // TS2344: 'false' does not satisfy 'true'
```
The `keepOnly`/`keepOnlyWhen(true)` positive control in the same repro passes,
proving the harness is sound and only this pair diverges. `disallowIfNoValue`
removes the named columns from `MISSING_KEYS` (they're runtime-guaranteed to have
a value), which — through the downstream `[MISSING_KEYS] extends [never]` gate
(`insert.ts:1005-1006`) — is what lets a later `.set(rest)` reach executability;
the `disallowIfNoValueWhen(true)` chain cannot, though it does the identical
thing at runtime. Same shape as the previously-fixed `keepOnlyWhen` /
shaped-`setWhen` MISSING_KEYS mis-folds. Fix: make each
`disallowIfNoValueWhen<COLUMNS extends …>(when, error/errorMessage, ...columns: COLUMNS[])`
overload return the `Exclude<MISSING_KEYS, COLUMNS>`-narrowed node its non-When
sibling returns (both string and `Error` overloads, all four interfaces); the
fixing agent settles whether the canonical direction is "When narrows too" or
"neither narrows", using the runtime delegation as the oracle.

**Current workaround in the suite**: no test asserts the type of
`disallowIfNoValue` / `disallowIfNoValueWhen` on a `dynamicSet()` (MissingKeys)
chain, so nothing is red today — the gap that hid it. A `// TODO[BUG]` marks the
would-be dispatch-lock assertion (paired direct-vs-`When(true)` `assertType<Exact>`
alongside the existing `keep-only-when-dispatches-on-true` lock in
`insert.set-when-helpers.test.ts`).

## `customizeQuery` `beforeQuery`/`afterQuery` silently dropped on a recursive-union select consumed via `forUseInQueryAs`

**Where**: `src/queryBuilders/SelectQueryBuilder.ts` — the recursive branch of
`forUseInQueryAs` (~:539-547) returns only the `recursiveView` and discards
`this.__recursiveSelect`, on which `__applyRecursiveCustomization` (~:612-648)
parked the whole-statement `beforeQuery`/`afterQuery` hooks.

**Reproduction**: `selectFrom(t).where(...).select({...}).recursiveUnionAll(...)
.customizeQuery({beforeQuery, afterQuery, beforeWithQuery, afterWithQuery})
.forUseInQueryAs('tree')` is typed & callable, but the emitted SQL drops
`beforeQuery`/`afterQuery`. Coordinator runtime probe (mock, `ctx.lastSql`),
three arms sharing one `customizeQuery({beforeQuery:'/* head */', afterQuery:'/* tail */',
beforeWithQuery:'/* warmup */', afterWithQuery:'/* end-of-with */'})`:
- **recursive + `forUseInQueryAs`** → `with recursive tree as /* warmup */ (…) /* end-of-with */ select … from tree` — `/* head */` and `/* tail */` **GONE**.
- **same recursive builder + `executeSelectMany`** → `/* head */ with recursive … /* warmup */ (…) /* end-of-with */ … /* tail */` — all four present.
- **non-recursive + `forUseInQueryAs`** → `with cte as /* warmup */ (/* head */ select … /* tail */) /* end-of-with */ …` — all four present (`beforeQuery`/`afterQuery` land inside the CTE body).

So the drop is specific to the `recursive × forUseInQueryAs` seam: both the
direct-execute path and the non-recursive CTE path preserve the hooks. A "TS
accepts what the impl doesn't deliver" divergence — user-supplied SQL (route
hints, comments) is silently lost. Distinct from the previously-fixed
recursive-CTE customizeQuery mislanding (that fix covered the direct/execute path;
this composition slips through). Expected: mirror the non-recursive CTE path and
render `beforeQuery`/`afterQuery` inside the recursive CTE body.

**Current workaround in the suite**: the `recursive-union × forUseInQueryAs`
composition is untested across the whole matrix (only recursive+`executeSelectMany`
and non-recursive+`forUseInQueryAs` are covered). A `// TODO[BUG]` will mark the
new probe test once written.

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

**First, locate every declaration site of the symbol** —
`bun run tests:where-is --search <symbol> --declared full` lists ALL
declaration sites. Trust the index over the entry: the files named in
the open entry are the ones known when it was filed, and they can be
**incomplete**. (Past miss: an entry on `virtualColumnFromFragment`
named `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`
and a fix that grepped only the two listed files would have left
`Table.ts` regressed.)

Then gather the context appropriate to the bug's shape:

- **SQL-emission bug** (the lib emits SQL the engine rejects, or the
  emitted SQL is wrong) — `bun run tests:where-is --search <symbol> --for emission-bug`
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
  `bun run tests:where-is --search <symbol> --for type-bug` bundles
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
   `bun run tests:where-is --search <symbol> --for post-fix-sync` bundles
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
