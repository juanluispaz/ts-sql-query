# Missing-tests audit — type-semantics coverage

**Purpose.** This report lists tests that are *missing* from the `test/` matrix, judged by the
**semantics the type definitions convey** — not by line coverage. The unit of analysis is a
**type-branch**: a distinction the TypeScript type system makes even when the runtime JS is
identical. Examples of a type-branch:

- A method that accepts a *union* of input types or is *overloaded* (e.g. a constant vs a
  `ValueSource`, or `int` vs `string`) — each accepted input type is its own branch and deserves
  its own test.
- A *type that transforms types*: optionality combination (`required` × `optional` → `optional`),
  nullability propagation, result-shape inference, mapped/derived shapes (`SelectedRow`,
  `InsertableRow`, `*ProjectedAsNullable`, `*ShapedAs`, `DeepPick`/`DeepOmit`, …).
- A per-type capability that exists on some value-source types but not others.

A branch is **covered** iff at least one `test/`-matrix test asserts that specific distinction —
its emitted SQL+params and/or its resulting TypeScript type/shape (`assertType<Exact<…>>`).

**Scope and rules used to produce this report** (so the implementing agent applies the same bar):

- Coverage was validated **only against the `test/` matrix** (not `src/examples/`).
- **Negative type tests** (`@ts-expect-error`, the `types.negative` cells) are **out of scope** as
  *findings*. A few entries note that a `types.negative` peer is the natural companion to the
  positive test being added — that companion is optional and not itself a gap here.
- `src/queryRunners/` was **excluded** from the audit.
- A type/variant that appears **only** inside `doc-code.generated.test.ts` fixtures that are
  discarded with `void tX` / `void ex_*` (139/139 of them are never executed) is **compile-only**,
  i.e. **NOT behaviorally covered** — those count as gaps.
- The matrix is highly symmetric: a gap found in the reference cell `postgres/newest/pg` is a gap
  in every cell, so each fix propagates across cells (respect per-dialect `NOT-APPLICABLE` markers
  where noted).

**Method.** Branch discovery was raw reading of the public type surface (the `exports` map of
[package.json](../package.json) minus `queryRunners/*`, plus the `src/index.ts` barrel) and its
transitive closure. Each candidate gap was then **adversarially verified** by an independent pass
that tried to *refute* it (find a covering test) before confirming. Verdicts: `CONFIRMED` = real
gap; `PARTIAL` = covered in one shape but a specific sub-case is genuinely missing; refuted
candidates are listed at the end so they are not re-chased.

**How to read each entry.** `Symbol` (`src/file:line`) · confidence · notes → then the branch,
why it is missing (evidence), and a concrete recommendation (target test file + the exact
expression + the assertion to write).

> **Conventions to honour when implementing** (from the repo): pair every dynamic-condition test
> with its direct non-dynamic equivalent and assert *identical* SQL+params; run date/time tests
> under `TZ=UTC` (the suite forces it); a couple of entries need a **new fixture** (flagged — that
> touches all 6 `test/db/*/domain/connection.ts` + schema DDL, weigh the cost); and the one
> **source bug** below must go to `test/BUGS.md` + a `// TODO[BUG]` — do **not** fix `src/` from a
> test PR.

---

## 📍 IMPLEMENTATION STATUS — ALL CLOSED

**All ~50 confirmed gaps are CLOSED** (the 4 docker-only entries C3 / G1 / G2 / G3 were authorised and
implemented with real SQL objects), propagated to all **17 active cells**; the whole matrix is green:
`tests:audit` ✓ (171 test files, **1205 tests/cell, 20485 validated**), `validate:tests` (tsgo) ✓,
`validate:tests:tsc` ✓, `bun run tests` (mock matrix) ✓ **20573 pass / 0 fail**, and a targeted
`--docker` pass real-validates every new SQL object (functions / procedures / sequences / tables) on
all 5 docker engines (postgres / mariadb / mysql / oracle / sqlserver). One source bug was surfaced
along the way — `localTime` parameter-binding on Oracle / SQL Server — and has since been **fixed**
(it was logged in `BUGS.md`, now closed).

The 21 fixture entries of the final round were completed by **extending the shared domain with real,
meaningful objects** (the DESIGN RULE below), NOT trap tables. New domain objects added across all 6
dialects (`schema.sql` + `seed.sql` + `connection.ts`):
- **`country`** — lookup table with a caller-**provided** primary key (`code`, ISO alpha-2).
- **`issue_worklog`** — time tracking: `localDate` / `localTime` / nullable `bigint` / nullable plain
  `boolean` (no adapter) / `optionalColumnWithDefaultValue` / plain `enum` columns.
- **`project_release`** — branded `customComparable` (version) / `custom` (channel) / optional
  `customUuid` (signing key) / `customLocalDate|Time|DateTime` columns, a DB-**generated** `notes`
  (`computedColumn`) and a `virtualColumnFromFragment` on a writable table.
- **`release_overview`** view (`vReleaseOverview`) — the View side of the same per-type dispatch.

**Validation:** the new `country` / `issue_worklog` / `project_release` / `release_overview` objects
and every Wave-6 test were **real-validated on all 6 dialects** — SQLite native in a plain
`bun run tests`, and the 5 docker engines (postgres / mariadb / mysql / oracle / sqlserver) via a
targeted `--docker` pass (the per-dialect `schema.sql`/`seed.sql` DDL all executes; the `STORED` /
`VIRTUAL` generated `notes` column, the RAW(16)/uniqueidentifier signing key, the date/time
columns, etc. all round-trip). **One bug surfaced and is documented in [`BUGS.md`](./BUGS.md):** binding a `localTime` *value as a
query parameter* is rejected by the Oracle (`ORA-01843`) and SQL Server (tedious `Invalid time`)
drivers — `localDate` / `localDateTime` are fine, and reading a `localTime` column works everywhere.
So `issue_worklog.started_at` is `optionalColumn(..., 'localTime')` (insert tests omit it) and the
dynamic-condition `local-time-descriptor-dispatch` test is `// TODO[BUG]`-commented on oracle +
sqlserver, live elsewhere (per the test-author / fixing-agent split — no `src/` change here). Type-only
/ helper tests don't touch a DB.

**Build change made (authorized):** `validate:tests:tsc` runs with
`NODE_OPTIONS="--max-old-space-size=8192"` — the matrix's value-source generics pushed tsc (TS6)
past Node's default ~4 GB heap. tsgo (authoritative) was never affected; tsc passes with full
coverage.

