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

---

## Case-insensitive ORDER BY on a compound query emits `lower(<alias>)`, which PostgreSQL rejects

**Where**: compound (UNION/INTERSECT/EXCEPT) ORDER BY emission for the
`insensitive` modifier in the SQL builders — the default path emits
`order by lower(<alias>)`. Reachable from `.union(...).orderBy(alias, 'asc insensitive')`.

**Reproduction**: [`test/db/postgres/newest/pg/select.compound.test.ts`](db/postgres/newest/pg/select.compound.test.ts) test
`union-with-insensitive-order-by`. The lib emits:

```sql
select name as label from project union select title as label from issue order by lower(label) asc
```

PostgreSQL rejects it at execution:

> error: invalid UNION/INTERSECT/EXCEPT ORDER BY clause
> detail: Only result column names can be used, not expressions or functions.

A compound query's ORDER BY may reference only result column names, never an
expression like `lower(...)`. The lib should emit a portable case-insensitive
ordering for compound queries (or reject it at build time) instead of SQL the
engine refuses.

**Current workaround in the suite**: the test is mock-only — it pins the
emitted SQL and returns before executing on the real engine
(`if (ctx.realDbEnabled) return`), carrying a
`// tests-audit-disable-next-line mock-only -- ...` line and a `// TODO[BUG]`
marker pointing here.

---

## Object-valued column extension rules are accepted at runtime but rejected by the `DynamicFilter` type

**Where**: the dynamic-condition extension typing (`DynamicFilter` /
`DynamicCondition` / the extension-key modelling in
`dynamicConditionUsingFilters.ts`). The runtime
(`DynamicConditionBuilder.processAdditionalColumnFilter`) accepts a column
extension entry that is an OBJECT of rules (recursing to any depth) and emits
correct SQL; the type only models extension entries that are FUNCTIONS
(`DynamicConditionRule`), so the matching filter shape doesn't typecheck.

**Reproduction**: [`test/db/postgres/newest/pg/dynamic-condition.nested-extension.test.ts`](db/postgres/newest/pg/dynamic-condition.nested-extension.test.ts)
tests `column-level-object-extension-rule-*`. An extension
`{ idRules: { above: (v) => tIssue.id.greaterThan(v) } }` plus a filter
`{ id: { idRules: { above: 10 } } }` runs and emits `where id > $1` correctly,
but the filter literal only compiles via `as any` — `DynamicFilter` rejects the
nested-object shape.

**Current workaround in the suite**: the filter is `... as any`, with a
`// TODO[BUG]` marker. (These tests assert SQL/params, so the cast is not the
audit's exempt runtime-guard case — the `as-any` warning stays until the type
models object-valued column extension rules.)

---

## The documented `tables-views-as-parameter` helper does not typecheck

**Where**: the source-tagging chain behind `subSelectUsing` / `fromRef` /
`TableOrViewOf` — a generic ref's source can't be reconciled with the
connection's, so the helper pattern shown on the docs page
`docs/advanced/tables-views-as-parameter.md` fails to compile.

**Reproduction**: building the documented generic helper
(`buildIssueCountSubquery<PROJECT extends TableOrViewOf<typeof tProject, 'project'>>(...)`)
exactly as the docs page shows it produces source-tagging errors
(`Argument of type 'TIssue' is not assignable to … OfSameDB<…>`, ending in
`Property 'valueWhenNull' does not exist on type 'never'`). Covered by the
smoke test in [`test/db/postgres/newest/pg/docs.advanced.tables-views-as-parameter.test.ts`](db/postgres/newest/pg/docs.advanced.tables-views-as-parameter.test.ts)
(`helper-pattern-runtime-sql-emission`). Either the docs page is wrong or the
generic source-tag inference through `subSelectUsing(fromRef(...))` is too
strict — check both.

**Current workaround in the suite**: the smoke test casts the connection to
`any` (`const conn: any = ctx.conn`) so the SQL emission is still validated,
with `eslint-disable` on the `no-explicit-any` lines and a `// TODO[BUG]`
marker. The `any-type` / `eslint-disable-type` warnings stay until the helper
typechecks.

---

## `executeUpdateNoneOrOne` / `executeUpdateOne` are not exposed on a bare `dynamicSet()` — bug or design?

**Where**: the `dynamicSet()` builder type (`DynamicExecutableUpdateExpression`)
exposes only `executeUpdate` (the affected-count path); `executeUpdateNoneOrOne`
/ `executeUpdateOne` are not on it. The runtime empty-set short-circuit
(`dynamicSet()` with no columns) does resolve sensibly on those paths
(`executeUpdateNoneOrOne` → `null`; `executeUpdateOne` → throws NO_COLUMN_SETS),
but they can only be reached past the type.

**Reproduction**: [`test/db/postgres/newest/pg/update.execute-variants.test.ts`](db/postgres/newest/pg/update.execute-variants.test.ts)
test `execute-update-none-or-one-with-no-sets-resolves-null` casts the builder
to `any` to call `executeUpdateNoneOrOne()` and assert `null`. **Needs a design
call**: if exposing those methods on `dynamicSet()` is intended, this is a
typing gap to fix; if a no-set update is deliberately restricted to the
count-only `executeUpdate`, the test exercises an unreachable path and should be
removed (or made a `types.negative/` assertion) rather than cast through `any`.

**Current workaround in the suite**: `... as any` + `// TODO[BUG]` marker. (The
sibling `execute-update-one-...-throws` asserts only the exception, so its cast
is the audit's exempt runtime-guard case; this one asserts a value, so the
`as-any` warning stays pending the decision.)

---

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
