# Missing-tests audit — ROUND 15

**Method:** type-driven discovery per [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md).
16 parallel discovery agents (one per surface) raw-read `src/` types, built an
exhaustive enumeration matrix, and checked each type-path against the **current**
test files. The coordinator deduped, settled cross-agent contradictions by direct
inspection, and verified the load-bearing / subtlest claims himself (wide-grep +
impl-read + one tsgo compile-repro). Degeneracy bar = the narrow one (§4 of the
runbook): a distinct reachable overload / interface / per-receiver method / arity /
input-classification is a GAP even when its output coincides with a covered case.

**Mandate this round:** maximalist / very deep, same intent as round 14 — total
coverage of every reachable typed path *and variant*, prefer erring by excess.

**Pre-flight:** matrix = 17 cells, 201 files, 1633 tests/cell, 27761 total,
`tests:audit` ✓ symmetric. Reference cell `postgres/newest/pg/`. Round 14 is
**implemented**, both its bugs (`double % x`, compound `orderBy(valueSource)`) are
**FIXED** — `BUGS.md` "Open Bugs" reads *None currently open* and there are **zero
`TODO[BUG]` markers** in `test/db`. Round 14 added the fixtures `tProjectReview`
(non-boolean per-column adapters), `tWebhookEvent` (bigint autogen PK + enum
default), `tAuditEntry` (PK-by-sequence), `tCalendarYear` (int provided PK).

## Headline

The suite is **far more saturated than at round 14** — that pass and its
implementation closed the bulk of the ~550 candidate paths. This deep re-sweep of
all 16 surfaces is an honest **harvest-the-residual** round, not another 550-path
explosion: **~31 §A gaps** (existing cell + existing fixtures) and **~13 §B gaps**
(need a fixture/scaffold addition), clustered tightly into the recurring themes —
plus **three genuinely-saturated surfaces** and **one agent type-prediction
corrected by compile-repro**. No new `src/` bug surfaced during discovery (one
projection finding had its *expected type* corrected; no behavior defect).

Counts by section: **§A = 31 · §B = 13 · OUT(type-only) = 2 · saturated surfaces = 3.**

---

## Themes, ranked by risk tier

### Tier 1 — distinct code-path / runtime-branch / the bug class (output-coincidence masks real risk; mostly existing fixtures)

