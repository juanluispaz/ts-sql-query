# MISSING_TESTS_AUDIT_48 — type-driven missing-tests audit (Round 48)

**Mandate.** Maximal-saturation, type-driven, multi-agent audit aimed at CLOSING total
coverage of the typed surface: classify every reachable type-path COVERED / TO-WRITE
(T1-T4) / OUT, adversarially re-verify every prior degenerate/OUT closure (§7.5), and
confirm no type-vs-impl / type-vs-runtime divergence is left unfiled. This report is an
exhaustive item-by-item backlog.

**Method.** 20 read-only discovery agents (one per surface), ≤10 concurrent; coordinator
compile-repro'd / mock-probed / re-read every load-bearing claim. Reference cell
`postgres/newest/pg/`; matrix symmetric (17 cells).

**Pre-flight.** N=48. `tests:audit` → **17 cells / 247 files / 3894 tests per cell** (66 198
total, symmetric) — up from 3876 (R47) as R47's backlog (+15 tests, +4 negative-locks) and
the R47 bug fix (`b055fc39`, +3-test 18-cell) landed. `BUGS.md` = *None open*.

**Headline.**
- **The `projectingOptionalValuesAsNullable` flag family is CLOSED** — proven THREE
  independent ways (F-RECENT full clone-site enumeration, SEL-SEAM compile-repro, F3-PROJ
  reconstruction-path trace) plus a coordinator compile+runtime probe. The R47 fix made the
  base `ValueSourceImpl` ctor the *single canonical carrier*; a full `src/` sweep shows every
  clone copying `__aggregatedArrayColumns` also copies the flag, `Null*` variants are
  correctly exempt, and the two theoretical remaining holes (base `asOptional` /
  re-`projectingOptionalValuesAsNullable`) are **type-unreachable** on an aggregate
  (`forUseAsInlineQueryValue` returns a plain `AggregatedArrayValueSource` exposing neither).
  The R44→R47 whack-a-mole is over. Baked-in scan of the whole R47 backlog + fix tests = clean.
- **BUT the maximal §7.5 adversarial re-check surfaced 2 NEW confirmed src bugs** — both
  probe-confirmed, filed to `BUGS.md`. This is the method working exactly as intended as
  saturation approaches: with the per-surface matrices saturated, the marginal defect moves to
  the seams/utility-types the adversarial lens re-opens.
- **18/20 surfaces re-derived SATURATED.** Genuine §A backlog is small (4 real items + a thin
  T4 tail). **§B: 0.**

---

## PART I — Confirmed bugs, candidates, verifications

### BUG-1 (CONFIRMED — filed) · type-vs-intent · `UpdatableOnInsertConflictRowShapedAs` over-restrictive

`src/extras/types.ts:56-57` defines the shaped on-conflict **Row** utility type as the
**Values** (literal-only) form — a copy-paste slip:
```ts
export type UpdatableOnInsertConflictRowShapedAs<TABLE, SHAPE> =
    MakeTypeVisible<OnConflictUpdateValues<TABLE, ResolveShape<TABLE, SHAPE>>>   // ← Values form (literal-only)
```
identical to `UpdatableOnInsertConflictValuesShapedAs` (58-59). Every other `*RowShapedAs`
and the non-shaped sibling delegate to a value-source-accepting `*SetsContent`:
`UpdatableOnInsertConflictRow` (47) → `OnConflictUpdateSetsContent`; `InsertableRowShapedAs`
(52) → `MandatoryInsertSetsContent`; `UpdatableRowShapedAs` (67) → `UpdateSetsContent`.

- **Compile-repro (confirmed):** on `tAppUser` + a rename shape, `const x:
  UpdatableOnInsertConflictRowShapedAs<…> = { newFullName: tAppUser.fullName }` **errors**
  (`@ts-expect-error` satisfied), while the non-shaped `UpdatableOnInsertConflictRow` control
  and the sibling `InsertableRowShapedAs`/`UpdatableRowShapedAs` controls compile with a value
  source. So the shaped on-conflict Row variant is the lone one that rejects value sources.
- **Docs contract violated:** `docs/advanced/utility-types.md` states the Row variant "admits
  valid SQL objects that you can use in the `onConflictDoUpdateSet` sentence, where
  `UpdatableOnInsertConflictValues` does not."
- **The existing test enshrines the bug:** `docs.advanced.utility-types.test.ts`
  (`docs-extra:utility-types/updatable-on-insert-conflict-row-shaped-as-equals-values`) asserts
  `Exact<ConflictRowShaped, ConflictValuesShaped>` — the "test whose assertType contradicts
  documented intent = documents a bug" fingerprint (§9). Once fixed it should probe a value
  source under a shaped key + a `keyof` pin against the Values sibling (like the sibling
  Row-shaped tests at lines 231/265).
