# MISSING_TESTS_AUDIT — Round 34

**Mandate this round:** deep, extensive, **generous** type-driven missing-tests audit — drive the suite toward *total coverage of the typed surface*, enumerating the full Tier-3 per-variant completeness tail, not only the headline gaps. Degeneracy bar in force: the **narrow** bar (§4) + the four mis-filed classes + the §7-item-5 discipline (adversarially re-check the confident §C/"saturated" DROPS, not only the §A claims).

**Method:** 20 read-only discovery agents in two waves of ten (surface decomposition per runbook §6), led by the parity sweep, the two seam critics, F-RECENT (pointed at the three fresh src fixes) and F9-TYPEVAR. Every load-bearing claim coordinator-verified myself — compile-repro for reachability/type, runtime-probe for emission/throw, wide-grep for absence. (One agent, F4-UPDDEL, died on an API error mid-run and was re-dispatched; all 20 surfaces have a real report.)

**Headline counts:**
- **Bugs: 0.** One CANDIDATE-DEFECT surfaced (SEL-SEAM) and was **probed clean** — not a defect.
- **§A missing tests: 7 findings** (2 Tier-1 · 1 Tier-2 · 4 Tier-3), **all closeable with existing fixtures** — **§B needs-new-fixture: 0.**
- **Surfaces returning SATURATED: 12** (a mature-suite result — see table).
- Fresh src fixes (07edb90f / b5dc3f2e / 920d5c97) audited on their positive/newly-reachable arms: **all covered** except the Tier-3 corners below (§A-1/§A-3).

`BUGS.md` is empty and stays empty this round.

---

## BUGS (confirmed type-vs-impl divergences)

**None.** A whole round validly closes with zero confirmed bugs at high maturity (runbook §7 / "where this runbook ends"). The one candidate that reached the coordinator was refuted by a runtime probe (below).

### CANDIDATE-DEFECT probed and REFUTED — recursive count-query customize hooks

SEL-SEAM flagged `recursive result × executeSelectPage × customizeQuery({beforeQuery,afterQuery})` as bug-vs-boundary: the count path (`__buildSelectCount`) *delegates* to `recursiveSelect.__buildSelectCount`, and `__applyRecursiveCustomization` sets `outerSelect.__customization` — so it was unclear whether the hooks survive onto the count query (reading a) or get dropped (reading b).

