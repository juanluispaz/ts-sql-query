# Missing-tests audit (Round 6) — type-semantics coverage

**Purpose.** Same bar as rounds 1–5: list tests *missing* from the `test/` matrix judged by the
**semantics the type definitions convey** — not line coverage. The unit is a **type-branch**: a
distinction the TypeScript type system makes even when the runtime JS is identical (overloads;
union/optional params; per-type/per-arity arms; type transformations; optionality/nullability
propagation; result-shape inference). A branch is **covered** iff a `test/`-matrix test asserts that
specific distinction — its emitted SQL+params and/or its resulting TS type (`assertType<Exact<…>>`),
or — where the type promises a runtime value (`| null`, `| undefined`, empty array, branded
round-trip) — the produced VALUE via `toEqual`/`toBe`.

**This round was run FRESH and INDEPENDENT.** Nothing from rounds 1–5 was assumed beyond the audit-1
principles; the prior "saturation"/"thin tail" verdicts were *not* trusted. Every conclusion was
re-derived against the **actual current (post-round-5) test files**. Method: 8 parallel raw-reading
discovery agents over the public surface → aggregation → 4 adversarial verifiers that each tried to
*refute* every candidate by finding a covering test. Verdicts carried here are post-verification.

**Scope/rules honoured:** coverage validated only against `test/` (not `src/examples/`); negative type
tests (`@ts-expect-error`, `types.negative` cells) out of scope as findings; `src/queryRunners/`
excluded; a variant present only as `void X` / `<any,any>` / a signature snapshot is **compile-only =
not covered**; error reasons in scope only if reachable through the public API **without** contrived
`as any`/impossible-state forcing; reference cell `postgres/newest/pg`, matrix symmetric; pair every
dynamic-condition test with its direct non-dynamic equivalent and assert identical SQL+params;
date/time under `TZ=UTC`. **No source bug was found this round.**

**Headline.** Despite five prior rounds, this independent pass surfaced **5 confirmed gaps — two of
them HIGH** — that the anchored rounds missed, plus the now-familiar conclusion that the big surfaces
(value expressions, columns, SELECT + both projectors, Connection API, the cross-cutting seams) are
genuinely covered. The two HIGH items are real type-contract holes, not fan-out tail: an
**optionality-erasure** asymmetry in `is`/`isNot`, and an entire **MySQL-5 compatibility error path**
(`UNSUPPORTED_QUERY`) that is never asserted. All fixes but one are coverable with existing fixtures.

---

## 📍 Confirmed gaps (verified — implementing agent: apply these)

### §1 — `is` / `isNot` optionality-erasure projected as a required boolean leaf · **HIGH**

`src/expressions/values.ts:254-258` (impl `src/internal/ValueSourceImpl.ts:189-197`,
`SqlOperation1NotOptionalValueSource`). `is` and `isNot` are the **only** members of the
equalable/comparable family whose return type is hard-coded to `BooleanValueSource<…, 'required'>` —
every sibling (`equals`, `notEquals`, `greaterOrEqual`, `between`, …) propagates `MergeOptional`, so two
optional operands yield an **optional** boolean leaf. So `is`/`isNot` encode a distinct type-transform:
**optional operands → REQUIRED boolean (no `?`)**.

**Evidence (verified):** grep-and-classify of all **171** `is`/`isNot` call sites (10/cell, symmetric)
— *every single one* is in `.where(` / `.and(` / `.on(` context; **zero** are projected into a
`.select({...})` with an `assertType`. The propagating contrast IS pinned right next door
(`select.value-source.column-vs-column.test.ts:341-363` asserts `greaterOrEqual(optionalCol)` → `x?:
boolean | undefined`), which makes the missing `is`/`isNot` erasure assertion conspicuous.

**Fix (column-vs-column.test.ts; existing fixtures; no DDL):** project both arms over two *optional*
columns and assert the leaf is REQUIRED:
```ts
const r = await ctx.conn.selectFrom(tIssue)
  .select({ eqIs: tIssue.assigneeId.is(tIssue.parentId), neqIs: tIssue.assigneeId.isNot(tIssue.parentId) })
  …executeSelectOne()
assertType<Exact<typeof r, { eqIs: boolean; neqIs: boolean }>>()   // NOTE: no `?`, no `| undefined`
```
Type is mock-validatable; the value is real-DB-validatable. Per-cell snapshot (SQL Server rewrites the
`is`-as-projection). Distinct from `isNull()`/`isNotNull()` — those are a different operator.

