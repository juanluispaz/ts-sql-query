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

## `subSelectUsing` / `subSelectDistinctUsing` arity-5 overload rejects five distinct correlated tables

**Where**: `src/connections/AbstractConnection.ts:441` (`subSelectUsing`) and
`:451` (`subSelectDistinctUsing`) — the **arity-5** overload. Its fifth
parameter is typed `table5: T4 & SameDB<DB>` (a copy-paste from `table4`),
while the return source union references a **distinct declared** type parameter
`T5`. Every other position uses its own `Ti` (`table1: T1` … `table4: T4`),
and the arity-4 overload (`:440`) is correct.

**Reproduction**: `conn.subSelectUsing(tOrganization, tProject, tIssue, tAppUser, tIssueWorklog)`
— five genuinely-distinct correlated tables — **does not compile**: `T4` is
fixed to `TAppUser` by `table4`, so `table5: T4` then rejects the fifth
argument with `TS2345: Argument of type 'TIssueWorklog' is not assignable to
parameter of type 'TAppUser & SameDB<"postgreSql:DBConnection/">'`. The
variadic runtime (`subSelectUsing(...tables)`) handles five distinct tables
fine — only the type rejects them. Both `subSelectUsing` and
`subSelectDistinctUsing` carry the identical typo. (Secondary effect: because
`T5` is never inferred from an argument it falls back to its constraint
`ITableOrView<any> | ForUseInLeftJoin<any>`, widening the correlated-source
scope in the return type — masked in practice by the primary argument
rejection.) Fix: `table5: T5 & SameDB<DB>` on both lines.

Confirmed by a coordinator tsgo compile-repro in the reference cell (arity-4
with four distinct tables compiles; arity-5 with five distinct tables emits
`TS2345` on both `subSelectUsing` and `subSelectDistinctUsing`).

**Current workaround in the suite**: none — the positive arity-5
correlated-subquery test cannot be written until the typo is fixed (arities 1–4
are covered and correct). When the fix lands, add a positive test building a
five-table correlated subquery (SQL + params + value) in
`select.subqueries.test.ts` / `select.subquery-shapes.test.ts`, and a
`types.negative/` lock proving an out-of-scope correlated table is still
rejected at arity 5.

## `executeSelectPage` count query drops `customizeQuery` hooks on a plain select (functional extension)

**Type**: functional extension — the `beforeQuery` / `afterQuery`
`customizeQuery` hooks should decorate **every** statement the builder
emits to the database, so they must ride on the auto-generated count
query of `executeSelectPage()` as well as on the data query. Today the
plain (non-`distinct`, non-grouped) select path drops them from the
count query; the grouped / `distinct` / compound paths already keep
them. This makes the behaviour consistent across all page shapes (a
statement-level `beforeQuery` — e.g. a connection-pooler routing comment
like `/* route=analytics-replica */` — currently rides on the data query
but is silently lost from the count query on the plain path).

**Where**: `src/queryBuilders/SelectQueryBuilder.ts` `__buildSelectCount`
(~:846-860) — the branch that builds the count query for a plain select
that is neither `distinct` nor grouped constructs `selectCountData`
without `__customization`. Contrast the distinct/grouped branch
(~:819-843) and the compound branch (~:1524-1546), both of which thread
`__customization` (via `{...this.__asSelectData()}`) so the count query
wraps the customized query in a CTE and keeps the hooks.

**Reproduction**: (coordinator mock runtime-probe)
```
connection.selectFrom(tProject)
    .select({ id: tProject.id, name: tProject.name })
    .customizeQuery({
        beforeQuery: connection.rawFragment`/* before */ `,
        afterQuery:  connection.rawFragment` /* after */`,
    })
    .limit(10).offset(0)
    .executeSelectPage()
```
- Data query (`ctx.history[0].sql`): `/* before */  select id as id, name as name from project limit $1 offset $2  /* after */` — hooks present.
- Count query (`ctx.history[1].sql`): `select count(*) from project` — hooks **dropped**.
- A **grouped** control keeps them: `with result_for_count as (/* before */  select … group by … /* after */) select count(*) from result_for_count`.

Note: the plain count query rewrites to `select count(*) from <table>`
(replacing the SELECT list), so there is no user SELECT to carry the
hooks inline — the fix should render the count query the same way the
grouped/compound path does (wrap the customized query in a
`result_for_count` CTE, or otherwise emit `beforeQuery` before and
`afterQuery` after the count statement) so the statement-level hooks
survive.

**Current workaround in the suite**: none — no test pins the plain-select
× `customizeQuery` × `executeSelectPage` count-query behaviour today.
When the extension lands, add a test asserting **both** `ctx.history[0]`
(data) and `ctx.history[1]` (count) SQL carry the hooks on a plain
select, as a sibling of the grouped/compound coverage in
`customize-query.compound.test.ts`; propagate across all 17 cells.

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
