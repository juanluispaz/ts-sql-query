# `test/` — tests derived from the documentation

Companion to [`README.md`](./README.md). Read this when you are adding
or extending a `docs.*.test.ts` file, or when a `docs/queries/<page>.md`
/ `docs/advanced/<page>.md` page grows and an agent needs to bring the
test suite back in sync.

- [Purpose](#purpose)
- [Where these tests live](#where-these-tests-live)
- [Two test-name prefixes in the same file: `docs:` and `docs-extra:`](#two-test-name-prefixes-in-the-same-file-docs-and-docs-extra)
- [The `doc-start` / `doc-end` block](#the-doc-start--doc-end-block)
- [Domain translation](#domain-translation)
- [Symmetry across cells](#symmetry-across-cells)
- [Canonical setup per database](#canonical-setup-per-database)
- [Inventory: pages ↔ files](#inventory-pages--files)
- [Pages not yet covered](#pages-not-yet-covered)
- [Adding coverage for a new page](#adding-coverage-for-a-new-page)
- [Extending an existing page](#extending-an-existing-page)
- [Verifying coverage](#verifying-coverage)
- [What counts as a "snippet"](#what-counts-as-a-snippet)
- [Cross-page borrowing](#cross-page-borrowing)
- [Edge cases shared with the rest of the suite](#edge-cases-shared-with-the-rest-of-the-suite)
- [What does NOT belong here](#what-does-not-belong-here)

## Purpose

Every public feature shown or described in a `docs/queries/*.md` or
`docs/advanced/*.md` page must have a test that:

- pins the **SQL + params** that the documented usage emits today, per
  dialect, via inline snapshot,
- pins the **TypeScript result type** via `assertType<Exact|Extends<…>>()`,
- exercises the **runtime value** through `ctx.mockNext(expected)` +
  `expect(result).toEqual(expected)` so mock and real-DB paths agree.

The point is twofold:

1. Lock the public API the docs advertise against drift. If a snapshot
   moves, somebody changed the public surface — that is real signal.
2. Give the next contributor (human or agent) a copy-pasteable
   reference. The block between `// doc-start` and `// doc-end` is the
   snippet exactly as a library user would write it.

## Where these tests live

| Docs page | Test file (per cell) |
|---|---|
| `docs/queries/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.<slug>.test.ts` |
| `docs/advanced/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.advanced.<slug>.test.ts` |

**One file per page** — the snippet-backed `docs:` tests and the
prose-backed `docs-extra:` tests for a given docs page live together
in a single `docs.<slug>.test.ts` (see [Two test-name prefixes in
the same file](#two-test-name-prefixes-in-the-same-file-docs-and-docs-extra)
for the why and how). That single file is mirrored to **every**
(database × version × connector) cell of the matrix per the symmetry
rule
([`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property)).
The audit (`bun run tests:audit`) enforces the mirror.

## Two test-name prefixes in the same file: `docs:` and `docs-extra:`

The two prefixes are a **naming convention**, NOT a file split. Both
kinds of test live side-by-side in the same `docs.<page>.test.ts`
file (one file per docs page — see [Where these tests live](#where-these-tests-live)).
There is no `docs-extra.<page>.test.ts` file and there should not be
one — splitting would duplicate imports, fixtures, the `describe`
block and the symmetry-audit surface for no gain.

The prefix tells the reader where the test comes from on the docs page:

| Prefix | Origin on the page | `doc-start`/`doc-end` |
|---|---|---|
| `docs:<page-slug>/<anchor>` | a literal fenced code block on the page | **required** |
| `docs-extra:<page-slug>/<anchor>` | behaviour the page **describes in prose** (bullet lists, notes, "the result type also accepts …", method-list options) but does NOT illustrate with code | optional |

Rule of thumb when reading a docs page:

- Every fenced ```ts/```tsx block that **calls** the API →
  one `docs:` test. (Fenced blocks that only **declare** the API
  surface — an `interface { … }` listing methods — are prose-like and
  split into `docs-extra:` tests, one per testable member. Full
  convention: [What counts as a "snippet"](#what-counts-as-a-snippet).)
- Every sentence, admonition or bullet that promises behaviour (e.g.
  "`projectingOptionalValuesAsNullable()` switches the result shape
  from `T?` to `T | null`", "you can also pass an `EXTRAS` object to
  `executeSelectPage`", "this method is not exposed on Oracle") that is
  not backed by a fenced block → one `docs-extra:` test.

Both prefixes are equally first-class — the `docs:` ones double as
publishable snippets; the `docs-extra:` ones are the regression net for
behaviour the page promises without showing. Mix them freely in the
same `describe(ctx.label, () => { ... })` block, sharing imports and
fixtures.

## The `doc-start` / `doc-end` block

`docs:` tests must bracket the user-facing snippet with `// doc-start`
on the line **above** the snippet and `// doc-end` on the line
**below**. Only the lines between those markers represent the snippet
a docs reader sees; everything outside (mock seeding, `expect`,
`assertType`, fixture imports) stays in the file but is not part of
the documented example.

Constraints:

- At most one `doc-start` / `doc-end` pair per `test(...)` block.
- The block must be valid TypeScript on its own (no half-statements,
  no references to identifiers that don't appear inside it or in
  obvious shared imports).
- Keep the snippet small — if a snippet sprawls past ~25 lines, the
  docs page is probably trying to explain two things; split into two
  tests with their own anchors.

`docs-extra:` tests **may** include a `doc-start` / `doc-end` block if
the implementation happens to demonstrate a useful idiom, but it is
optional — these tests exist to assert behaviour, not necessarily to
be published.

## Domain translation

Docs pages use the legacy `tCustomer` / `tCompany` / `tOrder` schema.
The test matrix uses a single shared **project management** domain
declared in `test/db/<db>/domain/connection.ts`:

| Test domain | Stand-in for the docs domain |
|---|---|
| `tOrganization` | `tCompany` |
| `tAppUser` | `tCustomer` |
| `tProject` | top-level grouping owned by an organisation |
| `tIssue` | child of a project, has priority, status, assignee |

When porting a snippet, preserve **structure** (operators, method
calls, fluent chain shape, presence/absence of `where`/`groupBy`/
`orderBy`/etc.) and substitute **identifiers**. The SQL the test
emits is therefore NOT lexically identical to the SQL shown on the
docs page; the inline snapshot records what the test actually emits.

That structural fidelity is what makes the test useful: a snippet
that no longer compiles or that emits structurally different SQL is
a real change to the public surface, regardless of which tables it
runs against.

## Symmetry across cells

The symmetry rule applies to docs files exactly like to any other
test file. Specifically:

- Same file name in every cell of every database in scope.
- Same `describe` + `test` names, same order, across every cell.
- A test that does not apply to a cell (engine lacks the feature,
  driver lacks the helper, dialect refuses the syntax) is
  **block-commented out** with a one-line reason above:

  ```ts
  // Not exposed on OracleConnection: JSON_ARRAYAGG(DISTINCT …) is
  // rejected by Oracle and the same-query emulation is not portable.
  /*
  test('docs:aggregate-as-object-array/aggregate-as-array-distinct', async () => {
      // … canonical body kept verbatim for cross-cell diff parity …
  })
  */
  ```

  Never `test.skip(…)`. Never delete. The commented body is
  documentation, not code — it does not need to compile against the
  target cell. Full rule: [`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property).

The same `/* … */` shape is also reused for two related cases
documented in `MAINTAINING.md`: when the **canonical sqlite cell
itself** can't compile the body
([When the canonical cell can't compile the body](./MAINTAINING.md#when-the-canonical-cell-cant-compile-the-body)),
and when an import is referenced only from a commented-out block
([Imports used only from commented-out blocks](./MAINTAINING.md#imports-used-only-from-commented-out-blocks)).

## Canonical setup per database

Exactly one cell per database flags its `setup.ts` with
`canonicalForDocs: true`. Today:

| Database | Canonical cell |
|---|---|
| mariadb | `newest/mariadb` |
| mysql | `newest/mysql2` |
| oracle | `newest/oracledb` |
| postgres | `newest/pg` |
| sqlite | `newest/bun_sqlite` |
| sqlserver | `newest/mssql` |

When adding a new test file, write it first in the **sqlite canonical
cell** (`sqlite/newest/bun_sqlite/`) — it is in-process, bun-native,
and has the fastest iteration loop. Mirror to the rest after the file
is green there.

## Inventory: pages ↔ files

The current set (counts taken from the sqlite canonical cell — every
other cell mirrors them subject to the symmetry rule).

### `docs/queries/`

| Page | File | Tests |
|---|---|---|
| `basic-query-structure.md` | `docs.basic-query-structure.test.ts` | 6 |
| `select.md` | `docs.select.test.ts` | 14 |
| `select-page.md` | `docs.select-page.test.ts` | 4 |
| `insert.md` | `docs.insert.test.ts` | 14 |
| `update.md` | `docs.update.test.ts` | 9 |
| `delete.md` | `docs.delete.test.ts` | 5 |
| `transaction.md` | `docs.transaction.test.ts` | 9 |
| `recursive-select.md` | `docs.recursive-select.test.ts` | 4 |
| `sql-fragments.md` | `docs.sql-fragments.test.ts` | 4 |
| `dynamic-queries.md` | `docs.dynamic-queries.test.ts` | 5 |
| `extreme-dynamic-queries.md` | `docs.extreme-dynamic-queries.test.ts` | 11 |
| `complex-projections.md` | `docs.complex-projections.test.ts` | 5 |
| `aggregate-as-object-array.md` | `docs.aggregate-as-object-array.test.ts` | 5 |

### `docs/advanced/`

| Page | File | Tests |
|---|---|---|
| `columns-from-object.md` | `docs.advanced.columns-from-object.test.ts` | 12 |
| `custom-booleans-values.md` | `docs.advanced.custom-booleans-values.test.ts` | 2 |
| `id-manipulation.md` | `docs.advanced.id-manipulation.test.ts` | 5 |
| `query-execution-metadata.md` | `docs.advanced.query-execution-metadata.test.ts` | 8 |
| `tables-views-as-parameter.md` | `docs.advanced.tables-views-as-parameter.test.ts` | 4 |
| `utility-dynamic-picks.md` | `docs.advanced.utility-dynamic-picks.test.ts` | 6 |
| `utility-types.md` | `docs.advanced.utility-types.test.ts` | 14 |

Total today: **20 files × 17 cells = 340 files**, ~146 tests per cell
(107 `docs:` + 39 `docs-extra:`). Every test in every `docs.*.test.ts`
file carries either the `docs:` or the `docs-extra:` prefix; the audit
verifies the mirror is intact.

## Pages not yet covered

Pages that have a docs page but no dedicated test file in the matrix:

- `docs/advanced/synchronous-query-runners.md` — out of scope for the main matrix; lives in the sync sub-tree (`test/db/sync/...`), not under `test/db/<db>/<version>/<connector>/`.

Reference pages **deliberately not** in this scope:

- `docs/api/*` — API reference of TypeScript types; covered by
  `types.negative/` and the ambient type checks the suite already runs.
- `docs/configuration/*` — covered by the connectors' `setup.ts` and
  the `runners.ts` factories.
- `docs/keywords/*` — keyword reference, not patterns.
- `docs/about/*` — narrative, no public-surface contract to lock.
- `docs/CHANGELOG.md` and `docs/index.md` — meta.

If a future docs page lands under a folder not in the "deliberately
not" list above, treat it the same as `queries/` or `advanced/` and
add a `docs.<slug>.test.ts` (or `docs.<folder>.<slug>.test.ts`) file.

## Adding coverage for a new page

1. **Read the page top-to-bottom.** Enumerate:
   - every fenced ```ts/```tsx block that **calls** the API →
     `docs:<slug>/<anchor>` test (apply the declaration-vs-call
     convention in [What counts as a "snippet"](#what-counts-as-a-snippet)
     when a fenced block is an `interface`/`type` reference instead),
   - every prose-only feature/promise (and every member listed inside
     a declaration-only fenced block) →
     `docs-extra:<slug>/<anchor>` test.
   - if the prose belongs conceptually to a different docs page,
     route the test to that page's file — see
     [Cross-page borrowing](#cross-page-borrowing).
2. **Create the file in the sqlite canonical cell**:
   `test/db/sqlite/newest/bun_sqlite/docs.<slug>.test.ts`
   (or `docs.advanced.<slug>.test.ts`). Use one of the existing files
   as a skeleton — `docs.basic-query-structure.test.ts` for a simple
   page, `docs.advanced.utility-types.test.ts` for a type-heavy one.
3. **Write each test.** Translate identifiers per the
   [Domain translation](#domain-translation) table; preserve structure.
   Wrap `docs:` snippets in `// doc-start` / `// doc-end`. Prime
   `ctx.mockNext(expected)`, assert SQL+params with empty
   `toMatchInlineSnapshot()`, assert types with `assertType<...>()`,
   assert value with `expect(result).toEqual(expected)`.
4. **Bake snapshots** in the sqlite cell:
   ```bash
   bun run tests:focus sqlite/newest/bun_sqlite/docs.<slug>.test.ts -- --update-snapshots
   ```
5. **Mirror to every other cell.** For each `(db, version, connector)`
   under `test/db/`, copy the file and re-bake snapshots:
   ```bash
   cp test/db/sqlite/newest/bun_sqlite/docs.<slug>.test.ts \
      test/db/<db>/<version>/<connector>/docs.<slug>.test.ts
   bun run tests:focus <db>/<version>/<connector>/docs.<slug>.test.ts \
       --docker -- --update-snapshots
   ```
6. **Comment out (do not delete)** any test that does not apply to a
   cell, with a one-line reason above the `/* … */` block. The body
   stays verbatim so future readers can diff parity. See
   [Edge cases shared with the rest of the suite](#edge-cases-shared-with-the-rest-of-the-suite)
   for the three derived patterns this commonly triggers (canonical
   can't compile the body, import unused in commented cells, the
   comment-out is masking a likely bug).
7. **Verify**:
   ```bash
   bun run tests:audit          # symmetry ✓
   bun run validate:tests:tsgo  # typecheck ✓
   bun run tests                # mock matrix ✓
   ```

## Extending an existing page

1. Open the docs page and the matching `docs.<slug>.test.ts` from the
   canonical sqlite cell side-by-side.
2. Diff: every fenced **API-calling** block on the page should map to
   a `docs:<slug>/…` test in the file; every prose-only feature (and
   every member of an `interface`/`type`-only fenced block) should
   map to a `docs-extra:<slug>/…` test. Anything missing is the work
   to do. Apply the rules in
   [What counts as a "snippet"](#what-counts-as-a-snippet) when the
   distinction is ambiguous, and route to a different page's file
   if the feature actually belongs there
   ([Cross-page borrowing](#cross-page-borrowing)).
3. Add the missing tests in the canonical cell first (snapshot-bake
   loop above). See
   [Edge cases shared with the rest of the suite](#edge-cases-shared-with-the-rest-of-the-suite)
   if the canonical can't compile the body, an import ends up unused
   in commented cells, or the comment-out is masking a likely bug.
4. Mirror to every other cell (same copy + bake loop).
5. Comment out where not applicable; reason on the line above.
6. Run the symmetry audit + typecheck + mock matrix.

## Verifying coverage

- `bun run tests:audit` — verifies the file/test mirror across cells
  per database. The single best automated check.
- Per-page manual cross-check (no scripted tool today): open
  `docs/queries/<page>.md` (or `docs/advanced/<page>.md`) and the
  matching `docs.<slug>.test.ts` from `sqlite/newest/bun_sqlite/`,
  walk both top-to-bottom, confirm every API-calling fenced block has
  a `docs:` test, and every prose feature OR member of a
  declaration-only fenced block has a `docs-extra:` test (rules in
  [What counts as a "snippet"](#what-counts-as-a-snippet)).
- `bun run validate:tests` — locks the negative type tests under
  `test/db/<db>/types.negative/`, which are the compile-time
  counterpart to the docs tests' runtime assertions.

## What counts as a "snippet"

The `docs:` / `docs-extra:` rule above says "every fenced ```ts/```tsx
block → one `docs:` test". The grey area is when a fenced TypeScript
block contains a **declaration** rather than usage — most often a
TypeScript `interface { method(): ... }` that documents an API
surface without showing it being called.

Convention:

- A fenced block that **declares** the surface (an `interface { … }` /
  `type X = ...` block listing methods or members for reference) →
  treat as **prose** and split into `docs-extra:` tests, one per
  individually testable member. The page is describing what exists,
  not how to call it.
- A fenced block that **calls** the surface (a query chain, an
  `insertInto(...).set(...).executeInsert()`, a type assertion of a
  realistic output type) → `docs:` test.

Real example: `docs/queries/insert.md` "Manipulating values to insert"
has a 130-line fenced `interface InsertExpression { … }` listing
`setIfValue`, `setIfSet`, … `disallowAnyOtherSet`. Those are
`docs-extra:insert/<method>` tests, not `docs:` tests; each one
demonstrates the method on the test domain.

## Cross-page borrowing

Sometimes the prose on page **A** describes behaviour that conceptually
belongs to feature **B** — `executeSelectPage`'s `EXTRAS` argument, for
example, is documented in `docs/queries/basic-query-structure.md` (a
trailing bullet list under "Other options") even though the feature
itself is the `executeSelectPage` API.

Rule: **the test goes in the file that owns the feature** (here,
`docs.select-page.test.ts`), not in the file mirrored from the page
that mentions it. Leave a one-line comment in the test body citing
the page the behaviour was documented on:

```ts
test('docs-extra:select-page/extras-with-count-skips-count-query', async () => {
    // basic-query-structure.md / select-page.md prose: if the EXTRAS
    // argument provides `count`, the count query is NOT executed —
    // the supplied value is used.
    // …
})
```

This keeps the file-per-page mapping clean while still capturing the
docs intent.

## Edge cases shared with the rest of the suite

A handful of patterns surface while porting docs tests but are not
exclusive to `docs.*.test.ts` — they apply to any test file in the
matrix. They live in `MAINTAINING.md` so a single canonical entry
serves the whole suite; this section is a pointer with the docs-tests
framing.

- **The canonical cell can't compile the body.** The sqlite canonical
  (`sqlite/newest/bun_sqlite/`, also `canonicalForDocs: true`) is the
  cheapest place to develop. When a feature is only typed on other
  dialects (e.g. `tTable.oldValues()` on PG/MariaDB/SqlServer,
  `deleteFrom(...).using(...)` not on sqlite, `isolationLevel(...)`
  not on sqlite), follow
  [`MAINTAINING.md` § When the canonical cell can't compile the body](./MAINTAINING.md#when-the-canonical-cell-cant-compile-the-body)
  — write the test commented-out in the canonical, mirror, uncomment
  in supporting cells. The three docs.* tests using this pattern
  today are `docs:update/update-returning-old-values`,
  `docs:delete/delete-using`, `docs:transaction/isolation-level`.
- **Imports referenced only from commented-out blocks.** Cells where
  a test is commented-out can end up with an unused import that
  `noUnusedLocals` rejects. The fix is the `void identifier` sentinel
  documented in
  [`MAINTAINING.md` § Imports used only from commented-out blocks](./MAINTAINING.md#imports-used-only-from-commented-out-blocks).
- **You suspect a library bug.** Don't fix `src/` from a test PR;
  mark the assertion or test with `// TODO[BUG]: see BUGS.md` and
  log the case in [`BUGS.md`](./BUGS.md) per
  [`MAINTAINING.md` § If a new test surfaces a bug in `src/`](./MAINTAINING.md#if-a-new-test-surfaces-a-bug-in-src).
  The four common shapes the bug takes (TS too loose, TS too strict,
  two forms typed asymmetrically, stale public symbol) are listed in
  that section — be explicit about which one in `BUGS.md` so the
  fixing agent knows where to look first.

## What does NOT belong here

- Tests that have no anchor in any `docs/` page. Those are general
  behavioural tests and go in the relevant `select.*.test.ts`,
  `insert.*.test.ts`, etc. — not in a `docs.*.test.ts`.
- Fixes for library bugs. Suspected bugs are logged in
  [`BUGS.md`](./BUGS.md) and marked with a `// TODO[BUG]` comment —
  the full routing protocol lives in
  [`MAINTAINING.md` § If a new test surfaces a bug in `src/`](./MAINTAINING.md#if-a-new-test-surfaces-a-bug-in-src).
- Snippets that depend on features outside the public `exports` map of
  `package.json`. If the snippet needs an internal symbol, the docs
  page is documenting non-public surface — flag it instead of
  reaching for `unsupported/*`.