### §2 — MySQL-5 compatibility mode `UNSUPPORTED_QUERY` throws · **HIGH**

`src/sqlBuilders/MySqlSqlBuilder.ts:172` (recursive `with`) and `:176` (a `Values` constructor in a
`FROM`), both gated `compatibilityVersion < 8_000_000`. These are the **only two builder-side**
throw-sites of the public `UNSUPPORTED_QUERY` `TsSqlErrorReason` (the third is in `Sqlite3QueryRunner`
= runner-side, out of scope). The reason name appears in `test/db/` **only** inside the generated union
snapshot — the throw itself is **asserted nowhere**.

**Reachable without contrivance (verified):** the `DBConnection` ctor takes `compatibilityVersion`
(`domain/connection.ts:31-37`, threaded by `runners.ts:326`); a MySQL-5 connection is just
`new DBConnection(runner, 5_007_000)`. Recursive via `recursiveUnionAllOn`, Values via
`Values.create(...)` + `selectFrom`. The newest mysql cell runs at `+Infinity` and there is no `oldest`
zone, so nothing exercises the `< 8_000_000` branch (the lone `5_007_000` connection in the generated
doc-code is a bare `void DBConnection` that never builds either query).

**Fix:** new `config.mysql5-compatibility.test.ts` in the **mysql2 cell** (mock-mode sufficient):
build `new DBConnection(runner, 5_007_000)`, assert `reasonOf(caught) === 'UNSUPPORTED_QUERY'` for both
a recursive `with` and a `Values`-in-FROM, plus a positive contrast (a non-recursive inlined `with`, or
the same queries on an `8_000_000+` connection, succeed). MySQL-only.

### §3 — On-conflict **do-update** `returningLastInsertedId()` (non-null) · **MEDIUM**

`src/expressions/insert.ts:712-714` (`OnConflictReturningLastInsertedIdType`). The do-update on-conflict
path (`CustomizableExecutableSimpleInsertOnConflict`, insert.ts:78-82) returns a **non-null** `number`
from `returningLastInsertedId()`, whereas the do-**nothing** path returns `number | null` (a do-nothing
conflict may insert zero rows). Only the do-nothing arm is tested
(`insert.on-conflict.test.ts:174` → asserts `number | null` at :184). The non-null do-update promise is
never pinned.

> **Refuted sub-claim (do NOT re-chase):** the do-update `.returning({...}).executeInsertOne()` **row**
> arm (non-optional, no `| null`) IS covered — `docs.insert.test.ts:311-347` and `:389-425` chain
> `onConflictOn(...).doUpdateSet({...}).returning({...}).executeInsertOne()` with `assertType<Exact<…,
> {id;name;plan}>>`. Only the `returningLastInsertedId` half of the do-update path is the gap.

**Fix (insert.on-conflict-do-update-extras.test.ts; existing fixtures, real-DB-validatable on PG —
the live `docs.insert` do-update tests already upsert `tOrganization`/`tProject` on the real DB):** add
`…onConflictOn(pk).doUpdateSet({...}).returningLastInsertedId().executeInsertOne()` and
`assertType<Exact<typeof id, number>>` (no `| null`) + value.

### §4 — Dynamic BOOLEAN filter beyond `{ equals: true }` · **MEDIUM** (PARTIAL)

`src/expressions/dynamicConditionUsingFilters.ts:13/39` — `BooleanFilter extends EqualableFilter<boolean>`
promises the full equalable operator set (`notEquals`, `is`/`isNot`, `in`/`notIn`, `isNull`/`isNotNull`)
on **both** the `'boolean'` descriptor arm (`FilterTypeOf`) and the `IBooleanValueSource` value-source-map
arm. The **only** dynamic boolean filter site in the whole matrix is
`dynamic-condition.equivalence.test.ts:419-448`, using **only `equals`**, **only** on the custom-adapter
`tProject.published`, **only** through the descriptor arm.

