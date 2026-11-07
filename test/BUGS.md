# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

A bug found while testing is usually fixed right away in `src/`, with a test that
fails before and passes after (see [`CLAUDE.md` § Testing strategy](../CLAUDE.md#testing-strategy)).
This file holds the ones found and left for later, with the test marked so the
suite stays green. What fixing one includes is in
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
   `// TODO[LIMITATION]`, `// NOT-SUPPORTED`, `// NOT-APPLICABLE`), and the wrap shape
   across cells — in one report.

   Recent miss: an entry on `virtualColumnFromFragment` named
   `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`.
   A fix that grepped only the two listed files would have left
   `Table.ts` regressed. `--declared full` lists all three.

The presets for the two main bug shapes live in
[§ "Common bug shapes"](#common-bug-shapes) below
(read them, even if your bug is "obvious"); the searcher-first triage
flow for test authors lives in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## How to write an entry (test author)

Keep it short — enough to reproduce, no deeper. Whoever fixes it
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
choosing a category, or proposing a fix — whoever fixes it owns all
of that. Two minutes of triage and one paragraph is the bar.

## Open Bugs

Most defects this suite surfaces are a **silently wrong value** rather than a
rejection, and are invisible to the matrix until a test reaches them — so each
entry says under *Current workaround in the suite* why the matrix can't see it.
A `none` there is not "nothing to do": it means no test would notice a
regression either.

## A `localDate` read and sent back doesn't find its row

**Where**: `transformValueToDB` for `localDate` (`AbstractConnection`, no override on the connections of
MySQL, MariaDB, Oracle and PostgreSQL); the decode puts a read `localDate` at 10:00 UTC.
**Reproduction**: `local-date-read-back-matches-its-row` in `select.date-ops.test.ts`: read `workDate` of
worklog 1 (`2024-03-04`, read as `2024-03-04T10:00:00.000Z`) and filter `workDate.equals(read)`. On real
engines it finds no row on MySQL 26.10, 8.0 and 5.7 (`mysql2` and Bun SQL), MariaDB 13.0, 10.5, 10.4 and 10.3
(`mariadb` and Bun SQL), Oracle 23 and 21 (`oracledb`) and PostgreSQL 18 and 17 with `postgres`; `pg`, Bun SQL
for PostgreSQL, PGlite, SQL Server and SQLite find it. The driver sends the `Date` with its time, and the
database compares the `DATE` with a date time. On Oracle, inserting that value stores `2024-03-04 10:00:00`
in the `DATE`; oracledb binds a `Date` with the local wall clock, so `new Date('2024-03-04')` from a process
in `Europe/Madrid` is stored at 01:00 (seen with `to_char` on a bind).
**Proposed fix**: send only the date, the one `getFullYear`/`getMonth`/`getDate` give: a `'YYYY-MM-DD'` text
on PostgreSQL, MySQL and MariaDB, and a `Date` at local midnight on Oracle (oracledb uses the local wall
clock). Tried and validated on the engines above, and in the `UTC`, `Europe/Madrid`,
`America/Los_Angeles` and `Asia/Tokyo` zones for `mysql2` and `mariadb`. Consequence: the parameter
shown in logs, `MockQueryRunner` and the `params` snapshots changes (a text instead of a `Date`, or a
`Date` at local midnight on Oracle, whose ISO text depends on the zone of the process), and so do the
"The parameters are" lines of the docs and the expectations of `src/examples/documentation`.
**Current workaround in the suite**: the test asserts `[]` on the real engines of those cells, with
`TODO[BUG]`; in mock it asserts `[1]`.

## `TableOrViewOf<typeof t>` without an alias: the value built with `fromRef` can't be selected

**Where**: `TableOrViewOf` / `fromRef` in `src/extras/types.ts`; first row of the table in
`docs/advanced/tables-views-as-parameter.md` ("`tCompany`, or an alias of it").
**Reproduction**: in `postgres/newest/pg`, a function `<P extends TableOrViewOf<typeof tProject>>(ref: P)`
returning `connection.subSelectUsing(fromRef(tProject, ref))…selectCountAll().forUseAsInlineQueryValue()`,
called as `ctx.conn.selectFrom(tProject).select({ n: f(tProject) })`, fails with TS2322: the value's
source is `…/table:TProject/${any}` (the constraint without alias), which the select of `tProject` doesn't
accept. The same with a `Values` (`TableOrViewOf<typeof projectNames>`). With an alias
(`TableOrViewOf<typeof tProject, 'p'>` and `tProject.as('p')`) it compiles. Already so before
`fromRef` checked the table of the reference.
**Current workaround in the suite**: none; the tests of the page use an alias.

## Coverage gaps carried over (not bugs — no entry to fix)

These are **not** defects and there is nothing in `src/` to change. They are the
places where a fix that landed has **no test holding it down**, so a regression
would be silent. Kept here because the loudest lesson of the round that fixed
them was that a defect survives exactly as long as no fixture can express it.

*(none)*

## Common bug shapes

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the first move of whoever
fixes it, not of whoever found it.

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
  version-gates · bugs full · limitation · not-applicable ·
  not-supported · mock-only · chain none`: the SQL the symbol emits across tests and docs, every
  implementing class, the compatibility-version branches that gate
  the method, sibling `// TODO[BUG]` markers and any declared
  `// TODO[LIMITATION]` / `// NOT-APPLICABLE` / `// NOT-SUPPORTED` /
  `// MOCK-ONLY` that names the symbol.
  `chain` is off on purpose — emission happens after the call-chain,
  so the chain never reaches the emission site; use
  `--emits-keyword <sql-fragment>` to walk back from the SQL token
  to the builder code instead.
- **Type-system bug** (overload selection, variance, assignability —
  the symbol's typing rejects or accepts something it shouldn't) —
  `bun run tests:where-is --search <symbol> --for type-bug` bundles
  `declared full · signature full · ref-type-arg full · neg-types
  full · bugs summary · limitation summary · not-applicable summary ·
  not-supported summary · mock-only summary · chain none`: every declaration + signature, every place the type is
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
   [`docs/about/changelog/v2.md`](../docs/about/changelog/v2.md) describing the
   user-visible change.
