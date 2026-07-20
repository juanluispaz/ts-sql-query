# Missing-tests audit (Round 14) — MAXIMALIST pass: cover every reachable typed path & variant

**Mandate (recalibrated).** Prior rounds judged by *type-branch / distinct observable output* and swept kind-string fan-outs and "same-impl variants" as degenerate. This round inverts that: **enumerate every reachable typed path and every variant, and require a test for each — even variants that look like the same implementation.** Prefer erring by EXCESS. The degeneracy bar is now NARROW: a path is degenerate *only* when it is the **same overload through a shared dispatcher** where only a kind-string differs **and** the impl is provably generic **and** a representative is already tested. A distinct reachable **overload / interface / per-receiver method / arity / input-classification** is a path to test **even when its output coincides** with a covered case — that coincidence is exactly where the §A1 (round 13) type-vs-impl bug hid (it shipped a real MariaDB/MySQL `ON DUPLICATE KEY UPDATE` fix, commit `1149a866`).

**Method.** 16 enumeration agents (one matrix each), raw-reading `src/` and grepping the current `test/` tree; then **coordinator verification** (targeted greps + a tsgo probe) on the largest/contradictory claims. All agents READ-ONLY; working tree clean.

**Headline.** Of 16 surfaces, **4 are fully saturated even under the maximalist bar** (string value-source, boolean/if-value, dynamic-condition, extras/adapters/errors). The other 12 yield **≈ 550 candidate type-paths**: **≈ 380 closeable on existing fixtures (§A)** and **≈ 170 needing a fixture addition (§B)** — no new matrix cell, no negatives, no `queryRunners` work. They concentrate into **8 cross-cutting themes**; the highest-risk ones are the same shape as the bug that opened this effort.

---

## The 8 themes (ranked by risk, not count)

**TIER 1 — distinct code-path / runtime-branch; output-coincidence masks real risk (the §A1 class).**

1. **Shaped builders are thinly tested.** INSERT: the shaped ON CONFLICT surface (`ShapedInsertOnConflictSetsExpression`) is reached by **1 of ~8 routes** (only `doUpdateDynamicSet()` no-arg); shaped `doUpdateSet`/`doUpdateSetIfValue`/`doNothing`, `onConflictOnConstraint`, the shaped `where`/`dynamicWhere`/`.and/.or` chain, `extendShape`-after-opener, and shaped entry-points (`setIfValue`/`values`-single/`dynamicValues`/`dynamicSet`) are all absent (F4-INSERT §A 1–13). UPDATE: the entire shaped set surface (`ShapedUpdateSetExpression` / `ShapedNotExecutableUpdateExpression` / shaped allowing-no-where) is untested beyond `shapedAs().set()` (F4-UPDDEL A1–A3). Compositions: `customizeQuery×shaped` (insert+update), `shaped×returning` (insert+update) — never chained (F8 A2–A5). **This is the exact surface that hid the round-13 bug.**

2. **Trailing-`adapter?` overload fan-out is STRING-only across 8 connection methods** (F5-CONN A1–A7): `const`, `optionalConst`, `fragmentWithType`, `aggregateFragmentWithType`, `executeFunction`, `sequence`, `arg`, `valueArg`. Each non-string kind is a distinct typed overload with an observable value transform, and several route through a **distinct runtime dispatch branch** (the `adapter2` slot / arg-shift on `custom`/`enum`, and the different arg-order in the aggregate-fragment dispatcher). *Coordinator-verified:* zero non-string `const`-with-adapter anywhere; zero non-boolean column factory carries a `TypeAdapter` object (F2-COL B1). The adapter-present-vs-absent code path is unproven outside `boolean`/`string` — the canonical "same output, different code path" risk.

3. **complexProjections classification boundaries** (F3-PROJ §A, **tsgo-probe-confirmed**): the rule-2↔rule-3 boundary — a nested object/aggregate-element mixing an own-table *required* leaf with a left-join *originallyRequired* leaf — is absent across all cells and both projectors (object stays required, left-join leaves demoted: `?`/absent under AsUndefined, `|null` under AsNull). Plus aggregate-element **rule-3 over own-table-required** leaves (mimics the covered left-join rule-2 element) and aggregate-element **rule-2 with a mixed optional leaf** (only the plain-select twin exists). 9 cells, all on existing `tIssue`/`tAppUser`/`tProject` fixtures.

4. **Compound order-by overloads** (F3-SELECT A1–A5, F8 A1, **live-probe-confirmed distinct SQL**): `CompoundedOrderByExecutableSelectExpression` declares its own `orderBy(valueSource)`/`orderBy(rawFragment)`/`orderByFromString`/`…IfValue`/`…Array`/`…ArrayIfValue` set; only `orderBy('col')` is exercised on compounds. Plus the **non-compound `orderBy(rawFragment)` arm** — untested across the *entire* matrix. Distinct interface + distinct emission decision (`query.__type !== 'compound'`).