**Verified coverage map (operator × arm):**

| operator | `FilterTypeOf<'boolean'>` desc | plain VS (`billable`) | adapter VS (`published`) |
|---|---|---|---|
| equals | COVERED (:419) | MISSING | COVERED (:419) |
| notEquals | MISSING | MISSING | **MISSING** (token-remap) |
| in / notIn | MISSING | MISSING | **MISSING** (token-remap) |
| is / isNot | MISSING | MISSING | MISSING |
| isNull / isNotNull | MISSING | MISSING | MISSING |

The interesting sub-case is **adapter-remaps-token-for-non-`equals`-ops**: the remap that renders
`published` as `(published = 't')` is operator-agnostic (`AbstractSqlBuilder.ts:291-300`), so it would
also wrap `<>`/`in`/`is null` — but no direct **or** dynamic test asserts it for any non-`equals`
operator. Also the plain-boolean `tIssueWorklog.billable` (`optionalColumn('boolean')`, no adapter,
connection.ts:472) is filtered dynamically **nowhere**, so the entire plain `IBooleanValueSource` arm is
unverified. (All these operators are in `allowedOpreations`,
`queryBuilders/DynamicConditionBuilder.ts:240-254` — they dispatch generically, not as errors.)

**Fix (equivalence.test.ts; existing fixtures; each paired with its direct equivalent):**
(a) adapter `published.notEquals`+`in` → direct `tProject.published.notEquals(true)` /
`.in([true,false])`, expected `(published = 't') <> $1` / `(published = 't') in ($2,$3)`;
(b) plain `billable.is`+`isNull` → direct `tIssueWorklog.billable.is(true)` / `.isNull()`;
(c) a `DynamicCondition<{ billable: 'boolean' }>` descriptor twin to separate the two arms (matching how
every other type carries both a `…-column-dispatch` and `…-descriptor-dispatch` test).

### §5 — Chained `selectFrom(t1).from(t2)` SELECT cross-join (comma-FROM) · **LOW**

`src/expressions/select.ts:436-442` (`SelectExpressionWithoutJoin.from`, two overloads — distinct from
the `subSelectUsing(...).from()` subquery form at L444-446); impl `SelectQueryBuilder.ts:749` emits a
comma-FROM via `AbstractSqlBuilder._buildFromJoins:733-740`. A chain-aware scan resolving every
`.from(tTable)`'s true receiver across `test/db/` **and** `src/examples/` yields **0** SELECT cross-joins
— every `.from(table)` in the suite is `subSelectUsing`/`update`/`insertInto`. The comma-FROM *emission*
is covered, but **only via UPDATE…FROM** (`update.from.variants.test.ts:66` → `update issue … from
project, organization …`), never via the SELECT `selectFrom().from()` path; no `select … from a, b`
snapshot exists. Undocumented and with no negative-type/BUGS/LIMITATIONS marker (so not provably
deliberate — `docs/queries/select.md` shows only `subSelectUsing().from()`).

**Fix (select.join.test.ts; existing fixtures):** `selectFrom(tProject).from(tOrganization)
.where(tProject.organizationId.equals(tOrganization.id)).select({...})…` and assert SQL+params (`… from
project, organization where …`) + value. If the maintainers consider the SELECT cross-join intentionally
de-emphasized, the alternative is to mark it explicitly rather than leave it silently untested.

---

## ❌ Refuted / out-of-scope (verified — do NOT re-chase)

- **On-conflict do-update `.returning({...}).executeInsertOne()` row** — **REFUTED** (covered in
  `docs.insert.test.ts:311-347` / `:389-425` with `assertType<Exact>` on the non-optional row). Only the
  `returningLastInsertedId` half (§3) is missing.
- **from-select `returningLastInsertedId()` (array)** — degenerate: never directly used, but the `number[]`
  result is already pinned by multi-row VALUES (`insert.execute-variants.test.ts:102`) and from-select array
  `returning({id})`. Optional one-liner only if propagating.