- **Fix scope (do NOT fix from audit):** `UpdatableOnInsertConflictRowShapedAs` →
  `MakeTypeVisible<OnConflictUpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[typeof
  source]>, ResolveShape<TABLE, SHAPE>>>`; then swap the enshrining test's `Exact`-to-Values
  for a value-source probe + `keyof` pin, and add a `// TODO[BUG]` until fixed.

### BUG-2 (CONFIRMED — filed) · type-vs-runtime soundness · cross-join operator-merge object with a const anchor drops at runtime

A nested projection object whose table-bound presence comes from a **single leaf merging two
different left joins** via an operator, PLUS a no-table const member, types the object as
**required** (rule-3, the const anchors it) but the **runtime drops the whole object** on a
partial join miss.

- **Probe (confirmed both sides):** with `tProjLeft = tProject.forUseInLeftJoin()`,
  `tAssigneeLeft = tAppUser.forUseInLeftJoin()`:
  `select({ iid: tIssue.id, obj: { combined: tProjLeft.id.add(tAssigneeLeft.id), tag:
  conn.const('rel','string') } })` (both left-joined on tIssue).
  - Type reveal: `obj: { combined?: number; tag: string }` — **obj is a REQUIRED key**,
    `tag` required.
  - Runtime partial miss (`obj.combined: null`, `obj.tag: 'rel'`): **`'obj' in row === false`**
    — the whole object is DROPPED. Both-hit control (`combined: 5`): obj present, combined 5.
  - So `row.obj.tag` (typed `string`, always present) is `undefined` at runtime → crash.
- **Where:** the type computes rule-3 via `AllFromSameLeftJoinWithOriginallyRequired`
  (`src/complexProjections/projectionRules.ts:67`); the runtime rule-2 drop-gate is
  `AbstractQueryBuilder.ts:303` (`if (alwaysSameRequiredTablesSize && onlyOuterJoin &&
  !originallyRequiredHaveValue)`), fed by the size accounting at 244-267. The merged leaf
  registers a size-2 required-tables set `{project, app_user}`; because it is the *only*
  table-bound leaf, `alwaysSameRequiredTablesSize` stays true → the runtime applies rule-2
  (drop) even though the const `tag` should anchor the object (rule-3).
- **Both readings (maintainer picks):** (a) the TYPE is too loose — narrow `obj` to optional
  (`obj?`) so absent-at-runtime is sound; (b) the RUNTIME over-drops — keep the object carrying
  the const, matching the covered *separate-leaves* precedent
  `two-different-left-joins-plus-const-promotes-to-rule-3`
  (`select.complex-projection.mixed-rules.test.ts:804`, where two joins as **separate** leaves
  + a const yield rule-3 and the object survives). The precedent leans (b): the merge into one
  leaf is what makes the runtime misfire.
- **Boundary (sound, keep as control):** the NO-const variant (`obj: { combined:
  tProjLeft.id.add(tAssigneeLeft.id) }`) types `obj?: { combined?: number }` (rule-2 optional)
  and the runtime drops it — type and runtime agree, sound. Only the const-anchor case diverges.
- **Test to write (carries `// TODO[BUG]`):** the with-const probe above, asserting the
  intended shape (obj present carrying the const, `combined` absent) — currently fails.

### Type-only candidates (owner ruling; NOT filed — no runtime/value surface → not Principle-#1 testable)

- **CAND-A** `update.ts:532` sqlite `returningOneColumn` stray `| NOldValuesFrom` OUTSIDE
  `ValueSourceOf` (re-confirmed present + provably dead — sqlite has no `oldValues()`;
  inconsistent with the row-twin 525 (no old-values) and delete sibling 188 (clean)). Src cleanup.
- **CAND-C** `ShapedInsertExpression` has no `from` → the `SHAPE` param of
  `CustomizableExecutableInsertFromSelect` is vestigial (only ever `undefined`). Drop the param
  or add shaped INSERT…SELECT. Src cleanup.
- **CAND-D** `values` overload order diverges (non-shaped array-first `insert.ts:614-615`;
  shaped single-first `628-629`); resolution is order-insensitive. Cosmetic normalize.
- **CAND-E** `WithableExecutableSelect` (`select.ts:81`) vs `WithableExecutableSelectWithoutWhere`
  (`87`) are a structural duplicate (identical extends + members). Consolidation candidate.