5. **Custom-temporal getters** (F1-TEMP §A, 14 cells): only 3 of 17 covered (`getFullYear`/`getHours`/`getTime`, one column each). Each getter emits **distinct SQL** (`extract(month…)-1` vs `extract(dow…)` vs `extract(year…)`) → genuinely distinct observable paths, not degenerate. (My round-13 agent wrongly called these "receiver-brand-invariant" under the old bar — the recalibration in action.)

6. **Brand-keep through `forUseAsInlineQueryValue`** (F8 B1): every inline-value subquery wraps a *plain* scalar; a custom/branded scalar (`Cents`/`Money`/`Semver`/`SigningKey`) is never pushed through to prove the brand survives. The one untested brand-keep boundary found.

**TIER 2 — distinct overloads / per-type emission; shared dispatcher but observably distinct.**

7. **Value-source-operand twin + optional-receiver branch** (numeric/custom-numeric leaves; F1-NUM §A 6, F1-CUSTOMNUM §A 30): the binary methods are tested with a **const** operand but never a **value-source** operand — `bigint`/`customInt`/`customDouble` `minValue`/`maxValue`/`valueWhenNull`/`nullIfValue`/`subtract`/`multiply`/`power` with a column RHS; the **const twin** of methods tested only with a VS operand (`modulo`/`logn`/`divide`/`atan2`); `customDouble` `ceil`/`floor`/`round`; the **optional-receiver** branch of the whole numeric surface (`tIssueWorklog.minutes` is fed into *zero* methods); and `asRequiredInOptionalObject`/`onlyWhenOrNull`/`ignoreWhenAsNull` (absent for custom types entirely).

8. **Direct (non-dynamic) fluent equality/comparison per leaf type** (F1-EQCMP §A, **coordinator-verified**): the shared `Equalable`/`Comparable` base methods are validated almost entirely on **int + string**. On bigint/double/every temporal & custom-temporal/customInt/customDouble/uuid/enum, `equals`/`notEquals`/`is`/`isNot`/`between`/`in`/`inN` are directly untested (a couple of comparison ops aside). `in(subquery)`/`notIn(subquery)` is tested on **one receiver type (int)** → 18 non-int-type cells. `enum` has a single `.equals` direct assertion; `uuid` has zero direct equality (only `asString`). **NB:** the *dynamic* path covers all of these per-type (F6-DYN saturated) — the gap is the **direct fluent** path only.

**TIER 3 — per-kind completeness fan-out (mostly needs a fixture; lowest priority, but in-scope per "every variant").**

- Column-factory × kind matrix is broad-but-shallow (F2-COL §B ~130 paths): most factories proven on only 1–3 of 18 kinds. Distinct VALUES-tuple / column cast emission per kind. Includes the per-column `TypeAdapter`-object axis (B1, the one Tier-1 item in this surface).
- `Values` base/custom kinds (F2-VALVIEW §B ~24): exercised on 2 of 9 base kinds; per-kind VALUES-tuple cast emission.
- Connection per-kind fan-outs (F5-CONN A5/A6/A7/A8, B1/B2): `executeFunction` return-kinds, `sequence` value-kinds, `arg`/`valueArg` missing kinds, `createTableOrViewCustomization` P1–P5, higher-arity `subSelectUsing`/`subSelectDistinctUsing`/`dynamicBooleanExpressionUsing`.

---

## Per-surface counts (after coordinator verification)

| Surface | §A (existing fixtures) | §B (needs fixture) | verdict |
|---|---|---|---|
| F1-STR string | 0 | 0 | **saturated** |
| F1-BOOLIF boolean/if-value | 0 | 0 | **saturated** |
| F6-DYN dynamic | 0 | 0 | **saturated** |
| F7-EXTRAS extras/adapters/errors | 0 | 0 | **saturated** |
| F1-NUM number/bigint | 6 | 2 (seed values) | gaps |
| F1-CUSTOMNUM customInt/customDouble | 30 | — (1 item reclassified OUT: negatives) | gaps |
| F1-TEMP temporal | 14 | 3 | gaps |
| F1-EQCMP equality/compare ×type | ~150 | 2 test files | **large** |
| F2-COL column factories | ~38 covered | ~130 | **large** |
| F2-VALVIEW Values/View | 1 (→§A) | ~24 | gaps |
| F3-SELECT builder | 5 | 0 | gaps |
| F3-PROJ complexProjections | 9 | 0 | gaps |
| F4-INSERT | 13 | 1 | gaps (shaped) |
| F4-UPDDEL | 6 | 0 | gaps (shaped) |
| F5-CONN connection API | ~140 | ~12 | **large** |
| F8-META composition/seams | 6 | 2 | gaps |
| **TOTAL** | **≈ 380** | **≈ 170** | |

---

## Coordinator verification (what I checked myself, per the cross-agent-contradiction discipline)

