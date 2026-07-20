# Missing-tests audit — Round 41

**Mandate.** Type-driven, maximal, multi-agent audit of the `ts-sql-query` typed
surface: find every test the TYPE DEFINITIONS imply but the `test/` matrix lacks,
drive toward saturation. Unit = the *type-path* (each overload / per-receiver
method / arity / kind / return-branch / input-classification). COVERED ⇔ a test
pins the exact distinction via emitted SQL+params and/or `assertType<Exact>`
and/or the realized VALUE. The report is an **exhaustive item-by-item
implementation backlog**, not a thematic summary.

**Method.** ~20 read-only discovery agents (16 per-surface + F-RECENT + F9-TYPEVAR
+ the two seam critics MUT-SEAM / SEL-SEAM + PARITY), ≤10 concurrent, each
raw-reading its `src/` slice and grepping the CURRENT test files. Every
load-bearing claim was coordinator-verified (compile-repro / mock-probe /
source-read); all repros deleted, tree clean.

**Matrix at run.** 17 cells · 245 files · **2929 tests/cell** · `tests:audit`
symmetric, 0 problems. `BUGS.md` was clean at start.

**Headline.** **2 confirmed `src/` bugs** — both **residuals of the round-40
BUG-3 fix** (commit `2a756870`), found at the SELECT projection seam and settled
against a cross-agent contradiction by direct probe (§7.1). The rest of the
surface is at extreme maturity: **17 of 20 discovery surfaces returned
SATURATED**; the actionable §A tail is dominated by the **inline-aggregate ×
projection-rule** cluster (the untested positive arm the two bugs live inside)
plus a handful of small distinct-path gaps (INSERT `defaultValues().returning`,
CONN P2 arity, the mysql/mariadb backslash-match behavioral residual, an
aliased-View virtual re-qualification, a mutation-returning nullable arm).

---

## Part I — Confirmed bugs, candidates, limitations

### BUG-1 (CONFIRMED, → `BUGS.md`) — inline aggregated-array nullable over-constrains a rule-1/rule-2 element-top leaf

`forUseAsInlineAggregatedArrayValue()` after `projectingOptionalValuesAsNullable()`
types a rule-1 (`asRequiredInOptionalObject`) gate or a rule-2
(`AllFromSameLeftJoinWithOriginallyRequired`) element-top leaf as **non-null `T`**
(via `ResultObjectValuesProjectedAsNullableForAggregatedArray`,
`src/complexProjections/resultWithOptionalsAsNull.ts:63-90`), but the inline
runtime (`__transformRootObject`, mode `ResultObject`,
`src/queryBuilders/AbstractQueryBuilder.ts:69-95,159-167`) is **non-dropping** and
yields the leaf **present-`null`**.

- **Coordinator-verified.** Mock-probe: `select({ projName: tProjLeft.name })
  .projectingOptionalValuesAsNullable().forUseAsInlineAggregatedArrayValue()` on a
  join-miss row → runtime `[{ projName: null }, …]`. tsgo `assertType<Exact>`:
  declared `Array<{ projName: string }>`. Type `string`, value `null` → unsound.
- **Root cause / fix direction (for the fixing agent, not this round).** The
  inline **default** branch uses the *plain* `ResultObjectValues`; the nullable
  branch should symmetrically use the *plain* `ResultObjectValuesProjectedAsNullable`
  (rule-1/rule-2 top leaf → `T | null`), not the `…ForAggregatedArray` variant
  (which is correct only for the *dropping* `aggregateAsArray` runtime). The BUG-3
  fix corrected rule-3/rule-4 (where the two nullable types coincide) but
  over-corrected rule-1/rule-2.
- Boundary tests: **SEL-INLINE-NULL-R1 / -R2 / -R2MISS** below carry `// TODO[BUG]`.

### BUG-2 (CONFIRMED, → `BUGS.md`) — pre-`union` nullable marker survives the type but the runtime flag is dropped on the compound builder

`select({…}).projectingOptionalValuesAsNullable().union(arm2)
.forUseAsInlineAggregatedArrayValue()`: the `'projectingOptionalValuesAsNullable'`
FEATURES marker (BUG-3 fix) **survives `.union()`** in the type (element typed
present-`null`), but `union`/`unionAll`/`intersect*`/`except*`/`minus*`
(`src/queryBuilders/SelectQueryBuilder.ts:409-448`) never copy the runtime flag
`__projectOptionalValuesAsNullable` onto the new `CompoundSelectQueryBuilder`
(unlike `__buildRecursive`, `:670/:742`, which does). So the runtime default-drops
the null leaf.