- **CAND-F (BOOLIF)** `isIfValue` (`values.ts:253`) propagates `OPTIONAL_TYPE` while
  `is`/`isNot`/`isNotIfValue` force `'required'`; `is not distinct from` never yields NULL, so
  it over-widens (safe direction). Same `_is` operator/runtime SQL as `is` → no value surface.
- **CAND-G (F2-COL)** `optionalComputedColumn` runtime-sets `__writable=true` while
  `computedColumn` leaves it false (`Table.ts:352/386`); not type-reachable (public type omits
  the writable brand). Internal inconsistency.
- **Interface name typo** `…SelectExpressionWitoutWhere` ("Witout"), 5 sites in select.ts
  (decl+refs agree → compiles). Cosmetic.

### Inert / report-only observations (not filed)

- **SEL-SEAM O-1** `allowWhen`/`disallowWhen` return `this`, so an array-shape modifier chained
  *after* a gate rebuilds a plain source and drops the gate
  (`.disallowWhen(true,'blocked').useEmptyArrayForNoValue()` would not throw). General
  `ValueSource` behavior, no type marker that the gate persists → not a soundness defect (drop ≠
  defect); normal usage is modifier-first/gate-last. Owner note.
- `_extractAdditionalRequiredTablesForUpdate:2410` `froms.length<0`/`joins.length<0` always-false
  guard (inert); `ReturningMultipleLastInsertedIdOptionalType ≡` its non-optional twin (redundant
  alias, by-design — multiple on-conflict shortens the array, no null elements).

### Doc-hygiene (report-only)

- **D-1** redundant with-values header trailer still present (`with-values.test.ts:5-7`,
  `with-values.advanced.test.ts:28-30`, ~34 files). Cosmetic.
- **DYN-comment** `dynamic-condition.operators.test.ts:10` header lists "between (object form
  with min/max)" — no such operator/test exists (stale). Cosmetic.

### R47-fix positive-arm verification (`b055fc39`) — COMPLETE

Family closed (see Headline). Coordinator probe: the R47 bug path now keeps present-null
(`hasBodyKey: true`), and the two flag-stripping holes are type-unreachable (both
`@ts-expect-error` satisfied). Baked-in scan of the whole projecting-flag backlog + fix tests =
0 assertType-vs-value contradictions.

---

## PART II — Enumerated §A backlog (existing fixtures)

- **PROJ-BUG-1 · T1 · `// TODO[BUG]`** — BUG-2 regression: cross-join-merged-leaf object with a
  const anchor keeps the object present (carrying the const) on a partial miss. Fixture
  `tIssue` + `tProject.forUseInLeftJoin()` + `tAppUser.forUseInLeftJoin()`. Currently FAILS.
- **EXTRAS-BUG-1 · `// TODO[BUG]`** — BUG-1 regression: replace the on-conflict Row-shaped
  `Exact`-to-Values test with a value-source probe + `keyof` pin (home
  `docs.advanced.utility-types.test.ts`). Currently would fail once the type is fixed; the
  marker documents the intent.
- **SEL-REQ-INLINE · T2** — `selectCountAll().forUseAsInlineQueryValue()` (the `requiredResult`
  branch, `select.ts:472-478`) — the only path to a **non-optional** inline scalar subquery
  (`projectCount: number`), zero occurrences repo-wide. Pair against the covered optional twin
  `selectOneColumn(count(x)).forUseAsInlineQueryValue()` (→ `n?: number`). Fixture
  tOrganization/tProject correlated. Real-validatable, correct-by-design (count returns one row).
- **INS-MULTI-BARE-UPSERT · T4** — multi-row `.values([rows])` chained to a **bare**
  `onConflictDoUpdateSet`/`…SetIfValue`/`…DynamicSet` (no-target upsert on the
  `CustomizableExecutableMultipleInsert` receiver). Type-reachable on sqlite/mariadb/mysql; 0
  live tests; output-distinct (`INSERT … VALUES (…),(…) ON DUPLICATE KEY UPDATE …`).
  Real-validatable on **mariadb** (richest: `.returningLastInsertedId()`/`.returning({…})`) and
  **mysql** (`.executeInsert()`-only); SQL-bake on sqlite with a real-DB LIMITATION note (sqlite
  rejects no-target DO UPDATE). Shaped counterpart (`ShapedExecutableMultipleInsertExpression`
  bare-doUpdate) uncovered too.
