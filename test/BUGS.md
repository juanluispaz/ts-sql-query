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

## Affix predicates with a literal `_` never match on SQL Server & Oracle (`_escapeLikeWildcard` maps `_` → `[]`)

**Where**: `src/sqlBuilders/SqlServerSqlBuilder.ts` `_escapeLikeWildcard`
(`value.replace(/_/g, '[]')`) and `src/sqlBuilders/OracleSqlBuilder.ts`
(same). The sibling escapes wrap the char in a bracket class (`%`→`[%]`,
`[`→`[[]`); the `_` arm is missing the char inside the brackets — it should
be `[_]`, not `[]`. `[]` is an empty character class that matches nothing.

**Reproduction** (docker-confirmed on both engines): insert
`email = 'a_b@probe.test'`, then
`tAppUser.email.startsWith('a_b').executeSelectMany()` returns **[]** (no
match) on `sqlserver/newest/mssql` and `oracle/newest/oracledb`; a
wildcard-free control `startsWith('a')` matches the same row, proving it
persisted. Affects every affix predicate
(`startsWith`/`endsWith`/`contains` + their `not`/`Insensitive`/`IfValue`
variants) whose needle contains a literal `_`. Mock-invisible: the mock
never runs the LIKE, and the existing
`select.where.like-escape-literal.test.ts` locks the emitted `50[%][]x` param
but its runtime assertion is trivially satisfied (`mockNext([])` + a needle
no row contains → `toEqual([])` passes whether or not the escape works).
Additionally on Oracle the whole bracket-escaping approach is inconsistent
with the affix predicates' `... escape '\'` clause — Oracle LIKE has no
`[...]` character classes, so `%`→`[%]` / `[`→`[[]` are also emitted as
literal bracket text rather than escaped wildcards (the underscore case is
the confirmed, clearest manifestation).

**Current workaround in the suite**: none yet — a positive-match test
(insert a row with a literal `_`/`%`, assert the affix predicate matches it)
would carry `// TODO[BUG]` until the escape is fixed.

## Rule-2 left-join object with a `const` leaf keeps the object on a join miss with the left-join leaf absent, violating its declared-required type

**Where**: type side `src/complexProjections/projectionRules.ts`
(`AllFromSameLeftJoinWithOriginallyRequired` ignores no-table leaves via
`NNoTableOrViewRequiredFrom`, so rule 2 applies and the object is typed
`proj?: { name: string; tag: string }` — required-when-present). Runtime side
`src/queryBuilders/AbstractQueryBuilder.ts` (`alwaysSameRequiredTablesSize`
tracking + the rule-2 drop gate): the const's required-table set is not
ignored the way the type ignores it, so the rule-2 "drop the whole object on
a miss" never fires.

**Reproduction** (mock-confirmed): a nested object mixing a left-join
`originallyRequired` leaf with a `connection.const()` no-table leaf —
`selectFrom(tIssue).leftJoin(tProjLeft).on(...).select({ iid: tIssue.id,
proj: { name: tProjLeft.name, tag: conn.const('rel','string') } })` — on a
join MISS (`mockNext({ iid:1, 'proj.name': null, 'proj.tag':'rel' })`)
resolves `{ iid:1, proj:{ tag:'rel' } }`: `proj` is PRESENT with `name`
ABSENT, while the type promises `proj?: { name: string; tag: string }`
(present ⟹ `name: string`). The pure rule-2 control (two left-join leaves,
no const) correctly drops the object → `{ iid:1 }`; the const leaf is the
differentiator. Same divergence under `projectingOptionalValuesAsNullable()`
(runtime `proj: { name: null, tag:'rel' }` vs typed `name: string`). Either
the runtime should drop `proj` on a full-left-join miss (matching the type),
or the type should demote `name` to optional — currently they disagree.

**Current workaround in the suite**: the existing
`rule-2-left-join-object-mixing-a-const-leaf-*` tests in
`select.complex-projection.mixed-rules.test.ts` mock only the join HIT, so
they never exercise the miss. A miss-row test carries `// TODO[BUG]`.

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