- **Coordinator-verified.** Mock-probe: type `Array<{ title: string; body: string
  | null }>`, runtime `[{ title: 'A' }, …]` — `body` ABSENT.
- **Cross-agent contradiction resolved (§7.1).** F-RECENT sub-audit (ii) called the
  compound composition inert/compile-only ("marker read only by
  `ForUseAsInlineAggregatedArrayValueFn`"); SEL-SEAM + F3-PROJ flagged the
  type-vs-runtime divergence. F-RECENT was checking marker *leakage to other
  consumers* (true — inert there) and never the inline *type-vs-runtime match*.
  Direct probe settled it for SEL-SEAM/F3-PROJ. (Same shape that surfaced BUG-3 in
  round 40 — SEL-SEAM right, a refuter wrong.)
- Fix direction: propagate the flag in the compound methods (mirroring
  `__buildRecursive`) so the runtime honors it, OR drop the marker on `.union()` so
  the type stops promising it.
- Boundary test: **SEL-UNION-INLINE-NULL** below carries `// TODO[BUG]`.

### Candidates presented with both readings — NONE this round
Every seam critic cleared its own suspected defects by probe/trace, except the two
above which the coordinator confirmed. No ambiguous bug-vs-boundary candidate
survived.

### By-design limitations re-confirmed (do NOT file)
- **Custom-temporal CONST getters** (`const(v,'customLocalDate','ReleaseDay').getMonth()`
  → bare `extract(month from $1)`, no cast, PG-rejected). The cast for a custom
  typeName is the user's `transformPlaceholder` responsibility → LIMITATION, not a
  src bug (F1-TEMP B-1). Not real-DB-validatable as a value test.
- **`disallowIfNoValueWhen` returning `MISSING_KEYS` unchanged** — correct-by-design
  (`*When` soundness under `when === false`), re-confirmed by F4-UPDDEL.
- The PARITY cosmetic observations (`Witout` interface-name typo at select.ts
  167/213/226/248/256; missing `/*in|out*/` variance comments on
  `ComposableCustomizableExecutableInsertOptional`; `values` overload order differs
  shaped-vs-non) — compile-only, no runtime/type-assignability surface → OUT
  src-cleanup notes, not tests.

---

## Part II — The enumerated backlog (by surface)

Reference cell `test/db/postgres/newest/pg/`; every item propagates to all 17
symmetric cells unless a per-dialect note says otherwise. Tiers: **T1** distinct
code-path/bug-class · **T2** distinct overload/emission/seam · **T3** per-variant
completeness (may be §B) · **T4** output-coincident completeness fan-out (listed).

### Surface SEL / PROJ-INLINE — `forUseAsInlineAggregatedArrayValue` × projection rules × projectors (the round's core §A cluster)

Context: the BUG-3 fix retyped this exact path. The **inline** aggregate path is
covered only for **rule-3 own-table** (default + nullable:
`select.aggregate-as-array.element-projection-rules.test.ts:850,888`); every other
rule shape is untested inline, under BOTH projectors. Convergent finding of
F-RECENT, SEL-SEAM, F3-PROJ. File all in
`select.aggregate-as-array.element-projection-rules.test.ts` (the inline arm).
Construction: `subSelectUsing(X).from(Y)[.leftJoin(…)]…select({…})
[.projectingOptionalValuesAsNullable()].forUseAsInlineAggregatedArrayValue()`;
mock the outer row's array field; assert element `assertType<Exact>` + boundary
runtime (`'k' in el` / `=== null` / element-count). Mock-only suffices (client-side
transform); native-sqlite/docker value-validate.

- **SEL-INLINE-R1-DEF · T2** — rule-1 gate at inline element top, default projector.
  `{ ref: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId }`.
  Assert `Array<{ ref?: string; assigneeId?: number }>`; boundary: a null-gate
  element is KEPT with `ref` ABSENT (the inline root is non-dropping — contrast
  `aggregateAsArray`, which DROPS the whole element). This test also documents the
  top-inert / nested-active two-tier behavior. Grep: no inline test uses
  `asRequiredInOptionalObject()` at the element top (only the outer-aggregate gate).
- **SEL-INLINE-NULL-R1 · T1 · `// TODO[BUG]` (BUG-1)** — same, nullable projector.
  Current type `Array<{ ref: string; assigneeId: number | null }>`; runtime keeps
  the element with `ref === null` (verify `=== null`). The `assertType` encodes the
  buggy non-null `ref` and contradicts the runtime value → mark `// TODO[BUG]`.
- **SEL-INLINE-R2-DEF · T2** — rule-2 all-left-join element top, default.
  `{ projName: tProjLeft.name }` (sole originallyRequired left-join leaf). Assert
  `Array<{ projName?: string }>`; boundary: a join-miss element is KEPT with
  `projName` ABSENT.
- **SEL-INLINE-NULL-R2 · T1 · `// TODO[BUG]` (BUG-1)** — same, nullable. Type
  `Array<{ projName: string }>`; runtime keeps `{ projName: null }` (coordinator-
  probed present-`null`). Mark `// TODO[BUG]`.
- **SEL-INLINE-NULL-R2MISS · T1 · `// TODO[BUG]` (BUG-1)** — rule-2 mixed nested
  object (`iss: { id, title, body }` from a left join) at inline element, nullable;
  join-miss row. Type declares the originallyRequired `id`/`title` non-null; runtime
  yields present-`null`. Mark `// TODO[BUG]`.
- **SEL-INLINE-R4-DEF · T2** — rule-4 all-optional element top, default.
  `{ body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId }`. Assert
  `Array<{ body?; assigneeId? }>`; boundary: an all-null element is KEPT as `{}`
  (inline root non-dropping — contrast `aggregateAsArray` rule-4 which DROPS it).
- **SEL-INLINE-NULL-R4 · T2** — rule-4 all-optional, nullable. Type
  `Array<{ body: string | null; assigneeId: number | null }>`; all-null element kept
  `{ body: null, assigneeId: null }`. SOUND (rule-4 branches coincide) but untested.
- **SEL-INLINE-NESTED-R1 · T2** — nested rule-1 object inside inline element
  (`{ iid, meta: { gate: X.asRequiredInOptionalObject(), assigneeId } }`), both
  projectors. The NESTED object DOES drop on a null gate (routes to
  `__transformProjectedObject`) — proves the top-inert / nested-active split.
- **SEL-INLINE-NESTED-R2 · T2** — nested rule-2 left-join object inside inline
  element (`{ pid, iss: { id, title, body } }`), both projectors → nested drops on
  miss (default) / `{…} | null` (nullable).
- **SEL-INLINE-SOLE-OPT · T2** — sole-optional-inner collapse inside inline element
  (`{ iid, wrapper: { inner: { …all optional } } }`), both projectors → container
  inherits inner optionality; collapses on all-null.
- **SEL-INLINE-MULTI-OPT · T4** — inline rule-3 own-table with ≥2 optional leaves
  (`{ title, body, assigneeId }`), nullable — same `ContainsRequired` branch as the
  covered single-leaf inline test, leaf-count only. Enumerated (do not collapse);
  lowest priority of the cluster.
- **SEL-INLINE-WRAP-GROUPBY · T2** — inline nullable + a `groupBy` wrap (marker
  coexists with `'groupBy'`; SQL `(select json_agg(…) from (… group by …) a_1_)`),
  optional leaf → present-`null` through the derived-table wrap. Existing
  `select.aggregate-as-array-inline-wrapped.test.ts:17` wrap test is required-only.
- **SEL-INLINE-WRAP-HAVING · T4** — same with a `having` wrap.
- **SEL-INLINE-WRAP-DISTINCT · T4** — same via `subSelectDistinctUsing` (marker +
  `'distinct'`).
- **SEL-INLINE-WRAP-RECURSIVE · T2** — inline nullable + `recursiveUnionAll` (marker
  copied at `SelectQueryBuilder.ts:670`, so SOUND) — the positive control that
  contrasts with BUG-2's compound path; optional leaf present-`null`. Existing
  recursive inline-aggregate test (`cte.recursive-union-variants.test.ts:883`) is
  required-only.

### Surface SEL — the union/compound nullable-marker boundary

- **SEL-UNION-INLINE-NULL · T1 · `// TODO[BUG]` (BUG-2)** — `select({ title, body })
  .projectingOptionalValuesAsNullable().union(arm2).forUseAsInlineAggregatedArrayValue()`
  (both arms projected-as-nullable). Type `Array<{ title: string; body: string |
  null }>`; runtime DROPS `body` (absent). Mark `// TODO[BUG]` on the `assertType`.
  File in `select.aggregate-as-array-inline-wrapped.test.ts` or the compound
  file. This is the regression guard for BUG-2 across all compound operators
  (`unionAll`/`intersect*`/`except*`/`minus*` share the un-copied flag).

### Surface INSERT — `defaultValues()` returning fan-out

`insertInto(t).defaultValues()` → `CustomizableExecutableSimpleInsertOnConflict`
exposes three returning entries; only `returningLastInsertedId()` is covered.
Coordinator-verified reachable + type-correct on PG (`defaultValues().returning({
id: tLedgerEntry.entryNo }).executeInsertMany()` compiles and runs). Typed-available
on PG/sqlite/sqlServer/mariaDB/oracle; `never` on mysql (its
`insert.default-values.test.ts:28` already carries the NOT-APPLICABLE for
`.returning`/`.returningOneColumn`). File in `postgres/newest/pg/insert.default-values.test.ts`,
mirror to the 15 other applicable cells; reuse `tLedgerEntry` (all-defaulted columns).

- **INS-DEFVAL-RET-OBJ · T1** — `defaultValues().returning({ … })` →
  `executeInsertOne` / `executeInsertNoneOrOne` / `executeInsertMany` +
  `projectingOptionalValuesAsNullable`. Distinct SQL shape `insert into t default
  values returning <cols>` (via `_buildInsertDefaultValues` → `_buildInsertReturning`).
- **INS-DEFVAL-RET-ONECOL · T1** — `defaultValues().returningOneColumn(col)` →
  `executeInsertOne` / `NoneOrOne` / `Many`. Distinct from the
  `returningLastInsertedId` PK path (uses `__columns`, not `__idColumn`, and a
  different runner). `insert into t default values returning <col>`.

### Surface CONN — `createTableOrViewCustomization` arity ladder

- **CONN-P2 · T3 (§B)** — the P2 (exactly-two-param) overload
  (`src/connections/AbstractConnection.ts:1026`) is the lone arity in the P0-P5
  ladder with no domain wrapper and no test (P0/P1/P3/P4/P5 all covered). Distinct
  SQL `where $1 >= 0 and $2 >= 0` with exactly two bound params. **§B**: add
  `withTwoParams = this.createTableOrViewCustomization<number, number>((table,
  alias, a, b) => this.rawFragment\`(select * from ${table} where ${this.const(a,
  'int')} >= 0 and ${this.const(b, 'int')} >= 0) ${alias}\`)` to the 17 domain
  `connection.ts` files + one test in `select.table-customization.test.ts`
  mirroring the P3/P4/P5 tests.

### Surface MUT — mutation RETURNING nullable over an outer-join-optional column

- **MUT-RET-NULL-OUTERJOIN · T2** — `update(t).from(aux).leftJoin(a).on(…).set(…)
  .returning({ …, x: a.col }).projectingOptionalValuesAsNullable().executeUpdateMany()`
  (and the `delete…using` twin). Every covered mutation `projectingOptionalValuesAsNullable`
  test projects an intrinsic-optional column; none projects an *outer-join-optional*
  one. Coordinator-verified **SOUND** (mutation-returning uses the *plain*
  `ResultObjectValuesProjectedAsNullable`, which matches the non-dropping
  `__transformRootObject` → present-`null`): type `{ x: string | null }`, runtime
  `{ x: null }`. §A, distinct present-`null` value vs the covered absent-key case;
  carry a real-DB VALUE assertion as the regression guard (defect-adjacent to BUG-1).
  File in `update.join.test.ts` / `delete.join.test.ts`.

### Surface STR — mysql/mariadb backslash LIKE-match behavioral residual (F-RECENT B)

The round-40/41 fix (commit `1090322b`) corrected the mysql/mariadb backslash
multiplier on BOTH the bound-param and column-operand paths, but
`select.where.like-escape-match.test.ts` proves a literal-backslash MATCH only for
`contains('\\')` (bound-param). Use the `ctx.withRollback` seed + matched-SET
assertion (a param-only snapshot never proves a real match — the R40 ESC-2
fingerprint). Identical body all cells; real-validate on mysql/mariadb via
`--docker`, trivially pass elsewhere.

- **STR-BSLASH-COLOP · T1** — `contains(<column>)` where the column holds a literal
  `\` (seed Row A `{ email: 'za\\cz@x', fullName: 'a\\c' }`, decoy Row B `{ email:
  'zabcz@x', fullName: 'a\\c' }`; `email.contains(fullName)` → only Row A). This is
  the genuinely-untested COLUMN-OPERAND arm the fix changed
  (`replace(title,'\\','\\\\')`); the existing column-operand match test uses `_`.
- **STR-BSLASH-STARTS · T3**, **STR-BSLASH-ENDS · T3**, **STR-BSLASH-NOTCONTAINS ·
  T4**, **STR-BSLASH-CONTAINS-INSENS · T3**, **STR-BSLASH-STARTS-INSENS · T3**,
  **STR-BSLASH-ENDS-INSENS · T3**, **STR-BSLASH-CONTAINS-IFVALUE · T4**,
  **STR-BSLASH-STARTS-IFVALUE · T3**, **STR-BSLASH-ENDS-IFVALUE · T3** — one
  backslash-literal matched-SET test per affix. Note `startsWithInsensitive` /
  `endsWithInsensitive` / `startsWithIfValue` / `endsWithIfValue` have NO behavioral
  escape-match test for *any* metachar today, so these also first-cover their
  behavioral affix wrapping (raising them from T4 re-proof to T3).

### Surface VALVIEW — aliased-View virtual-column sibling re-qualification

- **VV-VIEW-1 · T2** — a View `virtualColumnFromFragment` referencing a sibling
  (`upper(this.name)`), rendered through a USER-ALIASED View (`view.as('po')` /
  `forUseInLeftJoinAs('po')`). Coordinator-verified emission is **correct**:
  `select upper(po.name) as "nameUpper" from project_overview as po where po.id =
  $1` (re-qualifies under the alias). §A coverage gap — the View symmetry twin of
  the tested Values VV-1/VV-2 (`pp.id*2`); no snapshot anywhere pins the aliased-View
  sibling reference (only the view-name-qualified `upper(project_overview.name)`).
  Worth locking because `View.as()` does NOT call `__setColumnsName` (unlike
  `Values.as()`) — the divergence is documented; the test guards it. Uses existing
  `vProjectOverview.nameUpper` / `vReleaseOverview.versionUpper`, no fixture.

### Surface EQCMP — the T4 `*IfValue` output-coincident tail (RECOMMEND CLOSE)

F1-EQCMP found 0 T1-T3 gaps; the sole residual is a **102-cell T4 tail**: the
direct-fluent `*IfValue` methods lacking a per-leaf test, where the fired param
marshals identically to the leaf's already-tested non-IfValue sibling and the
fires/elides behavior is proven on a representative (and every marshalling-sensitive
leaf on its own twin). Enumerated by method for the record (no distinct SQL/type/
value → **CLOSE per R-P7**, do not implement):
`equalsIfValue`→{double, localDate, localTime, localDateTime, customComparable,
customLocalDateTime}; `notEqualsIfValue`→{bigint, double, localDate, localTime,
localDateTime, customComparable, customInt, customDouble, customUuid,
customLocalDateTime}; `isIfValue`→15 leaves; `isNotIfValue`→16;
`inIfValue`→11; `notInIfValue`→11; `lessThanIfValue`=`greaterThanIfValue`=
`lessOrEqualIfValue`=`greaterOrEqualIfValue`→{uuid, localDate, localTime,
localDateTime, customInt, customDouble, customUuid, customLocalDateTime} (8 each);
plus `asRequiredInOptionalObject` on a double leaf (optionality-mark only).

---

## Part III — OUT (named with reason, so they are not re-chased)

- **queryRunner-layer error reasons** — `SQL_*` (26), `TRANSACTION_*`,
  `FORBIDDEN_CONCURRENT_USAGE`, `UNSUPPORTED_DATABASE`, `INVALID_MOCKED_VALUE`,
  `OUT_PARAMS_NOT_SUPPORTED`, `ONLY_ONE_COLUMN_EXPECTED` — thrown only in
  `src/queryRunners/*` → OUT (driver layer, §5).
- **`UNKNOWN_DATA_TYPE` / insert-guard `INTERNAL`** — reachable only via non-value-source
  stub / `as any` past the type guard (impossible builder state) → OUT.
- **`UNSUPPORTED_QUERY`** (MySQL `compatibilityVersion < 8_000_000`) — no mysql/oldest
  cell exists → OUT (no cell), consistent with round-38.
- **Non-PG `compatibilityVersion` emission branches** (MySQL with-clause inlining,
  SQLite `unixepoch` subsec, MariaDB RETURNING) — version-band emission → OUT of a
  type-driven audit.
- **Value-source `limit(vs)` / `offset(vs)`** — runtime accepts `INumberValueSource`
  but the TYPED public surface is `limit(number)` only → runtime-only, OUT.
- **`with()` CTE method, `conn.values(...)`, `isTrue()`/`isFalse()`, `padStart`/
  `padEnd`/`position`/`replace`/standalone `ltrim`/`rtrim`** — non-existent APIs
  (hallucination guards held) → OUT.
- **Custom-temporal CONST getters** — by-design PG limitation (Part I) → OUT.
- **PARITY cosmetic items** (`Witout` typo, variance comments, `values` overload
  order) — compile-only, no observable surface → OUT src-cleanup notes.
- **Per-leaf sequence kinds / per-kind adapter-`a2` fan-out / EQCMP T4 tail** —
  degenerate (shared dispatcher, no distinct SQL/type/value) → OUT/CLOSE (R-P7).

---

## Part IV — Per-surface saturation table

| Surface | §A | §B | verdict |
|---|---|---|---|
| SEL / PROJ-INLINE (F-RECENT ∩ SEL-SEAM ∩ F3-PROJ) | 14 (2 are BUG-1 boundary) | 0 | **gap cluster** (+ BUG-1) |
| SEL union/compound marker | 1 (BUG-2 boundary) | 0 | **BUG-2** |
| F4-INSERT | 2 | 0 | near-saturated |
| F5-CONN | 0 | 1 (P2) | saturated but P2 |
| MUT-SEAM | 1 (+2 degenerate) | 0 | near-saturated |
| F1-STR (backslash residual) | 10 | 0 | fix-residual coverage |
| F2-VALVIEW | 1 | 0 | near-saturated |
| PARITY | 0 | 0 | **SATURATED** |
| F1-EQCMP | 0 (102 T4 → close) | 0 | **SATURATED** |
| F4-UPDDEL | 0 | 0 | **SATURATED** |
| F3-SELECT | 0 | 0 | **SATURATED** |
| F1-NUM | 0 | 0 | **SATURATED** |
| F1-CUSTOMNUM | 0 | 0 | **SATURATED** |
| F1-TEMP | 0 | 1 (B-1 limitation) | **SATURATED** |
| F1-BOOLIF | 0 | 0 | **SATURATED** |
| F2-COL | 0 | 0 | **SATURATED** |
| F6-DYN | 0 | 0 | **SATURATED** |
| F7-EXTRAS | 0 | 0 | **SATURATED** |
| F9-TYPEVAR | 0 | 0 | **SATURATED** |

**17 of 20 surfaces SATURATED.** The value of the round is concentrated at the
SELECT projection seam (2 bugs + the inline-aggregate cluster) plus a small
distinct-path tail.

---

## Part V — Coordinator verification notes (what I checked myself)

1. **BUG-1** — read `resultWithOptionalsAsNull.ts:63-90` (ForAggregatedArray types
   rule-1/2 top leaf non-null) and `AbstractQueryBuilder.ts:69-95,159-167` (inline
   uses non-dropping `__transformRootObject`). Mock-probe `select({ projName:
   tProjLeft.name }).projectingOptionalValuesAsNullable().forUseAsInlineAggregatedArrayValue()`
   → runtime `[{ projName: null }, …]` (PASS). tsgo → `Array<{ projName: string }>`.
   CONFIRMED unsound.
2. **BUG-2** — read `SelectQueryBuilder.ts:409-448` (compound methods don't copy the
   flag) vs `:670/:742` (recursive does). Mock-probe union case → type `{ body:
   string | null }`, runtime dropped `body`. CONFIRMED unsound. §7.1 contradiction
   (F-RECENT vs SEL-SEAM/F3-PROJ) resolved by direct probe.
3. **MUT-RET-NULL-OUTERJOIN (A3)** — mock-probe: type `{ assignee: string | null }`,
   runtime `{ assignee: null }` (PASS) → SOUND → §A, not a bug (mutation-returning
   uses the plain nullable type, which matches the non-dropping runtime).
4. **INS-DEFVAL-RET-\*** — mock-probe `defaultValues().returning({ id:
   tLedgerEntry.entryNo }).executeInsertMany()` compiled + ran (`[{ id: 1001 }]`, the
   `+1000` is `entryNo`'s read-adapter), `assertType<Exact<…, Array<{ id: number }>>>`
   held → reachable §A CONFIRMED.
5. **VV-VIEW-1** — mock-probe emission → `select upper(po.name) as "nameUpper" from
   project_overview as po …` → correct re-qualification → SOUND §A, not a bug.
6. **F-RECENT baked-in-bug scan** — the ~20 tests added by commits `2a756870` /
   `1090322b` show no `expected`/`toEqual` contradicting its own `assertType` (the
   rule-3 inline pair is self-consistent — its `ContainsRequired` branch coincides
   with the plain type, which is exactly why the BUG-1 divergence was invisible
   there). CLEAN.
7. All repros deleted; `git status --porcelain` shows only the new report,
   `BUGS.md`, and the pre-existing untracked audit reports (+ `.gitignore`, + the
   pre-existing baked-in-bug §0.5 runbook paragraph).

---

## Part VI — §B fixture-addition plan

- **CONN-P2**: add `withTwoParams` (`createTableOrViewCustomization<number, number>`)
  to the shared `domain/connection.ts` (propagates to all 17 cells). The only §B.

Doc-cleanups (not §B, not coverage debt — flag for a housekeeping pass):
- Stale header prose in `with-values.test.ts:5-7` and `with-values.advanced.test.ts:28-30`
  (34 cells) still claims dialects that type Values `never` comment out the body;
  Values is LIVE on all 17 cells (R40). Header is stale prose only.

---

## Part VII — Recommended implementation order

1. **BUG-1, BUG-2** — file the two `src/` fixes (owner/fixing agent, not this
   round); then the boundary tests **SEL-INLINE-NULL-R1/-R2/-R2MISS** and
   **SEL-UNION-INLINE-NULL** flip from `// TODO[BUG]` to plain assertions.
2. **T1 §A** — INS-DEFVAL-RET-OBJ / -ONECOL; STR-BSLASH-COLOP.
3. **T2 §A** — the SEL-INLINE default/nullable rule shapes (R1-DEF, R2-DEF, R4-DEF,
   R4-NULL, NESTED-R1, NESTED-R2, SOLE-OPT, WRAP-GROUPBY, WRAP-RECURSIVE);
   MUT-RET-NULL-OUTERJOIN; VV-VIEW-1.
4. **T3 §A/§B** — CONN-P2 (needs the `withTwoParams` fixture); the backslash
   affix behavioral tests that also first-cover the 4 insensitive/IfValue affixes.
5. **T4 tail** — SEL-INLINE-MULTI-OPT, WRAP-HAVING, WRAP-DISTINCT; the remaining
   backslash re-proofs. The EQCMP 102-cell `*IfValue` tail: **CLOSE, do not
   implement** (R-P7, output-coincident).

---

## Part VIII — Verdict

An honest, high-yield round at extreme maturity: **17/20 surfaces saturated, and
2 confirmed `src/` bugs** — both residuals of the round-40 BUG-3 fix, both living
in the projection seam the fix touched, both settled against a cross-agent
contradiction by direct runtime probe (the exact §7.1 discipline that caught BUG-3
itself). The "bug lives in the residual of the prior round's fix" pattern holds a
fifth time, this round as a *pair*. The remaining §A backlog is dominated by the
inline-aggregate × projection-rule cluster (the untested positive arm the bugs
inhabit) plus a short distinct-path tail; the rest of the typed surface is
genuinely saturated, and the EQCMP `*IfValue` fan-out is correctly closed rather
than padded. Nothing was fixed in `src/` from this audit.