- **MUT-FROMSELECT-UPSERT-WHERE · T4** — from-select upsert
  `insertInto(t).from(select).onConflictOn(cols).doUpdateSet({…}).where(pred)` (pg/sqlite). The
  VALUES path pins this WHERE; the from-select suite omits it (0 matrix occurrences). Symmetry
  closure; low correctness risk (WHERE emission is source-independent).
- **PROJ-A-1 (F3-PROJ) · T4** — the single-query **split**: builder-level
  `.projectingOptionalValuesAsNullable()` co-selected with a **bare** `aggregateAsArray({...})`
  carrying an optional leaf, asserting in ONE row that the flat optional leaf surfaces
  present-`null` (builder flag) WHILE the bare aggregate's element null-leaf is dropped (aggregate
  default) — the two-flag independence guarding `AbstractQueryBuilder:81`. Currently proven only
  by two juxtaposed separate tests + a doc comment.

## PART II-b — Output-coincident T4 tail (each hop independently proven; close under R-P7 or land thin)

- **SEL-T4-1** projecting → modifier → GATE 3-hop chain
  (`…projectingOptionalValuesAsNullable().useEmptyArrayForNoValue().allowWhen(true,…)` +
  disallowWhen / other-modifier variants) × {Family1, inline}. (= F3-PROJ C-1.)
- **SEL-T4-2** projecting → gate → modifier (`…projectingOptionalValuesAsNullable().allowWhen(true,…).useEmptyArrayForNoValue()`).
- **SEL-T4-3** `forUseAsInlineQueryValue` one-column projecting aggregate placed **inside a
  compound arm** / **nested-object inner leaf** / **with-view CTE** (the `forUseAsInlineAggregatedArrayValue`-of-compound twin is covered). (= F3-PROJ C-2.)
- **SEL-T4-4** adapter-carrying-column aggregate then modifier (adapter threaded by `createColumnsFrom`).
- **UD-T4-1 (F4-UPDDEL §C-1)** `oldValues()` × `.from(j1).innerJoin(j2).on(...)` returning a
  join-brought-in column (concatenation of two pinned shapes).
- **PROJ-A-2** nested-rule outer×inner combos 1-3/3-1/3-3/3-4/4-3 (output-coincident/unreachable).
- **PROJ-A-3** rule-2/rule-3 on INSERT/UPDATE/DELETE returning nested object with a join (feature-cross).

## PART II-c — Negative-type locks (owner-optional; technically OUT of Principle-#1 scope)

- **DYN-NEG (R48)** a `types.negative/dynamic-condition` lock rejecting `{ comparableCol: {
  between } }` (between exists on the value source but not the dynamic filter — documents the surprise).

---

## PART III — OUT (each class, with reason)

| Class | Reason |
|---|---|
| CAND-A..G + Witout typo + SEL-SEAM O-1 | Type-only / not-type-reachable / general-behavior → owner cleanups, not tests. |
| L-1 custom-temporal const/arg getter bare-`extract` | By-design LIMITATION (user `transformPlaceholder`). |
| customInt.modulo(fractional) | Throws INVALID_VALUE at marshalling (R47 probe). |
| §B sequence non-numeric value-kinds | nextval()→INTEGER: throw / distinct-type-only / mock-only. |
| bigint/customInt extended math typed-never | Negative-locked complete. |
| F2-COL brand-only PK/autogen tails (~130) | Brand not read-observable; SQL+value+type byte-identical. |
| 26 `SQL_*`, INVALID_MOCKED_VALUE, impossible-state reasons, queryRunner-thrown transaction/OUT_PARAMS/... | Driver/runner layer, not the typed builder surface. |
| Brand keep/erase through operators | Phantom marker, same runtime value → negative-type only. |
| `requiredInOptionalObject` at top level | `__transformRootObject` applies no rule-1 → value-coincident with plain-optional. |

---

## PART IV — Per-surface saturation

