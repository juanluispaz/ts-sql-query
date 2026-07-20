# MISSING_TESTS_AUDIT_47 — type-driven missing-tests audit (Round 47)

**Mandate.** Maximal-saturation, type-driven, multi-agent audit of the ts-sql-query
typed surface: classify every reachable type-path COVERED / TO-WRITE (T1/T2/T3/T4) /
OUT, enumerate every writable test as its own line item (output-coincident tails →
T4, one line per variant), and confirm no type-vs-impl / type-vs-runtime divergence
is left unfiled. This report is an **exhaustive implementation backlog**, not a
thematic summary.

**Method.** 20 read-only discovery agents (one per surface), ≤10 concurrent, each
raw-reading `src/` types and grepping the current `test/` matrix; coordinator then
compile-repro'd / mock-probed / re-read every load-bearing claim. Reference cell
`postgres/newest/pg/`; matrix symmetric (17 cells).

**Pre-flight.** N=47 (`_46` highest present). `tests:audit` → **17 cells / 247 files /
3876 tests per cell** (65 892 total, symmetric) — up from 3856 (R46) as R46's backlog
+ the R46 bug fix's 18-cell characterization tests landed. `BUGS.md` = *None open*.
Index refreshed. Fixtures (`test/db/postgres/domain/connection.ts`, 1973 L) re-read.

**Headline counts.**
- **1 CONFIRMED src bug** — `forUseAsInlineQueryValue()` over a one-column
  `projectingOptionalValuesAsNullable()` aggregate drops the present-null leaf
  (compile-repro + mock boundary-row probe confirmed). → filed to `BUGS.md`. This is
  the **R46 fix (`0b837af0`) incomplete** — the same projecting-flag family, on a clone
  the fix did not patch. Third consecutive round the runbook corollary (§7.4
  lines 1015-1026) fires; **no runbook edit** (textbook instance of an existing fingerprint).
