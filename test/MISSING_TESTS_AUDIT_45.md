# MISSING_TESTS_AUDIT_45 — maximal-saturation type-driven audit

**Mandate.** Round 45 at the MAXIMUM-SATURATION dial: enumerate *every* writable test the type
surface implies, including output-coincident T4 tails (do NOT close them under R-P7 — only a cell
with ZERO SQL/params/value surface is OUT). Each item is a discrete line with fixture + assertion +
absence proof. The report is an exhaustive item-by-item backlog, not a thematic summary.

**Method.** 20 read-only discovery agents (F-RECENT, PARITY, MUT-SEAM, SEL-SEAM, F1-EQCMP, F5-CONN,
F4-INSERT, F3-PROJ, F6-DYN, F1-STR, F4-UPDDEL, F3-SELECT, F1-NUM, F1-CUSTOMNUM, F1-TEMP, F1-BOOLIF,
F2-COL, F2-VALVIEW, F9-TYPEVAR, F7-EXTRAS), ≤10 concurrent, re-derived from the CURRENT test files.
Every load-bearing claim coordinator-verified (compile-repro + runtime mock probe; see Part V).

**Matrix at run:** `tests:audit` → 17 cells · 247 files · **3762 tests/cell** (63954 across the matrix),
fully symmetric (up from 3024 at R44 — R44's backlog + the two new src fixes landed). `test/BUGS.md`
is empty ("None open").

**Headline counts.**
- **Confirmed `src/` bugs: 0.** (Nothing filed to BUGS.md; two candidates probed and classified below.)
- **Genuinely-distinct core to-write: ~9** — the 2 probe-confirmed FIX-B §A T1 regression tests, their
  default-projector companions, the 3 custom-boolean IN-family distinct-SQL cells, and the MUT-SEAM
  characterization/boundary tests.
- **Output-coincident T4 tail: ~330** enumerated one-line-per-variant across the surfaces.
- **17 of 20 surfaces returned fully saturated** on independent re-derivation.

---

## PART I — Bugs, confirmed §A, candidates, limitations, hygiene

### I.0 Src changes since R44 (F-RECENT step-5) and their verification

Three src commits since R44's report; two are the round's primary targets:

- **`87f4a8a3` — FIX A (PARITY-1 fix):** `insert.ts:627` shaped `setIfValue` param `MandatoryInsertSets`
  → `MandatoryOptionalInsertSets<TABLE,USING,SHAPE>`, matching its non-shaped sibling (`:613`). This
  animates the previously-dead branch `MandatoryOptionalInsertSetsContent` `SHAPE extends ResolvedShape`
  (`insert.ts:1118-1123`), which adds `| null | undefined` to shaped OPTIONAL columns.
  **Verified sound** (F-RECENT + PARITY): `MandatoryOptionalInsertSets` is referenced at exactly the two
  `setIfValue` sites — its correct home; shaped/non-shaped entry surface now perfectly symmetric; no other
  now-live consumer. **Positive arm COVERED** by the two shipped tests (`insert.shaped.test.ts`
  `shaped-set-if-value-gates-defaulted-non-nullable-shaped-key` null-skip on `tProject.published`,
  `shaped-set-if-value-gates-optional-shaped-key` undefined-skip on `archivedAt`). **Baked-in scan of
  `insert.shaped.test.ts` (2163 lines): CLEAN** — every `assertType<Exact>` agrees with its
  `toEqual`/snapshot; no contradiction.

- **`6505628a` — FIX B (projecting-nullable through the shared column-copy):** `DBColumnImpl.ts`
  `createColumnsFrom:148` and `createColumnsFromInnerObject:204` now copy
  `__aggreagtedProjectingOptionalValuesAsNullable`; field declared `ValueSourceImpl.ts:53`. Regression
  shipped ONLY in `select.compound-nested-object.test.ts:614`. **Verified sound; the fix's other consumers
  are the round's headline §A gap — see I.1.** Baked-in scan of `select.compound-nested-object.test.ts`:
  **CLEAN**.

- **`621c64a2` — "Avoid values table appears several times"** (`Values.ts` self-join WITH double-hoist):
  reviewed+fixed in a prior round with an added test + 5-engine docker; BUGS.md empty. F2-VALVIEW confirmed
  the guard (`Values.ts:214-228`, `!withs.includes(target)`) and its test (`with-values.test.ts:416`,
  17/17 cells). **No action.**

### I.1 CONFIRMED §A T1 — FIX B's two untested consumers (PROBE-CONFIRMED present-null; NOT bugs)

The runbook corollary (`TYPE_AUDIT_RUNBOOK.md:1015-1026` — *a fix reusing one shape across two builder
paths must be probed on EACH path*) fired precisely. `createColumnsFrom`/`createColumnsFromInnerObject`
have three consumers; the fix shipped a test only for the **compound** path (`SelectQueryBuilder.ts:1530`).
SEL-SEAM, F-RECENT, and F3-PROJ independently converged on the other two; I **coordinator-probed both**
(Part V): each **typechecks with `assertType<Exact<…, archivedAt: Date | null>>`** and the **runtime keeps
the null leaf present-null**. So the fix is correct on these consumers, but no test exercises them → write
the regression tests (they lock two fix lines no current test reaches; a regression on either leaves every
existing test green).

- **B-T1a · T1 · §A** — `aggregateAsArray({...optional leaf...}).projectingOptionalValuesAsNullable()`
  projected TOP-LEVEL, carried through a **with-view CTE** (`.forUseInQueryAs('cte')` →
  `WithViewImpl.ts:44` → `createColumnsFrom:148`), then re-selected. Fixtures: `tOrganization`,
  `tProject.forUseInLeftJoin()`, `tProject.archivedAt` (the null leaf) — all exist (§A).
  Assertion: `assertType<Exact<…, Array<{orgId:number; projects:Array<{id:number;name:string;archivedAt:Date|null}>}>>>`,
  a null-`archivedAt` boundary element → `'archivedAt' in el === true` **and** `el.archivedAt === null`;
  emitted SQL is a `with cte as (… json_agg(json_build_object('archivedAt', project.archived_at)) …) select …`.
  Absence: grep of all `test/db` — `forUseInQueryAs` + `aggregateAsArray` + `projectingOptionalValuesAsNullable`
  co-occur in ONE query nowhere (only in separate queries in `select.brand-through-structure` and the
  generated doc files).
- **B-T1b · T1 · §A** — the SAME aggregate NESTED inside a projection object member
  (`select({ orgId, wrap: { projects: aggregateAsArray(...).projectingOptionalValuesAsNullable() } })`)
  carried through the CTE (**`createColumnsFromInnerObject:204`** — the fix's second line, which the
  top-level compound test never reaches). Same fixtures/assertion, one nesting level deeper; also a
  compound (`unionAll`) twin. This is the sharpest cell — line 204 is unexercised for the nullable flag by
  ANY test. Absence: no `test/db` file nests an aggregate-nullable inside an object member through
  compound/CTE.
- **B-T1c · T2 · §A companion** — the DEFAULT projector (no `.projectingOptionalValuesAsNullable()`)
  aggregate-through-CTE, top-level and nested: a null leaf is DROPPED (`'archivedAt' in el === false`).
  Pins the base composition (aggregate array round-trips through a CTE column at all) independent of the
  nullable flag. Same fixtures.

### I.2 CANDIDATES — both readings, probed, classified (NOT filed to BUGS.md)

- **MUT-SEAM-1 · T2 · §A characterization (lean NOT-a-bug).** Empty-on-conflict-degrade +
  `returningLastInsertedId()` on a **colliding** row. `.onConflictOn(cols).doUpdateDynamicSet({archivedAt:null})
  .ignoreAnySetWithNoValue().returningLastInsertedId()` emits byte-identical
  `insert … on conflict (…) do nothing returning id` to the covered `onConflictDoNothing().returningLastInsertedId()`
  twin, but the degrade path types the result **`number`** (non-null; the emptying is a runtime value-gate the
  type can't see) and, because the R43 degrade never sets `__onConflictDoNothing`, on a suppressed row the
  guard **throws `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`** (vs the doNothing twin, typed `number | null`,
  resolving null). **PROBE-CONFIRMED** (Part V): degrade path throws `MANDATORY_VALUE_NOT_RECEIVED`; control
  resolves null. Reading A (by-design): the type promises `number`; the runtime can't deliver on the degrade+
  collision; throwing is the **type-sound** fallback (resolving null would be unsound) → a §A characterization
  test pinning the throw. Reading B (defect-ish): the degrade makes the statement behave like `do nothing`, so
  the non-null type over-promises — but the only sound fix (nullable every dynamic-set upsert's
  `returningLastInsertedId`) is over-broad. **Lean firmly A** — unlike R43's A-1/C1 (engine rejections / silent
  behavior change), this is a clean documented library error on a genuinely-impossible case; the throw honors
  the type. Artifact: a mock+docker characterization test (`MANDATORY_VALUE_NOT_RECEIVED` on the colliding
  degrade path; the R43 test `insert.on-conflict.dynamic-set.test.ts:784` deliberately used a fresh
  non-colliding slug, so the collision inhabitant is untested). Not filed — flagged for owner adjudication.
- **FIX-A shaped-multi-row `values` under-accepts skip · CANDIDATE (lean NOT-a-bug, intentional).**
  `ShapedInsertExpression.values` (`insert.ts:628-629`) uses `MandatoryInsertSets`, not the optional twin, so
  shaped multi-row `values([…])` won't per-row `null`/`undefined`-skip an optional-in-shape column. Reading A
  (gap, asymmetric with `setIfValue`). Reading B (intentional — F-RECENT + PARITY both concur): the **non-shaped**
  `values` (`:614-615`) also uses `MandatoryInsertSets`, so shaped mirrors unshaped exactly; a bulk multi-row
  INSERT can't per-row omit a column (uniform VALUES column set), and skip for multi-row is provided by
  `dynamicValues` (`OptionalInsertSets`) / `setForAllIfValue`. Not a PARITY-1 residual. Not filed.

### I.3 Known LIMITATIONS (by-design; not bugs, not §A)

- **L-1 · custom-temporal CONST getter** (F1-TEMP-R1, F5-CONN-R2): `conn.const(d,'customLocalDate','ReleaseDay').getMonth()`
  and `arg`/`valueArg` over `customLocalDate/Time/DateTime` emit a bare `extract(part from $1)` / bind a raw
  `Date` with no built-in cast (custom typeName has no built-in SQL type → user's `transformPlaceholder`
  responsibility). PostgreSQL rejects the untyped placeholder → **not real-DB-validatable → OUT** as a
  Principle-#1 test. Matches runbook fingerprint (lines 936-955). At most a mock-only `// TODO[LIMITATION]`
  characterization test at owner discretion; already documented at `fragments.with-args.temporal.test.ts:9-15`
  and `select.value-source.const-temporal-getters.test.ts`.

### I.4 Inert / dormant-code observations (src-cleanliness; OUT, no test possible)

- **N-1 · cosmetic typo `as double presition`** (F1-NUM): `AbstractSqlBuilder._asDouble` (~2980-2981, also
  omits a space → `cast(colas double presition)`) and `_divide` (~3245-3246). All 6 real dialects OVERRIDE both
  methods (PG `::float`, Oracle/SqlServer `cast(.. as float)`, SQLite override, MySQL/MariaDB `col * 1.0`), so
  these lines are reachable only via `NoopDBSqlBuilder`, which is **not a matrix cell** → zero test impact, no
  Principle-#1 test possible. A one-line src fix someday; out of audit scope.

### I.5 Doc-hygiene (unapplied; report-only, not a gap)

- **D-1 · stale headers** (F2-VALVIEW re-confirmed): `with-values.test.ts:5-7` and
  `with-values.advanced.test.ts:28-30` carry R40-era "the Values tests run live on every cell" boilerplate;
  the newer sibling files don't repeat it. Unapplied doc-cleanup since R40.
- **D-2 · dangling B1 comment** (F5-CONN): `select.connection-trailing-adapter.test.ts:608-617` pre-writes the
  rationale for `const(value,'localDate'|'enum',adapter)` tests that were never added — a dangling intent that
  the D-2/B-CONN T4 items below would close.

### I.6 Superseded carried notes (corrected this round)

- **bigint trig/cast negative-lock is COMPLETE** (F1-NUM): `types.negative/select.test.ts:340-391` locks all 21
  methods (multiply/divide/power/sqrt/exp/ln/log10/cbrt/atan2/logn/roundn/sin/cos/tan/acos/asin/atan/cot/asInt/
  asDouble/asBigint) on a bigint receiver. The prior "only `sin` is locked" note is stale — **no top-up needed.**
- **R43-BOOL-B1 residual RESOLVED** (F1-BOOLIF): required-string `verified`/`published` `isNull`/`isNotNull`
  remap (`(verified='Y') is null`) is now covered at `custom-boolean-remap.test.ts:807/823/839/855`.

---

## PART II — Enumerated backlog by surface (maximal dial; T4 tails one line per variant)

Tiers: **T1** distinct code-path/bug-class · **T2** distinct overload/per-type-emission/seam · **T3** per-variant
completeness (may need §B) · **T4** output-coincident fan-out (distinct reachable overload/kind/arity/leaf,
byte-identical emission). Genuinely-distinct items first, then the T4 tail per surface.

### II.A  FIX B — projecting-nullable consumers (F-RECENT / SEL-SEAM / F3-PROJ)
- `B-T1a · T1` — top-level aggregate-nullable through with-view CTE (`createColumnsFrom:148`). [§A — see I.1]
- `B-T1b · T1` — nested-in-object aggregate-nullable through with-view CTE (`createColumnsFromInnerObject:204`)
  + a compound (`unionAll`) twin. [§A — see I.1]
- `B-T1c · T2` — default-projector (no flag) aggregate-through-CTE, top-level + nested: null leaf DROPPED. [§A]
- `B-T4-223 · T4` — aggregate-in-inner-object carried through compound/CTE via the copied column, exercising
  `AbstractQueryBuilder.ts:223` (`__transformProjectedObject`) through the fix's flag.
- `B-T4-144 · T4` — array-of-arrays (aggregated-array element is itself an aggregated-array value source) with
  the projecting flag, exercising `AbstractQueryBuilder.ts:144`.
- `B-probe1 · reachability-first` — `aggregateAsArray(dynamicPick(availableFields,{...}))` fed to the aggregate
  projector (F3-PROJ RESIDUAL-3). Coordinator must compile-repro that it is type-permitted BEFORE authoring;
  likely niche.

### II.B  FIX A — shaped `setIfValue` null/undefined-skip per defaulted-non-nullable kind (F-RECENT)
Each is `insertInto(tColMatrixDefault).shapedAs({k:'<col>'}).setIfValue({k:null}).executeInsert()` where the
renamed key maps a defaulted, NON-nullable column → `null` skips it (DB default), emitting a column list without it.
Output-coincident with the shipped boolean case → T4, one line per kind:
- `A-T4-01..18 · T4` — `tColMatrixDefault` columns: `mInt`(int), `mBigint`(bigint), `mDouble`(double), `mBool`(boolean-no-adapter), `mUuid`(uuid), `mDate`(localDate), `mTime`(localTime), `mDatetime`(localDateTime), `mStr`(string), `cents`(customInt), `money`(customDouble), `signingKey`(customUuid), `semver`(customComparable), `channel`(custom), `releaseDay`(customLocalDate), `cutoffClock`(customLocalTime), `signOff`(customLocalDateTime), `activity`(enum).
- `A-T4-19..23 · T4` — `tOrganization.verified` / `tAppUser.verified` (boolean w/ adapter), `tProjectRelease.publishedAt` (customLocalDateTime default), `tWebhookEvent.eventType` (enum default), `tIssue.viewCount` (bigint default).
- `A-T4-24 · T4` — the `{k: undefined}`-skip variant on a defaulted-non-nullable shaped column (the `| undefined`
  arm the fix's animated union adds; compiles — resolved, see Part V — and skips identically).
- `A-T4-25 · T4` — shaped `dynamicValues({...})` with an explicit `null`/`undefined` value (accepts skip via
  `OptionalInsertSets`, never asserted with a null value today).

### II.C  MUT-SEAM — empty-on-conflict-degrade composition tail (MUT-SEAM)
- `MUT-1 · T2` — degrade + `returningLastInsertedId()` on a COLLIDING row → throws `MANDATORY_VALUE_NOT_RECEIVED`
  (characterization; both readings — see I.2). Control twin = `onConflictDoNothing().returningLastInsertedId()`.
- `MUT-2 · T4` — degrade + `returningOneColumn(col)` × {executeInsertNoneOrOne→null, One→NO_RESULT, Many→[]}:
  the one-column runner through `… do nothing returning id` (benign; `returningOneColumn`+non-empty and
  degrade+row-shape are covered, this one-column-through-degrade cell is not).
- `MUT-3 · T2 boundary` — `.doUpdateSetIfValue({archivedAt:undefined}).where(cond)` reaches empty-set WITH a
  WHERE → emits `… do nothing` (WHERE dropped). Per the drop≠defect oracle a legitimate NOT-APPLICABLE boundary
  (the `do update set … where` clause is REPLACED by `do nothing`, no where slot) → artifact is a passing
  boundary snapshot, not a bug.

### II.D  F1-EQCMP — value-source-operand + inN-mixed tails (F1-EQCMP)
18/18 leaves saturated for every base method with a const operand + value-source operands for the core methods.
Residual is a §7.3-capped T4 tail (each leaf's value-source overload is already exercised by a sibling method):
- `EQ-T4-01..05 · T4` — `is(valueSource)` / `isNot(valueSource)` (const-only today) for: boolean, uuid, customDouble, customComparable, customLocalDateTime (one line each).
- `EQ-T4-06 · T4` — `equals(valueSource)` / `notEquals(valueSource)` for uuid.
- `EQ-T4-07 · T4` — `notEquals(valueSource)` for boolean.
- `EQ-T4-08..24 · T4` — `inN` MIXED (const + value-source) operand, per leaf except bigint (already covered):
  int, double, string, uuid, localDate, localTime, localDateTime, customInt, customDouble, customComparable,
  custom, enum, customUuid, customLocalDate, customLocalTime, customLocalDateTime, boolean.

### II.E  F6-DYN — op×type rotation tail (F6-DYN)
Every operator is covered on ≥1 type per form; the per-type IfValue-fire tests rotate which twins they omit.
27 op×type cells (each = descriptor + VSM form → implement as 1 paired test mirroring `dyn/*`):
- Comparable-IfValue rotation (base twin covered on same leaf): `DYN-T4-01` bigint `greaterThanIfValue`, `02` bigint `lessOrEqualIfValue`, `03` double `greaterThanIfValue`, `04` customInt `lessThanIfValue`, `05` customInt `greaterThanIfValue`, `06` customDouble `lessThanIfValue`, `07` customDouble `greaterThanIfValue`, `08` localDate `lessThanIfValue`, `09` localDate `greaterOrEqualIfValue`, `10` localTime `lessThanIfValue`, `11` localTime `greaterOrEqualIfValue`, `12` localDateTime `greaterOrEqualIfValue`, `13` customLocalDate `lessThanIfValue`, `14` customLocalDate `greaterOrEqualIfValue`, `15` customLocalTime `lessThanIfValue`, `16` customLocalTime `greaterOrEqualIfValue`, `17` customLocalDateTime `lessThanIfValue`, `18` customLocalDateTime `greaterOrEqualIfValue`.
- Equalable-IfValue rotation: `DYN-T4-19` double `isNotIfValue`, `20` string `isIfValue`, `21` string `isNotIfValue`, `22` string `inIfValue`, `23` string `notInIfValue`.
- Base-op rotation (the base operator itself): `DYN-T4-24` int `isNot`, `25` enum `equals`, `26` enum `notEquals`, `27` enum `in`.
- `DYN-T4-28 · T4/F7` — `expandTypeFromDynamicPickPaths` / `…ProjectedAsNullable…` `RESULT | null` / `RESULT | undefined`-returning overloads (value-realized null/undefined) — borderline F7 ownership.

### II.F  F1-STR — adapter-receiver IfValue twins + affix-escape adapter (F1-STR)
- `STR-T4-01..06 · T4` — adapter-receiver `*IfValue` predicate twins on `reviewerCode` (bracketAdapter):
  `equalsInsensitiveIfValue`, `notEqualsInsensitiveIfValue`, `likeIfValue`, `notLikeIfValue`,
  `likeInsensitiveIfValue`, `notLikeInsensitiveIfValue` (each byte-identical to its covered non-IfValue
  `reviewerCode` sibling; closes the "each string method on the adapter receiver" theme-9 checklist).
- `STR-T4-07..15 · T4` — affix-escape × adapter receiver: `{startsWith, endsWith, contains}` × `{% , _ , \}`
  on `reviewerCode` (9 variants; escape operates on the bound needle param, output-coincident with the
  plain-receiver `like-escape-literal` snapshot except the column name). Full 24-method × 3-metachar expansion
  (72) is pure receiver-agnostic redundancy — the 9 above suffice.

### II.G  F1-BOOLIF — custom-boolean receiver IN-family (F1-BOOLIF)
- `BOOLIF-1 · T2 (distinct SQL)` — `<cb>.notIn([…])` → `(col = X) not in (…)`: `in` is covered but the `not in`
  keyword on a remapping receiver is emitted NOWHERE. Reps: numeric `invoiced.notIn([false])`, string-req `verified.notIn([true])`.
- `BOOLIF-2 · T2 (distinct type-path)` — `<cb>.inIfValue([…])` fire+elide (`SqlOperationInValueSourceIfValueOrNoop`, never on a remapping receiver).
- `BOOLIF-3 · T2 (distinct type-path)` — `<cb>.notInIfValue([…])` fire+elide.
- `BOOLIF-T4-4 · T4` — `<cb>.inN(a,b)` → `(col=X) in ($1,$2)`.
- `BOOLIF-T4-5 · T4` — `<cb>.notInN(a,b)` → `(col=X) not in (…)`.
- `BOOLIF-T4-6 · T4` — `<cb>.isNot(true)` plain (BooleanValueSource path; only `is` covered plain).
- `BOOLIF-T4-7 · T4` — `<cb>.or(A.and(B))` from a cb receiver → `col=X or (A and B)` (only the inverse covered).
- `BOOLIF-T4-8 · T4` — `<cb>.and(A.or(B))` from a cb receiver → `col=X and (A or B)`.
- `BOOLIF-T4-9 · T4` — `<cb>.equalsIfValue(x).negate()` → `not ((col=X) = $1)` (plain-column analogue covered).
  (Each across the four cb receivers verified/published/approved/invoiced where the method applies.)

### II.H  F5-CONN — const/optionalConst + adapter kinds; sequence non-numeric kinds (F5-CONN)
- `CONN-T4-01..07 · T4` — `const`/`optionalConst` + trailing adapter for the 7 remaining kinds: `localDate`,
  `enum`, `custom`, `customComparable`, `customLocalDate`, `customLocalTime`, `customLocalDateTime`
  (both dispatcher branches already proven; closes the D-2 dangling B1 comment). Value asserted mock-only for the
  temporal/customLocal kinds, full value for enum/custom/customComparable.
- `CONN-T4-08..20 · T4` — `sequence` non-numeric value-kinds (string/uuid/temporal/enum/custom/customComparable/
  customUuid/customLocalDate/customLocalTime/customLocalDateTime/boolean): emitted SQL identical (`nextval(...)`),
  only the read marshaller differs (already proven elsewhere). Needs §B sequence declarations of those kinds.

### II.I  F1-CUSTOMNUM (F1-CUSTOMNUM)
- `CN-1 · T4` — `tIssueWorklog.costCents.modulo(2.5)` → `mod((cost_cents)::numeric,($1)::numeric)`: exercises the
  `customInt` dispatch branch reaching `_moduloRequiresFloatHandling` (current customInt modulo coverage is
  plain-`%` only). Borderline (SQL shape + value coincide with the covered int fractional-modulo).

### II.J  F1-TEMP — modifier→getter chains (F1-TEMP)
- `TEMP-T4-01..06 · T4` — modifier-then-getter leaf completeness: `releasedOn.valueWhenNull(x).getMonth()`,
  `releasedOn.nullIfValue(x).getDay()`, `cutoffTime.valueWhenNull(x).getHours()`, `cutoffTime.nullIfValue(x).getSeconds()`,
  `createdAt.valueWhenNull(x).getFullYear()`, `createdAt.nullIfValue(x).getHours()`.

### II.K  F2-COL — adapter-source per-kind tails (F2-COL)
The col_matrix read surface is output-complete; the adapter-source residual re-routes an ALREADY-asserted
adapter read output through a different source (View / virtual) than the Table cell that asserts it → T4:
- `COL-T4-view-adapter · T4` — View `column`/`optionalColumn` + adapter, non-string kinds (17 + 17): coincident
  with Table `column`+adapter×kind, distinct View read path.
- `COL-T4-virtual-adapter · T4` — `virtualColumnFromFragment` (Table) + adapter non-covered kinds (17 + 16);
  virtual (View) + adapter (18 + 18).
- (The primaryKey / autogeneratedPrimaryKey / autogeneratedPrimaryKeyBySequence non-int/non-comparable kind
  tails are brand-only-distinct — see Part III OUT.)

### II.L  F2-VALVIEW — Values self-join variants (F2-VALVIEW)
- `VV-T4-1 · T4` — Values self-join via LEFT-JOIN clone (`selectFrom(v).leftJoin(v.forUseInLeftJoinAs('anc'))`):
  distinct SQL (`left join … as anc` + optional-widened side + single hoisted WITH), same dedup guard.
- `VV-T4-2 · T4` — Values self-join with the original never in FROM (`selectFrom(v.as('a')).innerJoin(v.as('b'))`):
  the dedup guard when neither reference is the canonical `__source`.
- `VV-T4-3 · T4` — Values in BOTH arms of a compound (two distinct WITHs hoisted through the compound).
- `VV-T4-4 · T4` — Values in a NON-correlated `exists(selectFrom(values)…)`.

### II.M  F4-UPDDEL — Values-source in FROM/USING + edges (F4-UPDDEL)
- `UD-T4-1 · T4 (reachability-first)` — UPDATE `.from(values(...))` (a Values-derived source vs table/CTE-view):
  distinct `from (values …)`; compile-repro that `Values` satisfies the `from` bound before authoring.
- `UD-T4-2 · T4 (reachability-first)` — DELETE `.using(values(...))` (symmetric).
- `UD-T4-3 · T4` — empty `dynamicOn()` (join opened, no condition) then `.set/.executeDelete` → JOIN with no ON.
- `UD-T4-4 · T4` — UPDATE object-`returning({...})` + `executeUpdateNoneOrOne()` returning a PRESENT single object
  (DELETE has this; UPDATE only reaches it incidentally via the MORE_THAN_ONE_ROW mock branch).

### II.N  F3-SELECT (F3-SELECT)
- `SEL-T4-1 · T4` — `optionalLeftOuterJoin` ELIDED branch (only the emitted branch is pinned; byte-identical to
  the covered `optionalLeftJoin` elided snapshot — one-line copy with the method swapped).

### II.O  F7-EXTRAS — mock-value guard (F7-EXTRAS) — both readings, lean OUT (see Part III)
- `EX-c1 · candidate` — `INVALID_MOCKED_VALUE` per `MockQueryRunner` `queryType` arm (selectOneRow /
  selectManyRows / selectOneColumnManyRows / insert / insertReturningMultipleLastInsertedId / out-params) via
  `ctx.mockNext(wrongShape)` + `execute*()`. Reachable through the public mock seam BUT the thrower is in
  `src/queryRunners/` (§5 OUT) and it is not a type-path. Lean OUT; listed so it is not re-chased.

---

## PART III — OUT (genuinely unwritable; named so they are not re-chased)

- **F2-COL brand-only tails (~130)** — `primaryKey` non-comparable kinds (31), `autogeneratedPrimaryKey`
  (33), `autogeneratedPrimaryKeyBySequence` non-int (34), and the like: the factory brand
  (`& PrimaryKeyColumn` etc.) is NOT observable in any `ctx.conn` query result — read SQL, marshalled value,
  AND result type are byte-identical to the `column`×kind cell that asserts them. Compile-only distinction →
  negative-type territory → **OUT** (runbook §4 genuine-OUT line: observable only via `assertType` with
  byte-identical SQL AND value).
- **L-1 custom-temporal const getter / arg / valueArg** (I.3) — emits an uncastable bare `extract(part from $1)`
  / binds a raw Date; PostgreSQL rejects → not real-DB-validatable → OUT (mock-only LIMITATION at most).
- **F1-CUSTOMNUM casts + double-only methods on custom leaves** — `asInt/asDouble/asBigint` and
  `exp/ln/log10/sqrt/cbrt/trig/power/logn/roundn/divide/atan2` on customInt/customDouble are commented out in
  `values.ts` and negative-locked in every `types.negative/select.test.ts` — compile-only → OUT.
- **F1-NUM bigint typed-never methods** (21) — negative-locked (I.6); OUT.
- **F9-TYPEVAR compile-only brand keep/erase** — `add()` keeps brand vs `sign()` erases where SQL AND value are
  byte-identical: observable only via `assertType` → OUT.
- **F7-EXTRAS driver-layer error reasons** — `ONLY_ONE_COLUMN_EXPECTED`, `OUT_PARAMS_NOT_SUPPORTED`,
  `FORBIDDEN_CONCURRENT_USAGE`, the `TRANSACTION_*` / `LOW_LEVEL_*` runner reasons, `UNSUPPORTED_QUERY`
  (needs `compatibilityVersion < 8_000_000`, no cell targets it — R38 boundary), `UNSUPPORTED_DATABASE`,
  `UNKNOWN_DATA_TYPE`, all `SQL_*` driver error-mapping reasons: `src/queryRunners/` / driver / impossible-state
  / as-any → OUT.
- **F3-SELECT `forUpdate`/`forShare`** — no such API (row-locking is `customizeQuery({afterQuery: rawFragment\`for update\`})`,
  covered) → not a gap.
- **F4-INSERT bare no-target on-conflict forms on pg** (`onConflictDoUpdateSet` without `onConflictOn`) —
  typed-never on pg, NOT-APPLICABLE-marked + negative-locked; run live on mysql/mariadb/sqlite. Not a gap.
- **defaultValues() × on-conflict** — typed-never (`CustomizableExecutableSimpleInsertOnConflict` declares no
  `onConflict*`); R43's retracted MUT-A2a re-confirmed OUT.

---

## PART IV — Per-surface saturation table

| Surface | Confirmed bug | Genuine core (T1/T2/T3) | T4 tail | OUT | Verdict |
|---|---|---|---|---|---|
| F-RECENT (FIX A+B) | 0 | 3 (B-T1a/b/c) | ~26 (A 25, B 2) | — | headline §A; fixes sound |
| PARITY | 0 | 0 | 0 | — | twins symmetric |
| MUT-SEAM | 0 | 2 (MUT-1, MUT-3) | 1 (MUT-2) | — | 4/6 saturated |
| SEL-SEAM | 0 | (folded into B-T1) | — | — | primary lead confirmed |
| F1-EQCMP | 0 | 0 | ~24 | — | 18/18 leaves saturated |
| F5-CONN | 0 | 0 | ~20 | L-1 | saturated |
| F4-INSERT | 0 | 0 | 0 | several | saturated |
| F3-PROJ | 0 | (folded into B-T1) | 2 | — | near-saturated |
| F6-DYN | 0 | 0 | ~28 | — | saturated |
| F1-STR | 0 | 0 | ~15 | — | saturated |
| F4-UPDDEL | 0 | 0 | 4 | 1 | saturated |
| F3-SELECT | 0 | 0 | 1 | forUpdate | saturated |
| F1-NUM | 0 | 0 | 0 | 21 neg-lock | saturated |
| F1-CUSTOMNUM | 0 | 0 | 1 (CN-1) | many | saturated |
| F1-TEMP | 0 | 0 | 6 | L-1 | saturated |
| F1-BOOLIF | 0 | 3 (BOOLIF-1/2/3) | 6 | — | saturated |
| F2-COL | 0 | 0 | ~70 | ~130 brand | output-complete |
| F2-VALVIEW | 0 | 0 | 4 | 1 | saturated |
| F9-TYPEVAR | 0 | 0 | 0 | compile-only | saturated |
| F7-EXTRAS | 0 | 0 (EX-c1 lean OUT) | — | driver reasons | saturated |
| **Total** | **0** | **~9** | **~330** | — | mature/near-total |

"Saturated" = no runtime-surface cell remains beyond a listed T4 tail.

---

## PART V — Coordinator verification (what I ran myself)

- **FIX B T1 — compile-repro + runtime boundary-row probe.** Wrote a throwaway `*.test.ts` in
  `postgres/newest/pg/` with B-T1a (top-level aggregate-nullable through `forUseInQueryAs` CTE) and B-T1b
  (nested-in-object through the CTE), each with `assertType<Exact<…, archivedAt: Date | null>>` and a
  null-`archivedAt` boundary element. `npm run validate:tests` → **no error for the probe** (both compositions
  typecheck; the `Exact` present-null type holds). `npm run tests -- 'postgres/newest/pg/<probe>'` → **both
  tests PASS** (`'archivedAt' in el === true`, `el.archivedAt === null`), and `ctx.lastSql` contains the CTE.
  ⟹ the fix keeps the null leaf present-null on BOTH untested consumers → these are §A regression tests, NOT
  soundness bugs. (Per oracle 1015-1026, the compile-repro alone was insufficient; the runtime probe is what
  settled it.) Probe deleted; tree clean.
- **MUT-SEAM-1 — mock throw probe + type check.** Same probe file: control `onConflictDoNothing()
  .returningLastInsertedId()` with `mockNext(null)` → **resolves null**; the degrade path
  (`.doUpdateDynamicSet({archivedAt:null}).ignoreAnySetWithNoValue().returningLastInsertedId()`) with
  `mockNext(null)` → **throws `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`**; `validate:tests` confirms the
  degrade result types `number` (non-null). Emitted SQL byte-identical (`… on conflict (organization_id, slug)
  do nothing returning id`). ⟹ MUT-SEAM-1's trace confirmed by probe; the throw is type-sound → §A
  characterization test, not a bug.
- **FIX A undefined-skip (F-RECENT hedge resolved).** The animated `MandatoryOptionalInsertSetsContent`
  `SHAPE extends ResolvedShape` arm explicitly adds `| undefined` to optional-in-shape columns (`insert.ts:1122`),
  and a defaulted-non-nullable column is a `WritableDBColumnWithDefaultValue` → `OptionalColumnsForSetOf` → so
  `{k: undefined}` compiles (via both `?:` and `| undefined`). The shipped test's comment ("undefined would be
  caught by the shape's key type") is correct in effect (undefined allowed); no gap, no bug — a `A-T4-24`
  completeness item at most.
- **Cross-agent convergence** (no contradictions to adjudicate): SEL-SEAM, F-RECENT, and F3-PROJ independently
  identified the same FIX B consumer gap and split it cleanly into line 148 (with-view top-level) and line 204
  (nested-object) — direct inspection + the probe confirmed both.
- **Baked-in scans**: `insert.shaped.test.ts` and `select.compound-nested-object.test.ts` — every `assertType`
  agrees with its `toEqual`/snapshot; CLEAN.

---

## PART VI — §B fixture-addition plan

Almost everything is §A on existing fixtures. Only two surfaces need additions, both small:
- **CONN-T4-08..20 (sequence non-numeric kinds):** add `sequence(...)` declarations of string / uuid / temporal /
  enum / custom / customComparable / customUuid / customLocalDate / customLocalTime / customLocalDateTime / boolean
  value-kinds on the shared `domain/connection.ts` (reusing existing sequence names; the emitted SQL is
  `nextval(...)`, only the read marshaller differs). Mock-only for the kinds whose value doesn't round-trip.
- **UD-T4-1/2 (Values source in UPDATE FROM / DELETE USING):** no fixture needed (uses `values(...)` inline) —
  but gate on the reachability compile-repro first.

Everything else (FIX A/B, EQCMP, DYN, STR, BOOLIF, TEMP, COL, VALVIEW) reuses existing columns/fixtures.

---

## PART VII — Recommended implementation order

1. **B-T1a / B-T1b / B-T1c** — the FIX B §A regression tests (2 fix lines no test reaches; probe-confirmed
   present-null). Highest value.
2. **BOOLIF-1/2/3** — the custom-boolean IN-family distinct-SQL cells (genuinely new emission).
3. **MUT-1 (characterization) + MUT-3 (boundary)** — pin the empty-degrade collision throw + the WHERE-drop
   boundary (owner may re-classify MUT-1).
4. **§B** — CONN sequence non-numeric kinds; the two Values-source reachability compile-repros (UD-T4-1/2).
5. **T4 tails in slices** — FIX A per-kind null-skip (A-T4-01..25), EQCMP value-source/inN-mixed (EQ-T4),
   DYN op×type rotation (DYN-T4-01..27), STR adapter/affix (STR-T4), CONN const+adapter kinds (CONN-T4-01..07,
   closes D-2), TEMP modifier→getter (TEMP-T4), CUSTOMNUM CN-1, COL adapter-source (COL-T4), VALVIEW self-join
   (VV-T4), UPDDEL edges, SEL optionalLeftOuterJoin elided.
6. **Doc-hygiene** — D-1 stale headers; D-2 dangling B1 comment (subsumed by CONN-T4).

## PART VIII — Verdict

An honest, mature, near-total-saturation round: **0 confirmed `src/` bugs.** After R44's ~2,430-test maximal
backlog + both fixes landed, 17 of 20 surfaces re-derived fully saturated, and the type surface is now
exhaustively pinned. The round's real value is the **headline §A cluster the runbook corollary predicted and
the coordinator probe confirmed** — FIX B's projecting-nullable flag rides correctly through its two
non-shipped consumers (the with-view CTE `createColumnsFrom:148` and the nested-object
`createColumnsFromInnerObject:204`), but nothing tested them; those two regression tests lock fix lines no
existing test reaches. Two candidates were probed and classified NOT-a-bug (MUT-SEAM-1's throw is type-sound;
the shaped-multi-row asymmetry mirrors the unshaped form). The remaining ~330 items are the intentional
maximal-dial T4 tail — enumerated one-line-per-variant so a future round surfaces only genuinely-new `src/`
changes, not residual completeness. A 0-bug round at this maturity is a success, not a shortfall.

**Runbook: NO CHANGE.** Both probed candidates match existing fingerprints/oracles (FIX B T1 = the
"shared-shape fix must be probed on each consuming path" corollary, lines 1015-1026, working exactly as
written and here resolving to §A not a bug; MUT-SEAM-1 = the "type-sound guard throw ≠ defect" oracle). No new
failure mode, no load-bearing rule refined by the user this session.