**T1.1 — Trailing-`adapter?` fan-out & the `adapter2` positional-shift branch (THEME 3).**
Verified against the impl ([AbstractConnection.ts:658-663](src/connections/AbstractConnection.ts#L658-L663)).
- **F5-CONN A1 — `executeFunction` custom-kind return + trailing adapter.** The only
  adapter test (`callProjectNameBracketed`) uses the **plain-`string`** overload →
  the `else { adapter2 = adapter }` branch. The **custom-kind** overload
  (`executeFunction(name,params,'customDouble',typeName,'required',adapter)`) routes
  through the `typeof adapter === 'string'` **positional-shift** branch (reassigns
  `returnType`/`required`, lands the real adapter in `adapter2`) — a distinct runtime
  branch, untested. Needs a one-line domain wrapper reusing `estimated_total`
  (e.g. `callEstimatedTotalBracketed`, customDouble + observable adapter), assert the
  round-tripped value.
- **F5-CONN A2 — `fragmentWithType` custom-kind + trailing adapter.** Adapter is
  threaded only on the plain `'string'` kind ([fragments.type-coverage]); the
  custom-kind shift branch ([AbstractConnection.ts ~751-755]) is untested. In-file,
  no fixture change.
- **F5-CONN A3 — `aggregateFragmentWithType` custom-kind + trailing adapter.** Adapter
  covered only on `int`/`bigint` (`else` branch); the custom-kind shift branch is
  untested. In-file.

**T1.2 — Adapter slots with ZERO coverage (THEME 3, §B).** Verified: no
`arg`/`valueArg`/`sequence` in **any** domain `connection.ts` carries a trailing
adapter.
- **F5-CONN B1 — `sequence(name, type, adapter)`** trailing TypeAdapter → threads to
  `SequenceValueSource.__typeAdapter`, observable on `nextValue()`/`currentValue()`.
  Add one sequence field with an observable adapter (reuse `issue_id_seq`).
- **F5-CONN B2 — `arg`/`valueArg` trailing TypeAdapter** → `Argument.adapter` →
  applied on the WRITE path (`transformValueToDB`/`transformPlaceholder`), mock-
  observable in `lastParams`/SQL. **Highest-value of the two** — an entire adapter
  slot with zero coverage. Add one `buildFragmentWith*` field whose `valueArg`
  carries a value-scaling/placeholder-casting adapter.

**T1.3 — Write-path adapter marshalling (THEME 3, column side).** Settled a cross-agent
contradiction: `insertInto(tProjectReview)`/`update(tProjectReview)` appear in **zero**
cells, so the write transforms are asserted only as WHERE *operands*, never on the
column-value write path.
- **F2-COL A1 — `scaledTenthAdapter` ×10 on an INSERT/UPDATE column value.** Only
  `score.equals(85)→850` (operand) is asserted; `insertInto(tProjectReview).values({score:8.5})`
  binding param `85` (and `reviewerCode` pass-through) is untested. Fixture exists.
- **F2-COL A2 — branded `customInt`/`customDouble` column WRITE on INSERT.**
  `insert.custom-columns` sets `tIssueWorklog` but never `billedAmount`/`costCents`/`invoiced`;
  the write-side `baseTypeForCustom` marshalling (Money→double, Cents→int) on an insert
  value is unverified. Add the three columns to an existing `insertInto(tIssueWorklog)`.
- **F2-COL B1 (§B) — PK-factory trailing-adapter overload.** No
  `autogeneratedPrimaryKey`/`primaryKey`/`autogeneratedPrimaryKeyBySequence` anywhere
  passes the optional `adapter`. Needs a PK column declared with an adapter.

> **Docker note (per `feedback_docker_validate_delegated_custom_type_tests` + `project_docker_validation_gotchas`):** all of T1.1–T1.3 are custom-type/adapter **write-path** assertions — mock cannot catch per-driver value leaks. `--docker` spot-check on PG + mssql + oracle when implementing.

**T1.4 — INSERT from-select × on-conflict matrix & shaped returning (THEME 2 / THEME 8).**
- **F4-INSERT A1 — `from(select).onConflictOn(cols).doNothing()`** (`OnConflictDoInsertFromSelect.doNothing`)
  — distinct dispatch from bare `from(select).onConflictDoNothing()` (covered) and the
  targeted `…doUpdateSet` (covered). Absent tree-wide.
- **F4-INSERT A2 — from-select-on-conflict `returningLastInsertedId` (`[]` array) /
  `returningOneColumn`.** Only the `.returning({…})` object form is tested; the
  `ReturningFromSelect*` types **exclude oracle** (distinct dialect union) — a distinct
  type-branch.
- **F4-INSERT A3 — multi-row-on-conflict `returningLastInsertedId`/`returningOneColumn`**
  (`CustomizableExecutableMultipleInsertOnConfict`). Distinct result-interface; borderline
  (returning fn-types shared) but listed per the bar.
- **F4-INSERT A4 — shaped INSERT `returningOneColumn`.** Shaped path tests
  `returningLastInsertedId` + `returning({…})` but never `returningOneColumn`. Per the
  SHAPED-is-always-a-GAP guidance.

**T1.5 — Guard-state × RETURNING (THEME 8).** The `AllowingNoWhere` interface lineage
exposes `returning`/`returningOneColumn`, reachable **only** from the no-WHERE guard opt-in.
- **F4-UPDDEL A1 — `updateAllowingNoWhere(t).set(…).returning(…)` with NO WHERE.** Untested
  everywhere (existing tests only `.executeUpdate()`). Emits `update … set … returning …`
  touching all rows. Use `withRollback`.
- **F4-UPDDEL A2 — `deleteAllowingNoWhereFrom(t).returning(…)` with NO WHERE.** Same;
  `DeleteWhereExpressionAllowingNoWhere extends ReturnableExecutableDelete` directly.

**T1.6 — Composition seams (THEME 8, F8-META).**
- **A1 — dynamic-condition × compound** (`dynamicConditionFor(…).withValues(f)` →
  `.where(…)` → `.union()/.intersect()/.except()`). Never composed in any cell; assert
  identical SQL+params vs a hand-written direct-predicate compound.
- **A2 — brand-keep through `forUseAsInlineAggregatedArrayValue()`** (the **subquery**
  inline-aggregate path, distinct from the connection-level `aggregateAsArrayOfOneColumn`).
  Exercised only over plain columns; push a branded column (`channel`→`ReleaseChannel`,
  `costCents`→`Cents`) and assert `Exact<…, ReleaseChannel[]>` + value.
- **A3 — compound × `forUseAsInlineAggregatedArrayValue()`.** Compound-as-inline covered
  for scalar/derived-table but not aggregated-array. PG/sqlite/sqlserver/oracle run it
  live; the `'compound'→never` arm is **MariaDB-only** (→ a `types.negative` / NOT-APPLICABLE
  pairing on mariadb).
- **A4 — `withSqlHint` (createTableOrViewCustomization) × JOIN.** Only ever
  `selectFrom(customizedTable)` alone; a customized table is `ITableOrView`-shaped and
  joinable. Assert the hint comment lands on the customized side only.

**T1.7 — Projection input-classification boundaries (THEME 5, F3-PROJ).**
- **A1 — rule-1 object mixing a `requiredInOptionalObject` leaf with an OWN-required leaf.**
  **⚠ Type corrected by compile-repro** (see Coordinator notes): the actual asUndefined
  shape is `{ iid: number; meta?: { ownId: number; gate: string } }` — the
  requiredInOptionalObject leaf makes the **object** optional (`meta?:`) but the own-required
  `ownId` is **NOT demoted** (the agent predicted `ownId?:`, which is wrong). Still a
  distinct, untested rule-1 configuration; pin the **corrected** shape (and re-derive the
  `projectingOptionalValuesAsNullable()` variant at implementation via the same repro).
- **A2 — rule-2 demotion at the AGGREGATED-ARRAY element top level.** The only top-level
  rule-2 aggregated element tested (`aggregateAsArray({id,name})`) has no genuinely-optional
  leaf, so the demote-to-`?:`/`|null` arm is never pinned. Add
  `aggregateAsArray({id,name,archivedAt})` over one left-joined `tProject`, both projectors.

**T1.8 — Builder-reachable error reasons (F7-EXTRAS).** Via the established
cast-to-bypass-static-guard pattern (`errors.*.test.ts`), assert the throw.
- **A1 — `MAPPED_SHAPED_COLUMN_NOT_IN_TABLE`** (`update(t).shapedAs({prop:'nonexistent'}).set(…)`,
  `AbstractSqlBuilder.ts:2225`). Existing `tProject` + a bad shape map.
- **A2 — `INVALID_SQL_FRAGMENT_RETURN_TYPE`** (a `virtualColumnFromFragment`/`fragmentWithType(...).as`
  callback returning a non-value-source, `ValueSourceImpl.ts:1767`). Inline, no fixture.

### Tier 2 — distinct overloads / per-type emission (shared dispatcher but observably distinct)

**T2.1 — BigintValueSource value-source-operand twins & projection modifiers (THEME 1, F1-NUM).**
Verified: the only bigint `modulo` in the tree is `viewCount.modulo(2n)` — a **const** operand.
- **A1 — `bigint.modulo(value-source)`** twin (the one bigint arithmetic VS-operand twin missing).
- **A2 — `bigint.valueWhenNull(value-source)`** optional-propagation branch (arg-optionality wins;
  only the both-required form is tested → the distinctive branch is unpinned).
- **A3 — `bigint` direct projection modifiers** `asRequiredInOptionalObject()`/`onlyWhenOrNull()`/
  `ignoreWhenAsNull()` on a bigint leaf (`viewCount`) — only customInt/customDouble leaves are
  exercised.

**T2.2 — CustomDouble `roundn` 4th overload (F1-CUSTOMNUM A1).** `roundn` has 4 overloads;
the **brand-matched customDouble value source as the precision argument**
(`v.roundn(conn.const(2,'customDouble','…'))`) is the one exercised in no cell. (Brand keep/erase
otherwise saturated; `sign()` brand-erase covered on both leaves.)

**T2.3 — Optional plain `LocalDateTimeValueSource` getters (F1-TEMP A1).** `tProject.archivedAt`
(optional localDateTime) exists and is selected ~10× but **none of its 9 getters** is ever called;
the optional-marker propagation through the plain-DateTime getter set is unpinned (tested only on a
*required* localDateTime via `createdAt`). **Note:** THEME 7's "plain-vs-custom getter emits distinct
SQL" premise is **refuted** — getter emission is temporal-type-agnostic (`_getX` keyed only on the
op string); the custom-vs-plain getters coincide and are all covered. The only residual is this
optional-receiver branch.

**T2.4 — Custom-type operand marshalling on the DIRECT fluent surface (THEME 4, F1-EQCMP).**
The by-type matrix is broadly saturated (shared type-agnostic dispatcher); genuine holes are only
where a branded typeName flows on the operand or a distinct overload arm is reached:
- **A1 — `customUuid` (`signingKey`) `in(subquery)`/`notIn(subquery)`** — every other equalable leaf
  has the subquery twin; customUuid has only `in([array])`.
- **A2 — `customComparable` (`version`, Semver) `is`/`isNot`** null-safe arm.
- **A3 — `customComparable` (`version`) `in(subquery)`/`notIn(subquery)`** overload.
- **A4 — `custom` (`channel`, ReleaseChannel) `is`/`isNot`** — the only `custom`-leaf representative.
- **A5 — numeric `CustomBooleanTypeAdapter` (`invoiced`) as a DIRECT fluent filter operand**
  (`invoiced.equals(true)`→`1`, `.is`, `.in([…])`). `invoiced` has **zero** direct fluent usage;
  the numeric overload's operand emission differs from its string siblings. Fixture exists (→ this is
  effectively §A; the agent filed it §B but noted no new column is needed).

