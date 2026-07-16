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

## The default projector types a dropped optional leaf as a PRESENT key (`T | undefined`) whenever its containing object is optional — contradicting the projection rules and the runtime

**Where**: `src/complexProjections/resultWithOptionalsAsUndefined.ts:215-219` —
`TransformOptionalProperties<RESULT>` is the machinery that turns a value-union
`T | undefined` into an optional KEY `?: T` (via `OptionalMap` / `OptionalPropertiesOf`
at `:221-224`, which also strips the union with `NonNullable<RESULT[P]>`). But its two
leading guards short-circuit it:

```ts
type TransformOptionalProperties<RESULT> =
    null extends RESULT ? RESULT
    : undefined extends RESULT ? RESULT      // <-- bails out here
    : ...
    : { [P in keyof OptionalMap<RESULT>]: ... NonNullable<RESULT[P]> }
```

Rules 1, 2 and 4 all mark the containing object OPTIONAL, so the rung returns
`{...} | undefined` (`:100`, `:107`, `:120`, `:130`, `:137`, `:150`, `:160`, `:167`,
`:180`, `:190`, `:197`, `:210`). That makes `undefined extends RESULT` true, so the
transform returns `RESULT` unchanged and the object's own keys are **never** re-encoded.
Only a rule-3 (required) object reaches the transform.

**Which levels.** Each rung calls `TransformOptionalProperties` once, and it only ever
fixes *its own* keys (it is not recursive):

| level | type | optional container possible? | transform | verdict |
|---|---|---|---|---|
| 1 | `ResultObjectValues` (`:56`) | **no** — no arm is unioned with `\| undefined`, per the spec note "First level object cannot be marked as optional" | always runs | ✅ |
| 1 (aggregateAsArray) | `ResultObjectValuesForAggregatedArray` (`:63`) | **no** — "the result for aggregateAsArray must not be nullable" | always runs | ✅ |
| 2–5, rule 3 | `ResultObjectValues2..5` | container required → no `\| undefined` | runs | ✅ |
| **2–5, rules 1/2/4** | `ResultObjectValues2..5` | container optional → `{...} \| undefined` | **bails** | ❌ |

So the defect is confined to **nested objects (level ≥ 2) that the rules mark optional**,
and it is uniform across rungs 2, 3, 4 and 5.

