# Code Indexer

A queryable **SQLite map of the whole `ts-sql-query` codebase** — `src/` + the
`test/` matrix + the published `docs/` + the legacy `src/examples/` — so tooling can
ask precise questions about the project instead of grepping:

- Does symbol `X` exist? Is it public (importable through `package.json` exports) or
  internal?
- Which tests / documentation snippets exercise `X`, in which databases, and where
  exactly (file:line)?
- Given an internal symbol, what public call-chain reaches it (crossing dynamic
  `keyof` dispatch), and which builder interface + doc page corresponds?
- Which `src/expressions` interfaces are not implemented by any builder?

This folder is the **INDEXER** — it *builds* the database. The tool that *answers*
searches over it (the "where-is" searcher) is a separate consumer; it reuses this
tool's [`db.ts`](db.ts), [`schema.ts`](schema.ts) and [`model.ts`](model.ts).

> This is the **reference** doc (how to build it, what's inside, how to consume it).
> The full design rationale, decisions, roadmap and the searcher design live in the
> working document [`test/lib/symbolIndex/DESIGN.md`](../symbolIndex/DESIGN.md).

## Build it

```bash
bun run tests:index                          # preferred (precise, type-resolved)
bun run tests:index -- --no-resolve          # name-based, low-memory / fast build
bun run tests:index:verify                   # structural smoke test of the extractors (~4 s)
# or, directly:
bun test/lib/codeIndexer/build.ts [--out <path>] [--no-resolve]
npx tsx test/lib/codeIndexer/build.ts [--out <path>] [--no-resolve]   # under Node
```

**`--no-resolve`** skips the type resolution (`getSymbolAtLocation`), so the checker's type
cache never grows: **~1–2 GB / ~3 s** instead of **~8 GB / ~18 s**. Same schema and same rows;
the only difference is every `resolved_symbol_id` / `resolved_member_id` is NULL — name-based
search (`symbol_name`) still works, but you lose binding-level precision and the lib-vs-noise
filter (≈84% of test-ref name occurrences aren't lib API). Use it on RAM-constrained machines or
when only name discovery is needed; the precise build is the default.

Output (default): **`test/lib/codeIndexer/generated/code-index.sqlite`** — gitignored
(via the `generated` rule), and rebuilt **from scratch each run** (~18 s: ~2 s to build
the unified TypeScript Program, ~14 s to extract + type-resolve every reference, ~2 s to
write). It lives in the tool's own `generated/` folder rather than `.test-report/`, which
the test harness wipes even when the index is still valid. The run prints the chosen
backend in brackets and, per ref dimension, the share that type-resolved.

### Runtime backends ([`db.ts`](db.ts))

`openIndexDb(path)` dispatches by runtime and produces an **identical** index (the only
per-run difference is `meta.built_at`):

| Runtime | Backend | Notes |
|---|---|---|
| Bun | `bun:sqlite` | native, fastest, no deps |
| Node | `node:sqlite` | built-in (Node 22.5+/24+), zero extra deps |
| Node (fallback) | `better-sqlite3` | when `node:sqlite` isn't exposed |

The SQL it runs is plain portable SQLite, so **any** SQLite reader can open the result
— you don't have to use `db.ts`.

## One unified build + type-resolved references

The indexer builds **a single `ts.Program` over `src/` + `test/` at once** (from
[`test/tsconfig.json`](../../tsconfig.json), whose `include` is `["**/*.ts",
"../src/**/*.ts"]`). Every file — the real source, the simplified master, the
hand-written matrix tests, the generated doc cells — is compiled together; the
extractors only **read** their complete, compiled source files from that Program (see
[`resolve.ts`](resolve.ts)). Nothing is parsed in isolation and no file is sliced in
memory — whatever TypeScript compiles is the complete file, and `BEGIN/END` regions are
honoured by **line range** over that complete file.

Because one checker spans the whole tree, every reference is **type-resolved**, not just
name-matched: `getSymbolAtLocation` binds a ref token to its declaration, and a `declMap`
(declaration node → the row we emitted, by stable node identity) maps it back to a
`symbol`/`member` row. So `*_ref` and `invocation` rows carry **`resolved_symbol_id`** /
**`resolved_member_id`** FKs alongside the name — a `.equals()` in a test resolves to the
exact `EqualableValueSource.equals` member, not every `equals` in the codebase. JOIN on
the FK for an exact, collision-free link; fall back to `symbol_name` for the references
that bind outside the indexed surface (test helpers, locals, Bun globals, dynamic-table
columns — the bulk of test identifiers, which is why a cell's resolved share is well
under 100%). The one edge the checker can **not** resolve is the `keyof` dispatch (a
dynamic element access) — that stays the name-only `operation` bridge (pattern §1).

**Resolution-scatter caveat (read before counting member coverage).** A fluent call resolves
to the declaration the checker binds for the *static* receiver type, which for this library is
usually an **overloaded interface signature**, not the implementation. `.orderBy(...)` resolves
across the `*ExecutableSelectExpression` overloads in `src/expressions/select.ts` (member ids
1354/1404/1423/…), NOT the `AbstractSelect.orderBy` implementation (4872) that wraps
`__addOrderBy`. So a single `resolved_member_id` under-counts a logical method. To ask "is method
M exercised?", match by **member NAME across the owning family** (all real members named `M`),
not one id — start from `__addOrderBy`'s invocation caller name, then the real members of that
name. The bare `is_public member with no resolved ref` count is inflated for the same reason —
treat it as candidates, confirmed by a name-level check.

## What it indexes (16 tables — [`schema.ts`](schema.ts) is authoritative)

Built by one extractor per dimension; rows are assembled in [`model.ts`](model.ts) and
bulk-inserted by [`build.ts`](build.ts) (which also writes the `meta` table directly).

### build metadata — `meta`
- **meta** — key/value build provenance: `schema_version` (bump → a consumer can reject an
  incompatible index), `built_at` (ISO), `git_rev` + `git_dirty`, `resolve`
  (`resolved`|`name-based`), `tool`. Lets a consumer detect a STALE index (compare `built_at`/
  `git_rev` to the working tree) or a `--no-resolve` index (FKs are NULL) before trusting it.

### `src/` dimension — [`extractSrc.ts`](extractSrc.ts)
- **module** — every `src/**/*.ts` (+ the simplified query map as a pseudo-module);
  `area`, `is_public`, `export_subpath`, `zone`.
- **symbol** — interface/class/type/function/const/enum, with `is_public`, full span,
  JSDoc.
- **member** — methods/properties/getters of interfaces & classes (signature + span +
  JSDoc).
- **heritage** — `extends` / `implements` edges (`base_name` = head identifier), plus a
  **`commented`** flag (`implements` commented out in source, `/*Name,*/`, captured so a
  deliberate gap is distinguishable from a forgotten one) and a **`simplified`** flag
  (synthesised edges linking a builder to the simplified def it realizes — see *Three
  tricky patterns* §3). Real analyses filter `commented=0 AND simplified=0`.
- **reconcile** / **reconcile_gap** — the hand-maintained SIMPLIFIED definitions the docs
  render, mapped to the real code with a public-member diff (drift radar). `via`
  (`class`=collapsing query defs via a curated subtree map · `name`=same-name real symbol)
  and **`source`** — one row per (def, source) so a search can tell WHERE it's shown:
  `master` (simplifiedQueryDefinition.ts) · `doc` (the full reassembly cell) · `doc-inquery`
  (the subset extracts, `partial=1`). `reconcile_gap` carries `source` too. See *Three tricky
  patterns* §3.
- **invocation** — call graph of `src/` call sites: `caller_name`/`caller_kind` + the
  enclosing scope's span (`caller_start_line`/`caller_end_line` = the function to *read*
  for context), `callee_name`, `kind`, `line`/`col`, plus the type-resolved
  **`resolved_symbol_id`** / **`resolved_member_id`** of the callee (an exact call edge,
  not just a name). **`kind='operation'`** bridges the `keyof` dispatch: a
  `new SqlOperation*ValueSource('_op', …)` later runs `sqlBuilder['_op'](…)` via element
  access (invisible to the checker — dynamic), so the operation string `'_op'` — the exact
  `SqlBuilder` method — is recorded at the construction site (`resolved_*` NULL by design).

### `test/` matrix dimension — [`extractTests.ts`](extractTests.ts)
- **test_block** — one `test()`/`it()` leaf, in its matrix cell (`db`,`version`,
  `connector`), full `describe > … > test` name, `is_active`.
- **test_ref** — one row per OCCURRENCE of an API name in a block, with `line`/`col` and
  the type-resolved `resolved_symbol_id`/`resolved_member_id`. (The autogenerated
  `connector='documentation'` cells are excluded — they are the documentation dimension
  below.)

### documentation dimension — [`extractDocTests.ts`](extractDocTests.ts)
- **doc_test_block** — every snippet from the autogenerated doc-code cells, by `kind`:
  `test` (ts + documented SQL, asserted), `fn` (compile-only ts), `decl` (typescript
  type decls). Located by SOURCE markdown (`page`, `area`, `heading`, fence
  `start_line`..`end_line`) + the generated `.test.ts` span (`gen_*`) so a consumer can
  read the exact test. **`simplified_def`** names the interface/class a snippet declares when
  it's a simplified def (e.g. `SelectExpression`) — the precise def→doc anchor.
- **doc_test_ref** — one row per occurrence, plus the type-resolved
  `resolved_symbol_id`/`resolved_member_id`. Refs are taken from the COMPILED generated
  cell (so the checker resolves them) within the BEGIN/END region, then mapped back to
  `.md` coordinates (`md_line`/`md_col`) — the in-region copy is verbatim line-for-line,
  so `md_line = gen_line + (md_start − begin_file_line)` and the column is unchanged.
  Answers "where in the docs is `X` reflected / explained?".

### legacy examples dimension — [`extractExamples.ts`](extractExamples.ts)
- **example_block** / **example_ref** — `src/examples/` cases; `example_ref` is one row
  per occurrence with `line`/`col` + `resolved_symbol_id`/`resolved_member_id`.
  `src/examples/prisma/` (generated) excluded.

### negative-type dimension — [`extractNegTypeTests.ts`](extractNegTypeTests.ts)
- **neg_type** — one row per `// @ts-expect-error` in a `test/db/<db>/types.negative/` cell:
  the `description` (the rule), `marker_line` → `target_line` (the code asserted to fail),
  `snippet`, and the enclosing `scope`. These compile-only files are otherwise just a coarse
  block in the test dimension; this makes each negative assertion first-class.
- **neg_type_ref** — the API names in the statement that contains the target line, resolved —
  "WHICH API (+ line) does this negative test guard?" (e.g. `onConflictOn`/`insertInto`/`values`).

## Three tricky patterns it captures

The index goes out of its way to handle three `ts-sql-query`-specific shapes a naïve
name-based pass would miss.

### 1. `keyof` operation dispatch — crossing dynamic dispatch

[`src/sqlBuilders/SqlBuilder.ts`](../../../src/sqlBuilders/SqlBuilder.ts) declares one
interface per group of operations (`SqlFunction0/1/2`, `SqlComparator*`,
`AggregateFunctions*`, …) and groups them into a single **`SqlBuilder`**, implemented by
**`AbstractSqlBuilder`**. To avoid a case per operation,
[`src/internal/ValueSourceImpl.ts`](../../../src/internal/ValueSourceImpl.ts) stores the
operation as `__operation: keyof Sql…` and dispatches with
`sqlBuilder[this.__operation](…)` — an ELEMENT access whose target is dynamic, invisible
to a name-based call graph.

The bridge: the operation name is a string LITERAL at the **construction** site
(`new SqlOperation*ValueSource('_concat', …)`), where it's statically known. The indexer
records it as an `invocation.kind='operation'` edge to `_concat` (the exact `SqlBuilder`
method). So a call chain crosses the keyof — `_concat` shows as invoked by
`concat()`/`concatIfValue()`, bridging to `SqlFunction1` → `SqlBuilder` →
`AbstractSqlBuilder._concat`. (An operation forwarded as a *variable* instead of a
literal isn't captured — there's no static name; these are few.)

### 2. interface → builder implementation coverage

The interfaces in `src/expressions/*` are meant to be IMPLEMENTED by the builders in
`src/queryBuilders/*`. Some `implements` entries are **commented out** in source
(`/*Name<…>,*/`) because the type was too complex for the compiler — deliberate gaps the
AST drops. The indexer parses those too (**`heritage.commented=1`**), so a deliberate gap
is distinguishable from a forgotten one.

That powers a **coverage audit** (recipe **R7** in the working doc): close the real
`implements` edges upward over `extends`; any `src/expressions` interface outside that
closure is uncovered — then split into deliberate (commented), by-design families
(`*Filter` / `*FragmentExpression` / `FragmentBuilder*` / callbacks, never
builder-implemented), and the real CANDIDATES to check. Run it after adding interfaces to
confirm none was forgotten (the last sweep left only `NotSubselectUsing`, a typing-system
internal).

### 3. simplified definitions → the real implementing class (and drift detection)

[`src/examples/documentation/simplifiedQueryDefinition.ts`](../../../src/examples/documentation/simplifiedQueryDefinition.ts)
holds hand-maintained, compiler-protection-free SIMPLIFIED versions of the query types —
the ones the docs render (indexed as `area='simplified'`, and as the generated `decl`
doc cells). A curated table in [`reconcileSimplified.ts`](reconcileSimplified.ts) maps each to the
**root class** of the subtree that implements it (e.g. `SelectExpression → AbstractSelect`,
`Connection → AbstractConnection`), and the tool **expands DOWN to the root + every
descendant class**. Coverage is the UNION of that whole chain, so members spread over deeper
or specific classes — `Connection`'s methods split across the per-db connections — stay
discoverable WITHOUT hardcoding the leaves (a new subclass is picked up automatically), and
synthesised edges land on every class in the chain so the call-chain finds the simplified
def wherever it lands. The root is the topmost OPERATION-SPECIFIC class (the abstract base
where one exists, else the concrete builder — never the universal `AbstractQueryBuilder`).
Members match by NAME. From that:

- a synthesised **`heritage`** edge (`class implements <simplified>`, `simplified=1`) makes
  the simplified def show up as "another implemented interface", so it's discoverable
  through the same tooling: internal → call-chain → builder → simplified def → docs.
- a **`reconcile`** row + **`reconcile_gap`** rows record the public-member diff: members
  the simplified is **missing** (reachable on a mapped class, absent from the simplified —
  over-broad) or **extra** (reachable on NO mapped class — genuine drift: a rename / a
  member that no longer exists). A drift radar for the hand-maintained map.

That's pass 1 (the collapsing query defs, `via='class'`, `source='master'`). The rest is
covered by NAME (no edges — already name-discoverable, just the diff), and **each of the three
simplified sources is reconciled separately** so a search can tell WHERE a def is shown
(`reconcile.source`, and `reconcile_gap.source` on the member detail):

- `source='master'` — the other defs in `simplifiedQueryDefinition.ts` (ValueSource hierarchy,
  TypeAdapter, …) vs their real same-name symbol.
- `source='doc'` — `simplifiedDefinition.generated.test.ts` (the full reassembly of the doc
  pages): a per-source row for **every** def it shows, including ones also in the master
  (`SelectExpression`, `Connection`, …) PLUS the **doc-only additions** (the `TsSqlError`
  ecosystem, query-runner config, filter types — shown with internals stripped).
- `source='doc-inquery'` — `simplifiedDefinitionInQuery.generated.test.ts` (the SUBSET extracts
  showing only the methods relevant to a query). `partial=1`: its `missing` is by design (a
  subset), so it emits no `missing` gaps — only `extra` (shown-but-not-real = a real error).

The **def→doc-location anchor** is `doc_test_block.simplified_def` (the interface/class a snippet
declares). So the precise chain `internal __addOrderBy → (invocation) orderBy → (heritage
simplified=1) SelectExpression → doc_test_block WHERE simplified_def='SelectExpression' →
doc_test_ref orderBy` lands on every doc page that shows the simplified Select's `orderBy`,
grouped by `source`. (Actual *usage* of `orderBy` in query-example snippets is the complementary
path: `doc_test_ref.resolved_member_id` → the real member, in `docs/queries/*.md`.)

Caveat: `missing_in_simplified` is **over-broad** for `via='class'` — the member closure is
name-based, so it crosses generic interfaces the type system actually keeps apart (a delete
builder appears to "reach" `groupBy`), the same limitation as the call chain. Treat it as
candidates. `extra_in_simplified` is the clean drift signal; the current sweep flags only a
handful of minor groupings (the simplified flattens a method onto a type whose real interface
puts it on a sibling). The mapping/discoverability is exact.

## The simplified definitions — sources & reading semantics

The docs render hand-maintained, compiler-protection-free SIMPLIFIED versions of the library
types (so a reader — or the agent — can reason about the API without the heavy generics). The
index touches several files; know which is which:

| File | Role | How the index reads it |
|---|---|---|
| `src/examples/documentation/simplifiedQueryDefinition.ts` | **The MASTER** — the COMPLETE simplified defs of `src/expressions` (Select/Insert/Update/Delete/Connection/ValueSource hierarchy/…). The author writes it, then manually decomposes it across doc pages. | `extractSrc.ts` indexes it as the `simplified` pseudo-module (`area='simplified'`) — symbols + members. Feeds reconcile passes 1 (`via='class'`) & 2 (`via='name'`, `source='master'`). |
| `src/TsSqlError.ts` | The error types. Self-contained, so it is NOT replicated in the master — it IS the source, shown in the docs directly with the few internal impls stripped (the extractor injects dummies by replacing strategic comments, without shifting lines). | Indexed as normal `src/` symbols. Its simplified doc copy is read from the generated cell (below) for reconcile pass 3. |
| `docs/**/*.md` | The master decomposed into pages + the additions (the `TsSqlError` ecosystem, query-runner config, filter types). | The snippets become the documentation dimension (`extractDocTests.ts` → `doc_test_*`). |
| `test/db/general/newest/documentation/simplifiedDefinition.generated.test.ts` | The generated cell that reassembles those doc pages = master + additions. | reconcile `source='doc'`: a per-source row for **every** def it shows (incl. master defs) + the **doc-only additions**. Also a `doc_test_block` per snippet, tagged `simplified_def`. |
| `test/db/general/newest/documentation/simplifiedDefinitionInQuery.generated.test.ts` | **SUBSETS / extracts** — the query docs show only the methods relevant to that query scope, NOT the full defs. | reconcile `source='doc-inquery'`, `partial=1` (its `missing` is by design, so no `missing` gaps). Also `doc_test` blocks, tagged `simplified_def`. |

**`BEGIN/END` is the boundary.** In every generated cell, only the code between
`// BEGIN <page>:<line>` and `// END <page>:<line>` comes from the `.md` (the actual snippet);
everything outside is test scaffolding (imports, the mock, `void` usage marks, `assertSql`).
The MASTER carries the same markers (page-less `// BEGIN` / `// END`), wrapping the real defs;
the trailing `makeCompilerHappy` `ValueSource` merge + noop type aliases (compiler scaffolding)
sit OUTSIDE them. The extractors honour these by **line range** over the complete compiled file:
- `extractSrc.ts` indexes only the master declarations inside its BEGIN/END region — the
  `makeCompilerHappy_*` placeholders are simply never indexed (no name filter needed).
- `extractDocTests.ts` takes each snippet's refs from inside its BEGIN/END pair (then maps
  positions back to the `.md`) — never the scaffolding.
