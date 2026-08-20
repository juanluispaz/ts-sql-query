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

## `inN` / `notInN` report `required` when an OPTIONAL value source is among the elements — the query then throws

**Where**: `src/internal/ValueSourceImpl.ts:270-274` (`inN` / `notInN`), which
compute their optional type with `getOptionalType2(this, value)`
(`:2121-2126`). `value` there is the varargs ARRAY, so `isValueSource(array)` is
false and the function returns the RECEIVER's optional type without ever looking
at the elements.

**Reproduction** (PostgreSQL; verified end to end on a real engine — pglite):

```ts
tX.id  = column('id', 'int')            // required
tX.qty = optionalColumn('qty', 'int')   // nullable

conn.selectFrom(tX).where(tX.id.equals(1))
    .select({ id: tX.id, hit: tX.id.inN(3, tX.qty) })
    .executeSelectOne()
```

Row `(id = 1, qty = NULL)`. The emitted predicate is `id in ($1, qty)`, and the
engine answers **NULL** — SQL's three-valued logic: no element matched and one of
them is NULL, so the result is unknown, not false. TypeScript declares the
column `optional` (`MergeOptional<OPTIONAL_TYPE, VALUE[optionalType]>`,
`src/expressions/values.ts:283-286`), but the runtime says `required`, so
`AbstractQueryBuilder.ts:75` rejects the row:

```
TsSqlQueryExecutionError: MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE:
Expected a value as result of the column `hit`, but null or undefined value was found
```

**Engine evidence** (raw SQL, no library): `select (id in (3, qty)) from x` over
that row returns NULL on **PostgreSQL** and on **SQLite**, and `is null` on it is
true; `not in` is NULL too. With a matching element (`id in (1, qty)`) it is
`true` — the NULL only decides the outcome when nothing matched.

**Expected — BOTH cases, not a blanket widening.** Measured on PostgreSQL, with
`id`/`a` NOT NULL and `b` nullable, over a row where nothing matches:

| expression | engine | so the optional type must be |
|---|---|---|
| `id in (3, 4)` — receiver and every element required | `false` | **`required`** |
| `id in (3, a)` — element is a NOT NULL column | `false` | **`required`** |
| `id in (3, b)` — one element is nullable | **NULL** | `optional` |
| `b in (3, 4)` — the RECEIVER is nullable | **NULL** | `optional` |

So the fix is to MERGE the receiver's optional type with each element's, exactly
as the declared type already says (`MergeOptional<OPTIONAL_TYPE,
VALUE[optionalType]>`) and exactly as the library already does for operators that
take a single operand (`getOptionalType2`) or two (`getOptionalType3`). **The
required case must stay `required`** — forcing `optional` whenever an element is a
value source would trade an under-report for an over-report, and over-reporting
has its own cost (Oracle and SQL Server emit the 3-branch `case … else null end`
for a projected boolean, and SQL Server adds the `isnull(…, 'null')` JSON wrap).
The elements are a varargs array, so the merge has to walk it; that walk is the
whole missing step.

**Tests to add with the fix — both arms**, in every cell: one `inN`/`notInN` with
an OPTIONAL column among the elements (asserting the result is optional and the
row comes back) and one with only REQUIRED operands (asserting it stays required).
The suite has the second shape today and is missing the first, which is why the
defect survived.

**The tell that it is a bug and not a design decision**: the single-value-source
overload gets it RIGHT. `tX.id.in(tX.qty)` reports `optional` and the very same
query returns the row (`hit` absent). Same family, same operand, two answers,
depending only on whether the value source was passed alone or spread among the
varargs.

**Current workaround in the suite**: none, and the matrix would NOT notice a
regression — but the gap is narrower than "untested". The shape IS covered:
`select.*` tests across the cells call `.inN(1, tIssue.id)` and
`.notInN(1, tIssue.id)`. Every one of them passes a **required** value source, so
`MergeOptional<required, required>` is `required` and the wrong answer coincides
with the right one. **One test with an OPTIONAL column among the elements would
have caught this**, and that is the test to add with the fix.

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