- **2 type-only candidates** (owner ruling; not filed — no runtime/value surface,
  cannot become a Principle-#1 test): PARITY `update.ts:532` stray union; BOOLIF
  `isIfValue` optionality asymmetry.
- **Genuine §A backlog:** ~11 core (the bug regression test + projecting-then-gate/modifier
  crosses + 2 mutation seam pins) + a listed T4 tail. **§B: 0.** 18/20 surfaces saturated.
- Baked-in scan of the 7 R46-backlog files: **all CLEAN** (no assertType-vs-toEqual contradiction).

---

## PART I — Confirmed bug, candidates, verifications

### BUG-1 (CONFIRMED — filed to BUGS.md) · T1

`connection.selectFrom(...).selectOneColumn(conn.aggregateAsArray({...}).projectingOptionalValuesAsNullable()).forUseAsInlineQueryValue()`
— consumed as a column of an outer select — **types the element's optional leaf
present-`null` but the runtime DROPS it** (absent key).

- **Where:** `src/internal/ValueSourceImpl.ts` — `valueSourceInitializationForInlineSelect`
  (2476-2494). The `__oneColumn` branch (2479-2490) returns the 7-tuple
  `[valueType, valueTypeName, optionalType, typeAdapter, __aggregatedArrayColumns,
  __aggregatedArrayMode, __uuidString]` which is spread into the `ValueSourceImpl`
  base ctor (56-68). That ctor copies `__aggregatedArrayColumns` + `__aggregatedArrayMode`
  (so the outer transform still treats the value as an aggregated array) but has **no slot
  for `__aggreagtedProjectingOptionalValuesAsNullable`** → the flag is silently dropped.
  The resulting `InlineSelectValueSource` (ctor 2168, built by `forUseAsInlineQueryValue()`
  at `SelectQueryBuilder.ts:636`) then reaches `AbstractQueryBuilder.ts:81`
  (`__transformAggregatedArray(false, …)`) and the default projector drops the null leaf.
- **Probe (both sides, per the type-self-consistency≠runtime-soundness oracle):**
  - Compile-repro CLEAN → `typeof row` is `{ pid: number; issues?: Array<{ id: number; body: string | null }> }`
    (element leaf **present-`null`**).
  - Mock boundary-row (`mockNext({... issues:[{id:1,body:null},…]})`) → **candidate
    `'body' in el === false`** (leaf dropped); **control `forUseAsInlineAggregatedArrayValue()`
    → `'body' in el === true`** (present-null, correct — the R46-fixed twin works).
  - Emitted SQL identical shape (`(select json_agg(json_build_object('id', id, 'body', body)) … ) as issues`),
    so the divergence is purely the dropped flag, not a different query.
- **Fix scope (do NOT fix from the audit — documented for the fixing agent):** thread
  `valueSourcePrivate.__aggreagtedProjectingOptionalValuesAsNullable` out of
  `valueSourceInitializationForInlineSelect` and onto the constructed
  `InlineSelectValueSource` (an 8th tuple slot + base-ctor param, or a post-construction
  assignment in `forUseAsInlineQueryValue`). The three base-clone copy-sites (136/148/160),
  both aggregate families' ctor/gates/modifiers, and the `DBColumnImpl` column-map clones
  (148/204) already thread it correctly (verified below); this inline-select-init clone is
  the only remaining drop. `Null*` variants stay exempt (array→literal null).
- **Regression test to write (carries `// TODO[BUG]`):** the probe above, as a
  `select.aggregate-as-array.*` test — `assertType` present-null (ground truth) + the
  `'body' in el`/`el.body===null` boundary probe (currently FAILS: runtime drops).

### CANDIDATE-A (type-only; owner ruling; NOT filed) — PARITY `update.ts:532`

The **sqlite** `returningOneColumn` arm types its constraint
`COLUMN extends ValueSourceOf<TABLE[source] | NNoTableOrViewRequiredFrom<TABLE[source]>> | NOldValuesFrom<TABLE[source]>`
— the `| NOldValuesFrom<…>` sits **outside** `ValueSourceOf<…>`, inconsistent with (a) its
sqlite row-`returning` twin (525, which omits old-values entirely) and (b) the non-sqlite
`returningOneColumn` (530, where `NOldValuesFrom` is **inside** `ValueSourceOf`). The
`delete.ts:188` sqlite twin is clean. Both readings: (as-written) the stray arm is a bare
source-name unioned into a value-source constraint — **provably dead** (SQLite never exposes
`.oldValues()`; `sqlite/types.negative/update.test.ts:57-58` locks it), so it admits no real
value and is cosmetic; (intended) drop `| NOldValuesFrom<…>` to match line 525. **Not filed:**
type-only, no runtime/value surface → cannot be a Principle-#1 test (degeneracy-by-non-validatability);
a src-type cleanup for the owner, at most a `types.negative` lock.

### CANDIDATE-B (type-only; owner ruling; NOT filed) — BOOLIF `isIfValue` optionality

`src/expressions/values.ts:253` declares `isIfValue(value): IfValueSource<SOURCE, OPTIONAL_TYPE>`
— propagating the receiver's optionality — while its three siblings force `'required'`:
`is` (254), `isNot` (257), and **`isNotIfValue` (256)**. The null-safe operator emits
`x is not distinct from $1`, which can never yield NULL, so the boolean result is non-null
regardless of receiver optionality → `'required'` is the correct encoding, and `isIfValue`
is the lone outlier (its shape looks copied from `equalsIfValue` at 247, where propagation is
correct because plain `=` on NULL is NULL). Divergence **confirmed by direct source read** (253
vs 254/256/257). Both readings: (bug) a real internal inconsistency — `isIfValue` over-widens
the result to `optional`; (by-design) over-widening to optional is the **safe** direction (a
consumer handling `x?` handles the always-present case), so not unsound. **Not filed:** the
runtime value is a present boolean either way → no VALUE distinguishes the two → type-only,
cannot be a Principle-#1 test. Surface to the owner; if ruled a defect the fix is
`isIfValue → IfValueSource<SOURCE, 'required'>` + a `types.negative` lock.

### CANDIDATE-C (owner ruling cleanup; NOT filed) — PARITY `ShapedInsertExpression` has no `from`

`InsertExpression.from` (`insert.ts:619`) is the only producer of
`CustomizableExecutableInsertFromSelect` and hardcodes `…, undefined>`; `ShapedInsertExpression`
(622-632) exposes no `from`/`defaultValues`, so the `SHAPE` type parameter threaded through
`CustomizableExecutableInsertFromSelect` / `OnConflictDoInsertFromSelect` is vestigial (never
populated). Either a missing `ShapedInsertExpression.from(select)` method or dead type-param to
drop — unreachable public API → degenerate (R-P7). Owner-ruling cleanup.

### MUT-SEAM A-1 (sound §A pin — enumerated in Part II) · T1

`insertInto(t).values({…}).onConflictOn(cols).where(arbiter).doUpdateSet({…}).where(update)` —
the only mutation composition where **two independently-built WHERE clauses coexist in one
statement** (arbiter `__onConflictOnColumnsWhere` `AbstractSqlBuilder:2174` + update
`__onConflictUpdateWhere` `:2213`). MUT-SEAM traced the emission to correct
(`on conflict (cols) where <arbiter> do update set … where <update>`, pg/sqlite-typed); **not a
defect** — a §A pin + a bake-time snapshot probe (grep `where .* do update set .* where ` is
empty matrix-wide; every existing test isolates exactly one of the two WHEREs).

### Baked-in scan (R46 backlog just landed) — ALL CLEAN

F-RECENT scanned the 7 R46-backlog files for a test whose `expected`/`toEqual`/snapshot
contradicts its own `assertType<Exact>`:
`select.aggregate-as-array.modifiers.test.ts` · `select.aggregate-as-array-inline-wrapped.test.ts`
(incl. F3-RES-1 double `json_agg`) · `update.from.variants.test.ts` (UD-R1) ·
`mutation.shaped-compositions.test.ts` · `mutation.allow-when.test.ts` ·
`select.value-source.equality-comparison-by-type.test.ts` (EQ boolean.equals) ·
`insert.on-conflict.dynamic-set.test.ts` — **0 contradictions**. Every projecting test types
`body: string | null` with a present `null` value + `'body' in` probe; default-projector/rule-4
tests type `?:` and assert absent-key. No baked-in bug.

### R46-fix positive-arm verification (`0b837af0`) — COMPLETE except BUG-1

Coordinator + F-RECENT + SEL-SEAM + F3-PROJ converged: the flag is threaded at **every**
documented seam — both aggregate-family constructors (2223/2519), all four gate sites per
family (`allowWhen`/`disallowWhen` 2234/2241, 2530/2537), the three array-shape modifiers per
family (2276/2279/2282, 2655/2658/2661), the three base-clone copy-sites (136/148/160), and the
`DBColumnImpl` column-map clones (148/204). `Null*` variants correctly drop it (array→literal
null, element moot — F3-PROJ R1 refuted). Base `asOptional`/`valueWhenNull`/`asRequired` are
not on `AggregatedArrayValueSource`'s interface, so not reachable (F3-PROJ R2 refuted). The
compound + with-view crosses for **projecting-alone** are COVERED (settles the F-RECENT↔SEL-SEAM
contradiction in SEL-SEAM's favour: `select.compound-nested-object.test.ts:614/912`,
`select.complex-projection.inner-rules.test.ts:3213/3267/3387`). The single unpatched clone is
BUG-1's `valueSourceInitializationForInlineSelect`.

### Limitations / inert / known boundaries (OUT — not re-filed)

- **L-1** const/optionalConst/arg/valueArg **custom-temporal** getter → bare
  `extract(part from $1)` (no cast) PG rejects — by-design LIMITATION (custom typeName carries
  no built-in SQL type; user supplies `transformPlaceholder`). Verified `PostgreSqlConnection.ts:94-141`.
- **customInt.modulo(fractional literal)** — **throws** `INVALID_VALUE_TO_SEND_TO_DATABASE:
  Invalid int value … 2.5` at the marshalling layer (probe-confirmed), same class as the
  documented `int.add(2.5)` limitation → not real-validatable. OUT.
- §B **sequence non-numeric value-kinds** — `nextval()`→INTEGER; string/uuid/temporal throw
  INVALID_VALUE, enum/custom distinct-type-only (R-P7), boolean borderline mock-only. OUT.
- **bigint** typed-never trig/cast negative-lock complete (`types.negative/select.test.ts:340-391`).
- **INVALID_MOCKED_VALUE** + the 26 `SQL_*` reasons + non-`illegal state`
  `TsSqlInternalErrorReason`s = queryRunners/driver-mapping/impossible-state layer. OUT.
- **Inert (report-only, no test):** `_extractAdditionalRequiredTablesForUpdate:2410`
  `froms.length < 0`/`joins.length < 0` guard is always-false (no observable effect);
  the `SelectExpressionWitoutWhere` misspelling (5× select.ts, decl+refs agree, compiles) is cosmetic;
  `ReturningMultipleLastInsertedIdOptionalType` ≡ `ReturningMultipleLastInsertedIdType` (redundant alias, by-design).

### Doc-hygiene (report-only)

- **D-1** stale/redundant with-values headers still present (`with-values.test.ts:5-7`,
  `with-values.advanced.test.ts:28-30`) — harmless duplication of each file's lines 2-3.
- **D-5** `with-values.advanced.test.ts:212-213` broken src-ref — **already cleaned** in the R46 backlog.

---

## PART II — Enumerated backlog by surface (each variant one line)

### §A — projection / aggregate-modifier seam (existing fixtures; home `select.aggregate-as-array.*`)

- **PROJ-BUG-1 · T1 · `// TODO[BUG]`** — `forUseAsInlineQueryValue()` over
  `selectOneColumn(aggregateAsArray({id,body}).projectingOptionalValuesAsNullable())`: element
  present-`null` survives (assertType `body: string|null`, `'body' in el`===true, el.body===null).
  Currently FAILS (BUG-1). Fixture `tProject`/`tIssue.forUseInLeftJoin()`/`tIssue.body`.
- **PROJ-T4-1 · T4** — Family1 `aggregateAsArray({id,body}).projectingOptionalValuesAsNullable().disallowWhen(false,'…')`
  present-null (threads flag at `ValueSourceImpl:2537/2539`, untested combined; only `allowWhen(true)` covered at modifiers:641).
- **PROJ-T4-2 · T4** — inline `subSelectUsing(tProject).from(tIssue).where(…).select({id,body}).projectingOptionalValuesAsNullable().forUseAsInlineAggregatedArrayValue().allowWhen(true,'…')`
  present-null (AggregateSelect `allowWhen` 2234/2236; only the 3 modifiers are inline-tested).
- **PROJ-T4-3 · T4** — inline `…forUseAsInlineAggregatedArrayValue().disallowWhen(false,'…')` after projecting, present-null (AggregateSelect `disallowWhen` 2241/2243).
- **PROJ-T4-4 · T4** — compound arm column `aggregateAsArray({id,body}).projectingOptionalValuesAsNullable().useEmptyArrayForNoValue()` inside a `.unionAll(...)` — present-null through `createColumnsFrom:148` + the modifier clone together (projecting-alone compound is covered at compound-nested-object:614; projecting-*then-modifier* is not).
- **PROJ-T4-5 · T4** — compound arm column `…projectingOptionalValuesAsNullable().asOptionalNonEmptyArray()`.
- **PROJ-T4-6 · T4** — compound arm column `…projectingOptionalValuesAsNullable().asRequiredInOptionalObject()`.
- **PROJ-T4-7 · T4** — with-view (`forUseInQueryAs`) column `…projectingOptionalValuesAsNullable().useEmptyArrayForNoValue()` read from outer select — present-null through `createColumnsFrom:148` + modifier clone (projecting-alone with-view covered at inner-rules:3213; then-modifier not).
- **PROJ-T4-8 · T4** — with-view column `…projectingOptionalValuesAsNullable().asOptionalNonEmptyArray()`.
- **PROJ-T4-9 · T4** — with-view column `…projectingOptionalValuesAsNullable().asRequiredInOptionalObject()`.
- **PROJ-T4-10 · T4** — nested-object column (`meta:{ issues: …projectingOptionalValuesAsNullable().asRequiredInOptionalObject() }`) inside a compound OR with-view — hits `createColumnsFromInnerObject:204` (distinct from the 148 top-level copy).

### §A — mutation seam (home `insert.on-conflict.*`)

- **MUT-A-1 · T1** — `insertInto(t).values({…}).onConflictOn(cols).where(arbiter).doUpdateSet({…}).where(update)`: both WHEREs land distinctly (`on conflict (cols) where <arbiter> do update set … where <update>`), pg + sqlite; MariaDB/MySQL typed `never` (NOT-APPLICABLE). Sound pin.
- **MUT-B-1 · T2** — `insertInto(t).values({…}).onConflictOnConstraint(name).doUpdateSet({…}).where(cond)` non-degrade (`on conflict on constraint <name> do update set … where <cond>`), pg only. Distinct from the covered `onConflictOn(cols)…where` overload and from the covered on-constraint degrade.

### §C — update/delete completeness (weigh vs R-P7; home `update.*`/`delete.*`)

- **UD-T4-1 · T4** — `update(t).from(<VALUES source>).set({…}).returning(...)` with `oldValues()` (every oldValues+from test uses a real table; VALUES-from covered only without oldValues).
- **UD-T4-2 · T4** — `update(t).from(aux).set({…}).returningOneColumn(tX.oldColumn)` (returningOneColumn(old) tested only on a from-less UPDATE).
- **UD-T4-3 · T4** — `update(t).from(aux).…returningOneColumn(aux.newColumn)` (returningOneColumn of a from-table column on UPDATE…FROM — grep zero).
- **UD-T4-4 · T4** — `updateAllowingNoWhere(t).set({…}).returning({ o: tX.oldValues()... })` (allowing-no-where × oldValues subquery — untested cross).
- **UD-T4-5 · T4** — `deleteFrom(t).using(aux).returningOneColumn(aux.column)` (returningOneColumn of the USING-table column; object-form returning of it IS covered).
- **UD-close** — the minimal from-nested-returning trigger (`update(t).from(aux).set('plain').where(no-aux).returning({audit:{org:aux.name}})`) is **degenerate**: the extraction methods (`_extractAdditionalRequired{Tables,Columns}ForUpdate` 2421/2452) already flatten nested sub-objects and never scan WHERE, so removing the aux WHERE ref changes only the emitted predicate, not the extraction path (already exercised by `update.with-old-values-and-from.test.ts:180`). Close.

### §C — negative-type locks (owner-optional; technically OUT of Principle-#1 scope)

- **SEL-NEG-1** — `assertType<Exact<recursiveUnion|recursiveUnionOn result, never>>` on `oracle`+`sqlserver` `types.negative/select.test.ts` (restores the typed-never→types.negative convention; sqlite already locks the compound `*All` nevers).
- **SEL-NEG-2** — `@ts-expect-error forUseAsInlineQueryValue is never on a multi-column select` (select.ts:472-478), any cell.
- **SEL-NEG-3** — `@ts-expect-error forUseInQueryAs is never on a correlated select` on sqlServer/oracle/mariaDB (select.ts:465-470).
- **DYN-NEG-1** — a `types.negative/dynamic-condition` rule rejecting a Comparable/String operator on an Equalable-only filter (`{ activity: { lessThan } }` enum, `{ billable: { greaterThan } }` boolean, `{ channel: { like } }` custom) — the EqualableFilter⊄ComparableFilter boundary is unlocked.

### §C — marginal degenerate T4 (list per maximal dial; recommend close under R-P7)

- **EQCMP-T4-1/2** — `double.onlyWhenOrNull` / `double.ignoreWhenAsNull` on a plain-double column (output-coincident with the tested `customDouble` leaf).
- **STR-T4-1** — `vReleaseOverview.versionTagged` fed into { `trim`, `trimLeft`, `trimRight`, `reverse`, `substr`, `substrToEnd`, `substring`, `substringToEnd`, `concat`, `concatIfValue`, `replaceAll`, `replaceAllIfValue`, `length` } (only `.toUpperCase()` covered; the sole structurally-novel member is `concat` = infix `||` around a fragment).
- **STR-T4-2** — `tIssueWorklog.activityTagged` fed into the same 13-method set.
- **CUSTOMNUM-T4-1..6** — `ReleaseTag(customInt)` and `Money(customDouble)` × { `asRequiredInOptionalObject`, `onlyWhenOrNull`, `ignoreWhenAsNull` } (brand-keep through pure optionality modifiers — no runtime value distinguishes from the covered plain-`number` projection; lean OUT).
- **BOOLIF-T4-1..19** — `*IfValue` × custom-boolean-leaf holes (remap literal already pinned by ≥3 siblings each): `equalsIfValue`×{published,invoiced}, `notEqualsIfValue`×published, `isIfValue`×invoiced, `inIfValue`×{verified,published,approved}, `notInIfValue`×{verified,published,approved}, `inN`×{verified,published,approved}, `notInN`×{verified,published,approved}, plain `is`×{verified,published,approved} — all output-coincident.
- **NUM-T4-1..3** — `int.divide(<double column>)`; `int.{power,minValue,maxValue,atan2}(<fractional const>)`; plain-int/plain-double `onlyWhenOrNull(false)`/`ignoreWhenAsNull(false)`/`asRequiredInOptionalObject` null-literal-cast emission (`null` vs `null::int4`) — all emission-equivalent to covered twins.
- **VALVIEW-T4-1..5** — required-`Date` VALUES tuple member (localDate/localTime/localDateTime); no-arg `forUseInLeftJoin()` on a virtual-carrying Values; View no-adapter `virtualColumnFromFragment` per non-string kind; optional sibling-referencing Values virtual; `baseTypeForCustom('BillingRef')→uuid` with a real uuid value (all output-coincident/thin).
- **TEMP-T4-1..3** — getters on adapter-carrying temporal columns (adapter is a no-op on the numeric getter result); `onlyWhenOrNull(true)`/`ignoreWhenAsNull(false)` pass-through projected directly; `valueWhenNull(VS)`/`nullIfValue(VS)` cross-column operand.

---

## PART III — OUT (each class, with reason; so R48 does not re-chase)

| Class | Reason |
|---|---|
| CANDIDATE-A / -B / -C (PARITY stray union, isIfValue over-widen, Shaped `from`) | Type-only / unreachable — no runtime/value surface → not Principle-#1 testable; src-type cleanups for the owner. |
| L-1 custom-temporal const/arg getter bare-`extract` | By-design LIMITATION (user `transformPlaceholder`). |
| customInt.modulo(fractional) | Throws INVALID_VALUE at marshalling (probe-confirmed). |
| §B sequence non-numeric value-kinds | nextval()→INTEGER: throw / distinct-type-only / mock-only. |
| bigint typed-never trig/cast | Negative-locked complete (types.negative 340-391). |
| F2-COL brand-only PK/autogen tails (~130) | Brand not read-observable; SQL+value+type byte-identical to the covered `column`/`column+adapter` twin. |
| INVALID_MOCKED_VALUE, 26 `SQL_*`, impossible-state `TsSqlInternalErrorReason`s | queryRunners / driver-mapping / as-any-only layer. |
| Inert: `froms.length<0` guard, `Witout` typo, redundant `…OptionalType` alias | No observable effect / cosmetic / by-design. |

---

## PART IV — Per-surface saturation

| Agent | Verdict | §A / candidates | Notes |
|---|---|---|---|
| F-RECENT | **1 BUG + T4 tail** | PROJ-BUG-1 + PROJ-T4-1..10 | fix incomplete on inline-query-value clone; baked-in scan clean |
| PARITY | 2 candidates | CAND-A/-C | twin sweep; ALREADY-FIXED twins symmetric |
| MUT-SEAM | 0 bugs | MUT-A-1(T1), MUT-B-1(T2) | double-WHERE sound pin; 5 T4 |
| SEL-SEAM | 0 bugs | SEL-SEAM-1 (= PROJ-T4-4..9) | compound/CTE projecting-alone crosses COVERED |
| F1-EQCMP | Saturated | EQCMP-T4-1/2 | 18/18 leaves × method covered |
| F6-DYN | Saturated | DYN-NEG-1 | 0 positive T4; per-type exhaustive |
| F1-STR | Saturated | STR-T4-1/2 | virtual-tagged × non-toUpperCase transforms |
| F2-COL | Saturated | — | ~130-cell brand-only tail OUT |
| F5-CONN | Saturated | — | every method×kind×arity×adapter covered |
| F4-INSERT | Saturated | — | 464 test() in pg insert cell; shaped/on-conflict/*When/grid covered |
| F3-PROJ | 0 bugs | PROJ-T4-1/2/3 | R1/R2 refuted by direct read |
| F4-UPDDEL | 0 bugs | UD-T4-1..5 | minimal from-nested-returning degenerate |
| F3-SELECT | Saturated | SEL-NEG-1/2/3 | recursiveUnion never-lock symmetry |
| F1-NUM | Saturated | — | modulo per-receiver map complete; §C-1 OUT |
| F1-BOOLIF | 1 candidate | CAND-B + BOOLIF-T4 tail | isIfValue over-widen |
| F1-CUSTOMNUM | Saturated | CUSTOMNUM-T4-1..6 | brand-keep type-only |
| F1-TEMP | Saturated | TEMP-T4-1..3 | L-1 LIMITATION named |
| F2-VALVIEW | Saturated | VALVIEW-T4-1..5 | R44 self-join WITH regression-safe (3 angles) |
| F9-TYPEVAR | Saturated | — | 0 (deferred BUG-1 to coordinator) |
| F7-EXTRAS | Saturated | — | every builder-reachable TsSqlError reason covered |

**Saturated (no runtime-surface item beyond a listed T4 tail): 18/20.** Not saturated
(carry real §A work): F-RECENT (BUG-1 + projecting seam), MUT-SEAM (2 pins).

---

## PART V — Coordinator verification notes

1. **BUG-1** — compile-repro (probe `zzz_r47_probe.test.ts`, deleted): type reveal →
   `{ pid:number; issues?: Array<{ id:number; body: string|null }> }` (present-null element);
   mock boundary-row → candidate `'body' in el === false` (dropped) vs control
   `forUseAsInlineAggregatedArrayValue()` `=== true` (present). Type promises present, runtime
   drops → confirmed soundness bug. Matches the R46/1015-1026 corollary.
2. **F-RECENT ↔ SEL-SEAM contradiction** on the compound/with-view crosses — settled by direct
   grep in SEL-SEAM's favour: `compound-nested-object.test.ts:614/912` +
   `complex-projection.inner-rules.test.ts:3213/3267/3387` cover projecting-**alone**; the residual
   is only projecting-**then-modifier** (PROJ-T4-4..9).
3. **CANDIDATE-A / -B** — divergence confirmed by direct source read (update.ts:525/530/532;
   values.ts:253 vs 254/256/257). Classified type-only (no value surface) → owner rulings, not filed.
4. **F1-NUM §C-1** — mock probe: `costCents.modulo(2.5)` throws INVALID_VALUE at marshalling → OUT.
5. **Fix-completeness grep** — all `new Aggregate*`/`new AllowWhen*`/`new Null*` construction sites +
   flag copy-sites enumerated across `src/`; only `valueSourceInitializationForInlineSelect` (BUG-1)
   omits the flag; all others thread or correctly-drop it.
6. All probes deleted; `git status --porcelain` clean but for this report (+ the pre-existing R41
   untracked audit reports and the `M` runbook/.gitignore, untouched).

---

## PART VI — §B fixture-addition plan

**None.** Every §A/T4 item reuses existing fixtures (`tProject`/`tIssue.forUseInLeftJoin()`/`tIssue.body`
for the projection seam; existing on-conflict/from/using fixtures for the mutation/update seams).

---

## PART VII — Recommended implementation order

1. **BUG-1** — fix `valueSourceInitializationForInlineSelect` in `src/` (thread the flag), then land
   **PROJ-BUG-1** (drop the `// TODO[BUG]`), changelog entry.
2. **T1/seam pins** — MUT-A-1 (double-WHERE), PROJ-T4-1..3 (projecting-then-gate).
3. **T2** — MUT-B-1 (on-constraint non-degrade update-WHERE).
4. **T4 crosses** — PROJ-T4-4..10 (projecting-then-modifier × compound/with-view/nested), UD-T4-1..5.
5. **Negative-type locks (owner-optional)** — SEL-NEG-1..3, DYN-NEG-1.
6. **Marginal T4 churn** — EQCMP/STR/CUSTOMNUM/BOOLIF/NUM/VALVIEW/TEMP tails (mostly close under R-P7).
7. **Owner rulings** — CANDIDATE-A/-B/-C (src-type cleanups); doc-hygiene D-1.

---

## PART VIII — Verdict

An **honest, high-yield round**: 1 confirmed src bug (the R46 fix's last unpatched
projecting-flag clone), plus a compact projection/mutation seam backlog and a fully-enumerated
degenerate tail; 18/20 surfaces re-derived saturated; the R46 backlog baked-in scan is clean and
the R46 fix's positive arm is verified complete except for BUG-1. The bug is the third consecutive
round the runbook's shared-flag-clone corollary (§7.4 lines 1015-1026) has fired — the fingerprint
holds; **no runbook edit** (a defect matching an existing fingerprint needs none). The two type-only
candidates (PARITY stray union, isIfValue over-widen) are surfaced for owner ruling, not filed, per
degeneracy-by-non-validatability. `BUGS.md` carries the one confirmed entry.