- reconcile pass 3 keeps only declarations **inside** a BEGIN/END region when parsing the cell.

**Knowing which source you're looking at.** A `reconcile` row's `source` distinguishes master
vs doc; a `doc_test_block.page` gives the exact `.md` page of a doc snippet; `area='simplified'`
on a `symbol`/`member` is always the master file.

## Consume it

```ts
import { openIndexDb } from 'test/lib/codeIndexer/db.js'   // or any SQLite reader
const db = await openIndexDb('test/lib/codeIndexer/generated/code-index.sqlite')
const rows = db.all(`SELECT db, count(DISTINCT id) AS tests
                     FROM test_ref JOIN test_block ON test_block.id = test_ref.test_block_id
                     WHERE symbol_name = ? GROUP BY db`, ['groupBy'])
db.close()
```

- DDL: [`schema.ts`](schema.ts). Row shapes / INSERT column orders: [`model.ts`](model.ts).
- The index is read-only after the build. Counts are derived: occurrences of a name =
  `COUNT(*)` over the relevant `*_ref` table.

### Useful queries

```sql
-- Build provenance / staleness gate (run FIRST in a consumer): is the index resolved,
-- which git rev, and was the tree dirty? Compare git_rev to `git rev-parse HEAD`.
SELECT key, value FROM meta;   -- schema_version, built_at, git_rev, git_dirty, resolve, tool

-- Existence & classification (kills hallucinated API)
SELECT (SELECT count(*) FROM symbol WHERE name=:n AND is_public=1) AS public_symbol,
       (SELECT count(*) FROM member WHERE name=:n)                 AS members;

-- Where reflected in the docs (page:line:col + section + db)
SELECT dtb.page, r.md_line, r.md_col, dtb.heading, dtb.kind,
       group_concat(DISTINCT dtb.db) AS dbs
FROM doc_test_ref r JOIN doc_test_block dtb ON dtb.id = r.doc_test_block_id
WHERE r.symbol_name=:n GROUP BY dtb.page, r.md_line, r.md_col;

-- Where used in src + the enclosing function to read
SELECT m.path, i.caller_name, i.caller_start_line, i.caller_end_line
FROM invocation i JOIN module m ON m.id = i.module_id
WHERE i.callee_name=:n AND i.caller_name IS NOT NULL;

-- EXACT usage of one specific member (e.g. EqualableValueSource.equals), collision-free:
-- resolve the member id once, then count test occurrences that bind to THAT member.
SELECT count(*) AS uses
FROM test_ref tr
WHERE tr.resolved_member_id = (
  SELECT mm.id FROM member mm JOIN symbol s ON s.id = mm.symbol_id
  WHERE s.name = 'EqualableValueSource' AND mm.name = 'equals');

-- Method coverage handling resolution-scatter: ALL real members named :m across the family
-- (a fluent call binds to an overloaded interface signature, not the impl — see the caveat).
WITH fam AS (
  SELECT m.id FROM member m JOIN symbol s ON s.id = m.symbol_id
  JOIN module mo ON mo.id = s.module_id WHERE m.name = :m AND mo.area != 'simplified')
SELECT 'test' dim, count(*) n FROM test_ref    WHERE resolved_member_id IN (SELECT id FROM fam)
UNION ALL SELECT 'doc', count(*)  FROM doc_test_ref WHERE resolved_member_id IN (SELECT id FROM fam)
UNION ALL SELECT 'ex',  count(*)  FROM example_ref  WHERE resolved_member_id IN (SELECT id FROM fam);

-- Negative-type coverage: which API a `@ts-expect-error` guards, with its rule + .md line.
SELECT nt.db, nt.file, nt.marker_line, nt.description, group_concat(DISTINCT m.name) AS guards_api
FROM neg_type nt JOIN neg_type_ref r ON r.neg_type_id = nt.id
JOIN member m ON m.id = r.resolved_member_id
GROUP BY nt.id;
```

