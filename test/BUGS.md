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

## `buildFragmentWithMaybeOptionalArgs` drops a value-source arg's optionality when it follows a plain-value arg (`[…, plainValue, valueSource, …]`)

**Where**: `src/expressions/fragment.ts` — the `FragmentFunctionMaybeOptional3/4/5` overload
where arg *N* is a plain value (`TypeOfArgument`) and arg *N+1* is a value source
(`ArgBaseTypeForFn`): lines **436, 447, 456, 467, 475, 484, 492**. Each writes the merged
optional type as `MergeOptionalUnion<… | OptionalTypeOfValue<T_plain | T_source[typeof optionalType]> …>`
— the value-source arg's `T_source[typeof optionalType]` is **nested inside**
`OptionalTypeOfValue<…>`, which is non-distributive (`values.ts:59-63`, tests only
`null`/`undefined extends`). Since an `OptionalType` literal (`'optional'`) has no
`null`/`undefined`, it is silently discarded, so an **optional** value-source arg in that
position produces a **`'required'`** result instead of `'optional'`.

**Reproduction** (coordinator compile-repro, tsgo, reference cell; `coalesce3` =
`buildFragmentWithMaybeOptionalArgs(arg('string','optional')×3)`; `tProject.name`/`.slug`
required string sources, `tIssue.body` an optional string source):
- `conn.coalesce3(tProject.name, 'b', tIssue.body)` — `[src, value, src-OPTIONAL]`, overload
  `:436` → result key typed **`{ r: string }` (required)**. **← BUG** (an optional arg is present).
- Mirror `conn.coalesce3(tProject.name, tIssue.body, 'b')` — `[src, src-OPTIONAL, value]`,
  overload `:433` → **`{ r?: string }` (optional)**. **← correct.**
- Control `conn.coalesce3(tProject.name, 'b', tProject.slug)` — `[src, value, src-required]`,
  overload `:436` → **`{ r: string }` (required)**. **← correct** (no optional arg).
Two calls with exactly one optional value-source arg each yield different result optionality;
the divergence isolates to the mis-bracketed `:436`-family overloads. Unsound: the
`MaybeOptional` contract is "result optional iff any input arg is optional", so a fragment
body that propagates a null from the optional arg (e.g. arithmetic `${a} + ${b} + ${c}`)
can return `null` at runtime while TS promises non-null. Verified with an isolated
`@ts-expect-error` key-omission probe (cross-assertion `assertType` in one scope gives
cascading TS2344s — isolate each case).

**Suggested fix**: at each of the 7 sites replace
`OptionalTypeOfValue<T_plain | T_source[typeof optionalType]>` with
`OptionalTypeOfValue<T_plain> | T_source[typeof optionalType]` (matching the correct sibling
overloads on the surrounding lines). A src-wide grep for
`OptionalTypeOfValue<…[typeof optionalType]…>` returns exactly these 7 lines.

**Current workaround in the suite**: none — the path is uncovered. Every `coalesce3` call in
the matrix passes all-plain args (`coalesce3('a', undefined, 'c')`), so no snapshot baked the
wrong behavior. The positive test (a `[source, value, optional-source]` MaybeOptional fragment
asserting an optional result) is **blocked by this bug**; this entry is its marker.

## Empty-batch `values([])` on the RETURNING execute-shapes dispatches an empty SQL string (real-DB error)

**Where**: `src/queryBuilders/InsertQueryBuilder.ts`. `executeInsert` guards the empty-batch
case (`:67` `if (multiple && multiple.length <= 0) return resolved [] / 0`), but
`executeInsertMany` (`:264`), `executeInsertOne` (`:228`) and `executeInsertNoneOrOne` (`:192`)
have **no** such guard — they call `this.query()` and dispatch to the runner.
`_buildInsertMultiple` (`src/sqlBuilders/AbstractSqlBuilder.ts:1421`) returns **`''`** for an
empty batch (`if (multiple.length <= 0) return ''`), so the returning shapes hand an empty SQL
string to the driver.

**Reproduction** (coordinator mock probe): `conn.insertInto(tProject).values([]).executeInsert()`
short-circuits (returns `0`, `ctx.history.length === 0` — runner never touched); but
`conn.insertInto(tProject).values([]).returning({ id: tProject.id }).executeInsertMany()`
**does** reach the runner (`ctx.history.length === 1`) rather than short-circuiting. On the mock
the result is `[]` (SQL not executed), so it is **mock-blind**; on a real DB the dispatched `''`
is an empty-query error (universal across drivers). Source-confirmed mechanism; a `--docker`
spot-check on PG would make it airtight.

**Suggested fix**: apply the same empty-multiple short-circuit `executeInsert` uses to
`executeInsertMany`/`executeInsertOne`/`executeInsertNoneOrOne` (resolve `[]` / `null` / apply
the `min`/`max` guards against count 0).

**Current workaround in the suite**: none — `insertInto(t).values([])` is exercised only via
`executeInsert` (`errors.insert-guards.test.ts`), never via the returning shapes.

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