**T2.5 — Dynamic from-model `boolean` arm (F6-DYN A1).** `DynamicDefinitionFieldForModel`’s
`[T] extends [boolean] ? 'boolean'` arm is never asserted (no model feeds a boolean field).
Real-validatable via `tIssueWorklog.billable`; add `flag: boolean` to a from-model `Exact` map and
round a `{flag:{equals:true}}` filter vs the direct `.equals(true)`.

**T2.6 — `invoiced` literal WRITE (F2-COL A3, borderline).** The numeric custom-boolean write is
covered via a value-source RHS (`set({invoiced:id.greaterThan(0)})`→CASE); a plain-literal write
(`set({invoiced:true})` proving param `1`, not the CASE form) is absent. Borderline-degenerate with
the value-source arm; listed per WHEN-IN-DOUBT→MISSING.

### Tier 3 — mechanical per-kind / structural completeness (mostly §B, lowest priority)

- **F2-VALVIEW B1 — `uuid`/`customUuid` as a REAL VALUES-tuple column** (the `::uuid` cast +
  `baseTypeForCustom`→uuid round-trip as a real value; today the typeName only ever appears as a
  virtual `null`). **Strongest §B.** *(uuid VALUES on sqlite/bun connectors may need NOT-APPLICABLE
  per `project_bun_sqlite_uuid_platform_dependent`; PG/mssql/oracle validate under `--docker`.)*