## Architecture & how to modify it

The pipeline is a straight line — **extractors → rows → DDL → bulk insert**, with one
file per concern. To change behaviour you almost always touch the three that mirror
each other (schema ↔ model ↔ extractor), kept in sync by hand.

```
        resolve.ts  buildProgram(): ONE ts.Program over src/ + test/  +  the checker
        │           (declMap declaration-node → row, resolveToken for the refs)
        ▼
  extractSrc.ts         ─┐  READ the complete, compiled source files from the Program
  extractTests.ts        │  (BEGIN/END honoured by line range, never sliced); resolve
  extractDocTests.ts     │  each reference via the checker → resolved_*_id; emit row
  extractExamples.ts     │  objects (ids from a shared Ids counter)
  extractNegTypeTests.ts ─┘
        │  walk.ts only ENUMERATES paths (test/, src/examples/) to feed the Program lookup
        ▼
  model.ts   row TYPES (one interface per table) + INSERTS (sql + column order)
        │
        ▼
  build.ts   buildProgram() → extractors → open db → exec SCHEMA → insertMany per table → close
        │
        ▼
  db.ts      IndexDb backend (bun:sqlite / node:sqlite / better-sqlite3)
```

| File | Role |
|---|---|
| [`resolve.ts`](resolve.ts) | `buildProgram()` (the single src+test Program + checker) + the `declMap` type + `resolveToken` (ref token → indexed `symbol`/`member` row). |
| [`walk.ts`](walk.ts) | recursive `*.ext` file walk (bun has no `globSync`) — enumerates paths; the SourceFiles come from the Program. |
| [`extractSrc.ts`](extractSrc.ts) | symbols/members/heritage/invocations + the simplified-master pseudo-module (BEGIN/END-restricted); builds the `declMap` the other extractors resolve against. |
| [`reconcileSimplified.ts`](reconcileSimplified.ts) | the curated `simplified def → class` table + the synthesised heritage edges and the member-coverage diff (`reconcile`/`reconcile_gap`). Edit the table here to add a mapping. |
| [`extractTests.ts`](extractTests.ts) | `test_block`/`test_ref`; **exports the shared AST helpers** (`cellOf`, `asTestCall`, `describeName`, `firstStringArg`, `collectRefPositions`) reused by `extractDocTests`. |
| [`extractDocTests.ts`](extractDocTests.ts) | the documentation dimension (BEGIN/END snippet regions in the compiled generated cells; refs resolved, positions mapped back to the `.md`). |
| [`extractExamples.ts`](extractExamples.ts) | `example_block`/`example_ref` (interval segmentation of legacy examples). |
| [`extractNegTypeTests.ts`](extractNegTypeTests.ts) | `neg_type`/`neg_type_ref` — one row per `// @ts-expect-error` in `types.negative` cells + the API it guards (resolved). |
| [`verify.ts`](verify.ts) | structural smoke test (`tests:index:verify`) — re-extracts in `--no-resolve` mode and asserts counts/referential-integrity/id-uniqueness/reconcile invariants in memory. |
| [`model.ts`](model.ts) | `*Row` interfaces + `INSERTS` (the SQL + column order + a `row()` mapper) + the `Ids` counter. |
| [`schema.ts`](schema.ts) | the SQLite DDL as one exported `SCHEMA` string. |
| [`build.ts`](build.ts) | orchestrator + the CLI entry (runs on import). |
| [`db.ts`](db.ts) | the `IndexDb` abstraction + the three `open*IndexDb` backends. |