- **Round-5's SQLite `INVALID_CONFIGURATION` item** — **genuinely closed.** `config.datetime-formats.test.ts`
  (all 5 sqlite cells) asserts `reasonOf(caught) === 'INVALID_CONFIGURATION'` via a bogus `getDateTimeFormat()`
  override, reaching the SqlBuilder-side default arms (`SqliteSqlBuilder.ts:229/251/276`). The 6 `SqliteConnection`
  marshalling default arms throw the identical reason+payload → degenerate, correctly closed.
- **`columnWithDefaultValue('…','uuid'/'double')`** — OUT-OF-SCOPE. The omittable-on-insert behavior is proven
  kind-independently (`insert.non-default-primary-keys.test.ts:62`) and the uuid/double leaves are already proven;
  the only delta is a pure type intersection (fails DESIGN Principle #1) against a real 12-file fixture cost (no
  spare DEFAULT uuid/double column exists). `optionalColumnWithDefaultValue` non-int siblings: same — close.
- **`CustomBooleanTypeAdapter` numeric `(number, number)` overload** — out of scope: produces no distinct public
  result type (column still types `boolean`); only a runtime param-literal diff.
- **`IfValueSource.or(IfValueSource)` non-collapse arm** — better suited to `types.negative/` (out of scope); its
  runtime behaviour is already covered by the dynamic-condition suite.
- **Connection API (F5)** — **no genuine gap** (independently re-derived against actual asserting tests):
  `createTableOrViewCustomization` P1..P5 param-threading is covered by the generated `forSystemTimeBetween` P2
  doc-code across all dialects; `transaction<T>` return type asserted in `docs.transaction.test.ts:47`;
  `const`/`optionalConst`/fragment family/sequence/executeFunction/executeProcedure/isolation/deferred-hook all
  asserted. `subSelectUsing`/`dynamicBooleanExpressionUsing` arities 3–5 are mechanical tail.
- **Cross-cutting seams (F8)** — **effectively exhausted of in-scope gaps.** Every barrel value/function export
  has a behavioral test; every `extras/types` transform alias is `assertType<Exact>`-pinned on concrete fixtures;
  the cross-layer chains (branded custom type through `returningOneColumn`, TypeAdapter value effect through a
  projection, optionality through both projectors) are asserted *through* the layers. The two zero-reference barrel
  exports (`Pickable`, `OpaqueValues`) are constraint/guard aliases with no behavioral promise → correctly untested.
  The one residual (`ts-sql-query/dynamicCondition` compat re-export subpath never imported by a test) is an
  export-map-integrity concern better served by a package.json-exports lint than a matrix cell → close.

---

## ⚡ Quick-win order

1. **§1** `is`/`isNot` required-boolean-leaf projection — one test, two arms, existing file. HIGH value, trivial.
2. **§2** MySQL-5 `UNSUPPORTED_QUERY` — one new mysql-cell file, mock-mode, two throw arms + a positive contrast.
   HIGH value (an entire error path), self-contained.
3. **§3** on-conflict do-update `returningLastInsertedId()` non-null — one assertion in an existing file.
4. **§4** dynamic boolean filter operators — a small batch in `equivalence.test.ts`, each paired with its direct
   equivalent (the adapter-token-remap-on-non-`equals` sub-case is the most valuable).
5. **§5** SELECT comma-FROM cross-join — one test (or an explicit "intentionally de-emphasized" marker).

## Saturation observation (not a decree)

Round 6, run independently, produced a **richer** set than round 5's thin tail — 5 confirmed gaps, two
HIGH — and they are *structural* (an optionality-transform asymmetry; a whole compatibility-mode error
path; a result-type distinction between two on-conflict arms), not mechanical fan-out. The lesson the
prior rounds keep teaching holds: the big surfaces verify as covered, but each fresh, un-anchored pass
still finds real contract holes the anchored passes glide over — because anchored reading inherits the
prior round's blind spots. Value-density is not monotonically decreasing; it depends on the *angle*. No
source/type-vs-impl bug surfaced this round. A round 7 remains defensible, with the same caveat: keep it
fresh and independent, or it will just re-confirm round 6.