- **F2-VALVIEW B2 — temporal-kind VALUES cast** (`::date`/`::time`/`::timestamp` inside the tuple),
  SQL-only via a `null` value (the `Date` round-trip is a documented engine limitation).
- **F2-VALVIEW B3 — `customComparable`/`custom`/`enum` real VALUES column** (weak — collapses to
  `text`; only the branded/enum type dispatch is the slice).
- **F2-COL B2 — `autogeneratedPrimaryKeyBySequence` non-int kind** (bigint / branded customInt) —
  all four dialects declare it `'int'`; the value-type fan-out is unexercised (contrast
  `autogeneratedPrimaryKey`, which has int+bigint).
- **F3-PROJ B1/B2/B3 — structural recursion paths** (new test scaffold, existing tables): rule-1
  with a nested required-object sibling (B1); `ColumnsForCompound` recursion into a nested object in
  a compound/recursive query (B2); `ColumnsForLeftJoin` re-projecting a nested object through
  `.forUseInQueryAs(...).forUseInLeftJoin()` (B3).
- **F4-INSERT B1 — bare `from(select).onConflictDoUpdateSet*` WithoutTarget arms on
  sqlite/mariadb/mysql** (the `*WithoutTargetFnType` excludes postgreSql; NOT-APPLICABLE on PG/oracle,
  live & untested on the three that type it). Existing fixtures.
- **F7-EXTRAS B1 — `NO_PRIMARY_KEY_FOUND`** (`update(t).returning({…oldValue…})` on a no-PK table,
  pg/sqlserver only) — needs a dedicated PK-less table fixture.
- **F8-META B1 — recursive CTE × aggregated-array projection** (lower confidence on type-reachability
  across cells; needs a scaffold + per-dialect `never` handling).

### OUT — degenerate-by-non-validatability (type-only, no runtime/value surface → negatives at most)

- **F6-DYN A2 — `never` arm of `DynamicDefinitionFieldForModel`** (an array/Map/binary model field →
  `never`). Pure compile-time; at most a `types.negative` assertion paired with the positive map.
- **F6-DYN A3 — `Array<Filter>` half of the aggregated-array `MapValueSourceToFilter` union**
  (`{titles:[{}]}`). Type-legal but a runtime no-op coinciding with the covered empty-object form.

---

## Per-surface counts & saturation

| Agent | §A | §B | Saturated? | Note |
|---|---|---|---|---|
| F1-NUM (Number/Bigint) | 3 | 0 | near | int saturated; all 3 on the **bigint** side |
| F1-CUSTOMNUM (CustomInt/Double) | 1 | 0 | near | only `roundn` 4th overload; brand keep/erase saturated |
| F1-STR (String) | 0 | 0 | **YES** | all 52 methods + operand/arity/optionality covered |
| F1-BOOLIF (Boolean/If/AlwaysIf) | 0 | 0 | **YES** | ~30 `*IfValue` + 3 interfaces, fire/elide all covered |
| F1-TEMP (temporal) | 1 | 0 | near | THEME-7 premise refuted; only optional-localDateTime getters |
| F1-EQCMP (Equalable/Comparable ×leaf) | 5 | 0 | near | only branded-typeName operand / `in(subquery)` / numeric-bool |
| F2-COL (column factories) | 3 | 2 | no | write-path adapter marshalling + PK-factory overloads |
| F2-VALVIEW (Values/View dispatch) | 0 | 3 | near | uuid/customUuid + temporal VALUES casts |
| F3-SELECT (select builder) | 0 | 0 | **YES** | THEME-6 compound overload set fully covered |
| F3-PROJ (complexProjections) | 2 | 3 | near | two rule boundaries + 3 structural recursion paths |
| F4-INSERT (insert) | 4 | 1 | near | the from-select × on-conflict matrix |
| F4-UPDDEL (update/delete) | 2 | 0 | near | guard × returning |
| F5-CONN (connection API) | 3 | 2 | no | the `adapter2` shift branch + sequence/arg/valueArg adapter |
| F6-DYN (dynamic condition) | 1 | 0 | near | only the boolean from-model arm (+2 type-only OUT) |
| F7-EXTRAS (extras/adapters/errors) | 2 | 1 | near | extras+adapters saturated; 2 error reasons + 1 no-PK |
| F8-META (seam critic) | 4 | 1 | no | 4 composition seams; barrel clean |
| **TOTAL** | **31** | **13** | **3 saturated** | + 2 OUT(type-only) |