### Add a column to an existing table
1. **`schema.ts`** — add the column to the `CREATE TABLE`.
2. **`model.ts`** — add the field to the `*Row` interface AND to that table's `INSERTS`
   entry (both the `sql` column list and the `row()` array — keep them aligned).
3. The **extractor** for that table — populate the field on every row it pushes.

### Add a whole dimension (new table + extractor)
1. **`schema.ts`** — new `CREATE TABLE` (+ indexes).
2. **`model.ts`** — new `*Row` interface(s) + a new `INSERTS` entry per table.
3. **new `extractXxx.ts`** — take `(program, checker, declMap, ids)`, read SourceFiles from the
   Program, return `{ ...rows }`; reuse `walk.ts` (path enumeration) and the exported AST helpers
   from `extractTests.ts` (`collectRefPositions` + `resolveToken` for resolved FKs).
4. **`build.ts`** — call the extractor inside its own block scope, `insertMany` its rows, push a
   count line, and let it fall out of scope (the per-dimension streaming pattern).

### Add a runtime backend
Implement one more `open*IndexDb(path): Promise<IndexDb>` in [`db.ts`](db.ts) (the
interface is small: `exec` / `run` / `insertMany` / `all` / `close` / `backend`), and
wire it into the `openIndexDb` dispatcher. Everything above `db.ts` is backend-agnostic.

