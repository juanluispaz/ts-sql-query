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
2. **Refresh the index**: `npm run tests:index` (~28 s, gitignored).
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

## Recursive select consumed via `forUseInQueryAs` with ordering/paging drops the `afterSelectKeyword` / `beforeColumns` / `customWindow` customize hooks

**Where**: `src/queryBuilders/SelectQueryBuilder.ts` — `forUseInQueryAs`, the
ordering/paging branch at ~607-623 (`wrapCustomization`, ~608-617, copies only
`beforeOrderByItems` / `afterOrderByItems` onto the wrapping CTE's select). The
allow-list comment at ~564-577 treats the three projection-only hooks as
not-applicable, but its rationale ("a plain SELECT clause the compound body
does not have") does **not** hold on this branch: the wrapping CTE
`<as> as (select … from <recursive-member> order by … limit …)` IS a plain
select with a surviving projection (the same `outerSelect` the code notes at
~596-599 "already IS that `select … from <recursive-member>`").

**Reproduction**: a recursive result carrying `orderBy`/`limit` AND
`customizeQuery({ afterSelectKeyword, beforeColumns, customWindow, beforeOrderByItems })`,
consumed via `.forUseInQueryAs('tree')`, emits:
`… , tree as (select id as id, title as title from recursive_select_1 order by title asc, id limit $N) …`
— `beforeOrderByItems` (`title asc`) re-homes to the wrapping select and
renders, but `afterSelectKeyword` / `beforeColumns` / `customWindow` are
**dropped** (no `/* hint */`, no `/* cols */`, no `window w1`). The
non-recursive twin renders all five in the identical
`<name> as (select /* hint */ /* cols */ … window … order by …)` structure
(`customize-query.select.test.ts:269`
`customize-select-projection-only-hooks-survive-as-cte`), and the recursive
result renders them when executed directly — so this is inconsistent, not a
missing capability. Expected: the three projection-only hooks render on the
wrapping CTE's select. Fix: extend `wrapCustomization` to also carry
`afterSelectKeyword` / `beforeColumns` / `customWindow`, and adjust the
~564-577 allow-list to distinguish the **ordering path** (wrapping select
survives → hooks apply) from the **no-ordering path** (the recursive member IS
the CTE, no plain SELECT clause → genuinely NOT-APPLICABLE).

**Current workaround in the suite**: no test currently exercises this
composition (the gap this bug was found through). See `MISSING_TESTS_AUDIT_49.md`
item **SEL-1**: add the test (marked `// TODO[BUG]` until fixed) asserting the
three hooks render in the wrapping CTE. The no-ordering path
(`customize-recursive-select-projection-only-hooks-not-applicable-as-cte`,
`customize-query.select.test.ts:174`) correctly asserts they are dropped and
stays as-is (a genuine NOT-APPLICABLE boundary).

## The base dialect (`AbstractSqlBuilder`) `_startsWithInsensitive` / `_notStartsWithInsensitive` are wrong (swapped `_escapeLikeWildcard` args + missing the SQLite `escape '\\'`); every dialect overrides them instead of the base being fixed

`AbstractSqlBuilder` is the **base dialect** (SQLite-shaped, expanded by
PostgreSQL with minimal overrides), so its implementation is meant to be a
correct, usable dialect — not an unreachable abstract fallback. It currently is
not, for the two insensitive prefix predicates.

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts` — `_startsWithInsensitive`
(~2811-2820) and `_notStartsWithInsensitive` (~2821-2830). Two defects:
1. **Swapped args.** All three branches call `_escapeLikeWildcard(value, params, …)`,
   but the signature is `_escapeLikeWildcard(params, value, …)` (`:2932`). Every
   correct caller passes `(params, value)` — the sensitive siblings
   `_startsWith`/`_notStartsWith`/`_endsWith`/`_notEndsWith` (~2800-2809) and every
   dialect override. Root cause: `_escapeLikeWildcard`'s signature is the **sole
   outlier** in the render-helper family — `_appendSql(value, params, …)`,
   `_appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)`
   (identical tail!), `_appendConditionSql(value, params, …)` all put **value
   first**. Whoever wrote these two methods followed that pervasive convention and
   passed `(value, params)` — correct for the convention, wrong for this one
   function. This routes the `params` array through the `typeof value === 'string'`
   escape guard (always false → the `%`/`_`/`\` LIKE-wildcard escaping never runs).
2. **Not SQLite-shaped.** The `else` (no-collation) branch emits
   `lower(col) like lower(escaped || '%')` with **no `escape '\\'` clause**, while
   `SqliteSqlBuilder`'s override adds `… escape '\\'` — so the base, which is
   supposed to be the SQLite dialect, does not actually match SQLite.

**History (why it's here)**: the insensitive-comparison rework
(`85ec8ded` "Rework insensitive comparison to allow use collations instead of the
lower function; … Fix some 'not' ignored … on MySQL, MariaDB, Oracle, PostgreSQL,
Sqlite, SqlServer") introduced these base methods with the swap and fixed the
behavior **per dialect via overrides** rather than correcting the base. As a
result all six dialects (Postgres/SqlServer/Oracle/Sqlite/MariaDB+MySql) override
both methods; only `NoopDBSqlBuilder` inherits the broken base — which is why no
current matrix cell reproduces it (the SQLite cells run SQLite's override, not the
base).

**Reproduction**: no matrix cell currently exercises the base (SQLite overrides
it). Once the base is corrected to be SQLite-shaped and the redundant
`SqliteSqlBuilder` override is removed, the existing SQLite insensitive-affix
escape tests (`select.where.like-escape*.test.ts`, `operators-insensitive`) would
run against the base and pin it. Suggested fix, in order: (a) reconcile
`_escapeLikeWildcard`'s signature to `(value, params, …)` to match
`_appendValue`/`_appendSql` (then the base methods here become correct unchanged
and every other caller flips `(params, value)` → `(value, params)`) — or at
minimum fix these two methods to `(params, value)`; (b) make the base `else`
branch SQLite-shaped (add `escape '\\'`); (c) drop the now-redundant
`SqliteSqlBuilder` override and minimize the PostgreSQL one, so the base carries
the shared behavior as intended. The other dialects' overrides stay (they emit
genuinely dialect-specific SQL: PG `ilike`, MySql/MariaDB `like concat(...)`,
SqlServer `+ '%'`/collate, Oracle `escape '\\'`).

**Current workaround in the suite**: none needed — the bug is masked by the
per-dialect overrides, so the suite is green. This entry tracks the base-dialect
correctness + the design-debt (overrides added instead of fixing the base). No
`// TODO[BUG]` marker exists yet because no test reaches the base today; the test
appears once the redundant SQLite override is removed (step c).

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
