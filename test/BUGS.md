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

## `is` / `isNot` / `isIfValue` / `isNotIfValue` report an optional type the operator cannot produce

**Where**: `src/internal/ValueSourceImpl.ts:191-199` (`isIfValue`, `is`, `isNotIfValue`,
`isNot`), all four built with `getOptionalType2(this, value)` (`:2137-2143`),
which answers the RECEIVER's optional type. Declared types are in
`src/expressions/values.ts:266-271`.

**Reproduction**: `IS [NOT] DISTINCT FROM` is a TOTAL predicate — it is the
operator you use precisely because it never returns NULL. Verified on a real
engine (PostgreSQL via pglite), over a row where the column IS NULL:

| expression | result | `is null` |
|---|---|---|
| `b is not distinct from 1` | `false` | **false** |
| `b is distinct from 1` | `true` | **false** |
| `b is not distinct from null` | `true` | **false** |
| `b = 1` (ordinary comparison, for contrast) | `null` | true |

So the honest optional type for the whole family is `'required'`, whatever the
receiver is. What the library has instead:

| method | DECLARED | RUNTIME |
|---|---|---|
| `is` | `'required'` ✅ | the receiver's ❌ |
| `isNot` | `'required'` ✅ | the receiver's ❌ |
| `isNotIfValue` | `'required'` ✅ | the receiver's ❌ |
| `isIfValue` | the receiver's ❌ | the receiver's ❌ |

Three of the four have a runtime that contradicts their own declaration, and
`isIfValue` is the one whose DECLARATION is also wrong.

**Consequence — it is not only cosmetic, it reaches the SQL.** On the dialects
with no native boolean in a projected position the shape is chosen from
`__optionalType`, so an over-report emits the 3-branch form with a dead
`else null` and binds the parameter TWICE. Measured, SQL Server,
`tX.b.is(1)` projected:

```sql
cast(case when case when [b] = @0 then 1 else 0 end = 1 then 1
          when not (case when [b] = @1 then 1 else 0 end = 1) then 0
          else null end as bit)
```

The `else null` branch is unreachable — the operator cannot return NULL — and
`@1` exists only to feed it. The 2-branch form is the correct emission. SQL
Server also wraps a non-`'required'` value in `isnull(…, 'null')` inside an
aggregated array built as JSON text, which is equally unnecessary here.

**Diagnosis** (measured, so the fixing agent need not redo it): the four are
built through the generic operand-merging helper, which is right for an
ORDINARY comparison — `b = 1` really is NULL when `b` is — and wrong for a total
predicate. The fix is to pass `'required'` explicitly at the four sites, and to
correct `isIfValue`'s declaration to `'required'` so the pair stops being
asymmetric. Note the `*IfValue` twins turn NEUTRAL when the operand is absent,
and the neutral must then carry `'required'` too — that is not an exception to
the neutral rule but the rule itself: the neutral inherits the optional type of
THE EXPRESSION IT STANDS FOR, and for a total predicate that is `'required'`
(see `THE NEUTRAL'S OPTIONALITY` in `src/typeSystem/nodes/conditionValueSource.ts`).

**Current workaround in the suite**: none, and no test would notice a
regression — the emitted SQL is snapshotted as it is today, so the dead branch
is baked into the snapshots rather than flagged by them. Fixing this WILL move
Oracle and SQL Server snapshots for any projected `is`/`isNot`/`is*IfValue`;
classify them against this entry rather than refreshing them. A test asserting
that the projected result of `is` over an OPTIONAL column is non-nullable is the
one to add with the fix.

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
