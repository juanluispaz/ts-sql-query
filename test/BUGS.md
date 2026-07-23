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
2. **Refresh the index**: `npm run tests:index:newest` (gitignored; the newest-cells
   index — low RAM. Use the full `npm run tests:index` only when chasing a
   version-specific bug in an older-tier cell).
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

## `extendShape` tests the wrong operand, so it rejects new keys and accepts real overrides

**Where**: `src/queryBuilders/UpdateQueryBuilder.ts:270` and
`src/queryBuilders/InsertQueryBuilder.ts:420` — identical code in both.

```ts
if (typeof value === 'string' || isColumn(value)) {            // 268 / 418
    const currentShapeValue = this.__shape[property]           // 269 / 419
    if (typeof currentShapeValue === 'string' || isColumn(value)) {   // <-- `value`, not `currentShapeValue`
```

The inner check is meant to ask whether the property **already exists** in the shape. Its
second disjunct asks about `value` — the incoming value — which the outer `if` has already
established. Two consequences:

1. **False rejection.** Adding a *brand-new* key whose shape value is a column object always
   throws `INVALID_SHAPE_OVERRIDE`, even though the key is absent from the current shape
   (`currentShapeValue` is `undefined`). Reachable on UPDATE, where `UpdateShape` values are
   `WritableDBColumn | ColumnsForSetOf<TABLE>`.
2. **False acceptance.** Overriding an existing *column-valued* property with a **string** is
   silently allowed — the disjunct that would catch it (`isColumn(currentShapeValue)`) never
   runs. This is the case the error exists to prevent.

**Reproduction** (well-typed, no casts):

```ts
conn.update(tIssue)
    .shapedAs({ newTitle: 'title' })
    .extendShape({ newAssignee: tIssue.assigneeId })   // throws INVALID_SHAPE_OVERRIDE — should not
```

**Current workaround in the suite**: none — no test calls `extendShape` with a column-object
value, which is why neither symptom is visible today. Found by cycle-4 branch triage:
`UpdateQueryBuilder.ts:268`'s `binary-expr` arm is uncovered, and `InsertQueryBuilder.ts:418`
was classified "the `isColumn(value)` half is dead for INSERT" — both are the same typo.
A regression here would be silent in either direction.

## A CTE added to an INSERT after the statement was first built is referenced but never declared

**Where**: `src/queryBuilders/InsertQueryBuilder.ts` — `__withsGenerated` is set at line 1941 and
guards the generation at 1938, but `set(...)` (line 462) clears `__query` to force a rebuild
**without** resetting `__withsGenerated`.

**Reproduction** (well-typed, no casts): build the insert once so the flag latches, then stage a
value that introduces a *new* CTE, then build again.

```ts
const cte = conn.selectFrom(tIssue).select({ n: tIssue.id }).forUseInQueryAs('c')
const ins = conn.insertInto(tProject).dynamicSet().set({ name: 'x' })
ins.query()                                        // __withsGenerated latches true
ins.set({ organizationId: conn.selectFrom(cte).selectOneColumn(cte.n).forUseAsInlineQueryValue() })
ins.query()                                        // rebuilds the statement, SKIPS with-generation
```

The second rendering references the CTE alias while the `with` clause that declares it is missing,
so the engine rejects the statement. `set()` already clears `__query` precisely because the
statement must be re-rendered; `__withsGenerated` needs the same treatment (or the generation needs
to be idempotent against a changed CTE set).

**Current workaround in the suite**: none, and none is possible as a *coverage* test — the
`__withsGenerated` guard is invisible in the ordinary single-build path, because with-generation is
already idempotent there (`WithViewImpl.__addWiths` short-circuits on `withs.includes(this)`).
Removing the guard changes no emitted SQL in any existing test. Only the build-twice-with-a-new-CTE
sequence above distinguishes it. Found by cycle-5 branch triage while attempting
`InsertQueryBuilder.ts:1938`, which was then dropped as unfalsifiable.

## `isQueryAllowed` never inspects the `onConflictOn(...)` conflict-target columns

**Where**: `src/queryBuilders/InsertQueryBuilder.ts:2044` (`__isAllowed`) and `:2114`
(`__hasAggregation`).

Both pass `this.__onConflictOnColumns` — a plain `Array<AnyValueSource>` assigned from a rest
parameter at `:1776` — to the helpers in `src/utils/ITableOrView.ts:95` / `:105`, which only
duck-type a **single** object (`typeof value.__getValuesForInsert === 'function'`). An Array never
matches, so the helper falls through to `return true` and the guard at `:2045-2046` is dead code.

The sibling `__addWiths` at `:1961-1966` gets it right and shows the intended shape:

```ts
const onConflictOnColumns = this.__onConflictOnColumns
if (onConflictOnColumns) {
    for (let i = 0, length = onConflictOnColumns.length; i < length; i++) {
        __addWiths(onConflictOnColumns[i], sqlBuilder, withs)
    }
}
```

**Reproduction** (well-typed, PostgreSQL/SQLite where `onConflictOn` is available):

```ts
const q = conn.insertInto(tProject)
    .values({ organizationId: 1, slug: 'mktg-site', name: 'x' })
    .onConflictOn(tProject.organizationId, tProject.slug.allowWhen(false, 'blocked'))
    .doUpdateSet({ name: 'y' })

isQueryAllowed(q)        // true  ← wrong
await q.executeInsert()  // throws DISALLOWED: blocked
```

The introspection walker and the renderer disagree: the walker says the query is allowed, then
building it throws. That is precisely the contract the walker exists to uphold — it is meant to
answer "would this build?" without rendering.

**Current workaround in the suite**: none, and none is possible — the arm is unreachable, so no test
can distinguish the fixed from the broken behaviour today. Found by cycle-8 branch triage while
attempting `InsertQueryBuilder.ts:2045`, which was then dropped as dead. Once fixed, the natural
test is `gate-on-on-conflict-target-column-fires-on-build` in `insert.on-conflict.allow-when.test.ts`
— live on the 8 postgres + 45 sqlite cells, wrapped on the other 14 with each cell's existing
`onConflictOn is narrowed away` marker.

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