### Conventions & gotchas (read before editing)
- **`schema.ts` is a JS template literal** — a stray backtick (`` ` ``) or `${` in a SQL
  comment ends the literal and breaks the file. Keep them out of SCHEMA comments.
- **`schema.ts` ↔ `model.ts` must stay in lockstep**: a column added in one but not the
  other is a silent `INSERT` mismatch. The `row()` array order must match the `sql`
  column order.
- **Type-resolved + a name fallback.** `*_ref`/`invocation` rows carry both the
  `symbol_name` (text) and the checker-resolved `resolved_symbol_id`/`resolved_member_id`.
  Prefer the FK (exact, collision-free); the name is the fallback for refs that bind
  outside the indexed surface. The **two** things the checker can't do — the `keyof`
  **operation bridge** (a dynamic element access; recorded name-only from
  `new SqlOperation*ValueSource('_op', …)`) and the **commented `heritage`** capture
  (text the AST drops) — are still handled by string parsing.
- **`*_ref` tables are one row per occurrence** (with `line`/`col`); a count is
  `COUNT(*)`, not a stored column.
- **One `ts.Program` over `src/` + `test/`** (built in `resolve.ts` from
  `test/tsconfig.json`), shared by every extractor — no per-file `createSourceFile`, no
  in-memory slicing. The classic `typescript` package (not tsgo, which has no programmatic
  API yet). `src/examples/prisma/` is excluded.
- Typecheck edits with `bun run validate:tests` (tsgo) and `bun run validate:tests:tsc`.

## Notes

- The `.sqlite` is a **disposable derived artifact** — gitignored; don't commit it.
- Rebuild after `src/`, `test/` or `docs/` change. If `docs/` changed, regenerate the
  doc-code cells first (`bun run codegen:doc-code`) so the documentation dimension is
  current.
- It uses the classic `typescript` package (not tsgo, which has no programmatic API yet).
  Unlike a pure-parse pass, it builds a real type-checked Program over the whole tree, so
  a rebuild is ~18 s (the type resolution is the cost — and the point).