`ResultObjectValues5` (`:183-211`) is **deliberately special and is NOT part of this
defect**: it is the recursion cutoff — its inner-object branch is `never // Stop recursion
here` instead of recursing to a level 6 (mirrored in `projectionRules.ts` by
`ContainsRequired5`, "the nesting limit was reached, so a still-nested inner object is
assumed to be required"). Its rule dispatch and its `TransformOptionalProperties` bail are
identical to rungs 2–4. **Do not touch the cutoff when fixing this.**

**What breaks inside a bailed object — leaves AND nested object keys.** Because the rung's
transform never runs, none of that object's own keys are re-encoded:
- optional leaf → `k: T | undefined` (should be `k?: T`)
- optional inner-object key → `k: {...} | undefined` (should be `k?: {...}`)

**Why it is camouflaged:** the *parent's* transform (when the parent is itself required)
does correctly fix the child's KEY and strips the child's outer `| undefined` — so the
container reads correctly and only its contents are wrong. Both appear in one type below
(`inner?: { est: number | undefined }`).

This contradicts the documented rules in
`src/complexProjections/projectionRules.ts:13-53`, which state for **every** rule that
non-required leaves are "marked as **optional**" (rule 1: "originallyRequired & optional
are marked as optional"; rule 2 defers to rule 1; rule 3 and rule 4 likewise).

**Reproduction**: `test/db/postgres/newest/pg/dynamic-condition.pick.test.ts:539-577`
(`pick/rule-2-left-join-leaf-inside-picked-object-default`) asserts both sides of the
divergence in the same test:

```ts
assertType<Exact<typeof rows, Array<{
    iid:  number
    proj?: { id: number; name: string; archivedAt: Date | undefined }  // key PRESENT
}>>>()
expect(rows).toEqual([{ iid: 1, proj: { id: 1, name: 'Marketing site' } }])
expect('archivedAt' in rows[0]!.proj!).toBe(false)                     // key ABSENT at runtime
```

`proj` is rule-2 (all mandatory leaves from the same left join, originally required) so
the object is optional → the transform bails → `archivedAt` stays `Date | undefined`.
With `exactOptionalPropertyTypes` on (this repo), `archivedAt: Date | undefined` means
the key MUST exist, but the default projector drops it. The correct type is
`archivedAt?: Date`.

Contrast proving the inconsistency: a **required** (rule-3) object gets the transform and
its optional leaves correctly project as `?: T` — every optional `col_matrix` arm in
`select.column-factory-matrix.test.ts` asserts `?: T` (base type, no `| undefined`),
because the top-level object has a required `id`.

**Minimal compile-repro isolating the level and the rule boundary** (type-only, PostgreSQL
cell; `const _x: 0 = …` makes tsgo print the inferred type). The same `body` leaf sits in
the same level-2 position in both objects; only the sibling's requiredness differs:

```ts
declare const conn: DBConnection

// LEVEL 1 — optional leaf beside a required one
conn.selectFrom(tIssue).select({ id: tIssue.id, body: tIssue.body })
// -> { body?: string; id: number; }                                        OK

// LEVEL 2, RULE 3 — inner object has a required leaf -> container required
conn.selectFrom(tIssue).select({ id: tIssue.id, o: { title: tIssue.title, body: tIssue.body } })
// o -> { body?: string; title: string; }                                   OK

// LEVEL 2, RULE 4 — inner object all-optional -> container optional
conn.selectFrom(tIssue).select({ id: tIssue.id, o: { body: tIssue.body, est: tIssue.estimatedHours } })
// o -> { body: string | undefined; est: number | undefined; } | undefined  BUG (present keys)

// LEVEL 3 inside an OPTIONAL level-2 container: the nested OBJECT key breaks too
conn.selectFrom(tIssue).select({ id: tIssue.id, o: { body: tIssue.body, inner: { est: tIssue.estimatedHours } } })
// o -> { body: string | undefined; inner: { est: number | undefined; } | undefined; } | undefined   BUG

// Control: same level-3 shape inside a REQUIRED level-2 container
conn.selectFrom(tIssue).select({ id: tIssue.id, o: { title: tIssue.title, inner: { est: tIssue.estimatedHours } } })
// o -> { inner?: { est: number | undefined; }; title: string; }
//       ^ key fixed by the level-2 transform     ^ but level-3 bailed, so its own leaf is still present-key
```

The last line shows both halves of the mechanism in a single type: a transform fixes only
the level it runs on.

Note: `resultWithOptionalsAsNull.ts` (the `projectingOptionalValuesAsNullable` projector)
is correct as-is — it deliberately keeps the key present as `T | null`. Only the
as-undefined (default) projector is affected. A fix likely needs to distribute instead of
bail, e.g. `undefined extends RESULT ? TransformOptionalProperties<NonNullable<RESULT>> | undefined`
(and the `null` guard likewise) — but check both projectors per `CLAUDE.md`.

**Current workaround in the suite**: none — the tests pin the current (unsound) type. The
whole `pick/*` family in `dynamic-condition.pick.test.ts` and the rule-1/2/4 leaves in
`select.complex-projection.*` assert `T | undefined` present-key. When fixed, those
`assertType<Exact<...>>` blocks flip from `k: T | undefined` to `k?: T` and the `'k' in obj`
probes keep passing unchanged.

## Base dialect (`AbstractSqlBuilder`) emits invalid SQL for `_asDouble` and `_divide`: `double presition` typo, plus a missing space that glues the operand to `as`

**Where**: `src/sqlBuilders/AbstractSqlBuilder.ts`

- `_asDouble` (`:2989-2991`) — **two** defects on one line:
  ```ts
  return 'cast(' + this._appendSql(valueSource, params, false) + 'as double presition)'
  //                                                            ^ missing space   ^ typo
  ```
  emits `cast(priorityas double presition)` — the operand and `as` are glued together, and
  `presition` should be `precision`. Invalid on every engine.
- `_divide` (`:3254-3255`) — `presition` twice:
  ```ts
  return 'cast(' + ... + ' as double presition) / cast(' + ... + ' as double presition)'
  ```
  (the spaces are correct here; only the type name is misspelled).

`AbstractSqlBuilder` is the **designated base dialect** (SQLite-shaped, expanded by
PostgreSQL with minimal overrides), so a broken base is a real defect even though all six
shipping dialects currently override both methods — the wall-to-wall overrides are the
design-debt symptom, not proof the base is dead. `NoopDBSqlBuilder` inherits the base, and
`src/connections/NoopDBConnection.ts` is a shipped connection.

Compare the SQLite override, which is what the base is meant to be:
`SqliteSqlBuilder._divide` (`:285-287`) → `cast(x as real) / cast(y as real)`;
`SqliteSqlBuilder._asDouble` (`:288-290`) → `cast(x as real)`.

**Reproduction**: no matrix cell reaches it today (every dialect overrides both), which is
exactly why it survived: `grep -rn "presition" test/` returns nothing. Fixing the base to
be SQLite-shaped (`as real`) should make the SQLite overrides redundant and removable,
which then makes the base reachable from the SQLite cells — the same remedy shape as the
`_likeEscape` rework, which removed the SQLite/Oracle LIKE overrides. (If the base is
instead meant to be standard-SQL-shaped, the minimum fix is `precision` + the missing
space.)

Operator precedence and the rest of the arithmetic emission were probed and are correct:
`(p+2)*3`, `(p*2)+3`, `p+(p*2)`, `p-(p-1)`, `p+2+3`, `p*2*3`, `(p/2)+1`, `(p-1)*2` all
parenthesize correctly (conservative, never wrong).

**Current workaround in the suite**: none, and no test can reach the base while the
overrides stand. Prior rounds mis-classified this as cosmetic/dormant/OUT
(`MISSING_TESTS_AUDIT_45.md:129`, `MISSING_TESTS_AUDIT_46.md:181`) on the "all 6 dialects
override it" reasoning — the inverse error the base-dialect rule in
`TYPE_AUDIT_RUNBOOK.md` exists to prevent.

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
