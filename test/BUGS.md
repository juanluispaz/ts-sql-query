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

## Compound `orderBy(rawFragment)` is not no-table-restricted — accepts an anchor-table column and emits an invalid `UNION … ORDER BY <table>.<col>`

**Where**: `src/expressions/select.ts:110` — the raw-fragment `orderBy` overload
on `CompoundedOrderByExecutableSelectExpression` is typed `IRawFragment<FROM[typeof
source]>` (FROM-scoped), whereas the value-source sibling `:109` and both recursive
twins (`OrderByRecursiveAwareValueSource` `:562`, `OrderByRecursiveAwareRawFragment`
`:567`) are `…<NNoTableOrViewRequiredFrom<REQUIRED[typeof source]>>`
(no-table-restricted). Same defect class as the recently-fixed recursive orderBy
restriction (`df9d0838`).

**Reproduction**: on a compound (`union`/`intersect`/`except`/…) the value-source
arm correctly rejects a table-bound term, but the raw-fragment arm does not:

```ts
const compound = conn.selectFrom(tProject).select({ label: tProject.name })
    .union(conn.selectFrom(tIssue).select({ label: tIssue.title }))

compound.orderBy(tProject.id)                         // correctly REJECTED at compile (:109)
compound.orderBy(conn.rawFragment`${tProject.id} desc`) // WRONGLY COMPILES (:110)
```

The raw-fragment call emits an **unwrapped**
`select name as label from project union select title as label from issue order by project.id desc`
— a UNION whose ORDER BY references a branch base table (`project`), which every
engine rejects (a set-operation ORDER BY may only reference output columns /
ordinals). The value-source arm both no-table-restricts **and** wraps
(`select * from (…) as o_1_ order by $1`). A no-table `rawFragment` (`` `label desc` ``,
`` `1` ``) stays valid and must keep compiling. The recursive-orderBy negative block
in `types.negative/select.test.ts` even states it "mirrors the restriction a compound
query's ORDER BY carries" — but `:110` does not carry it.

**Current workaround in the suite**: `types.negative/select.test.ts` (all 6 db
folders) gains a compound-orderBy block — the value-source arm locked with a live
`@ts-expect-error`, and the raw-fragment arm left as a currently-compiling call
marked `// TODO[BUG]` (no directive yet, since it does not error). When `:110` is
narrowed, that call starts erroring and the fixing agent locks it with a directive
matching the value-source sibling + the recursive twin.

## `forUseInQueryAs` mishandles a recursive result's outer-projection ordering — `orderBy`/`limit`/`offset` are dropped, and customize order-by hooks are misplaced into the recursive term (invalid SQL)

**Where**: `src/queryBuilders/SelectQueryBuilder.ts` — a recursive-union result's
`orderBy`/`limit`/`offset` route to the outer `__recursiveSelect` (via
`__orderingAndPagingTarget()`), and its `customizeQuery` order-by hooks
(`beforeOrderByItems`/`afterOrderByItems`) route to the same outer select.
`forUseInQueryAs` discards that outer projection; the `45c12968` allow-list
(`:580-585`) then copies the customize hooks onto the recursive **CTE body**. Root
cause is shared: the recursive result's outer-projection ordering is not carried into
the CTE. Two symptoms:

**Symptom A — `orderBy`/`orderByFromString`/`limit`/`offset` silently dropped
(missing feature).** A plain select and a compound (`union`/…) select fold these into
the CTE body under `forUseInQueryAs`; the recursive path drops them:

```ts
const tree = conn.selectFrom(tIssue).where(tIssue.id.equals(1))
    .select({ id: tIssue.id, title: tIssue.title })
    .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
    .orderBy('id').limit(5).offset(1)      // ← set on the recursive result
    .forUseInQueryAs('tree')
conn.selectFrom(tree).select({ id: tree.id, title: tree.title }).executeSelectMany()
```

emits `with recursive tree as (anchor union all recursive) select … from tree` —
**no `order by` / `limit` / `offset`**. (`orderByFromString` is dropped the same way.)

**Symptom B — customize order-by hooks misplaced into the recursive term (emits
engine-rejected SQL).** With the same `forUseInQueryAs`, the allow-list re-homes
`beforeOrderByItems`/`afterOrderByItems` **inside** the recursive CTE:

```ts
conn.selectFrom(tIssue).where(tIssue.id.equals(1))
    .select({ id: tIssue.id, title: tIssue.title })
    .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
    .customizeQuery({ beforeOrderByItems: conn.rawFragment`title asc`, afterOrderByItems: conn.rawFragment`id asc` })
    .forUseInQueryAs('tree')
```

emits `with recursive tree as (anchor union all recursive **order by title asc, id asc**) select … from tree`
— **rejected by PostgreSQL (docker-verified): `ORDER BY in a recursive query is not
implemented`**. The hook content is valid (`title asc, id asc`); the invalidity is
structural — `ORDER BY` is not allowed inside a recursive CTE term at all. (For a
non-recursive CTE the same re-home is valid, so the bug is specific to the recursive
member.)

**The library already renders a valid recursive ORDER BY** — a standalone
`recursive…orderBy('id')` emits `… select … from <cte> order by id` on the **outer**
select (valid, docker-verified). Both symptoms share one fix: render the outer-projection
ordering via a **wrapping CTE**, which is engine-valid (verified on real PostgreSQL):

```sql
with recursive tree_inner as (anchor union all recursive),
     tree as (select * from tree_inner order by id limit 5 offset 1)   -- + hooks here for symptom B
select … from tree
```

The fix must **NOT** naively fold `order by`/`limit` into the recursive term
(`… union all … order by …`) — that is symptom B, which every engine rejects.

**Current workaround in the suite** (both in `cte.recursive-union-variants.test.ts`,
all 17 cells):
- Symptom A: a **live** test
  `recursive-result-order-by-limit-offset-then-for-use-in-query-as-drops-them` pins the
  dropped emission + value (the dropped `offset(1)` is why the single anchor row
  survives), marked `// TODO[BUG]`.
- Symptom B: a **block-commented** test
  `recursive-customize-order-by-hooks-then-for-use-in-query-as-misplaces-into-recursive-term`
  marked `// TODO[BUG]` (it cannot run — the emitted SQL is engine-rejected). Uncomment
  when the lib stops emitting it.

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