**Coordinator runtime-probe (deleted after use):** built the composition on the mock, read `ctx.history[1].sql` (the count query). Result — hooks **survive**, riding the `result_for_count` wrap (doubly-nested, valid SQL):
```
with recursive recursive_select_1 as (…), result_for_count as (/* head */  select … from recursive_select_1 order by id  /* tail */) select count(*) from result_for_count
```
This is **reading (a) — correct**, matching the plain/compound count-wrap shape. **Not a defect.** It remains an untested-but-valid composition → filed as §A-2 (bake the snapshot). Per the drop≠defect oracle: the customized clause survives (the count query's inner select still exists to host the hooks), so there was never a drop.

---

## §A — Missing tests (grouped by theme, tiered by risk). All closeable on existing cells + existing fixtures.

### Tier 1 — distinct code-path / seam composition / input-classification boundary

**§A-2 — recursive result × `executeSelectPage()` × `customizeQuery(...)` — count-query emission** *(SEL-SEAM; coordinator-probe-verified)*
The count-path × customize matrix is covered for **plain ✓ / distinct ✓ / grouped ✓ / compound ✓** but **recursive ✗** (grep = 0 across the whole tree; recursive-page tests exist without customize, recursive-customize tests exist without page, never both). Probe-confirmed emission (above) is valid and distinct from every tested count path.
- **Test:** `.recursiveUnionAll(fn).orderBy('id').limit(2).customizeQuery({beforeQuery, afterQuery}).executeSelectPage()` — assert `history[0].sql` (data) and `history[1].sql` (the doubly-nested `result_for_count` count wrap) + `page.count`/`page.data`. Add a second case with the outer-projection hooks (`afterSelectKeyword`/`beforeColumns`/`customWindow`) to pin whether they ride the recursive count wrap too (§A-2b).
- **Home:** `cte.recursive-union-variants.test.ts` (reference cell), propagate to all 17 cells.
- **Fixtures:** `tIssue` (existing). No new fixture.

**§A-4 — `projectingOptionalValuesAsNullable()` twin of "a nested object kept REQUIRED solely by a required inner object"** *(F3-PROJ; grep-verified absent)*
The DEFAULT (asUndefined) projector covers it (`select.complex-projection.inner-rules.test.ts` → `mixed-container-required-object-inner-plus-optional-inner-keeps-container-required-default`). The **asNull** projector twin is **absent matrix-wide** (grep: only the `-default` name exists, no `-nullable` sibling). This is a distinct input-classification path — it hits `ResultObjectValuesProjectedAsNullable2`'s `ContainsRequired` arm *via required-inner-object classification* rather than an own required scalar; the two projectors are **separate code** and every existing asNull rule-3 test drives required-ness via an own required *scalar*.
- **Test:** the same shape under `projectingOptionalValuesAsNullable()` — expected `container: { req: { title; num }; opt: { gate; extra: number | null } | null }`. **Per the container-optionality oracle (runbook §9), the test MUST runtime-probe the boundary row** (`mockNext` the `opt.gate = null` case): assert `container` present (`req` intact), `container.opt === null` (not absent, asNull mode), `'container' in row === true`; plus an all-non-null row showing `opt` present. (No soundness bug is expected — `req`'s columns are always present — but the null-vs-present value distinction is the untested unit.)
- **Home:** `select.complex-projection.inner-rules.test.ts`.
- **Fixtures:** existing. No new fixture.

### Tier 2 — distinct execute-shape / guard arm (shared dispatcher, observably distinct)

**§A-1 — single-row `values({...}).returningLastInsertedId().executeInsert(min[, max])` — the count-from-scalar-id guard arm** *(MUT-SEAM + F4-INSERT converged; grep-verified)*
`InsertQueryBuilder.executeInsert` computes the min/max guard `count` via three arms: `Array.isArray(result)→length` (tested, multi-row), `else if (returningLastInsertedId)→(result==null?0:1)` (**UNTESTED**), `else→rowcount` (tested, single-row plain). Arm #2 is reached only by a **single-row** last-id chain (scalar id, not array). Grep-confirmed: every guarded `returningLastInsertedId().executeInsert(<n>)` in the whole matrix uses the multi-row `values([...])` array form; no `values({...})` (object) form exists. This completes the maintainer's own 2×2 (multi-row+guard and single-row-plain+guard both exist).
- **Test:** `.values({...}).returningLastInsertedId().executeInsert(1,1)` → resolves the id (count 1 in range); `.executeInsert(2)` → `MINIMUM_ROWS_NOT_REACHED`; `.executeInsert(0,0)` → `MAXIMUM_ROWS_EXCEEDED`. Real-DB-validatable (a real single insert always yields count 1).
- **Home:** `insert.execute-variants.test.ts` (beside the multi-row twin).
- **Fixtures:** `tOrganization`/`tProject` (existing). No new fixture.

### Tier 3 — per-variant completeness (distinct type / emission / value; promoted per §4 discriminator)

**§A-3 — empty-batch `values([]).returningOneColumn(c)` — the one-column short-circuit arm** *(F-RECENT; promoted from §C per §7-item-5; compile-repro-verified)*
Two agents (MUT-SEAM, F4-INSERT) filed this **§C-degenerate** ("the empty short-circuit precedes the `__oneColumn` branch → same src line"). Coordinator compile-repro **overturns the §C**: all three chains typecheck and produce a **distinct scalar result type** vs the covered row-shape object arm:
| chain | inferred type (repro `assertType<Exact>` held) | inhabitant |
|---|---|---|
| `values([]).returningOneColumn(id).executeInsertNoneOrOne()` | `number \| null` | → null |
| `values([]).returningOneColumn(id).executeInsertOne()` | `number` | → NO_RESULT throw |
| `values([]).returningOneColumn(id).executeInsertMany()` | `number[]` | → [] |
Per the §4 discriminator, a differing **declared type** makes it a distinct path; the shared short-circuit is a *severity* note, not a degeneracy disqualifier (the same shape as MUT-SEAM's own §A-1 reasoning). This is exactly the "two agents over-file a distinct-typed path as degenerate" case §7-item-5 guards against.
- **Test:** 3 tests asserting the scalar type + `toBeNull()` / `reasonOf(caught)==='NO_RESULT'` / `toEqual([])`.
- **Home:** `errors.insert-guards.test.ts` (byte-symmetric with the existing row-shape empty-batch tests).
- **Fixtures:** `tProject.id` (existing). No new fixture.

**§A-6 — the modifier trio `asRequiredInOptionalObject` / `onlyWhenOrNull` / `ignoreWhenAsNull` on the temporal leaves** *(F1-TEMP, corroborated by F1-BOOLIF; grep-verified absent)*
These three are **redeclared per-leaf** (values.ts, per temporal interface). The suite established per-leaf granularity for them — dedicated `modifier-trio-on-{enum,custom-channel,custom-comparable-version,custom-boolean}-leaf` tests exist — but **temporal is the missing sibling set**: grep over all `test/db` for `(temporal col).(asRequiredInOptionalObject|onlyWhenOrNull|ignoreWhenAsNull)(` = **0 hits**. `onlyWhenOrNull`/`ignoreWhenAsNull` emit distinct build-time NULL substitution (`null` / `null::<type>`) never observed on a Date-typed leaf; `asRequiredInOptionalObject` emits a `requiredInOptionalObject` result-shape. §4 class-2 (per-leaf-redeclared Nullable family). Moderate value (shared base dispatcher, representative-tested on non-temporal leaves) but a legitimate uncovered per-leaf type-path.
- **Test:** one coherent `modifier-trio-on-temporal-leaves` (e.g. `workDate` localDate + `cutoffTime` customLocalTime + `signedOffAt` customLocalDateTime) — SQL + result-shape + value.
- **Home:** `select.value-source.null-and-if-value-modifiers.test.ts`.
- **Fixtures:** existing temporal columns. No new fixture.

**§A-5 — `dynamicWhere()`-elides-WHERE twin for UPDATE + DELETE** *(F4-UPDDEL; grep-verified)*
`select(...).dynamicWhere()` with no `.and()`/`.or()` (the documented safety-guard escape hatch → executes with no WHERE) has a SELECT test (`select.conditional.test.ts:211 dynamicWhere/no-condition-elides-where`) but **no UPDATE/DELETE twin**: every `dynamicWhere()` in `update/delete.where-in-subquery.test.ts` is followed by at least one `.and(...)`. The bare-empty form reaches `DynamicExecutableUpdateExpression`/`...Delete` (executable, no predicate) — a distinct reachable builder state.
- **Test:** `update(t).set({...}).dynamicWhere().executeUpdate()` and `deleteFrom(t).dynamicWhere().executeDelete()` — assert `update … set …` / `delete from …` with **no** WHERE clause (not an empty WHERE) + the count value. Low tier (emission byte-identical to `allowingNoWhere`), but completes the SELECT symmetry the maintainer chose to test.
- **Home:** `update.where-in-subquery.test.ts` / `delete.where-in-subquery.test.ts`.
- **Fixtures:** existing. No new fixture.

**§A-7 — per-column adapter (`plusOffsetAdapter`, read +1000) propagation through a NON-`add` arithmetic method on `releaseOrdinal`/`optionalReleaseOrdinal`** *(F1-CUSTOMNUM §B1; promoted per §4 class-4 + §7-item-5; grep-verified)*
Grep: the *only* arithmetic on these adapter-bearing customInt view columns is `optionalReleaseOrdinal.add(` (the required `releaseOrdinal` is never fed into arithmetic at all). A second method — `subtract`/`modulo`/`minValue`/`valueWhenNull` — emits **distinct SQL** (`col - $p`, etc.) and produces a **distinct value** ((raw result) +1000). F1-CUSTOMNUM filed it "degenerate-adjacent" (shared `getTypeAdapterN` mechanism); the §4 discriminator says the differing emission+value makes it a distinct path — the shared-mechanism argument is a severity note. Low priority, docker-observable.
- **Test:** e.g. `optionalReleaseOrdinal.subtract(1 as ReleaseTag)` → raw `(x-1)+1000`; add one non-add method on the *required* `releaseOrdinal` too. Value-validate under `--docker`.
- **Home:** `select.value-source.custom-numeric.test.ts`.
- **Fixtures:** `vReleaseOverview.releaseOrdinal`/`optionalReleaseOrdinal` (existing). No new fixture.

---

## §B — deferred / low-priority completeness (existing fixtures, borderline-degenerate)

Surfaced for the "prefer excess" record; each is a defensible drop, promotable only in a maximal wave.
- **§B-a (F3-PROJ):** two asNull twins with no `projectingOptionalValuesAsNullable()` sibling — depth-4 sole-optional CHAIN (`multi-level-sole-optional-chain-depth-4-*`), and `rule-2-wrapper-of-sole-rule-2-inner-with-const-required-leaf`. Degenerate: deep null-propagation on asNull is pinned by the depth-3 asNull twins + `level-5-optional-container-projecting-optional-values-as-nullable`; the rule-2 arm itself is covered.
- **§B-b (F4-UPDDEL):** `executeUpdateMany(min,max)` / `executeDeleteMany(min,max)` **in-range PASS** with a RETURNING shape (only the THROW arms are covered for the many-path). Degenerate: the `rows.length` guard is the same shared post-processing as the count-path pass (which IS covered).

**No §B item needs a new fixture.** The shared `domain/connection.ts` already exposes everything the §A tests need.

---

## OUT-adjacent — a negative-type lock worth surfacing (types.negative scope, OUT of Principle-#1)

**PARITY §B-1 — `executeInsertOne` deliberately dropped on `ExecutableInsertReturningOptional`, but not negatively locked.** `ExecutableInsertReturning` declares `executeInsertNoneOrOne`+`executeInsertOne`+`executeInsertMany`; its twin `ExecutableInsertReturningOptional` (reached via `onConflictDoNothing().returning(...)` / on-conflict do-update → returning) deliberately drops `executeInsertOne` (an ON CONFLICT DO NOTHING may insert zero rows, so "exactly one" is unsound). The twin's *positive* inhabitants are covered, but its **distinguishing absence** is locked by no test — while the UPDATE side *does* lock its analog (`types.negative/update.test.ts` — `executeUpdateOne` needs RETURNING). This is a `types.negative/` addition (§5 OUT of this audit's Principle-#1 scope), surfaced per the "never silently drop" rule. Compile-repro (per-dialect `types.negative/insert.test.ts`):
```ts
// @ts-expect-error executeInsertOne is dropped on the optional-returning path
void connection.insertInto(tOrganization).values({ name: 'x', plan: 'free' })
    .onConflictDoNothing().returning({ id: tOrganization.id }).executeInsertOne()
```

**customInt `valueWhenNull` / `nullIfValue` SOURCE-provenance — the src fix landed this session; it now needs its negative-type lock.** The `valueWhenNull<VALUE>` / `nullIfValue<VALUE>` value-source overloads on `CustomIntValueSource` ([values.ts:603/605](../src/expressions/values.ts#L603-L605)) were the lone outlier among ~9 value-source types: they returned just `SOURCE` where every sibling (`CustomDouble`, `Bigint`, `Number`, the bases) returns `SOURCE | VALUE[typeof source]`, so the result dropped the operand column's table from the phantom source-provenance and weakened the "column not in FROM" net for customInt only. **Fixed** (both overloads now union `| VALUE[typeof source]`, matching `CustomDouble`; folded into the existing customInt phantom-source *Internal changes* CHANGELOG entry). Validated: `validate:tsgo` + `validate` (tsc) + `validate:tests` clean, and the full newest matrix (31,188 tests) green with **zero snapshot changes** (phantom SOURCE → no SQL/value effect).

Because the effect is compile-only (phantom SOURCE, no runtime/value/SQL surface), the lock is a **`types.negative/` test**, not a Principle-#1 runtime test — the generation phase should add it:
- **Assert (`@ts-expect-error`)** that a `customInt` null-handling result whose operand column comes from a table **absent from the FROM** is now rejected. The operand must be a bare column of the **same `TYPE_NAME`** (`valueWhenNull<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>` requires it) from a **distinct source** — e.g. `tIssueWorklog.costCents.valueWhenNull(<other 'Cents' customInt column>)` used in `selectFrom(tIssueWorklog).select({ x: … })` where the other source is not joined in.
- **Fixture:** there is no second `customInt 'Cents'` column on another table today (`costCents` is on `tIssueWorklog`; `releaseOrdinal`/`optionalReleaseOrdinal` are both `'ReleaseTag'` on the same view). Two routes — the generation agent picks via a compile-repro:
  1. **Self-alias (no fixture):** `tIssueWorklog.as('w2').costCents` as the operand — if aliasing yields a distinct source ref, the result requires both `tIssueWorklog` and `w2`, so a FROM with only `tIssueWorklog` is rejected. Verify the repro actually flags it (compiles the positive control with both in scope, rejects the one missing `w2`).
  2. **§B fixture fallback:** if the alias does not produce a distinct provenance, add a second `customInt 'Cents'` column on another table (e.g. `tInvoice`) to the shared `domain/connection.ts`.
- **Positive control:** the same chain with the operand's source in scope must compile. Place in each dialect's `types.negative/` (symmetric across cells).

---

## Permanent OUT — recorded so future rounds don't re-chase (compile-only / non-validatable)

- ~~**customInt `valueWhenNull<VALUE>`/`nullIfValue<VALUE>` drop the `| VALUE[source]` SOURCE union**~~ — **RESOLVED this session** (src fix + CHANGELOG). No longer OUT; it moved to the negative-type-lock section above (the generation phase must add the `types.negative/` lock). **Runbook consequence:** `TYPE_AUDIT_RUNBOOK.md` §9 lists this exact item as a "permanent OUT — do not re-file" fingerprint; that entry is now stale (the asymmetry is fixed) and should be dropped so a future F1-CUSTOMNUM pass doesn't treat a corrected surface as a known outlier.
- **customInt `add`/`subtract`/`multiply`/`modulo`/`minValue`/`maxValue` value-source-overload SOURCE-union** (8d4585c2) — CHANGELOG explicitly states "generated SQL and the runtime values are unchanged" → compile-only; shipped without a negative-type lock (the maintainer's precedent for this phantom-source class). *(Optional: the same `types.negative/` lock above could cover the arithmetic siblings too, if the generation phase wants belt-and-suspenders.)*
- **`roundn(value: TYPE)` branded-literal overload #1** — byte-identical SQL + value + result-type to `roundn(value: number)` #2 → compile-only; and brand-KEEP on `roundn(NumberValueSource)` #4 is not value-observable.
- **opt×opt through a binary operator** (F9-TYPEVAR) — `MergeOptionalUnion(opt,opt)=opt` yields the same `?:`/`|null` value surface as req×opt (already Exact+value-locked); no new inhabitant → degenerate. (Note: genuinely absent in the pg cell — a `column-vs-column.test.ts` comment overstates coverage — but degenerate, not a gap.)
- **NULL inhabitant of the optional `executeFunction` return for the Date/Money/bigint/int variants** (F9-TYPEVAR) — the optional-executeFunction null path is value-realized on the `string|null` variant (`project_name(999)→null`); `null` is runtime-type-erased, so the other return-kinds add a byte-identical `null` on the same code path.

---

## Round-33 fresh-fix arms — audited, covered, NOT re-reported

The three src fixes since round 33 were audited on their positive/newly-reachable arms and found **covered** (only the Tier-3 corners §A-1/§A-3 remain):
- **b5dc3f2e** — the non-distributive optional-type fix in `FragmentFunctionMaybeOptional3/4/5` (the `(value-source, PLAIN, value-source-optional)` overload) is `assertType<Exact>`-locked at **all three arities** with required controls + a runtime `undefined` at arity 3 (`fragments.with-args.test.ts`); PARITY confirmed **no** remaining non-distributive `OptionalTypeOfValue<X | Y>` shape survives in `fragment.ts`. The empty-batch RETURNING execute-shapes (row-shape arm) are covered.
- **920d5c97** — `subSelectUsing`/`subSelectDistinctUsing` with **5 genuinely-distinct tables** (source union over all five) is covered for both twins; the `executeSelectPage` count-query keeps `customizeQuery` hooks on a plain select (verified). PARITY's whole-`src` scan for the `paramN: T(N-1)` fingerprint = 0 other hits.
- **07edb90f** — min/max enforcement on the empty `executeInsert`/`executeUpdate`/`executeUpdateMany` operation (throw on count 0 < min) is covered across the matrix; the max-on-empty arm is degenerate (count 0 can never exceed a positive max).

---

## Per-surface saturation table

| Surface | §A | Result |
|---|---|---|
| F-RECENT (fresh fixes) | §A-3 | fixes covered except the empty-batch one-column corner |
| SEL-SEAM (select/CTE/compound/recursive seam) | §A-2 | 1 seam composition; candidate-defect probed clean |
| MUT-SEAM (mutation seam) | §A-1 | empty-op grid fully covered; 1 guard-arm gap |
| F4-INSERT | §A-1 (converged) | saturated but the single-row last-id guard |
| F4-UPDDEL | §A-5 | one low-tier symmetry gap; else saturated |
| F3-PROJ (projections) | §A-4 (+§B-a) | 1 asNull input-classification twin |
| F1-TEMP (temporal) | §A-6 | getters/optionality saturated; trio-on-temporal gap |
| F1-CUSTOMNUM (custom numeric/brand) | §A-7 | arithmetic/brand saturated; 1 adapter-into-non-add |
| PARITY (twin sweep) | — (§B-1 neg-type) | all 3 seed fixes' siblings type-correct + covered |
| F1-EQCMP | — | **SATURATED** (18 leaves × const+value-source) |
| F9-TYPEVAR | — | **SATURATED** (optionality/brand/scalar-null Exact+value-locked) |
| F5-CONN | — | **SATURATED** (6 builder families × arities 0–5, adapter slots) |
| F6-DYN | — | **SATURATED** (operator×type×descriptor/VSM×base/IfValue) |
| F1-STR | — | **SATURATED** (transforms/predicates/theme-9 adapter ×11) |
| F2-VALVIEW | — | **SATURATED** (VALUES per-kind + View bare-DBColumnImpl read) |
| F7-EXTRAS | — | **SATURATED** (adapters + builder-reachable error reasons) |
| F3-SELECT | — | **SATURATED** (execute-shape 2×2×4, joins 8/8, orderBy 13/13) |
| F2-COL | — | **SATURATED** (15 factories × ±adapter, writable-shape axes) |
| F1-BOOLIF | — | **SATURATED** (custom-bool combinators, *IfValue elision) |
| F1-NUM | — | **SATURATED** (modulo fingerprint ×13, int→double promotion) |

**12 surfaces genuinely saturated; the other 8 contributed the §A tail.**

---

## Coordinator verification notes (what I checked myself)

1. **§A-2 recursive-page-customize (bug-vs-boundary)** — runtime-probe on the mock, read `history[1].sql`: hooks ride the `result_for_count` wrap (valid SQL). Reading (a), **not a bug**. Probe deleted; tree clean.
2. **§A-3 empty-batch one-column reachability** — compile-repro (`assertType<Exact>` on all three chains), `bun run validate:tests` clean: reachable + distinct scalar type. Overturns the §C filing from MUT-SEAM/F4-INSERT (§7-item-5 in action). Repro deleted.
3. **§A-1 single-row last-id guard** — grep: no `values({...})...returningLastInsertedId()...executeInsert(<n>)` anywhere; converged independently by MUT-SEAM + F4-INSERT.
4. **§A-4 / §A-6 / §A-5 / §A-7 absence** — direct greps confirmed each: no asNull `mixed-container-required-object-inner-*` twin; 0 temporal×trio hits (with the non-temporal control present); only `optionalReleaseOrdinal.add(` used; every update/delete `dynamicWhere()` carries `.and(...)` while the SELECT twin exists.
5. **§7-item-5 (re-check the confident §C/saturated drops)** — ran the §4 settling test on the longer §C lists: F2-VALVIEW (~14 kind-string families — the View read has **no per-kind emission axis**, so required-vs-optional-same-kind cells are generic-projection intersections of independently-covered axes → genuinely degenerate); F2-COL §C-2 (custom-kind + value-transform adapter on a writable Table column — binds `value×10` cast int, **byte-identical** to the tested plain-int+scaledTenth Table INSERT, branded type covered by `costCents` → degenerate); F3-SELECT §C (plain top-level `.join()` — the ` join ` keyword is already pinned inside recursive-CTE bodies → degenerate). Two §C/§B items **failed** the discriminator and were promoted (§A-3, §A-7); the rest held.
6. **Non-existent APIs refuted** (agents correctly did not invent them): `asRequiredInOptionalObjectIfValue`/`smaller`/`larger` (F1-EQCMP), `extendDynamicCondition`/`select-from-model` (F6-DYN), `OptionalAs` (F7-EXTRAS), `isTrue`/`isFalse` (F1-BOOLIF), the commented-out bigint arithmetic methods (F1-NUM), `selectDistinct`/`executeSelectCount`-as-public (F3-SELECT).

Working tree ends **clean** (`git status --porcelain` shows only the pre-existing untracked reports + the `.gitignore` mod + this file).

---

## Recommended implementation order

1. **§A-1** (Tier-2, cheapest, converged) — one test in `insert.execute-variants.test.ts`.
2. **§A-2** (Tier-1 seam) — one/two cases in `cte.recursive-union-variants.test.ts`; snapshot already probed.
3. **§A-4** (Tier-1 projection) — with the mandatory boundary-row runtime probe.
4. **§A-3** (Tier-3, 3 tests) — byte-symmetric with the existing row-shape empty-batch tests.
5. **§A-6**, **§A-5**, **§A-7** (Tier-3 completeness tail) — one test each; §A-7 value-validate under `--docker`.

All seven propagate to the 17 symmetric cells via the shared `domain/connection.ts` (no fixture change).

---

## Verdict

An honest mature round: **0 bugs, 7 §A completeness findings (all on existing fixtures), 12 surfaces saturated, 1 candidate-defect probed clean, 0 new fixtures required.** The three fresh src fixes landed with their positive arms well-covered; the round's value is the seam compositions (§A-1/§A-2/§A-4) and the Tier-3 tail (§A-3/§A-5/§A-6/§A-7). The **§7-item-5 discipline paid off** — re-adjudicating the confident §C/saturated drops promoted two distinct-typed paths (§A-3 from §C, §A-7 from "degenerate-adjacent §B") that a positive-claims-only pass would have silently dropped; the remaining §C/saturated verdicts survived the §4 settling test.

**Runbook:** no edit warranted. This round surfaced no new failure-mode, oracle, or fingerprint — every technique it used (compile-repro, runtime-probe, the §4 discriminator, the §7-item-5 §C re-check) is already written, and 0 new defects means nothing to add to §9. Per the Timelessness discipline, a round that matches existing fingerprints needs no change.
