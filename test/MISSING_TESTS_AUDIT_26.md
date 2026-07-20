# Missing-tests audit — ROUND 26

**Mandate:** type-driven, multi-agent missing-tests detection over the `test/`
matrix. Find tests the TYPE DEFINITIONS in `src/` imply but the suite lacks, and
hunt type-vs-impl divergences. **Degeneracy bar in force:** the narrow bar (§4 of
[`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md)) — a distinct reachable
overload / interface / per-receiver method / arity / input-classification is a
GAP even when its output coincides with a covered case. Maximalist round.

**Method:** 20 discovery agents (the ~16 standard surfaces + the two mature-phase
extras F-RECENT and F9-TYPEVAR), two waves of ≤10, led by the parity sweep and
the two seam critics. Every load-bearing claim was coordinator-verified with a
tsgo compile-repro or a mock runtime SQL probe (both deleted; tree clean).

**Pre-flight state:** `tests:audit` clean (17 cells, 234 files, **2224 tests/cell**,
matrix symmetric — up from 2197 after Round 25's implementations). `BUGS.md` empty
at start and end. Reference cell `postgres/newest/pg/`. Domain = Round-25 domain +
`tAuditEntryNoAdapter` (the Round-25 §B1 fixture).

**Freshly-changed src type surface (§0.5 step 5 — the round's top target): the two
fixes shipped since Round 25.**
- **`143fe3b2`** ("A nested object whose only member is an optional inner object is
  now typed optional") — rewrote `ContainsRequired`/`…2..5` in
  `src/complexProjections/projectionRules.ts`: recurse on the inner object
  (`NonNullable<TYPE[K]>`), contribute `never` (not `false`), container required
  only when the inner is a *required object*.
- **`726d9e77`** ("More recursive query work…") — narrowed the compound
  `orderBy(rawFragment)` overload to no-table (`select.ts:110`, the Round-25 CD-1
  fix, negative now locked), and reworked `forUseInQueryAs` so a recursive result
  with ordering/paging renders on a **wrapping CTE**
  `<as> as (select … from <recursive-member> order by … limit … offset …)` (the
  Round-25 CD-2/CD-3 fix).

## Headline counts

| | |
|---|---|
| **Confirmed `src/` bugs** | **0** — BUGS.md stays empty |
| **Candidate defects → adjudicated** | **0 survive** — 2 raised (F-RECENT-A4 inline consumers; SEL-SEAM-B1 recursive×compound), **both runtime-probed → valid SQL → REFUTED as defects, kept as clean §A tests**; 1 compile-only provenance asymmetry filed OUT |
| **§A findings (existing cell + existing fixtures)** | **~19 clusters** (see themes), concentrated on the two fresh fixes' positive arms + the composition seams |
| **§B findings (need a fixture)** | **0** (one optional non-recommended note) |
| **Refuted / scope-flagged** | **4** (A4 & B1 defect-readings; F1-CUSTOMNUM SOURCE-union; F7 version-band reason) |
| **Surfaces genuinely saturated (0 §A)** | **7** — F5-CONN, F1-NUM, F1-STR, F2-COL, F1-TEMP, F2-VALVIEW, F4-UPDDEL |

**Verdict up front:** another **mature saturating round with ZERO confirmed bugs.**
Both fresh-surface fixes are **sound** — the projection-optionalisation and the
recursive wrapping-CTE trace correct under compile-repro and runtime-probe, and
five agents (F-RECENT, F3-PROJ, F9-TYPEVAR, SEL-SEAM, PARITY) converged on their
*untested positive/tail arms* without finding a single misfire. The round's value
is a clean §A composition/tail — the just-landed fixes' under-tested arms plus the
standing composition seams (compound×customize, connectBy grid, INSERT
allow-when walker, brand-survival). No fabricated bug; no §A padding.

---

## Implementation status (findings turned into tests)

**Implemented and merged into the matrix.** All §A findings below were written,
baked per-cell, typechecked (tsgo), and validated. **Matrix went 2224 → 2287
tests/cell (+63 new tests × 17 cells).** Closing gates all green: `tests:audit`
(symmetric, 0 problems) · `validate:tests` (tsgo clean) · `bun run tests` (38161
mock pass, 0 fail). Docker (`--docker`): T1/T2/T3/T7/T8 real-validated on
pg+mariadb+mysql+oracle+sqlserver; T10 on Oracle; **all 14 touched files on the
postgres reference cell (325 pass)**; F1-BOOLIF on sqlserver; SQLite-native cells
run real by default (all value assertions real-validated there). The three
former deferrals were closed in a follow-up pass (see below): T4 join×returning
and F4-INSERT-A2 real-validated with `--docker --wasm` across **every live cell**
(33 pass, 0 fail — pg/oracle/sqlserver docker + sqlite wasm+native); F-RECENT-A6
retired as not-expressible. `src/` untouched; `BUGS.md` still empty (no defect
surfaced — consistent with the round's verdict).

| Finding | Status | Tests | Home file |
|---|---|---|---|
| **T1** recursive wrapping-CTE tail (T1a/T1b/T1c) | ✅ done | 4 | `cte.recursive-union-variants` |
| **T2** projection container-optionalisation (T2a rule-1 sole-inner + T2b multi-level) | ✅ done | 8 | `select.complex-projection.inner-rules` |
| **T3** SELECT/compound seams (compound×customize→CTE/scalar/executeSelectPage; non-recursive CTE projection-hook SURVIVE; recursive×compound B1) | ✅ done | 5 | `customize-query.compound` / `customize-query.select` / `cte.recursive-union-variants` |
| **T4** INSERT `__isAllowed` walker gates (customization / returning / multi-row / partial-index-where) | ✅ done | 4 | `mutation.allow-when` / `insert.on-conflict.allow-when` |
| **T4** update.from/delete.using join × returning-nested | ✅ done | 2 | `update.join` / `delete.join` |
| **T5** ShapedMissingKeysMultipleInsertExpression + shaped single-object `dynamicValues` | ✅ done | 5 | `insert.multi-row.missing-keys` / `insert.shaped` |
| **T6** INSERT `disallow*(Error)` overload | ✅ done | 1 | `insert.conditional-sets` |
| **T7** brand-survival on branded receivers (customInt `ReleaseTag` + customDouble `Money`) | ✅ done | 12 | `select.value-source.custom-numeric` |
| **T8** boolean in-family + 6 temporal in-subquery leaves | ✅ done | 7 | `select.value-source.equality-comparison-by-type` |
| **T9** dynamic-condition from-model numeric-literal→`['enum',T]` arm | ✅ done | 1 | `dynamic-condition.from-model` |
| **T10** Oracle connectBy × feature grid (A5–A9 + inline scalar) | ✅ done | 6 | `oracle/newest/oracledb/select.connect-by` |
| **Tier-3** F-RECENT-A5 recursive orderBy-alone wrap | ✅ done | 1 | `cte.recursive-union-variants` |
| **Tier-3** F3-PROJ-T2c mixed container (required-object inner wins) | ✅ done | 1 | `select.complex-projection.inner-rules` |
| **Tier-3** F3-PROJ-T2d deeper-nested (depth-4) sole-optional chain | ✅ done | 2 | `select.complex-projection.inner-rules` |
| **Tier-3** F1-BOOLIF onlyWhenOrNull/ignoreWhenAsNull on a custom-boolean receiver | ✅ done | 2 | `select.value-source.conditional-projection` |
| **Tier-3** F3-SELECT `query()`/`params()` accessors on SELECT | ✅ done | 1 | `select.basic` |
| **Tier-3** F4-INSERT-A2 from-select `onConflictOnConstraint` | ✅ done | 1 | `insert.on-conflict.from-select` |
| **Tier-3** F-RECENT-A6 recursive `orderingSiblingsOnly`-wrap | ✅ neg-type guard | 6 | `<db>/types.negative/select` (×6) |

### Notes captured while implementing (corrections to the audit's shape suggestions)

- **T1b dual re-homing — the audit's suggested order is untypeable.** The audit
  proposed `customizeQuery({…, beforeOrderByItems}).orderBy('id').limit(2).forUseInQueryAs('tree')`,
  but `customizeQuery(...)` on a recursive result returns `CompoundableExecutableSelectExpression`
  which **drops `orderBy`** — calling `.orderBy` after it fails tsgo. Implemented as
  `.orderBy('id').limit(2).customizeQuery({beforeQuery, afterQuery, beforeOrderByItems}).forUseInQueryAs('tree')`,
  which still re-homes `beforeQuery`/`afterQuery` to the inner recursive body and
  `orderBy`/`beforeOrderByItems`/`limit` to the wrapping select (probed valid).
- **T3 non-recursive CTE SURVIVE test — `customWindow` IS matrix-portable.** Initially
  dropped `customWindow` fearing an unused named `WINDOW` is rejected on SQL Server < 2022 /
  older Oracle, then re-included it after confirming the pre-existing
  `customize-select-custom-window-emits-named-window` test is live and green in every cell.
- **T7 brand-survival — a `.round()` type-anchor is load-bearing on PostgreSQL.** A pure
  const-const binary operator (`add`/`subtract`/`multiply`/`minValue`/`maxValue`) emits two
  untyped placeholders PostgreSQL cannot resolve (`$1 + $2` → 42725 *"operator is not unique"*;
  `greatest($1,$2)` silently compares as text). A leading `.round()` (identity for the integer
  receiver, keeps the brand) types the left operand as `numeric` and resolves it; harmless on
  the other dialects. Kept in the expressions.
- **Incidental precision fix (not a bug).** MySQL has no native `CBRT` and emits `cbrt` as
  `POWER(x, 1/3)`, losing precision at the 5th decimal (`cbrt(4)` diff ≈ 7.3e-6). Relaxed the
  `cbrt` `toBeCloseTo` precision 5 → 4 in the new T7 test **and** in the pre-existing
  `custom-numeric/customdouble-math` test (which shares the same latent MySQL sensitivity) — a
  strict robustness improvement, no meaning lost.

### Former deferrals — now closed (follow-up pass)

The three items originally left deferred were revisited and resolved. Two turned out to be
real-DB-validatable distinct compositions and were implemented with correct per-dialect
narrowing; the third proved not to be expressible at all and was retired.

- **T4 · `update.from().innerJoin().returning({nested})` / `delete.using().innerJoin().returning({nested})`
  — ✅ implemented (2 tests).** The composition emits a distinct full statement (RETURNING /
  `OUTPUT` / `RETURNING … INTO` coexisting with the multi-table `FROM`/`USING`+`JOIN`), so it is
  worth a real-DB assertion even though the RETURNING clause itself is shared with the
  single-table path. Per-dialect landing:
    - **UPDATE** (`update.join.test.ts`, `update-from-table-then-inner-join-returning-nested`):
      LIVE on PostgreSQL (8), SQLite (5), Oracle (`returning … into`), SqlServer (`output
      inserted.*`); NOT-APPLICABLE on MySQL (no RETURNING); TODO[LIMITATION] on MariaDB
      (UPDATE…RETURNING needs 13.0.1+, docker image ships 12.x).
    - **DELETE** (`delete.join.test.ts`, `delete-using-table-then-inner-join-returning-nested`):
      LIVE on PostgreSQL (8), Oracle, SqlServer; NOT-APPLICABLE on SQLite (no `DELETE … USING`)
      and MySQL (no RETURNING); **TODO[LIMITATION] on MariaDB** — the library types and emits
      `RETURNING` on a multi-table DELETE but MariaDB rejects it (`ER_PARSE_ERROR 1064`); the
      single-table `DELETE … RETURNING` works, so this is an engine-grammar gap, not a type gap.
    - Real-DB confirmed: Oracle + SqlServer via `--docker`, SQLite via native/wasm, MariaDB's
      DELETE rejection reproduced against the live engine before commenting it out.
- **Tier-3 · F4-INSERT-A2 from-select `onConflictOnConstraint(name)` — ✅ implemented (1 test).**
  `insert.on-conflict.from-select.test.ts`, `from-select-on-conflict-on-constraint-do-update-set`:
  the named-constraint conflict target (`ON CONSTRAINT app_user_email_key`) on a from-select
  upsert — a distinct emission from the covered column-target arms. LIVE on the 8 PostgreSQL
  cells; NOT-APPLICABLE on SQLite (no named-constraint target — only `ON CONFLICT (columns)`),
  Oracle / SqlServer (no `INSERT … ON CONFLICT`), and MySQL / MariaDB (bare `ON DUPLICATE KEY`
  form, no conflict target). Real-DB confirmed on PostgreSQL via `--docker`.
- **Tier-3 · F-RECENT-A6 recursive `orderingSiblingsOnly`-wrap — ✅ closed as a negative-type guard (6 assertions).**
  `orderingSiblingsOnly` is **type-gated behind the `'connectBy'` feature flag**. The property
  is present on every `Ordered…ExecutableSelectExpression`, but its type is
  `OrderingSiblingsOnlyFnType<FEATURES, NEXT> = 'connectBy' extends FEATURES ? () => NEXT : never`
  (`src/expressions/select.ts:546`). It becomes callable only after `startWith` / `connectBy` /
  `connectByNoCycle` stamp `'connectBy'` into `FEATURES` — i.e. only on Oracle's hierarchical
  `CONNECT BY` query. A `recursiveUnion*` result carries `'recursive'` in `FEATURES`, never
  `'connectBy'`, so there `.orderBy(...).orderingSiblingsOnly()` types to `never` → not callable.
  Coverage now stands on both sides of the gate:
    - **Positive** (the valid path) was already covered — `connect-by-ordering-siblings-only-emits-order-siblings-by`
      in `oracle/newest/oracledb/select.connect-by.test.ts` pins the `order siblings by` emission on a
      real Oracle `startWith`+`connectBy` query.
    - **Negative** (the boundary that made a recursive-wrap unimplementable) was NOT covered, so it was
      added: a `@ts-expect-error` on `.recursiveUnionAll(...).orderBy('id').orderingSiblingsOnly()` in
      each `test/db/<db>/types.negative/select.test.ts` (×6), sitting beside the existing recursive-result
      `orderBy` negatives. Enforced under both tsgo (authoritative) and tsc — if the library ever made the
      method callable on a recursive result, the now-unused directive would fail the build (`TS2578`).
  So there is no positive composition to add (the type forbids it by design, and that design is now
  regression-guarded); the semantics are correct — `order siblings by` is CONNECT-BY syntax, meaningless
  for a recursive-union CTE.

These three can be picked up in a follow-up if the maintainer decides the marginal coverage
is worth the per-dialect handling; none blocks the round.

---

## Coordinator verification notes (what I checked myself)

- **tsgo compile-repro** (`_repro26.ts`, deleted):
  - **F3-PROJ-A1 / F9-A1** (rule-1 sole-inner container): actual type printed =
    `{ iid: number; wrapper?: { inner: { gate: string; extra: number | undefined } | undefined } }`
    → `wrapper` is **correctly OPTIONAL**. No misfire.
  - **F9-A2** (multi-level fully-optional chain): actual type =
    `{ iid: number; a?: { b: { c: {…} | undefined } | undefined } }` → outermost
    `a` **correctly OPTIONAL**, propagating down. No misfire.
  - **SEL-SEAM-B1** (`recursiveUnionAll(…).union(other)`): **compiles** (reachable).
  - **F1-EQCMP-A1** (`estimatedHours.equalsIfValue(1.5)`): reachable.
- **mock runtime SQL probe** (`_probe26.test.ts`, deleted, 5/5 passed — read the
  printed string, not reasoned):
  - **SEL-SEAM-B1**: `with recursive recursive_select_1 as (…) select … from recursive_select_1 union select … from issue` — **valid** (WITH correctly hoisted). Clean §A, not a defect.
  - **F-RECENT-A4 CANDIDATE DEFECT → REFUTED**: scalar inline = `(select result from recursive_select_1 order by result limit $3)` (order by inside the scalar subquery — valid); aggregated-array inline = `(select json_agg(…) from (select … from recursive_select_1 order by id) as a_2_)` — the order by is **relocated into a wrapping derived table**, so `json_agg` aggregates ordered rows (valid, not the engine-rejected `order by` beside `json_agg` I suspected). Both clean §A.
  - **F-RECENT-A1/A2** (order-less wrapping CTE): `…, tree as (select … from recursive_select_1 limit $4 offset $5) select … from tree` — valid.
  - **F-RECENT-A3** (dual re-homing): `with recursive recursive_select_1 as (/*HEAD*/ … /*TAIL*/), tree as (select … order by title asc, id limit $4) select … from tree` — the `beforeQuery`/`afterQuery` land on the inner recursive body, the ordering/hooks on the wrapping select. Valid.
- **absence-at-scale greps**: confirmed the INSERT `disallow*(Error)` overload is
  passed only string literals matrix-wide while `update.shaped-disallow.test.ts:312-339`
  **does** exercise the Error-instance overload (via a `sentinel` variable) — so
  F4-INSERT-A1 is a genuine INSERT-side parity gap. Confirmed the recursive×compound,
  order-less-wrap, and connectBy-composition shapes are absent.
- Working tree verified clean (`git status --porcelain` shows only the audit report +
  pre-existing untracked files; no `_repro`/`_probe` remain).

---

## §A — findings, grouped by theme × risk tier

### Tier 1 — the two fresh fixes' positive/tail arms + composition seams (highest value)

**T1 · Recursive wrapping-CTE tail arms** *(F-RECENT; the `726d9e77` fix's under-tested arms — all runtime-probed VALID).* The fix added regression guards only for the *bundled* shapes (`orderBy('id').limit(2).offset(1)` and `beforeOrderByItems+afterOrderByItems`, each in isolation). The `outerHasOrderingOrPaging` predicate has six independent OR-arms + a dual re-homing split; the tail is untested:
  - **T1a** — `limit`-alone / `offset`-alone (no `orderBy`) via `forUseInQueryAs` → an **order-less** wrapping CTE `…, tree as (select … limit $ offset $)`, a shape that appears **nowhere** in the matrix. (One test: `.limit(2).offset(1)` no `orderBy`.)
  - **T1b** — the **dual re-homing** combined: `customizeQuery({beforeQuery, afterQuery, beforeOrderByItems}).orderBy('id').limit(2).forUseInQueryAs('tree')` — `beforeQuery`/`afterQuery` on the inner recursive body, `orderBy`/`beforeOrderByItems`/`limit` on the wrapping select. The two regression guards test each side alone.
  - **T1c** — the recursive-with-ordering result consumed via the **inline consumers** `forUseAsInlineQueryValue` (order by inside the scalar subquery) and `forUseAsInlineAggregatedArrayValue` (order by relocated into the wrapping derived table). The fix only touched `forUseInQueryAs`; these paths were verified to emit *valid* SQL (candidate-defect refuted) but are untested.
  - Home: `cte.recursive-union-variants.test.ts`. Fixtures: `tIssue.parentId`/`tProject`. (T1d borderline: `orderBy`-alone-wrap; `orderingSiblingsOnly`-wrap — lower value, listed §C.)

**T2 · Projection container-optionalisation arms** *(F3-PROJ + F9-TYPEVAR converged; the `143fe3b2` fix's untested make-optional arms — compile-confirmed OPTIONAL, no misfire).* The fix's 8 collapse tests cover only the rule-2 and rule-4 inner arms; the third make-optional arm and the multi-level case are untested:
  - **T2a (rule-1 sole-inner)** — a container whose SOLE member is a **rule-1** inner object (`{ inner: { gate: tIssue.title.asRequiredInOptionalObject(), extra: tIssue.assigneeId } }`) → container `wrapper?` optional. The `ContainsRequiredInOptionalObject → never` arm as a *sole* contributor. 4 type-paths (present/collapse × both projectors). Home: `select.complex-projection.inner-rules.test.ts`.
  - **T2b (multi-level optional chain)** — `{ a: { b: { c: { body, assigneeId } } } }` with no required siblings → **all three** containers optional (`a?: { b: { c: {…} | undefined } | undefined }`). The fix's depth-2 tests can't reach the upward propagation through `ContainsRequired → 2 → 3`. Value: all-null → `'a' in row === false` (default) / `a: null` (nullable, null propagates up two levels). Higher value.
  - **T2c** — mixed container (required-object inner + optional inner, no scalar → required wins); **T2d** — deeper-nested sole-optional-inner (a distinct hand-copied `ResultObjectValues3` level). Both MEDIUM.

**T3 · SELECT/compound composition seams** *(SEL-SEAM; pg).*
  - compound × `customizeQuery` → `forUseInQueryAs` (CTE-materialise a customized compound) and → `forUseAsInlineQueryValue` (customized compound as scalar subquery) — the array-consumer variant is covered, these two are not.
  - non-recursive `forUseInQueryAs` CTE × the projection-only hooks (`afterSelectKeyword`/`beforeColumns`/`customWindow`/`beforeOrderByItems`/`afterOrderByItems`) — the **SURVIVE** counterpart to the existing recursive-CTE **DROP** test (a plain SELECT body has a render site).
  - compound × `orderBy`+`limit` × `customizeQuery` → `executeSelectPage` (hook placement in the count-wrap).
  - **SEL-SEAM-B1** — the recursive×compound cross `recursiveUnionAll(…).union(other)` (probed valid; clean §A).

**T4 · Mutation composition seams** *(MUT-SEAM; 0 defects).*
  - **The INSERT `__isAllowed` walker** (`InsertQueryBuilder.ts:1964-2038`) is a *distinct function* from the UPDATE/DELETE walkers; its `__customization`-fragment, `__columns` (returning-column), `__multiple` (multi-row set-value), and `__onConflictOnColumnsWhere` (partial-index-where) gate branches are gated-tested on UPDATE/DELETE but **never on INSERT** (4 branches, each throw-observable via `isQueryAllowed===false` + `executeInsert` throw). Home: `mutation.allow-when.test.ts` / `insert.on-conflict.allow-when.test.ts`.
  - `update.from().innerJoin().on().returning({nested})` and `delete.using().innerJoin().returning({nested})` — the join-after-from/using base limbs landed Round 25; their RETURNING composition is unasserted matrix-wide (valid PG). *(F4-UPDDEL classifies these as emission-only / OUT since they reuse the `ReturningFnType` type-path; MUT-SEAM classifies them §A as untested emission seams — listed here as low-tier §A per the seam view.)*

### Tier 2 — distinct overloads / branches / twin-parity

**T5 · Twin-interface parity** *(PARITY; 0 defects, fresh seeds verified consistent).*
  - **ShapedMissingKeysMultipleInsertExpression** (`insert.ts:549-606`) — the shaped multi-row missing-keys interface is uncovered matrix-wide while its unshaped twin (`insert.multi-row.missing-keys.test.ts`, 4 tests) is covered; every shaped `dynamicValues([…])` in the matrix supplies complete rows. Reach via `shapedAs(…).dynamicValues([incomplete rows])` → clear with `setForAll`/`disallowIfNoValue`/`keepOnly`/`ignoreIfSet`. Systematic gap; mirror the 4 unshaped tests.
  - shaped single-object `dynamicValues` overload (`insert.ts:631`) — untested (the unshaped single-object and the shaped-array forms are both tested).

**T6 · INSERT `disallow*(error: Error)` overload** *(F4-INSERT-A1; coordinator-confirmed parity gap).* The Error-object dispatch branch (`InsertQueryBuilder.ts` — throws the caller's Error *verbatim* + `disallowedProperty`, vs the string branch's wrapped `TsSqlProcessingError`) is passed only string literals across every INSERT test; its UPDATE twin **is** tested (`update.shaped-disallow.test.ts:312`). Distinct builder branch, value-observable. One representative test.

**T7 · Brand-survival on branded receivers** *(F1-CUSTOMNUM; coverage-invisible, per the type-driven method).* Brand-KEEP is invisible on plain-`number`-TYPE receivers (keep ≡ erase both project `number`); it is only observable on a **branded newtype** receiver. Today only `abs` (customInt) and `sqrt` (customDouble) are brand-guarded there:
  - **T7a** — customInt KEEP methods on a branded `ReleaseTag` receiver: `ceil/floor/round/minValue/maxValue/add(const)/subtract/multiply/modulo/valueWhenNull/nullIfValue` (~11) each Exact-assert the leaf stays `ReleaseTag`.
  - **T7b** — customDouble KEEP methods on a branded `Money` receiver: the full SqlFunction0 (`abs/ceil/floor/round/exp/ln/log10/cbrt` + 7 trig) + SqlFunction1 (`power/logn/roundn`×4 incl. `roundn(TYPE)`/`min/max/add/subtract/multiply/divide/modulo/atan2/valueWhenNull/nullIfValue`) (~30) each Exact-assert `Money`.
  - Fixtures exist (`const(x as ReleaseTag/Money, …)`, `vReleaseOverview.releaseOrdinal`). Large but mechanical; extend `branded-newtype-keeps-or-erases-the-brand`.

**T8 · Equality/comparison per-leaf residuals** *(F1-EQCMP; 0 defects; the value-source-operand mass-claim from Round 25 stays refuted — subquery operands cover it).*
  - boolean `billable` `notIn([…])` / `inN(…)` / `notInN(…)` (only `in([…])` is covered).
  - `in(subquery)` / `notIn(subquery)` for the six **temporal** leaves (three custom + three plain) — the subquery overload is tested per-leaf for the non-temporal leaves, never reached for temporal.
  - *(A-1 double `estimatedHours` full `*IfValue` family — the agent disclosed this is **borderline degenerate**: double and int both resolve to `NumberValueSource` and `*IfValue` is inherited generically. Listed §C/Tier-3, not promoted.)*

**T9 · Dynamic-condition from-model numeric-literal arm** *(F6-DYN-A1).* `DynamicDefinitionFieldForModel` (`src/dynamic/condition.ts:26`) maps a **numeric-literal union** to `['enum', T]` (the `[number] extends [T]` false branch), distinct from the tested string-literal arm and the widened-`number`→`'int'` arm. Real-emit-validatable via `dynamicConditionFor`. Home: `dynamic-condition.from-model.test.ts`.

**T10 · Oracle connectBy × cross-cutting-feature grid** *(SEL-SEAM A5-A9; oracle cell).* The hierarchical-query builder is tested only with `startWith`+`connectBy`(+`orderingSiblingsOnly`); nothing composed onto it: connectBy **without** `startWith` (distinct `ConnectByFnType` overload + emission), connectBy × `customizeQuery` order-by hooks, × `forUseInQueryAs`, × `forUseAsInline{Query,AggregatedArray}Value`, × `projectingOptionalValuesAsNullable`. Home: `oracle/newest/oracledb/select.connect-by.test.ts`.

### Tier 3 — borderline / low-value (listed per the maximalist bar)

- **F3-SELECT-A1** — `ExecutableSelect.query()` / `params()` never called on a SELECT builder (only on INSERT/UPDATE); distinct public accessor pair, but its emitted SQL is already asserted via every execute path's `ctx.lastSql`. Low.
- **F1-BOOLIF-A1** — `onlyWhenOrNull(when)` / `ignoreWhenAsNull(when)` on a **boolean** receiver (every matrix call site is numeric/string/aggregate); the custom-boolean `when=true` passthrough carries the read-remap (`(published='t')`). Low-moderate.
- **F4-INSERT-A2** — from-select `onConflictOnConstraint(name)` (distinct interface method composing two covered pieces). Low.
- **F-RECENT-A5/A6, F3-PROJ-T2c/T2d** — the recursive orderBy-alone/orderingSiblingsOnly wraps and the mixed/deeper projection arms. Low-medium.

---

## §B — needs a fixture

**None actionable.** Every §A item is reachable with existing `domain/connection.ts`
fixtures (including the Round-25-added `tAuditEntryNoAdapter`). One optional,
**non-recommended** note (F1-CUSTOMNUM): a required *branded customDouble column*
does not exist, so T7b's brand-survival is exercised through `const(x as Money, …)`
rather than a real column — `const` covers the identical type-path, so no fixture is
warranted.

---

## §C / OUT — degenerate, scope-flagged, or refuted (kept so the next round doesn't re-chase)

- **F-RECENT-A4 inline-consumers CANDIDATE DEFECT — REFUTED.** The recursive-with-ordering result consumed inline emits valid SQL (order by relocated into the scalar subquery / the json_agg derived table); it is a clean §A test (T1c), not a bug.
- **SEL-SEAM-B1 recursive×compound — REFUTED as defect.** Emits valid hoisted `with recursive`; clean §A (T3).
- **F1-CUSTOMNUM SOURCE-union asymmetry — OUT (compile-only).** customInt `valueWhenNull`/`nullIfValue` value-source overloads return `CustomIntValueSource<SOURCE,…>` (no `VALUE[source]` union) while customDouble unions it; a phantom-`SOURCE` provenance property, not observable in emitted SQL/params/value/result-Exact → `types.negative` territory, not a §A value test. Noted for the type-bug lane only.
- **F7-EXTRAS `UNSUPPORTED_QUERY` (MySQL compat-mode) — SCOPE-FLAGGED.** Both arms (recursive-CTE / VALUES-in-WITH under `compatibilityVersion < 8_000_000`) are builder-reachable and asserted nowhere, reachable via the existing `compatibilityVersion` constructor param on the mysql cell. But it is a **version-band-gated** builder reason, which the standing scope note tends to exclude ("version-band emission"). Presented for the maintainer's call; not counted as an in-scope §A.
- **F1-EQCMP-A1 double `*IfValue`** — borderline degenerate (double≈int `NumberValueSource`, `*IfValue` inherited generically); listed, not promoted.
- Standard degenerate fan-outs (per-kind through shared `DBColumnImpl`/connection dispatchers; native-leaf value-source-operand twins where a subquery operand is already tested; connectBy on non-oracle = `never`; the `ContainsRequired5` depth-limit arm = compile-only) — all confirmed §C, unchanged from Round 25.
- **Non-gap notes for maintainer awareness:** `optionalComputedColumn`/`Values.optionalColumn` `__writable` asymmetry (type-invisible, re-verified unobservable); PARITY's benign sqlite `ReturningOneColumnFnType` union member (inert); F6-DYN's stale `between` comment in `dynamic-condition.operators.test.ts:13` (a one-line comment cleanup, no such operator exists).

---

## Per-surface counts + saturation map

| Agent | §A | §B | verdict |
|---|---|---|---|
| F-RECENT (recursive wrap + compound) | 4 (+2 borderline) | 0 | fix sound; tail arms uncovered; A4 defect REFUTED |
| F3-PROJ (projectionRules rewrite) | 8 paths | 0 | fix SOUND (0 misfire); rule-1/multi-level arms uncovered |
| F9-TYPEVAR | 2 | 0 | fix SOUND; rule-1 + multi-level chain; brand/scalar/MergeOptional saturated |
| SEL-SEAM | 9 (4 pg + 5 oracle) | 0 | seams at boundaries; B1 probed valid |
| MUT-SEAM | 6 (+1 borderline) | 0 | INSERT walker gates + join×returning; 0 defects |
| PARITY | 2 | 0 | fresh seeds consistent; shaped-multi-row-missing-keys gap; 0 defects |
| F1-EQCMP | ~5 (A-2/A-3) | 0 | 0 defects; value-source-operand mass-claim stays refuted |
| F5-CONN | 0 | 0 | **SATURATED** |
| F4-INSERT | 1 (+1 borderline) | 0 | disallow-Error parity gap; 0 defects |
| F4-UPDDEL | 0 | 0 | **SATURATED** |
| F1-CUSTOMNUM | ~2 clusters | 0 | brand-survival tail; 1 compile-only candidate OUT |
| F1-NUM | 0 | 0 | **SATURATED** (modulo-on-double stayed fixed) |
| F1-STR | 0 | 0 | **SATURATED** |
| F1-BOOLIF | 1 | 0 | prior A1/A2 landed; onlyWhenOrNull-on-boolean residual |
| F1-TEMP | 0 | 0 | **SATURATED** |
| F2-COL | 0 | 0 | **SATURATED** (tAuditEntryNoAdapter closed B1) |
| F2-VALVIEW | 0 | 0 | **SATURATED** |
| F3-SELECT | 1 | 0 | saturated except query()/params() accessors |
| F6-DYN | 1 | 0 | numeric-literal from-model arm; 0 defects |
| F7-EXTRAS | 0 (1 scope-flagged) | 0 | version-band reason, maintainer's call |

---

## Recommended implementation order (fresh-fix arms first, Tier-1-on-existing-fixtures)

1. **T1a/T1b/T1c** — the recursive wrapping-CTE tail (order-less wrap, dual re-homing, inline consumers). Guards the just-landed `726d9e77` fix's untested arms; all probed valid.
2. **T2a/T2b** — projection rule-1 sole-inner + the multi-level optional chain. Guards the just-landed `143fe3b2` fix; compile-confirmed optional. (Then T2c/T2d.)
3. **T3** — compound×customize→forUseInQueryAs/inline; the non-recursive CTE projection-hook SURVIVE test; the recursive×compound cross (B1).
4. **T4** — the 4 INSERT allow-when walker gates; the join-after-from/using × RETURNING pair.
5. **T5/T6** — ShapedMissingKeysMultipleInsertExpression + shaped single-object dynamicValues; the INSERT disallow-Error overload.
6. **T7** — brand-survival on branded receivers (large but mechanical; do the full enumeration or a representative subset per appetite).
7. **T8/T9/T10** — boolean in-family + temporal in-subquery; numeric-literal from-model arm; the Oracle connectBy × feature grid.
8. Tier-3 (F3-SELECT query/params, F1-BOOLIF onlyWhenOrNull-boolean, etc.) as time permits. Skip/defer the F7 version-band reason pending a scope decision.

## Honest verdict

A textbook **mature saturating round**. The two fixes from Round 25
(`143fe3b2` projection-optionalisation, `726d9e77` recursive wrapping-CTE) are the
round's centre of gravity, and both are **sound**: five agents converged on their
positive/tail arms, the coordinator compile-repro confirmed the corrected
container optionality, and the runtime probe confirmed every recursive-consumption
emission (wrapping CTE, inline scalar, inline aggregated-array, recursive×compound)
is **valid SQL** — the one candidate defect raised against the untouched inline
consumers was refuted by the probe. **Zero confirmed `src/` bugs — BUGS.md stays
empty, which per §9 is a success.** The value is a clean §A tail: the fixes'
under-tested arms, the standing composition seams (compound×customize, the Oracle
connectBy grid, the INSERT allow-when walker), the coverage-invisible brand-survival
class, and two twin-parity gaps (shaped-multi-row-missing-keys, INSERT disallow-Error).
No bug was fabricated and §A was not padded with degenerate per-kind gaps; seven
surfaces are named as genuinely saturated.
