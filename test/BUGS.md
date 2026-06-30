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

## `int.modulo(double-column)` emits plain `%`, which PostgreSQL/SqlServer reject

**Where**: `src/sqlBuilders/PostgreSqlSqlBuilder.ts` `_modulo`
(lines 268-280). The override wraps both operands in `mod(...::numeric)`
only when the **receiver** `columnType` is `'double'`/`'customDouble'`;
when an **int** receiver is modulo'd by a **double** operand (the
overloaded-number dispatcher promotes the *result* to double but still
passes the receiver's `columnType === 'int'` to `_modulo`), it falls
through to `super._modulo`, which emits the inherited `priority %
estimated_hours`.

**Reproduction**: `tIssue.priority.modulo(tIssue.estimatedHours)`
(int receiver, `double` column operand) emits
`select ... priority % estimated_hours ...`. PostgreSQL rejects it at
runtime: `operator does not exist: integer % double precision`
(SQLSTATE 42883). This is the int-receiver mirror of the round-14
`double % x` modulo class — the fix added the `columnType === 'double'`
branch (the double-*receiver* direction) but not the
double-*operand* direction. The fix likely needs to also wrap when the
math argument type (`_getMathArgumentType(...)` for the value) resolves
to a double/customDouble. SqlServer has the same `%`-on-float gap;
SQLite silently truncates the operand to integer (wrong value 0 instead
of 0.5) rather than erroring.

**Current workaround in the suite**:
`select.numeric-overloaded-promotion.test.ts`, test
`int-receiver-modulo-double-column-promotes-result-to-double`, is
block-commented with `// TODO[BUG]: see test/BUGS.md` in every cell.
The full canonical body inside the block asserts the intended fixed
PostgreSQL SQL (`mod((priority)::numeric, (estimated_hours)::numeric)`)
and value `0.5`.

## `projectingOptionalValuesAsNullable()` is not exposed on a compound's typed surface

**Where**: `CompoundedExecutableSelectExpression` in
`src/expressions/select.ts` (the interface a `.union(...)` /
`.intersect(...)` / `.except(...)` chain returns). It declares the
set-operator overloads and `executeSelect*` but NOT
`projectingOptionalValuesAsNullable()`.

**Reproduction**: `a.select({...}).union(b).projectingOptionalValuesAsNullable()`
is rejected by the type-checker (`Property
'projectingOptionalValuesAsNullable' does not exist on type
'CompoundedExecutableSelectExpression<…>'`), yet the RUNTIME honors it:
the implementation (`AbstractSelect.projectingOptionalValuesAsNullable`
returns `this`, and the result projector reads the flag) produces the
correct `T | null` / `{...} | null` output for a compound — a
`--docker` run of that exact chain passes (a null optional leaf surfaces
as present-null instead of being dropped). So the runtime supports the
operation and only the typed surface omits it. Applying the modifier on
the FIRST arm before `.union(...)` instead (`...select({...})
.projectingOptionalValuesAsNullable().union(b)`) type-checks but is
silently ignored at runtime (the optional leaf is still dropped), so
there is no type-safe public path to a nullable-projected compound.

**Current workaround in the suite**:
`select.compound-optional-as-nullable.test.ts`, tests
`compound-optional-flat-leaf-as-nullable-surfaces-null` and
`compound-optional-left-joined-object-as-nullable-surfaces-null`, are
block-commented with `// TODO[BUG]: see test/BUGS.md` in every cell. The
full canonical bodies inside the blocks call
`.union(...).projectingOptionalValuesAsNullable()` (the runtime-correct
form) and assert the `T | null` leaf and present-null value.

## `createTableOrViewCustomization` template is dropped when the wrapper is re-aliased or made left-joinable

**Where**: `src/Table.ts` lines ~41-55. `Table.as()` and
`Table.forUseInLeftJoinAs()` clone via `new (this.constructor)()` and
copy only `__as` / `__forUseInLeftJoin`, never the customization fields
`__template` / `__customizationName`. `src/View.ts` and `src/Values.ts`
have the same clone shape, so customized Views/Values lose it too.

**Reproduction** (mock, postgres): `connection.withSqlHint(t)` renders
its `/*+ hint */` fragment under `selectFrom(customized)`,
`innerJoin(customized)`, `update(customized)`, `deleteFrom(customized)`
and in a compound arm, but is silently dropped by `.as(...)` /
`.forUseInLeftJoin()`:
- `selectFrom(withSqlHint(t,'c1'))` → `select id from /*+ hint */ organization` ✓
- `selectFrom(withSqlHint(t,'c1').as('o'))` → `select "o".id from organization as "o"` ✗ (hint gone)
- `leftJoin(withSqlHint(t,'c2').forUseInLeftJoin())` → `… left join organization on …` ✗ (hint gone)

The type permits the call and it runs without error (the emitted SQL is
still valid, just missing the hint), so coverage stays green — a
type-vs-runtime gap.

**Current workaround in the suite**:
`select.table-customization-positions.test.ts`, test
`table-customization: wrapper as left-join target widens columns`, is
LIVE in every cell asserting the current (hint-less) leftJoin SQL with a
`// TODO[BUG]` marker on the assertion. The selectFrom-arm / update /
delete positions render the hint correctly and assert it present.

## `mutation.shaped-compositions` `shaped-update-returning-one-row` is mock-validated but rejected by real MariaDB

**Where**: `test/db/mariadb/newest/mariadb/mutation.shaped-compositions.test.ts`,
test `shaped-update-returning-one-row` (LIVE / un-gated in the mariadb
cell; committed in 63ec424f, pre-dates round 18). Surfaced by the
round-18 `--docker` validation pass, not introduced by it.

**Reproduction**: the test emits
`update project set name = ? where id = ? returning id as id, name as name`.
Against the `mariadb:latest` docker image it fails:
`SQL_SYNTAX_ERROR (1064, 42000) … near 'returning id as id, name as name'`.
It passes under the mock (mock-validated only).

**Not a `src/` defect**: the library emits valid SQL — `UPDATE … RETURNING`
just needs MariaDB 13.0.1+ (MDEV-5092) and the image still ships 12.x.
This is the same engine limitation already gated in the mariadb cells of
`update.returning.test.ts` and `update.with-old-values-in-returning.test.ts`.

**Resolution (test-suite fix, not a src change)**: gate this test in the
mariadb cell with the existing `// TODO[LIMITATION]: see LIMITATIONS.md —
UPDATE…RETURNING needs MariaDB 13.0.1+ (MDEV-5092); mariadb:latest ships
12.x` marker (full canonical body preserved), mirroring the two returning
files above. No `src/` change; remove this entry once the marker lands.

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