> ### ⚠️ DESIGN RULE honoured — NO trap tables
> An earlier attempt did the fixture entries with **local `class TFoo extends Table` stubs that
> re-projected the real `project`/`issue` tables with FALSE column semantics** (an autogenerated
> `id` re-declared as a provided `primaryKey`; a regular `slug` column re-declared as a
> `computedColumn`). These were **reverted** and redone by extending the shared domain with the real
> `country` / `issue_worklog` / `project_release` / `release_overview` objects above (per
> `WRITING_TESTS.md` § *Extending the shared domain*). A local stub stays acceptable only for the two
> narrow sanctioned cases (a *manufactured* table with no natural domain home that reads meaningfully,
> or a purely type-level test with a manufactured name that does **not** pretend to be a real table).

### ✅ DONE — docker-only / dialect-scoped SQL objects (4, authorised + `--docker`-validated)

Real SQL objects were added to the per-dialect `domain/schema.sql` + `connection.ts` and validated via
a targeted `--docker` pass. Live where the dialect supports the feature; NOT-APPLICABLE-commented (with
`types.negative` peers where the API is `never`-typed) elsewhere.

| Entry | File | Notes |
|---|---|---|
| **C3** `autogeneratedPrimaryKeyBySequence` | `insert.autogenerated-by-sequence.test.ts` (**NEW FILE**) | `tAuditEntry` (PK drawn from the `audit_tag_seq` sequence) on mariadb/oracle/postgres/sqlserver → INSERT references `nextval(seq)`; NOT-APPLICABLE on sqlite/mysql + `@ts-expect-error` peers in their `types.negative/insert.test.ts` |
| **G1** `executeFunction` return-type fan-out | `exec.procedure-function.test.ts` | `total_view_count`→`bigint`, `latest_issue_at`→optional `localDateTime`, `estimated_total`→branded `customDouble` (`Money`); real SQL functions per dialect + wrappers (sqlserver names need the `dbo.` prefix); commented on sqlite |
| **G2** `sequence()` value-type fan-out | `sequence.next-current-value.test.ts` | `release_tag_seq` declared over a branded `customInt` (`ReleaseTag`); `nextValue()` projects the branded value source; NOT-APPLICABLE on sqlite/mysql |
| **G3** `executeProcedure` (void) | `exec.procedure-function.test.ts` | `assertType<Exact<…, void>>()` on the existing `callRefreshStats()` no-args procedure test |

### ✅ DONE — Wave 6 (17) → file (canonical cell `sqlite/newest/bun_sqlite`, mirrored to all 17)

| Entry | File | Notes |
|---|---|---|
| C1, E4-Table | `docs.advanced.utility-types.test.ts` | `tProjectRelease.notes` (computedColumn) + `versionTag` (virtual) ∈ ColumnKeys but ∉ WritableColumnKeys, against a non-empty writable surface |
| C2, E3 | `docs.advanced.utility-types.test.ts` + `docs.advanced.columns-from-object.test.ts` | `tCountry.code` provided PK → ProvidedIdColumnKeys=`'code'`, required on insert; runtime `extractProvidedId*` → `['code']` |
| C4, C5, C6, C7, C8, C9, C10, C11 | `select.column-factory-types.test.ts` | **NEW FILE**. optionalColumnWithDefaultValue / custom local date-time / custom equality / customComparable / localDate+localTime / optional boolean / optional bigint / plain enum — type + SQL + value, real-validated on bun_sqlite |
| C12 | `select.view-column-types.test.ts` | **NEW FILE**. View-side per-type dispatch on `vReleaseOverview` |
| C13 | `with-values.advanced.test.ts` | base-type `optionalVirtualColumnFromFragment('int'/'string')` → `T \| undefined`, omitted from the VALUES tuple |
| F1, F2, F3 | `dynamic-condition.equivalence.test.ts` | customComparable + customUuid descriptor dispatch; `'localDate'`→DateFilter; `'localTime'`→TimeFilter — each paired against the direct API, identical SQL+params |

### ✅ DONE — earlier waves (30) → file (canonical cell `sqlite/newest/bun_sqlite`, mirrored to all 17)

| Entry | File | Notes |
|---|---|---|
| A1, B2, B5, B7, B8 | `select.value-source.column-vs-column.test.ts` | B2 = numeric-operators-column-rhs; tsc heap-bump was needed because of this file |
| A2 | `select.value-source.null-and-if-value-modifiers.test.ts` | |
| A3 | `select.value-source.between.test.ts` | |
| A4, D1 | `select.complex-projection.inner-rules.test.ts` | A4 = requiredInOptionalObject preserved through operator |
| A5 | `fragments.with-args.test.ts` | assertTypes on 2 existing intPlus tests + new value-source-arg test |
| A6 | `select.aggregation.test.ts` | count(optional) → required |
| B1 | `select.where.operators-insensitive.test.ts` | 3 tests, column-rhs of the 10 insensitive ops |
| B3, B4 | `select.string-ops.test.ts` | substr*/substringToEnd value-source + replaceAll value-source |
| B6 | `select.where.operators.test.ts` | and/or literal-boolean overload |
| E1, E2, E4-view | `docs.advanced.utility-types.test.ts` | type-only; identical across cells (cp-propagated). Uses ONLY real domain fixtures (tProject, tAppUser, tOrganization, vProjectOverview) |
| D2 | `insert.on-conflict.test.ts` | wrapped NOT-APPLICABLE on mysql (no RETURNING typing), oracle + sqlserver (no ON CONFLICT — MERGE) |
| D3 (insert+companion / update / delete) | `insert.returning.test.ts`, `update.returning.test.ts`, `delete.returning.test.ts` | wrapped on mysql (no RETURNING); update.returning also wrapped on mariadb (TODO[LIMITATION] 13.0.1+) |
| D4 | `select.compound.test.ts` | optional seed column → optional merged result |
| E5 | `docs.advanced.tables-views-as-parameter.test.ts` | default-alias arm |
| E6 | `docs.advanced.synchronous-query-runners.test.ts` | **NEW FILE**. sync() happy + sync rejection + SYNCHRONOUS_PROSIME_EXPECTED throw |
| E7, E8, E9 | `docs.advanced.deep-utilities.test.ts` | required-intermediate / depth-3 / two-leaves |
| F4 | `dynamic-condition.equivalence.test.ts` | enum-descriptor-dispatch |
| F5, F6 | `docs.advanced.utility-dynamic-picks.test.ts` | Pick*ProjectedAsNullable aliases |
| F7 | `dynamic-condition.from-model.test.ts` | all 14 OrderByForModel mode forms |

### ⬜ REMAINING — none

Every confirmed gap (A–G) is CLOSED. The 17 non-docker fixture entries (C1, C2, C4–C13, E3, E4-Table,
F1, F2, F3) were closed via the real shared-domain extension (the *Wave 6* table); the 4 docker-only
entries (C3, G1, G2, G3) were authorised, implemented with real SQL objects, and `--docker`-validated
on all 5 docker engines (the *docker-only* table above). The `localTime` parameter-binding **bug** that
this round surfaced has since been **fixed** (Oracle / SQL Server now bind a date-anchored `Date` instead
of a bare time string); the two `local-time-descriptor-dispatch` cells are live again and the `BUGS.md`
entry is closed.