| Agent | Verdict | Items |
|---|---|---|
| F-RECENT | **Family CLOSED** | 0 bugs; projecting-flag family provably complete; baked-in clean |
| PARITY | Saturated | CAND-A/C/D/E + typo (type-only) |
| MUT-SEAM | 0 bugs | MUT-FROMSELECT-UPSERT-WHERE (§A T4) |
| SEL-SEAM | 0 bugs | SEL-T4-1..4; O-1 (report-only); family closure compile-repro'd |
| F1-EQCMP | Saturated 18/18 | R47 "double degenerate" rationale corrected (distinct emission already tested) |
| F6-DYN | Saturated | 0 positive T4; stale-comment note |
| F1-STR | Saturated | T4-STR closure holds (virtual path has no parenthesization) |
| F2-COL | Saturated | brand-only OUT tail re-confirmed; CAND-G (report-only) |
| F5-CONN | Saturated | all 4 R47 residuals confirmed genuine closures |
| F4-INSERT | 1 §A | INS-MULTI-BARE-UPSERT (multi-row bare onConflictDoUpdate) |
| F3-PROJ | 0 bugs | PROJ-A-1 (single-query split); family sound |
| F4-UPDDEL | Saturated | UD-T4-1 (oldValues × join returning) |
| F3-SELECT | 1 §A | SEL-REQ-INLINE (selectCountAll inline required) |
| F1-NUM | Saturated | full modulo/cast/promotion matrix covered |
| F1-BOOLIF | Saturated | CAND-F (type-only) |
| F1-CUSTOMNUM | Saturated | bare-null already covered; brand-keep OUT |
| F1-TEMP | Saturated | custom bare-null already covered; L-1 holds |
| F2-VALVIEW | Saturated | 5 R47 T4 re-confirmed degenerate; R44 hoist regression-safe |
| F9-TYPEVAR | **1 BUG** | BUG-2 (cross-join-merge soundness); other closures re-verified |
| F7-EXTRAS | **1 BUG** | BUG-1 (conflict Row-shaped over-restrictive); rest saturated |

**Saturated (no runtime-surface item beyond a listed T4 tail): 18/20.** Not saturated:
F9-TYPEVAR + F7-EXTRAS (the 2 bugs).

---

## PART V — Coordinator verification notes

1. **Family closure** — compile probe: present-null type holds AND both flag-stripping holes'
   `@ts-expect-error` satisfied (type-unreachable); runtime probe: candidate `hasBodyKey: true`.
   Confirms F-RECENT + SEL-SEAM + F3-PROJ.
2. **BUG-1** — compile-repro: the shaped on-conflict Row rejects a value source
   (`@ts-expect-error` satisfied) while the non-shaped + sibling RowShapedAs controls accept it.
3. **BUG-2** — type reveal `obj: { combined?; tag: string }` (required); runtime partial-miss
   (`combined:null, tag:'rel'`) drops obj (`'obj' in row === false`); both-hit keeps it. No-const
   variant sound (`obj?` + drop agree). Precedent `…promotes-to-rule-3` (mixed-rules:804) leans
   "runtime over-drops."
4. **F1-EQCMP §7.5** — R47 mislabeled `double.onlyWhenOrNull` as degenerate; it is a distinct
   emission (`null::float8` vs custom bare `null`) but the test already exists in all 17 cells —
   tree correct, rationale corrected.
5. All probes deleted; tree clean but for this report + the 2 BUGS.md entries (R41 runbook/.gitignore untouched).

---

## PART VI — §B fixture-addition plan
**None.** Every §A/T4 item reuses existing fixtures.

## PART VII — Recommended implementation order
1. **BUG-1 + BUG-2** — fix in `src/` (owner picks BUG-2's side: narrow type vs fix runtime),
   land PROJ-BUG-1 / EXTRAS-BUG-1 (drop the TODO[BUG]s), changelog.
2. **§A** — SEL-REQ-INLINE (T2), then INS-MULTI-BARE-UPSERT, MUT-FROMSELECT-UPSERT-WHERE, PROJ-A-1 (T4).
3. **Output-coincident T4 tail** — SEL-T4-1..4, UD-T4-1, PROJ-A-2/A-3 (close under R-P7 or land thin per the close-saturation directive).
4. **Negative-type lock** — DYN-NEG (owner-optional).
5. **Owner rulings** — CAND-A/C/D/E/F/G + typo + O-1; doc-hygiene D-1, DYN-comment.

## PART VIII — Verdict

The round achieves its goal on the biggest front: **the projectingOptionalValuesAsNullable flag
family — six rounds of whack-a-mole — is provably CLOSED** (canonical-carrier fix, four
independent confirmations incl. a type-unreachability proof). That is the durable saturation the
effort was chasing on that surface. And precisely because the per-surface matrices are now
saturated, the maximal §7.5 adversarial pass surfaced **2 new confirmed src bugs** in the seams
it re-opened — a type-vs-intent utility-type slip (BUG-1) and a genuine type-vs-runtime
projection soundness bug (BUG-2) — both probe-confirmed and filed. The remaining §A backlog is
small and thin (4 real items + an output-coincident tail), consistent with a surface at the edge
of total saturation. `BUGS.md` carries the 2 confirmed entries; the type-only candidates are
surfaced for owner ruling, not filed.