- **F1-EQCMP (~150) vs F6-DYN (saturated)** — RESOLVED in F1-EQCMP's favour, properly scoped. Direct greps: bigint has only `greaterThan`/`lessOrEqual`; uuid **0** direct equality; localDateTime only `greaterOrEqual`/`lessOrEqual`; enum only `equals`; double only `greaterThan`/`isNot`. The equivalence file pairs dynamic predicates with direct equivalents **for a representative subset of types**, not all — so dynamic is saturated, direct is sparse. Both findings stand.
- **`in(subquery)` receiver** — confirmed int-only.
- **F5-CONN trailing adapter** — confirmed: no non-string `const`/`optionalConst`-with-adapter anywhere.
- **F2-COL adapter axis (B1)** — confirmed: no non-boolean column factory carries a `TypeAdapter` object in the domain.
- **F3-PROJ §A3** — agent ran its own tsgo probe (object stays required, left-join leaves demoted); consistent with my round-13 probe.
- **F3-SELECT / F8 compound order-by** — agent live-probed distinct SQL (`order by $1` for the value-source arm proves non-trivial wiring).

---

## §B — fixture-addition plan (now actionable; no new matrix cell)

Add to the shared `test/db/postgres/domain/connection.ts` (propagates to all 17 cells automatically):

- **Per-column `TypeAdapter` object on non-boolean kinds** (F2-COL B1, highest §B value): one `column('…','int', adapter)` + one `optionalColumn('…','string', adapter)` whose adapter brackets the read value — proves the adapter-present code path for non-boolean kinds.
- **Factory × kind fan-out columns** (F2-COL B2–B11): autogen/provided PK over uuid/bigint/etc.; `columnWithDefaultValue`/`optionalColumnWithDefaultValue` across the ~12 uncovered kinds; non-string computed/virtual columns; View-source kind columns.
- **Values base/custom kinds** (F2-VALVIEW B2/B3): a `VValueKinds`/extended values-view with one column per uncovered base + custom kind (distinct VALUES-tuple casts).
- **Temporal receiver-optionality** (F1-TEMP B1/B2): an optional `localDate` column and a required `localTime` column; seed a non-null value so optional getters can be value-asserted.
- **Numeric optional-receiver seed values** (F1-NUM B1/B2): seed `estimated_hours` and `minutes` non-null so optional-double/int receivers run through the math surface.
- **New test files (existing columns)** (F1-EQCMP §B, F8 B1): `select.value-source.equality-comparison-by-type.test.ts`, `select.value-source.enum-operators.test.ts`, `select.inline-value-custom-type.test.ts`.
- **INSERT from-select × on-conflict do-update** (F4-INSERT B1): `insert.from-select.on-conflict.test.ts`.

**Reclassified OUT** (not §B): F1-CUSTOMNUM's proposed `types.negative` brand keep/erase lock — negatives are out of scope this round.

---

## Recommended implementation order

1. **Tier 1, existing fixtures first** (highest risk, cheapest): shaped INSERT/UPDATE routes + `shaped×{customizeQuery,returning}` (F4-INSERT 1–13, F4-UPDDEL A1–A3, F8 A2–A5); complexProjections §A3 boundary (F3-PROJ 1–9); compound order-by (F3-SELECT A1–A5); custom-temporal getters (F1-TEMP 14); brand-keep inline-value (F8 B1).
2. **Tier 1 adapter fan-out** (F5-CONN A1–A4 const/optionalConst/fragment/aggregate-fragment with adapter, prioritising the `custom`/`enum` `adapter2`-slot arms) + F2-COL B1 fixture.
3. **Tier 2**: value-source-operand twins + optional-receiver (F1-NUM, F1-CUSTOMNUM); direct fluent equality/comparison per type, leading with `in(subquery)` ×18 types + `enum`/`uuid` direct operators (F1-EQCMP); remaining connection per-kind/arity fan-outs (F5-CONN A5–A8, B1/B2); `disallow` Error-object overload (F4-UPDDEL A4).
4. **Tier 3**: the column-factory / Values per-kind fixture fan-out (F2-COL B2–B11, F2-VALVIEW B2/B3) — batchable; distinct cast emission per kind.

## Verdict

**NOT saturated under the maximalist bar — and that is the correct, intended result.** Four surfaces are genuinely complete; the rest expose ≈ 550 reachable typed paths the suite doesn't yet assert, concentrated in 8 coherent themes. The Tier-1 themes (shaped builders, adapter-dispatch fan-out, projection-classification boundaries, compound order-by, custom-temporal getters) are the same *output-coincidence-hides-a-bug* shape as the round-13 bug — these are where the next latent type-vs-impl defect most plausibly lives, and they are cheap (existing fixtures). Tier 3 is mechanical per-kind completeness (needs fixture columns) — lower risk but in-scope per "every variant covered." No source bug surfaced at audit time; whether implementing the Tier-1 items surfaces one (as §A1 did) is the question the tests will answer.