---

## ✅ Source bug surfaced — FIXED

> **Resolved.** The `src/extras/utils.ts:250` return type was corrected to
> `Exclude<ProvidedIdColumnKeys<O>, EXCLUDE>[]`, and the existing
> `docs:columns-from-object/extract-provided-id-column-names` test in all 17
> `docs.advanced.columns-from-object.test.ts` cells was tightened from
> `assertType<Extends<typeof names, string[]>>()` to
> `assertType<Exact<typeof names, never[]>>()` — which the buggy type fails
> (`'id'[]` ≠ `never[]`) and the fixed type passes. **No new fixture was needed**:
> the mismatch is visible even on the autogenerated-PK fixtures, because the wrong
> type named `'id'` while the runtime (and now the type) returns `never[]`. The E3
> provided-PK fixture below remains a separate, optional coverage item. Changelog
> entry added under v2.0.0-beta.2 → Fixes.

**`extractProvidedIdColumnNamesFrom` declared return type is wrong** —
[src/extras/utils.ts:250](../src/extras/utils.ts#L250). The function body returns the names of
**provided (non-autogenerated) PK** columns (runtime predicate at line 270:
`__writable && __isPrimaryKey && !__isAutogeneratedPrimaryKey`), but its declared return type is
`Exclude<AutogeneratedIdColumnKeys<O>, EXCLUDE>[]` — it names the **autogenerated** alias instead of
`ProvidedIdColumnKeys<O>`. Confirmed as a copy/paste slip: the sibling object form
`extractProvidedIdColumnsFrom` (utils.ts:114) is correctly typed on `ProvidedIdColumnKeys<O>`, and
line 250 is a verbatim copy of `extractAutogeneratedIdColumnNamesFrom` (utils.ts:222) with the body
swapped but not the return type. The correct type is `Exclude<ProvidedIdColumnKeys<O>, EXCLUDE>[]`.
Invisible today because every fixture uses an autogenerated PK, so both aliases collapse to `[]`.
The **provided-PK fixture** recommended in gap **E3** would surface it. → log in `test/BUGS.md`,
add `// TODO[BUG]` next to the new assertion, no `src/` change in the test PR.

---

## A. Value expressions — optionality / nullability propagation

The value-source suite is mature, but the *optional* side of `MergeOptional` is systematically
unasserted: existing tests pin `required op required → required` and (rarely) `optional op optional
→ optional`, but never the **mixed** cells, and never with the optionality arriving from a
*value-source argument*.

**A1. `MergeOptional` mixed cells via the value-source overload, projected** —
`*ValueSource` binary ops ([src/expressions/values.ts:9](../src/expressions/values.ts#L9), used at
:249 `equals`, :291 `lessThan`, :425 `add`, …) · **high** · whole operator family.
- Branch: `required.binaryOp(optionalValueSource)` and `optional.binaryOp(requiredValueSource)` →
  `MergeOptional<'required','optional'> = 'optional'`, asserted as a **projected** optional column.
- Why missing: `select.value-source.column-vs-column.test.ts` projects only required operands;
  `greatest-least.test.ts` derives optionality from an *optional receiver + literal*; the one
  opt×opt case (`uuid-cast.test.ts`) is symmetric; the ~119 `requiredCol.equals(optionalCol)` sites
  all live inside `.on()`/`.and()` join clauses where the boolean is consumed, never projected.
- Add → `select.value-source.column-vs-column.test.ts`:
  `select({ x: tIssue.priority.add(tIssue.assigneeId), y: tIssue.priority.equals(tIssue.assigneeId), z: tIssue.assigneeId.add(tIssue.priority) })`
  then `assertType<Exact<…, Array<{ x?: number; y?: boolean; z?: number }>>>()`. SQL is param-free
  (`priority + assignee_id`, `priority = assignee_id`). Pins that the optional flag comes from the
  value-source argument (distinct from receiver-optional and opt×opt already covered).

**A2. `valueWhenNull(VALUE)` — required receiver + optional value-source default** —
([src/expressions/values.ts:212](../src/expressions/values.ts#L212), per-type redefs :275, :311, …)
· **high**.
- Branch: `requiredCol.valueWhenNull(optionalValueSource)` → result optionality is `VALUE[optionalType]`
  = `'optional'` (the overload *replaces* the receiver's optionality with the default's).
- Why missing: all covered shapes keep the receiver optional (`assigneeId.valueWhenNull(id)`,
  `body.valueWhenNull(title)`, `body.valueWhenNull(externalRef.asString())`), so none isolates "the
  default's optional flag wins past a required receiver".
- Add → `select.value-source.null-and-if-value-modifiers.test.ts`:
  `select({ x: tIssue.title.valueWhenNull(tIssue.body) })` (title required, body optional) →
  `assertType<Exact<…, Array<{ x?: string }>>>()`; SQL `coalesce(title, body)`.

**A3. `between` with an optional value-source bound, projected** —
([src/expressions/values.ts:302-304](../src/expressions/values.ts#L302)) · **high**.
- Branch: `requiredCol.between(optionalBound, requiredBound)` →
  `MergeOptional<MergeOptional<recv,V>,V2> = 'optional'`, asserted as a projected boolean.
- Why missing: `between.test.ts` projects only required bounds; the one optional between
  (`assigneeId.between(1,2)`) is a WHERE predicate whose boolean is never projected.
- Add → `select.value-source.between.test.ts`:
  `select({ b: tIssue.priority.between(tIssue.assigneeId, tIssue.number) })` →
  `assertType<Exact<…, Array<{ b?: boolean }>>>()`; SQL `priority between assignee_id and number`.

**A4. `MergeOptional` asymmetric intermediate states** —
([src/expressions/values.ts:14-19](../src/expressions/values.ts#L14)) · **medium**.
- Branch: `requiredInOptionalObject` / `originallyRequired` (the lattice's middle rows) fed into a
  binary operator — the only place those rows are reachable through an operator.
- Why missing: all ~69 `asRequiredInOptionalObject()` usages are projection-shape calls; none pipes
  the result (or a left-joined `originallyRequired` column) into `.equals`/`.add`/`.and`.
- Add → inside a complex projection in `select.complex-projection.inner-rules.test.ts`, build
  `tIssue.priority.asRequiredInOptionalObject().equals(tIssue.id)` and a left-joined-column
  `.add(requiredCol)`; assert the resulting leaf optionality reflects `requiredInOptionalObject` /
  `originallyRequired` (read that file's projection-rule expectations first to fix the exact shape).

**A5. `MergeOptionalUnion` over `FragmentFunctionMaybeOptional*`** —
([src/expressions/fragment.ts:421-477](../src/expressions/fragment.ts#L421), uses values.ts:43) ·
**high (PARTIAL)**.
- Branch: a `buildFragmentWithMaybeOptionalArgs` fn invoked with mixed required/optional args →
  optional result; plus the value-source-arg overloads that read `T[optionalType]` from a passed
  value source.
- Why partial: the optional path is exercised at **runtime only** (`intPlus(undefined,5)` →
  `{ r: undefined }`) with **no `assertType`**, and the value-source-argument overloads are never hit
  (both calls pass literals).
- Add → `fragments.with-args.test.ts`: add `assertType<Exact<…,Array<{ r: number }>>>()` /
  `<{ r?: number }>` to the two existing `intPlus` tests, then a value-source-arg case
  `intPlus(conn.const(3,'int'), tIssue.assigneeId)` asserting an optional result.

**A6. `count(optionalColumn) → required`** —
([src/connections/AbstractConnection.ts:1064](../src/connections/AbstractConnection.ts#L1064)) ·
**high (PARTIAL)**.
- Branch: `count`/`countDistinct` of an *optional* column is still `'required'` (optionality is
  decoupled from the input). (The dual `sum(requiredCol) → optional` is already covered.)
- Why partial: every count assertion uses a required input (`count(id)`); the optional-input case
  that proves the decoupling is never pinned.
- Add → `select.aggregation.test.ts`: `select({ assigned: conn.count(tIssue.assigneeId) })` →
  `assertType<Exact<…, { assigned: number }>>()` (required); SQL `count(assignee_id)`.

---

## B. Value expressions — constant-vs-ValueSource (and other) overloads

A dedicated test file (`select.value-source.column-vs-column.test.ts`) covers the value-source-RHS
emission path for a *subset* of operators; the gaps below are the operators that subset skipped.
Each is a real distinct overload with a distinct, param-free SQL-emission path (RHS through
`_appendSql`, not a bound param).

**B1. Insensitive string predicates — value-source (column) RHS overload (10 methods)** —
([src/expressions/values.ts:686,689,698,701,716,719,722,725,734,737](../src/expressions/values.ts#L686))
· **high**.
- Branch: `equalsInsensitive`/`notEqualsInsensitive`/`likeInsensitive`/`notLikeInsensitive`/
  `startsWithInsensitive`/`notStartsWithInsensitive`/`endsWithInsensitive`/`notEndsWithInsensitive`/
  `containsInsensitive`/`notContainsInsensitive` with a `IStringValueSource` RHS.
- Why missing: all insensitive ops are tested literal-only; the **case-sensitive twins** (`like`/
  `contains`/…) *do* have a column-RHS test (`select.where.like-escape.test.ts`) — clean asymmetry.
- Add → `select.where.operators-insensitive.test.ts` (or a new column-vs-column variant):
  `tAppUser.email.equalsInsensitive(tAppUser.fullName)` → param-free `lower(email) = lower(full_name)`,
  plus one affix variant `tIssue.body.containsInsensitive(tIssue.title)` (distinct SqlBuilder method).
  The `not…`/`like`/`startsWith`/`endsWith` variants each hit a distinct `_…Insensitive` method.

**B2. Numeric operator value-source overload on `NumberValueSource`** —
([src/expressions/values.ts:426,430,414,416,418,436,422](../src/expressions/values.ts#L414)) ·
**high**.
- Branch: `subtract`, `divide`, `power`, `logn`, `roundn`, `atan2`, `maxValue` each with an
  `INumberValueSource` RHS. (`add`/`multiply`/`modulo`/`minValue` already covered column-vs-column;
  **`minValue` is covered → do not add it**.)
- Why missing: every call uses a numeric literal; CustomDouble's `divide`/`logn`/`atan2` tests use
  `const()` which still binds a param, so they do not exercise the param-free `col OP col` shape on
  plain `NumberValueSource`.
- Add → `select.value-source.column-vs-column.test.ts`: `tIssue.priority.subtract(tIssue.id)`,
  `.divide(tIssue.id)` (note divide upcasts to double — assert the dialect's `/`/`::float`),
  `.power(tIssue.id)` (`power(priority,id)`), `.logn(tIssue.id)`, `.roundn(tIssue.id)`,
  `.atan2(tIssue.id)`, `tIssue.priority.maxValue(tIssue.number)` (`least(priority,number)`). All
  param-free.

**B3. `substr` / `substrToEnd` / `substringToEnd` — `INumberValueSource` boundary overload** —
([src/expressions/values.ts:751,753,756-758](../src/expressions/values.ts#L751)) · **high**.
- Branch: substring boundaries supplied as a number value-source, not a literal int. (`substring`
  is already covered with VS args in both positions — asymmetry within the family.)
- Add → `select.string-ops.test.ts`: `tIssue.title.substrToEnd(tIssue.priority)` and
  `tIssue.title.substr(tIssue.priority, tIssue.id)`; param-free.

**B4. `replaceAll` — `IStringValueSource` find/replace overload** —
([src/expressions/values.ts:767-769](../src/expressions/values.ts#L767)) · **high**.
- Branch: find/replace operands as string value-sources → `replace(col, col2, col3)`, no params.
- Add → `column-vs-column` / `select.string-ops.test.ts`:
  `tIssue.title.replaceAll(tIssue.body, tIssue.title)`.

**B5. `nullIfValue` — `IValueSource` (column) overload** —
([src/expressions/values.ts:277/313/440/774 per type](../src/expressions/values.ts#L277)) · **high**.
- Branch: NULL-out when the column equals another column → `nullif(col, col2)`, param-free. (Sibling
  `valueWhenNull` is covered with a VS arg — asymmetry within the nullable-modifier pair.)
- Add → `select.value-source.column-vs-column.test.ts`: `tIssue.body.nullIfValue(tIssue.title)`;
  assert result stays `optional`.

**B6. `BooleanValueSource.and(boolean)` / `.or(boolean)` literal overload** —
([src/expressions/values.ts:332,334](../src/expressions/values.ts#L332); also `IfValueSource`
355/358 and `AlwaysIfValueSource` 372/374) · **high**.
- Branch: a compile-time boolean constant operand (distinct from the `IAnyBooleanValueSource`
  overload; routes through `_appendValue` → bound boolean param).
- Why missing: every `and`/`or` call passes another predicate (the value-source overload).
- Add → `boolean-chain.test.ts`: `where(col.equals(x).and(true))` / `.or(false)`; assert the emitted
  SQL for a literal-boolean operand and that the optional-type is unchanged. One test each for the
  `IfValueSource`/`AlwaysIfValueSource` twins if widening.

**B7. `in` / `notIn` — single-ValueSource overload** —
([src/expressions/values.ts:262,266](../src/expressions/values.ts#L262)) · **medium-high**.
- Branch: `in<VALUE extends IEqualableValueSource>(value)` — one value-source, not an array, not a
  subquery → `col in (col2)`. (Array / empty-array / subquery forms are all covered.)
- Add → `where(tIssue.priority.in(tIssue.id))`; verify the actual emitted snapshot (close to a
  1-element list).

**B8. `inN` / `notInN` — value-source-element overload** —
([src/expressions/values.ts:269,271](../src/expressions/values.ts#L269)) · **medium-high**.
- Branch: `inN(...Array<TYPE | VALUE>)` mixing literals and value-sources. (Only literal varargs
  `inN(1,3)` covered.)
- Add → `tIssue.priority.inN(tIssue.id, tIssue.number)` and/or `inN(1, tIssue.id)`.

---

## C. Column & table/view definitions

The domain model uses only `autogeneratedPrimaryKey` / `column` / `optionalColumn` /
`columnWithDefaultValue` / `virtualColumnFromFragment`. Whole families of the column factory are
therefore exercised only in compile-only doc-code (or nowhere). Each entry below is a distinct
factory overload → distinct typed/branded column.

| # | Factory (`src/Table.ts` unless noted) | Branch / type-promise | Verdict |
|---|---|---|---|
| **C1** | `computedColumn` / `optionalComputedColumn` (:321-387) | non-writable column → no `& Column`; must be **excluded** from Insertable/Writable shapes | CONFIRMED |
| **C2** | `primaryKey` (non-autogenerated) (:253-285) | `& PrimaryKeyColumn` → **required on insert**, distinct from autogenerated | CONFIRMED |
| **C3** | `autogeneratedPrimaryKeyBySequence` (:287-319) | PK from a named sequence → `nextval(seq)` SQL; `this`-gated to mariaDB/oracle/postgreSql/sqlServer | CONFIRMED · dialect-scoped |
| **C4** | `optionalColumnWithDefaultValue` (:185-217) | `'optional' & ColumnWithDefaultValue` → omittable on insert AND `T \| null` | CONFIRMED |
| **C5** | `customLocalDate` / `customLocalTime` / `customLocalDateTime` as a column | branded `CustomLocal*ValueSource<…,T,TYPE_NAME>` | CONFIRMED |
| **C6** | `custom` as a plain column | TypeAdapter-backed `EqualableValueSource` (equality only) | CONFIRMED |
| **C7** | `customComparable` as a column | `ComparableValueSource` (`<`/`between`/`orderBy`) — capability conferred at the column site | CONFIRMED |
| **C8** | `localDate` / `localTime` as a column type | `LocalDate/LocalTimeValueSource` projection + per-dialect marshalling | CONFIRMED |
| **C9** | `optionalColumn('boolean')` | `BooleanValueSource<…,'optional'>` → `boolean \| null` + optional-null marshalling | CONFIRMED |
| **C10** | `optionalColumn('bigint')` | `BigintValueSource<…,'optional'>` → `bigint \| null` | CONFIRMED |
| **C11** | `enum` as a **plain** (non-virtual) column | `column('x','enum','MyEnum')` — distinct overload from the only-covered `virtualColumnFromFragment('enum')` | PARTIAL |
| **C12** | View-side mirrors of C5–C10 ([src/View.ts:52-118](../src/View.ts#L52)) | same per-type ValueSource on a View source | PARTIAL (lower value; shared dispatch) |
| **C13** | `Values.optionalVirtualColumnFromFragment` base types ([src/Values.ts:171-205](../src/Values.ts#L171)) | base-type (non-custom) optional virtual column → `T \| undefined`, omitted from VALUES tuple | PARTIAL |

Recommendations (per entry): declare the column on a fixture table (or, for C5–C8, add as a sibling
in `select.column-with-custom-type-and-adapter.test.ts`), then **round-trip it** — assert the
projected result type (`assertType`), the emitted SQL/marshalling, and for **C1** that it is absent
from the insert/update shape, for **C2** that the PK is required in the mandatory insert set, for
**C3** that the SQL references the sequence (`nextval`/`.NEXTVAL`) on a supporting dialect (place a
`types.negative` peer on sqlite/mysql where it is `never`). **C8/C5** date/time marshalling differs
per dialect — run under `TZ=UTC`.

---

## D. Query builders & result-shape projectors

The result-shape surface is broadly very well covered (the 4-rule projector, left-join optionality,
nested objects, compound operators, recursive CTEs, returning/execute variants). Gaps concentrate
in the **second projector** (`projectingOptionalValuesAsNullable`) outside `aggregateAsArray`, and
in one compound optionality case.

**D1. `projectingOptionalValuesAsNullable()` on a non-aggregate select with a nested object** —
([src/complexProjections/resultWithOptionalsAsNull.ts:56,92-148](../src/complexProjections/resultWithOptionalsAsNull.ts#L56))
· **high** · compiler-verified shape.
- Branch: a left-joined sub-object projected with the helper → `{...} | null` (vs the default
  `org?: {...}`). The recursive `ResultObjectValuesProjectedAsNullable2..4` path.
- Why missing: the helper runs only on flat objects (`archivedAt: Date | null`) or inside
  `aggregateAsArray` (whose first-level object can't be null). No plain-select nested assertion.
- Add → `select.complex-projection.inner-rules.test.ts` (or a new `…nullable-projection.test.ts`):
  ```ts
  const tOrgLeft = tOrganization.forUseInLeftJoin()
  const row = await conn.selectFrom(tProject)
    .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.organizationId))
    .where(tProject.id.equals(1))
    .select({ pid: tProject.id, org: { id: tOrgLeft.id, name: tOrgLeft.name } })
    .projectingOptionalValuesAsNullable()
    .executeSelectOne()
  assertType<Exact<typeof row, { pid: number; org: { id: number; name: string } | null }>>()
  ```

**D2. `onConflictDoNothing().returningLastInsertedId()` → `number | null`** —
([src/expressions/insert.ts:750-753](../src/expressions/insert.ts#L750)) · **high** · dialect-scoped
· compiler-verified.
- Branch: a conflict may suppress the insert, so the last-id is optional
  (`AutogeneratedPrimaryKeyColumnsTypesOf<TABLE> | null`), distinct from the non-conflict non-null
  last-id. (The optional *row* shape after on-conflict is already covered; the optional *last-id* is
  not.)
- Why missing: no test chains `onConflict*` with `returningLastInsertedId` — the files containing
  both use them in separate tests.
- Add → `insert.on-conflict.test.ts` (or `insert.execute-variants.test.ts`):
  ```ts
  const id = await conn.insertInto(tOrganization).values({ name: 'Acme Corp', plan: 'free' })
    .onConflictDoNothing().returningLastInsertedId().executeInsert()
  assertType<Exact<typeof id, number | null>>()
  ```
  Respect the supported-DB set (`OnConflictReturningLastInsertedIdOptionalType` is `never` outside
  `noopDB|postgreSql|sqlServer|oracle|sqlite|mariaDB`); a `types.negative` peer may be needed where
  unsupported.

**D3. `returning({...}).projectingOptionalValuesAsNullable()` on INSERT / UPDATE / DELETE** —
([insert.ts:650-651,674-676](../src/expressions/insert.ts#L650); update.ts; delete.ts) · **high** ·
compiler-verified.
- Branch: optional returning columns become `| null` via `ResultObjectValuesProjectedAsNullable` on
  a mutation builder (the `…ProjectableAsNullable` interfaces exist on all three).
- Why missing: the helper is only ever called on selects/aggregate-as-array — zero mutation-returning
  tests call it.
- Add → one per mutation in `insert.returning.test.ts` / `update.returning.test.ts` /
  `delete.returning.test.ts`, returning an optional column under the helper:
  ```ts
  const inserted = await conn.insertInto(tProject).values({ organizationId: 1, name: 'x', slug: 'x' })
    .returning({ id: tProject.id, archivedAt: tProject.archivedAt })
    .projectingOptionalValuesAsNullable().executeInsertOne()
  assertType<Exact<typeof inserted, { id: number; archivedAt: Date | null }>>()
  ```
  Pair each with its non-nullable equivalent (`archivedAt?: Date`) to prove the helper flips it.

**D4. Compound with an OPTIONAL seed column → optional merged result** —
([src/complexProjections/compound.ts:12,51](../src/complexProjections/compound.ts#L51)) ·
**medium-high (PARTIAL — wave-1 framing corrected)** · compiler-verified.
- Branch (corrected): compound result optionality is decided by the **seed (first) query**, via
  `OptionalTypeRequiredOrAny` (`'required' → 'required'`, else → relaxed). The reachable untested
  case is an **optional seed → `{ a?: T }[]`**. (Wave-1's "required ⊕ optional merge" is *not*
  type-correct — the second branch must conform to the seed's slot, so the mix never typechecks.)
- Why missing: every compound test uses a required seed; the relaxed (optional) branch never fires
  under an `assertType`.
- Add → `select.compound.test.ts`:
  ```ts
  const optSeed = conn.selectFrom(tProject).select({ a: tProject.archivedAt })
  const other   = conn.selectFrom(tProject).select({ a: tProject.archivedAt })
  const result  = await optSeed.union(other).executeSelectMany()
  assertType<Exact<typeof result, Array<{ a?: Date }>>>()
  ```
  (Both branches carry the optional column so the second conforms to the seed.)

---

## E. Pure type transformers & utility types (`extras/*`)

**E1. `SelectedRowProjectedAsNullable` / `SelectedValuesProjectedAsNullable`** —
([src/extras/types.ts:28-39](../src/extras/types.ts#L28)) · **high** · public + documented · cheap.
- Branch: optionals-as-NULL projection (routes through `ResultObjectValuesProjectedAsNullable`):
  optional projected columns become present `T | null`, not `?: T`.
- Why missing: **zero references** in all of `test/`; `docs.advanced.utility-types.test.ts` covers
  only the non-nullable `SelectedRow`/`SelectedValues`.
- Add → `docs.advanced.utility-types.test.ts` (use `tProject`, which has `archivedAt = optionalColumn`):
  `assertType<Exact<SelectedValuesProjectedAsNullable<typeof tProject>, { …; archivedAt: Date | null; createdAt: Date }>>()`,
  contrast with `SelectedValues<typeof tProject>` (`archivedAt?: Date`), and pin
  `Exact<SelectedRowProjectedAsNullable<T>, SelectedValuesProjectedAsNullable<T>>` (they are aliases).

**E2. `*ShapedAs` family (6 types)** —
([src/extras/types.ts:51-69](../src/extras/types.ts#L51)) · **high**.
- Branch: `ResolveShape<TABLE, SHAPE>` renames the table's column keys to the shape's property names,
  preserving per-column required/optional/value-source typing. (Note: the two on-conflict aliases
  both delegate to `OnConflictUpdateValues` → Row === Values for that pair; pin that equality.)
- Why missing: only compile-only `void function(_0: X){}` smoke in generated doc-code; no `Exact`.
- Add → `docs.advanced.utility-types.test.ts` with `const s = { newName: 'name', newPlan: 'plan' } as const`
  over `tOrganization`: assert the renamed mandatory keys for each of the 6 types (prefer
  `Extends`/assignment probes over `Exact`, matching the existing `Insertable*`/`Updatable*` tests
  which avoid `Exact` due to lib-version `?:` drift); for the on-conflict pair assert
  `Exact<…RowShapedAs, …ValuesShapedAs>`; the `*Row*` variants additionally accept value-sources.

**E3. `ProvidedIdColumnKeys` non-`never` branch** —
([src/extras/types.ts:80-82](../src/extras/types.ts#L80)) · **high** · **needs a NEW fixture** · ties
to the bug above.
- Branch: a table with a **provided** PK (`primaryKey(...)` not `autogeneratedPrimaryKey(...)`) → the
  column is in `ProvidedIdColumnKeys` + `IdColumnKeys` but NOT `AutogeneratedIdColumnKeys`.
- Why missing: `ProvidedIdColumnKeys` is only ever asserted `= never` (autogenerated-PK fixtures); no
  domain table uses a provided PK, so the non-empty branch is unreachable.
- Add → a new fixture table with `primaryKey('id','int')`, then
  `assertType<Exact<ProvidedIdColumnKeys<typeof tProvidedPk>, 'id'>>()`,
  `assertType<Exact<AutogeneratedIdColumnKeys<typeof tProvidedPk>, /* excludes 'id' */>>()`,
  `assertType<Extends<'id', IdColumnKeys<typeof tProvidedPk>>>()`. The same fixture enables a runtime
  `extractProvidedIdColumnNamesFrom` test that asserts `['id']` and **surfaces the utils.ts:250 bug**
  (→ `// TODO[BUG]` + `test/BUGS.md`). *Fixture cost: touches all 6 domains + schema DDL — weigh it.*

**E4. `ColumnKeys` vs `WritableColumnKeys` — computed-column exclusion** —
([src/extras/types.ts:78-79](../src/extras/types.ts#L78)) · **medium-high (PARTIAL)**.
- Branch: a `virtualColumnFromFragment` column is in `ColumnKeys` (it is an `AnyValueSource`) but NOT
  in `WritableColumnKeys` (not a `WritableDBColumn`).
- Why partial: the only computed-column fixture (`vProjectOverview.nameUpper`) is on a **View**, whose
  *regular* columns are also non-writable, so `WritableColumnKeys` is `never` for the whole view —
  it can't isolate the computed-specific exclusion from a writable surface.
- Add → (cheap, now) in `docs.advanced.utility-types.test.ts`:
  `assertType<Exact<ColumnKeys<typeof vProjectOverview>, '…'|'nameUpper'>>()` (pins `nameUpper`
  present) + `assertType<Exact<WritableColumnKeys<typeof vProjectOverview>, never>>()`. (Full
  Table-level isolation needs a Table-with-virtual-column fixture — same cost note as E3.)

**E5. `TableOrViewOf` / `TableOrViewLeftJoinOf` — default-alias arm** —
([src/extras/types.ts:84-96](../src/extras/types.ts#L84)) · **high** · cheap.
- Branch: the `ALIAS extends ''` (default, no-alias) arm. Only the explicit-alias arm is asserted.
  (The `false`/`any` arm is degenerate/internal — skip.)
- Add → `docs.advanced.tables-views-as-parameter.test.ts`:
  `const ref: TableOrViewOf<typeof tProject> = tProject; void ref` and
  `const ref2: TableOrViewLeftJoinOf<typeof tIssue> = tIssue.forUseInLeftJoin(); void ref2`.

**E6. `sync()` — `SYNCHRONOUS_PROSIME_EXPECTED` throw** —
([src/extras/sync.ts:45-49](../src/extras/sync.ts#L45)) · **high** · cheap, no DB.
- Branch: a promise not resolved synchronously by the time `.then` returns → throw
  `TsSqlProcessingError({ reason: 'SYNCHRONOUS_PROSIME_EXPECTED' })`. Only the happy path is covered.
- Add → assert `sync(Promise.resolve(1))` throws (a native Promise defers `.then`, triggering the
  guard) and `(err as TsSqlProcessingError).errorReason.reason === 'SYNCHRONOUS_PROSIME_EXPECTED'`.

**E7–E9. `DeepPick` / `DeepOmit` edge shapes** —
([src/extras/deepUtilities.ts:61-82](../src/extras/deepUtilities.ts#L61)) · **high** · cheap.
- **E7** required (non-optional) intermediate object: tested models only have an optional `company?`.
  Add a model `{ id: number; org: { id: number; name: string } }` and
  `assertType<Exact<DeepPick<M,'org.name'>, { org: { name: string } }>>()` + the `DeepOmit` dual.
- **E8** depth-3 path (`a.b.c`): models are ≤2 levels. Add `{ a: { b: { c: number; d: string } } }` →
  `DeepPick<M3,'a.b.c'>` = `{ a: { b: { c: number } } }`, plus `DeepPickPaths<M3>` includes `'a.b.c'`.
- **E9** two leaves of one nested object: reuse `CustomerWithCompany` →
  `assertType<Exact<DeepPick<CustomerWithCompany,'company.id'|'company.name'>, { company?: { id: number; name: string } }>>()`.

> **Out of scope:** `TsSqlErrorReason` `SQL_*` subfield discriminant narrowing
> ([src/TsSqlError.ts:162-292](../src/TsSqlError.ts#L162)) — the type-branch is real, but producing
> an `SQL_*` error with a populated subfield happens entirely in the excluded
> `src/queryRunners/databaseErrorMappers/`; there are 0 in-scope producers. A synthetic type-only
> `assertType` would be contrived and low-value. Not counted as a gap.

---

## F. Dynamic condition / pick / orderBy

The string/uuid/int/double/bigint/boolean/localDateTime operator surface is thoroughly covered
(every operator + its `*IfValue` twin, paired against the direct API). Gaps are in **descriptor
arms that are never dispatched through `withValues`** and two unreferenced public pick aliases.

**F1. `custom*` descriptor dispatch — all 8 arms (incl. `CustomUuidFilter`)** —
([src/expressions/dynamicConditionUsingFilters.ts:137-145](../src/expressions/dynamicConditionUsingFilters.ts#L137))
· **high**.
- Branch: `['customInt'|'customDouble'|'customUuid'|'customLocalDate'|'customLocalTime'|'customLocalDateTime'|'customComparable'|'custom', T]`
  each → its `Custom*Filter<T>` / `ComparableFilter<T>` / `EqualableFilter<T>`. `CustomUuidFilter<T>`
  (lines 89-125) is a full bespoke like/affix/insensitive interface over the branded `T`.
- Why missing: a real `customInt` column exists (`tProjectBranded.id`) but is only used via the
  direct API; **zero** custom* descriptors are fed through `dynamicConditionFor`. The model path
  *structurally cannot* reach custom arms (it can't map adapters), so only the descriptor map can.
- Add → `dynamic-condition.equivalence.test.ts`: at minimum `['customComparable',T]`
  (`{ lessThan, greaterThan }`) and `['customUuid',T]` (`{ like, contains, startsWith }`) through
  `withValues`, each paired against the direct custom-column call, asserting identical SQL+params.

**F2. `'localDate'` (→ `DateFilter`) and F3. `'localTime'` (→ `TimeFilter`) descriptor dispatch** —
([dynamicConditionUsingFilters.ts:134-135](../src/expressions/dynamicConditionUsingFilters.ts#L134))
· **high** · need a fixture column.
- Branch: distinct `FilterTypeOf` arms; only `'localDateTime'` (`DateTimeFilter`) is exercised.
  Per-dialect date/time literal emission may differ from datetime.
- Why missing: the domain has no date-only/time-only column.
- Add → `dynamic-condition.equivalence.test.ts`: declare a fixture column `'localDate'` (and one
  `'localTime'`), dispatch `{ d: { lessThan, greaterOrEqual } }` via `dynamicConditionFor` vs the
  direct comparable calls; assert identical SQL+params (run under `TZ=UTC`).

**F4. `['enum', T]` descriptor dispatch through `withValues`** —
([dynamicConditionUsingFilters.ts:143](../src/expressions/dynamicConditionUsingFilters.ts#L143)) ·
**high**.
- Branch: `['enum', infer T] → EqualableFilter<T>`. Only the *type mapping* is asserted (from-model),
  never run to SQL.
- Add → `dynamic-condition.equivalence.test.ts`:
  `DynamicCondition<{ status: ['enum','open'|'closed'] }>` with
  `withValues({ status: { equals: 'open', in: ['open','closed'], notEquals: 'closed' } })` over
  `{ status: tIssue.status }` vs the direct `.equals(...).and(.in(...)).and(.notEquals(...))`;
  identical SQL+params.

**F5. `PickValuesPathProjectedAsNullable` and F6. `PickValuesPathWitAllPropertiesProjectedAsNullable`
(standalone aliases)** —
([src/dynamic/pick.ts:22-23](../src/dynamic/pick.ts#L22)) · **high** · cheap.
- Branch: the nullable-projection siblings of `PickValuesPath` / `…WitAllProperties` (picked leaves
  with optionals as `| null`).
- Why missing: **zero references** in `test/` (the non-nullable twins *are* `Exact`-asserted). The
  `expandType…AsNullable…` *function* shares the mapping (transitive), but the documented standalone
  aliases get no direct assertion.
- Add → `docs.advanced.utility-dynamic-picks.test.ts`, mirroring the existing `PickValuesPath`
  assertions, using a fixture whose picked leaves include a nullable column so `| null` is visible.

**F7. `OrderByForModel` — full `OrderByMode` set on the dotted-path template-literal string** —
([src/dynamic/orderBy.ts:40](../src/dynamic/orderBy.ts#L40)) · **high**.
- Branch: `` `${path} ${OrderByMode}` `` admits all **14** mode strings (asc/desc × {∅|nulls
  first|nulls last} × {∅|insensitive}) on any leaf path. Only 4 modes are built as
  `OrderByForModel<M>` strings; the other modes are covered only via the separate `.orderBy(col,
  mode)` 2-arg API (a different code path).
- Add → `dynamic-condition.from-model.test.ts`: a `const allModes: OrderByForModel<M>[] = [ …all 14
  modes on 'priority'… ]` plus the same on a nested path (`'author.id <mode>'`) and a runtime
  `expect(allModes).toHaveLength(14)`.

**Lower-value (PARTIAL):** `MapValueSourceToFilter` aggregated-array arm (reached at runtime via `as
any`; the type promise is unasserted — orderBy.ts:191); `DynamicConditionForModel<M, EXTENSION>`
second-param forwarding (never used with a non-`never` extension — condition.ts:39); the
deep-MANDATORY pick **alias** on a deep path (the runtime shape *is* `Exact`-asserted —
`dynamic-condition.pick.test.ts:130-162` — only the standalone alias isn't).

---

## G. Connection surface not centred by any area lens (completeness sweep)

The JOIN-builder surface per kind (incl. `leftOuterJoin`/`optional*Join`/`dynamicOn` and the
left-join → optional-column result), multi-table UPDATE-`join` / DELETE-`using`, INSERT-from-select,
`connectBy`/`startWith`, `SqliteConfiguration`/`SqliteDateTimeFormat`, `Values.forUseInLeftJoin(As)`,
and the per-DB `*Distinct` capability methods are all **already covered** with `assertType`. The
only genuinely unvisited surface was sequences and `exec*`:

**G1. `executeFunction` — return-type overload fan-out** —
([src/connections/AbstractConnection.ts:601-654](../src/connections/AbstractConnection.ts#L601)) ·
**high**.
- Branch: the `returnType` discriminator selects ~15 arms (`boolean`/`bigint`/`double`/`uuid`/
  `localDate`/`localTime`/`localDateTime`/`enum`/`custom*`/`customComparable`), each crossed with
  `required → Promise<T>` vs `optional → Promise<T | null>`. The `typeName`-carrying custom arms add
  a positional arg that shifts `required` into 4th position.
- Why missing: every domain declares only `int` + `string` function wrappers; the `required`/
  `optional` distinction is covered (string + null), but the other ~13 return arms are untested.
- Add → a couple of function wrappers on the domain connection, e.g.
  `executeFunction('f', [...], 'localDateTime', 'optional')` → `Promise<Date | null>` and
  `executeFunction<Money>('f', [...], 'customDouble', 'Money', 'required')` → `Promise<Money>`, with
  `assertType<Exact<…>>` on each.

**G2. `sequence()` — value-type overload fan-out** —
([src/connections/AbstractAdvancedConnection.ts:16-42](../src/connections/AbstractAdvancedConnection.ts#L16))
· **high** · *file never opened by the area lenses*.
- Branch: ~22 overloads mapping each `ValueType` keyword to a `Sequence<…ValueSource<…,'required'>>`
  with a typed `.nextValue()` / `.currentValue()`. Only `int` + `bigint` are ever declared.
- Add → declare one sequence over a non-numeric type (e.g. `this.sequence('s','string')` or a
  branded `customInt`) in a domain connection and assert `seq.nextValue()` projects the right
  value-source type via `selectOneColumn(...).executeSelectOne()` + `assertType<Exact<…>>`.

**G3. `executeProcedure` (void) vs `executeFunction` (value) — type distinction** —
([AbstractConnection.ts:587 vs 601](../src/connections/AbstractConnection.ts#L587)) · **medium**.
- Branch: `executeProcedure(...)` returns `Promise<void>`; the void return is only implicit in the
  wrapper signature, never `assertType`-pinned.
- Add → `assertType<Exact<Awaited<ReturnType<typeof ctx.conn.callRefreshStats>>, void>>()` alongside
  the existing procedure test.

---

## Refuted / already-covered candidates (do NOT re-chase)

These were flagged during discovery and **disproved** during verification — they are covered; listed
so the implementing agent doesn't re-open them.

- **`minValue` value-source overload** — covered (`greatest-least.test.ts:93`,
  `priority.minValue(number)` → `greatest(priority, number)`). Only its twin **`maxValue`** is
  missing (see B2).
- **`sum`/`average` of a required column → optional** — covered (`select.aggregation.test.ts:39/94`).
  Only the dual `count(optionalCol) → required` is missing (see A6).
- **Recursive/CTE `ColumnsForWithView` optionality remap** — covered
  (`cte.recursive-union-variants.test.ts` carries optional `parentId` through a recursive CTE,
  asserts `parentId?: number`, required columns stay required).
- **`useEmptyArrayForNoValue` / `asOptionalNonEmptyArray`** — covered (array empty-coercion + modifiers).
- **JOIN-builder per-kind + left-join nullability, UPDATE/DELETE multi-table, INSERT-from-select,
  `connectBy`/`startWith`, `SqliteDateTimeFormat`, `Values` left-join, `*Distinct` capabilities,
  `fromRef` (both overloads), `DeepPickPaths` terminal/optional-intermediate, `dynamicPick`/
  `dynamicPickPaths` runtime, the 4-rule undefined projector, all non-`SQL_*` error reasons** — all
  covered (completeness sweep + area lenses confirmed).
- **"between" as a dynamic-condition operator** — does not exist (a misleading header comment in
  `dynamic-condition.operators.test.ts`); not a gap.

---

## Quick-win order (cheapest, no new fixture, highest confidence first)

1. **E1, E5, E6, E7–E9** — pure `assertType`/throw additions to existing `extras` test files.
2. **F5, F6, F7, F4** — dynamic alias + enum-dispatch + orderBy-mode assertions in existing files.
3. **A1, A2, A3, A6, B1–B8** — value-source operator additions to existing
   `column-vs-column` / `string-ops` / `aggregation` / `between` files.
4. **D1, D2, D3, D4** — projector additions to existing select/insert/update/delete returning files.
5. **E2** — `*ShapedAs` assertions over `tOrganization` (existing fixture).
6. **C1–C13, F1–F3, G1–G3** — need a new fixture column/wrapper (cheap-ish, per existing fixtures).
7. **E3 + E4 (Table side)** — need a **new fixture table** (provided-PK / virtual-column); also the
   witness for the **utils.ts:250 bug**. Highest cost — weigh before doing.