**Genuinely saturated (re-verified this round, a real result):** `StringValueSource`,
`Boolean/IfValue/AlwaysIf`, the SELECT builder (incl. the compound interface's own overload set).
`extras/*` utility types and `TypeAdapter` are also saturated (only `TsSqlError` reasons remain in F7).

## Coordinator verification notes

1. **Cross-agent contradiction — F7-EXTRAS vs F2-COL on non-boolean adapter writes → settled for
   F2-COL.** `insertInto(tProjectReview)`/`update(tProjectReview)` appear in **zero** cells (grep);
   no test sets `score`/`reviewerCode` as a column value. The ×10 write is asserted only as a WHERE
   operand. F7's "write asserted" was the operand path; the column-value write path (T1.3 A1) is a
   real gap.
2. **Cross-agent contradiction — F3-SELECT vs F1-CUSTOMNUM on BUGS.md → settled by direct read.**
   `BUGS.md` Open Bugs = *None currently open*; **zero `TODO[BUG]`** in `test/db`. Both round-14 bugs
   are FIXED. F3-SELECT's "the compound-orderBy bug is filed" is wrong but harmless — it still didn't
   re-flag it (the `compound-order-by-value-source-secondary` test now asserts the **wrapped** emission,
   i.e. fixed + covered).
3. **F3-PROJ A1 type prediction — REFUTED & CORRECTED by tsgo compile-repro.** Wrote a type-only repro
   in the reference cell with both hypotheses as `assertType<Exact>` lines; **Hypothesis A (the agent's
   `ownId?:` demotion) errored**, Hypothesis B typechecked. Actual asUndefined shape:
   `{ iid: number; meta?: { ownId: number; gate: string } }` — object optional, own-required leaf NOT
   demoted. The configuration is still a valid untested gap; the **expected type was corrected**. Repro
   deleted, tree clean.
4. **F5-CONN A1 — verified against the impl.** [AbstractConnection.ts:658-663](src/connections/AbstractConnection.ts#L658-L663):
   the custom-kind overload reaches the `typeof adapter === 'string'` shift branch; `callProjectNameBracketed`
   (plain `string`) reaches the `else` branch — distinct, confirmed.
5. **F1-NUM A1 — verified.** Only `viewCount.modulo(2n)` (const operand) exists; the value-source twin
   is genuinely absent.
6. **F5-CONN B1/B2 — verified.** No `arg`/`valueArg`/`sequence` in any domain `connection.ts` carries a
   trailing adapter (grep empty).

## §B fixture / scaffold plan (shared `domain/connection.ts` propagates to all cells)

| ID | Add to the shared domain | For |
|---|---|---|
| F5-CONN B1 | a `sequence(name,type,adapter)` field with an observable adapter (reuse `issue_id_seq`) | sequence adapter slot |
| F5-CONN B2 | a `buildFragmentWith*` field whose `arg`/`valueArg` carries a value-scaling adapter | arg/valueArg adapter slot (highest-value) |
| F5-CONN A1 | a customDouble `executeFunction` wrapper with a trailing adapter (reuse `estimated_total`) | adapter2 shift branch |
| F2-COL B1 | a PK column declared with a trailing TypeAdapter | PK-factory adapter overload |
| F2-COL B2 | a `autogeneratedPrimaryKeyBySequence` of bigint or branded customInt | PK-by-sequence value-type fan-out |
| F2-VALVIEW B1 | a `uuid`/`customUuid` column on a `Values` subclass (real tuple member) | `::uuid` cast + round-trip (docker PG/mssql/oracle) |
| F2-VALVIEW B2 | a temporal column on a `Values` subclass (assert cast via `null` value) | temporal VALUES cast |
| F7-EXTRAS B1 | a no-primary-key table | `NO_PRIMARY_KEY_FOUND` (pg/sqlserver) |

§B items needing only a **new test scaffold over existing tables** (no domain column): F3-PROJ B1/B2/B3,
F4-INSERT B1 (test bodies on sqlite/mariadb/mysql + PG/oracle NOT-APPLICABLE), F8-META B1, F2-VALVIEW B3,
F1-EQCMP A5 (`invoiced` filter — fixture already present).

## Recommended implementation order

1. **Tier 1 on existing fixtures (cheapest, highest value):** F5-CONN A1–A3 (adapter2 shift),
   F2-COL A1–A2 (write-path marshalling), F4-INSERT A1–A4, F4-UPDDEL A1–A2, F8-META A1–A4,
   F3-PROJ A1 (**use the corrected type**)/A2, F7-EXTRAS A1–A2. **`--docker` spot-check** the
   custom-type/adapter ones on PG + mssql + oracle.
2. **Tier 1 §B adapter slots:** F5-CONN B1/B2, F2-COL B1 — small fixture additions, distinct branches.
3. **Tier 2 per-type/overload:** F1-NUM A1–A3, F1-CUSTOMNUM A1, F1-TEMP A1, F1-EQCMP A1–A5, F6-DYN A1,
   F2-COL A3.
4. **Tier 3 §B per-kind/structural:** F2-VALVIEW B1–B3, F2-COL B2, F3-PROJ B1–B3, F4-INSERT B1,
   F7-EXTRAS B1, F8-META B1.
5. **OUT:** F6-DYN A2/A3 → at most `types.negative` assertions, not Principle-#1 tests.

## Verdict

A deep, full-16-surface pass on a **mature** matrix. Round 14's implementation closed the bulk of the
typed surface — so the honest yield is **~31 §A + ~13 §B residual gaps**, not another 550, with **three
surfaces genuinely saturated** (String, Boolean/If, SELECT) and **no new `src/` bug**. The residual is
not noise: the Tier-1 core — the **`adapter2` positional-shift branch** and the **zero-coverage
sequence/arg/valueArg adapter slots** (THEME 3), **write-path custom-type marshalling** (mock-blind),
the **from-select × on-conflict matrix** and **guard × returning** (THEME 2/8), the **four composition
seams**, and the **two projection-classification boundaries** (THEME 5) — is exactly the
output-coincidence-masks-risk class this method exists to catch, and the **compile-repro that corrected
F3-PROJ A1's type** is a reminder that the expected shapes must be pinned, not assumed. Bar held high;
nothing manufactured to fill a quota.

---

## Implementation status (Round 15)

**Matrix delta:** `1633 → 1670` tests/cell (§A bulk) → `1681` tests/cell after the deferred §B / scaffold
follow-up pass. All work propagated across the full 17-cell matrix (+ `types.negative/`). One new domain table
(`tInvoice`, schema + seed + reset across all 6 dialects).

**Validation (all green):** `tests:audit` ✓ symmetric (28 577 tests, 202 files) · `validate:tests` (tsgo) ✓ ·
`validate:tests:tsc` (tsc) ✓ · full mock matrix ✓ (28 491 pass / 0 fail) · `--docker` spot-check of **every**
custom-type / adapter / uuid / write-path / temporal / compound-inline / recursive wave on **PostgreSQL
(full cell, 1686/0) + SQL Server + Oracle + MariaDB + MySQL** ✓. One real-DB-only bug surfaced and filed
(MySQL from-select `ON DUPLICATE KEY UPDATE`, see BUGS.md).

### ✅ Done — §A (existing fixtures)

| ID | Status |
|---|---|
| **F5-CONN A1** `executeFunction` custom-kind adapter2-shift | done — `exec.procedure-function` (`callEstimatedTotalOffset` + `plusOffsetAdapter`); docker PG/mssql/oracle ✓ |
| **F5-CONN A2 / A3** `fragmentWithType` / `aggregateFragmentWithType` custom-kind trailing adapter | done — `fragments.type-coverage` (customComparable `Semver` bracketed); docker ✓ |
| **F2-COL A1** `scaledTenth` / `bracket` write-path on INSERT/UPDATE | done — `insert.custom-columns` + `update.custom-columns` (`tProjectReview`); docker ✓ |
| **F2-COL A2** branded `customInt`/`customDouble` + numeric-bool INSERT | done — `insert.custom-columns` (`billedAmount`/`costCents`/`invoiced`); docker ✓ |
| **F2-COL A3** `invoiced` literal write | done — **correction:** the literal emits `case when $::bool then 1 else 0 end` (binds the boolean), **not** param `1`; tests/comments pin the real CASE form |
| **F4-INSERT A1** from-select targeted `onConflictOn(cols).doNothing()` | done — live PG/sqlite, NOT-APPLICABLE mariadb/mysql/oracle/sqlserver |
| **F4-INSERT A2** from-select on-conflict `returningLastInsertedId`/`returningOneColumn` | done — **correction:** `returningLastInsertedId()` executes via `.executeInsert()` (→ `number[]`), not `executeInsertMany`; live PG/sqlite/mariadb, NOT-APPLICABLE mysql/oracle/sqlserver |
| **F4-INSERT A3** multi-row on-conflict `returningLastInsertedId` | done — live PG/sqlite/mariadb, NOT-APPLICABLE mysql/oracle/sqlserver |
| **F4-INSERT A4** shaped INSERT `returningOneColumn` | done — live everywhere except mysql (no RETURNING) |
| **F4-UPDDEL A1 / A2** guard-state × RETURNING (no-WHERE) | done — `update`/`delete.allowing-no-where`; mysql NOT-APPLICABLE, mariadb update-returning TODO[LIMITATION] (version gate), delete-returning live on mariadb |
| **F8-META A1** dynamic-condition × compound-union | done — `dynamic-condition.combinations` (SQL+params identical to the direct-predicate compound) |
| **F8-META A2** brand-keep through `forUseAsInlineAggregatedArrayValue()` | done — `select.aggregate-as-array-inline-wrapped` (`ReleaseChannel[]`) |
| **F8-META A4** `withSqlHint` × JOIN | done — `select.table-customization` (hint on the customized side only) |
| **F7-EXTRAS A1** `MAPPED_SHAPED_COLUMN_NOT_IN_TABLE` | done — `errors.builder-reasons` (cast-to-reach-guard) |
| **F7-EXTRAS A2** `INVALID_SQL_FRAGMENT_RETURN_TYPE` | done — `errors.builder-reasons` (no-op-hook stub survives registration, fails `hasToSql`; `as-any` suppressed with reason) |
| **F3-PROJ A1** rule-1 `requiredInOptionalObject` + own-required leaf (both projectors) | done — `select.complex-projection.inner-rules`; the **corrected** shape `meta?: { ownId: number; gate: string }` verified by tsgo |
| **F1-NUM A1/A2/A3** bigint `modulo(VS)` · `valueWhenNull(VS)` optional-propagation · projection modifiers | done — `select.value-source.numeric-operand-coverage` |
| **F1-CUSTOMNUM A1** `roundn` 4th overload (brand-matched customDouble precision) | done — `select.value-source.custom-numeric` |
| **F1-TEMP A1** optional plain-`localDateTime` getters (×9, `archivedAt`) | done — `select.date-ops` (UPDATE-in-rollback for determinism); docker ✓ |
| **F1-EQCMP A1-A5** customUuid `in(subquery)` · customComparable `is`/`in(subquery)` · custom `is` · `invoiced` direct filter | done — `select.value-source.equality-comparison-by-type`; docker PG/mssql/oracle ✓ |
| **F6-DYN A1** boolean from-model arm | done — `dynamic-condition.from-model` (`{flag:{equals:true}}` ≡ direct `.equals(true)`) |

### ✅ Done — §B (fixture / test-only additions)

| ID | Status |
|---|---|
| **F5-CONN B1** `sequence(name,type,adapter)` | done — `issueIdSeqOffset` field + `sequence.next-current-value` (next/current value shifted), advanced dialects live, mysql/sqlite NOT-APPLICABLE |
| **F5-CONN B2** `arg`/`valueArg` trailing TypeAdapter (write path) | done — `scaledThresholdFragment` field + `fragments.with-args` (bound placeholder scaled ×10) |
| **F6-DYN A2** `never` arm of `DynamicDefinitionFieldForModel` | done as a positive map assertion in `dynamic-condition.from-model` (`{tags:string[]} → {tags:never}`) **+ a `@ts-expect-error` lock in all 6 `types.negative/dynamic-condition.from-model.test.ts`** |
| **F2-VALVIEW B3** customComparable / custom / enum real VALUES columns | done — `with-values.kind-coverage` (`VBrandedSampler`, all-dialect text round-trip) |

### 🟦 Closed — degenerate / not a Principle-#1 test (correctly NOT added)

- **F3-PROJ A2** (rule-2 demotion at the aggregated-array element top level) — **already covered.** The
  existing `aggregate-as-array-element-default-projector-required-leaf-stays-required` (`{id, body?}`,
  asUndefined) and `aggregate-as-array-projecting-optional-values-as-nullable` (`{id, body|null}`) pin the
  exact same input-classification; `{id,name,archivedAt}` is the same rule with different columns. The
  audit overlooked these existing tests.
- **F6-DYN A3** (`Array<Filter>` arm of the aggregated-array `MapValueSourceToFilter` union) — **not
  real-validatable.** Type-legal, but `{ titles: [{}] }` **throws `DYNAMIC_CONDITION_UNKNOWN_OPERATION`
  at runtime** (the array index `0` is read as an operation name). No SQL/value surface → closed per the
  degeneracy rule (the audit's "runtime no-op" prediction was wrong: it's a runtime *error*). Borderline
  type-vs-impl gap, but not filed as a `src/` bug (no realistic user writes the array form).

### 🐛 Fixture bug fixed (surfaced while implementing)

- **Oracle `seed.sql`** — `project_review`'s IDENTITY was never realigned past the seeded `id=1` (round 14
  added the table but nothing inserted into it before, so the gap was latent). F2-COL A1's
  `insertInto(tProjectReview)` was the first insert and hit `ORA-00001`. Fixed by adding
  `ALTER TABLE project_review MODIFY (id GENERATED BY DEFAULT ON NULL AS IDENTITY START WITH LIMIT VALUE);`
  to the Oracle seed (it re-runs each reseed); re-validated under `--docker`.

### ✅ Done — deferred follow-up pass (now COMPLETE)

The deferred §B / scaffold residual is implemented and validated. Matrix `1670 → 1681` tests/cell. Several
audit reachability claims were **corrected against the real DB** (the audit had misdiagnosed three).

| ID | Status |
|---|---|
| **F2-VALVIEW B2** temporal VALUES cast via a `null` value | done — `with-values.kind-coverage` (`VTemporalSampler`, all-dialect `::date`/`::time`/`::timestamp` cast pinned via null); docker PG/mssql/oracle ✓ |
| **F4-INSERT B1** bare `from(select).onConflictDoUpdateSet*` WithoutTarget | done — **correction:** SQLite does **not** reject the bare `DO UPDATE` (verified on real bun_sqlite), so it is **live** on mariadb + the 5 sqlite cells, NOT-APPLICABLE on pg×8/oracle/sqlserver. **Bug found:** the **mysql** cell emits an invalid `as _new_` row alias after the SELECT source (real MySQL rejects it) → `TODO[BUG]` + a `BUGS.md` entry; mariadb/sqlite stay live, docker-validated |
| **F8-META A3** compound × `forUseAsInlineAggregatedArrayValue()` | done — `select.aggregate-as-array-inline-wrapped` (`inline-aggregate-of-compound-union`); the `'compound'→never` arm is MariaDB-only → live on the other 16 cells, NOT-APPLICABLE + a `types.negative` lock on mariadb; docker PG/mssql/oracle ✓ |
| **F8-META B1** recursive CTE × aggregated-array projection | done — `docs.aggregate-as-object-array` (`recursive-query-as-inline-array`, a previously-untested documented snippet); the `'recursive'→never` arm covers sqlServer/oracle/mariaDB → live on pg/sqlite/mysql, NOT-APPLICABLE + `types.negative` locks on those three; docker PG/mysql ✓ |
| **F3-PROJ B1** rule-1 object containing a nested required object | done — `select.complex-projection.inner-rules` (`meta?: { gate; inner: { num; pri } }`); docker PG/mssql/oracle ✓ |
| **F3-PROJ B2** `ColumnsForCompound` recursion into a nested object | done — `select.complex-projection.inner-rules` (a UNION preserving a nested `header` object); docker ✓ |
| **F3-PROJ B3** `ColumnsForLeftJoin` re-projection of a nested-object CTE | done — `select.complex-projection.inner-rules` (a `forUseInQueryAs(...)` nested-object CTE used via `forUseInLeftJoin()` → optional); docker ✓ |
| **F2-COL B1** PK column with a trailing `TypeAdapter` | done — new all-dialect domain table `tInvoice` (`primaryKey('invoice_no','int', scaledTenthAdapter)`); `column.provided-pk-adapter` pins the scale on the insert / WHERE / read paths; schema+seed+reset across 6 dialects; docker PG/mssql/oracle/mariadb ✓ |
| **F2-VALVIEW B1** uuid / customUuid real VALUES column | done — `with-values.kind-coverage` (`VUuidSampler`, plain `uuid` + branded `customUuid`); uuid VALUES **does** round-trip on real sqlite (the platform-dependence is for uuid *columns*, not VALUES literals), so it is live on all 17 cells; uuid values compared case-insensitively (mssql uppercases, oracle uses `uuid_to_raw`/`raw_to_uuid`); docker PG/mssql/oracle ✓ |
| **F7-EXTRAS B1** `NO_PRIMARY_KEY_FOUND` | done — `errors.builder-reasons` (`update(...).returning({…oldValue…})` on a no-PK local stub via the sanctioned `as any`). **Correction:** the guard is reached where `_useUpdateOldValueInFrom()` is true — **postgres compat<18 (oldest) + sqlite + oracle**, *not* `pg/sqlserver`; live on those 10 cells, NOT-APPLICABLE on pg-newest (≥18 native OLD/NEW) + mariadb + mysql + sqlserver (capture old values without a PK join) |

### 🟦 Closed — degenerate (deferred follow-up pass)

- **F2-COL B2** (`autogeneratedPrimaryKeyBySequence` non-int) — **closed.** Declaring the bySequence PK as a
  branded `customInt` (`ReleaseTag`) instead of `int` emits **byte-identical SQL** (`nextval(seq)`) and runtime
  to the already-covered `tAuditEntry` (`insert.autogenerated-by-sequence`); the only distinction is the TS brand
  on the returned id, assertable solely at compile time. With no NEW real-validatable surface (Principle #1), a new
  cross-dialect DDL table + sequence + docker is not warranted. Closed per the degeneracy rule, as F3-PROJ A2 /
  F6-DYN A3 were.

### 🐛 Bug surfaced & filed (deferred follow-up pass)

- **MySQL `INSERT … SELECT … ON DUPLICATE KEY UPDATE` emits an invalid `as _new_` row alias** (BUGS.md). Surfaced
  by F4-INSERT B1 under `--docker`; the VALUES-based form is valid and passes, only the SELECT-sourced form
  misplaces the alias. mysql cell wrapped with `TODO[BUG]`; mariadb/sqlite stay live.

**Net:** Round 15 is fully implemented — all §A and all actionable §B. Residual closed items: F3-PROJ A2,
F6-DYN A3 (round-15 §A) and **F2-COL B2** (degenerate). Three audit reachability claims corrected against the
real DB (F4-INSERT B1 sqlite, F7-EXTRAS B1 dialect set, and the MySQL bug), and one new `src/` bug filed.
