# `test/` — tests derived from the documentation

Companion to [`README.md`](./README.md). Read this when you are adding
or extending a `docs.*.test.ts` file, or when a `docs/queries/<page>.md`
/ `docs/advanced/<page>.md` page grows and an agent needs to bring the
test suite back in sync.

- [Purpose](#purpose)
- [Where these tests live](#where-these-tests-live)
- [Two prefixes: `docs:` and `docs-extra:`](#two-prefixes-docs-and-docs-extra)
- [The `doc-start` / `doc-end` block](#the-doc-start--doc-end-block)
- [Domain translation](#domain-translation)
- [Symmetry across cells](#symmetry-across-cells)
- [Canonical setup per database](#canonical-setup-per-database)
- [Inventory: pages ↔ files](#inventory-pages--files)
- [Pages not yet covered](#pages-not-yet-covered)
- [Adding coverage for a new page](#adding-coverage-for-a-new-page)
- [Extending an existing page](#extending-an-existing-page)
- [Verifying coverage](#verifying-coverage)
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

One file per page, mirrored to **every** (database × version × connector)
cell of the matrix per the symmetry rule
([`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property)).
The audit (`bun run tests:audit`) enforces the mirror.

## Two prefixes: `docs:` and `docs-extra:`

Test names use one of two prefixes. The prefix tells the reader where
the test comes from on the docs page.

| Prefix | Origin on the page | `doc-start`/`doc-end` |
|---|---|---|
| `docs:<page-slug>/<anchor>` | a literal fenced code block on the page | **required** |
| `docs-extra:<page-slug>/<anchor>` | behaviour the page **describes in prose** (bullet lists, notes, "the result type also accepts …", method-list options) but does NOT illustrate with code | optional |

Rule of thumb when reading a docs page:

- Every fenced ```ts/```tsx block → one `docs:` test.
- Every sentence, admonition or bullet that promises behaviour (e.g.
  "`projectingOptionalValuesAsNullable()` switches the result shape
  from `T?` to `T | null`", "you can also pass an `EXTRAS` object to
  `executeSelectPage`", "this method is not exposed on Oracle") that is
  not backed by a fenced block → one `docs-extra:` test.

Both prefixes are equally first-class. `docs-extra:` is the regression
net for behaviour the page promises without showing.

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
| `basic-query-structure.md` | `docs.basic-query-structure.test.ts` | 3 |
| `select.md` | `docs.select.test.ts` | 3 |
| `select-page.md` | `docs.select-page.test.ts` | 1 |
| `insert.md` | `docs.insert.test.ts` | 4 |
| `update.md` | `docs.update.test.ts` | 3 |
| `delete.md` | `docs.delete.test.ts` | 3 |
| `transaction.md` | `docs.transaction.test.ts` | 2 |
| `recursive-select.md` | `docs.recursive-select.test.ts` | 1 |
| `sql-fragments.md` | `docs.sql-fragments.test.ts` | 1 |
| `dynamic-queries.md` | `docs.dynamic-queries.test.ts` | 2 |
| `extreme-dynamic-queries.md` | `docs.extreme-dynamic-queries.test.ts` | 9 |
| `complex-projections.md` | `docs.complex-projections.test.ts` | 5 |
| `aggregate-as-object-array.md` | `docs.aggregate-as-object-array.test.ts` | 5 |

### `docs/advanced/`

| Page | File | Tests |
|---|---|---|
| `columns-from-object.md` | `docs.advanced.columns-from-object.test.ts` | 6 |
| `custom-booleans-values.md` | `docs.advanced.custom-booleans-values.test.ts` | 2 |
| `id-manipulation.md` | `docs.advanced.id-manipulation.test.ts` | 3 |
| `tables-views-as-parameter.md` | `docs.advanced.tables-views-as-parameter.test.ts` | 4 |
| `utility-dynamic-picks.md` | `docs.advanced.utility-dynamic-picks.test.ts` | 3 |
| `utility-types.md` | `docs.advanced.utility-types.test.ts` | 12 |

Total today: **19 files × 17 cells = 323 files**, ~69 tests per cell.
Every test in every `docs.*.test.ts` file carries either the `docs:` or
the `docs-extra:` prefix; the audit verifies the mirror is intact.

## Pages not yet covered

Pages that have a docs page but no dedicated test file in the matrix:

- `docs/advanced/query-execution-metadata.md` — no `docs.advanced.query-execution-metadata.test.ts` yet.
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
   - every fenced ```ts/```tsx block → list of `docs:<slug>/<anchor>`
     tests to write,
   - every prose-only feature/promise → list of
     `docs-extra:<slug>/<anchor>` tests to write.
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
   stays verbatim so future readers can diff parity.
7. **Verify**:
   ```bash
   bun run tests:audit          # symmetry ✓
   bun run validate:tests:tsgo  # typecheck ✓
   bun run tests                # mock matrix ✓
   ```

## Extending an existing page

1. Open the docs page and the matching `docs.<slug>.test.ts` from the
   canonical sqlite cell side-by-side.
2. Diff: every fenced block on the page should map to a `docs:<slug>/…`
   test in the file; every prose-only feature should map to a
   `docs-extra:<slug>/…` test. Anything missing is the work to do.
3. Add the missing tests in the canonical cell first (snapshot-bake
   loop above).
4. Mirror to every other cell (same copy + bake loop).
5. Comment out where not applicable; reason on the line above.
6. Run the symmetry audit + typecheck + mock matrix.

## Verifying coverage

- `bun run tests:audit` — verifies the file/test mirror across cells
  per database. The single best automated check.
- Per-page manual cross-check (no scripted tool today): open
  `docs/queries/<page>.md` (or `docs/advanced/<page>.md`) and the
  matching `docs.<slug>.test.ts` from `sqlite/newest/bun_sqlite/`,
  walk both top-to-bottom, confirm every fenced block has a `docs:`
  test and every documented prose feature has either a `docs:` or a
  `docs-extra:` test.
- `bun run validate:tests` — locks the negative type tests under
  `test/db/<db>/types.negative/`, which are the compile-time
  counterpart to the docs tests' runtime assertions.

## What does NOT belong here

- Tests that have no anchor in any `docs/` page. Those are general
  behavioural tests and go in the relevant `select.*.test.ts`,
  `insert.*.test.ts`, etc. — not in a `docs.*.test.ts`.
- Fixes for library bugs. The agent does not touch `src/` from a test
  PR; bugs uncovered while writing a docs test are documented in
  [`BUGS.md`](./BUGS.md) with a `// TODO[BUG]` marker on the
  assertion, per [`MAINTAINING.md`](./MAINTAINING.md#if-a-new-test-surfaces-a-bug-in-src).
- Snippets that depend on features outside the public `exports` map of
  `package.json`. If the snippet needs an internal symbol, the docs
  page is documenting non-public surface — flag it instead of
  reaching for `unsupported/*`.
