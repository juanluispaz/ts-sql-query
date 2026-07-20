# Missing-tests audit — ROUND 27

**Mandate:** type-driven, multi-agent missing-tests detection over the `test/`
matrix. Find tests the TYPE DEFINITIONS in `src/` imply but the suite lacks, and
hunt type-vs-impl divergences. **Degeneracy bar in force:** the narrow bar (§4 of
[`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md)). Maximalist round.

**Method:** 20 discovery agents (the ~16 standard surfaces + the two mature-phase
extras F-RECENT and F9-TYPEVAR), two waves of ≤10, led by the parity sweep and
the two seam critics. Every load-bearing claim was coordinator-verified with a
direct `src/` read or a mock runtime SQL probe (probe deleted; tree clean).

**Pre-flight state:** `tests:audit` clean (17 cells, 234 files, **2287 tests/cell**,
matrix symmetric — up from 2224 after Round 26's implementations). `BUGS.md` empty
at start and end. Reference cell `postgres/newest/pg/`. Domain unchanged since
Round 26.

**Freshly-changed src surface (§0.5 step 5 — the round's top target):** the only
`src/` change since Round 26 is **`1b00764e`** ("PostgreSQL compat < 18: Fix
nested complex projection in update using old values") — an **emission fix** in
`AbstractSqlBuilder.ts`: `_extractAdditionalRequiredTablesForUpdate` (`:2359`) and
`_extractAdditionalRequiredColumnsForUpdate` (`:2395`) now `flattenQueryColumns(...)`
before registering, so a FROM-joined table/column referenced **only** inside a
nested RETURNING sub-object is discovered + pre-projected into the synthetic
`_old_` subquery. Gated to PG compat < 18 (`postgres/oldest/*`; compat 18 uses
native OLD/NEW).

## Headline counts

| | |
|---|---|
| **Confirmed `src/` bugs** | **0** — BUGS.md stays empty (3rd consecutive clean round) |
| **Candidate defects → adjudicated** | **0 survive** — MUT-SEAM-A3 (update-from-returning-a-from-column) runtime-probed → valid SQL → REFUTED as defect, kept as clean §A; 1 compile-only SOURCE-union asymmetry re-confirmed OUT |
| **§A findings (existing cell + existing fixtures)** | **~13 clusters** (see themes), concentrated on the join-after-from/using limb + composition seams + `requiredInOptionalObject` remap edges |
| **§B findings (need a fixture)** | **0** |
| **Surfaces genuinely saturated (0 §A)** | **11** — F5-CONN, F4-INSERT, PARITY, F1-NUM, F1-STR, F1-CUSTOMNUM, F2-COL, F1-TEMP, F2-VALVIEW, F7-EXTRAS, + F-RECENT(fresh surface, covered) |

**Verdict up front:** a **mature saturating round with ZERO confirmed bugs** — the
3rd consecutive clean round. The freshly-fixed emission surface (`1b00764e`)
**shipped its own regression lock** and is fully covered. Eleven surfaces come
back 0/0. The round's value is a clean §A composition/tail — the **left-join
twins** of Round 26's inner-join-after-from/using limb (independently found by two
agents), the `Values`-in-a-compound-arm seam, and the `requiredInOptionalObject`
projection-remap edges. No fabricated bug; no §A padding.

---

## Coordinator verification notes (what I checked myself)

- **Fresh surface (`1b00764e`) — CONFIRMED covered, by direct `src/` read.** F-RECENT
  claimed 0 §A because the fix shipped its own lock
  (`returning-old-new-and-from-column-folded-into-nested-audit-object`, postgres/oldest
  ×4 cells, **snapshot corrected by the fix commit**). The load-bearing claim was that
  `_extractAdditionalRequiredTablesForUpdate`/`…ColumnsForUpdate` walk
  `query.__sets` + flattened `query.__columns` but **not** `query.__where` — so in
  that test the FROM-table `tOrganization` is discovered *only* via the flattened
  nested `audit.org` column (the WHERE `.and(...)` reference is irrelevant to the
  extract). I read `AbstractSqlBuilder.ts:2359-2416` and confirmed exactly that — the
  extract loops iterate `__sets` and `flattenQueryColumns(__columns)`, never `__where`.
  So both flatten arms (table + column) are genuinely exercised. Fresh surface = 0 §A.
- **mock runtime SQL probe** (`_probe27.test.ts`, deleted, 4/4 passed):
  - **UPDATE left-join-after-from** (A1): `update project set name = issue.title from issue left join app_user on app_user.id = issue.assignee_id where …` — valid PG.
  - **DELETE left-join-after-using** (A2): `delete from issue using project left join app_user on app_user.id = issue.assignee_id where …` — valid PG.
  - **MUT-SEAM-A3 CANDIDATE → REFUTED**: plain `update…from` (no oldValues) RETURNING a FROM-table column emits valid SQL both flat (`returning … organization.name as "orgName"`) and nested (`… as "audit.org"`). Not per-dialect-broken on PG; a clean §A gap, not a defect.
- Working tree verified clean (`git status --porcelain` shows only the report +
  pre-existing untracked; no `_repro`/`_probe`).

---

## §A — findings, grouped by theme × risk tier

### Tier 1 — composition seams (highest value)

**T1 · The LEFT-join-after-from / -after-using limb** *(F4-UPDDEL A1/A2 and MUT-SEAM A1/A2 independently converged; probed VALID).* Round 26 added only `innerJoin(...).on(bareCond)` after `.from()`/`.using()`. `UpdateFromExpression`/`DeleteUsingExpression` declare `leftJoin`/`leftOuterJoin` **unconditionally** (not `OfDB`-gated), so on PostgreSQL:
  - **T1a** `update(t).from(j1).leftJoin(j2.forUseInLeftJoin()).on(…).set(…).where(…)` → `… from j1 left join j2 on … where …`. Distinct from the inner limb: leftJoin introduces **nullable** joined columns (a real type distinction, not kind-string-only).
  - **T1b** `delete(t).using(u1).leftJoin(u2.forUseInLeftJoin()).on(…).where(…)` → the delete twin.
  - **T1c** join-predicate compositions on that limb: `.on(c).and(c2)` (`DynamicOnExpression.and`, distinct dispatch onto `__lastJoin.__on`, not the WHERE's `.and`) and `.dynamicOn().and/.or(…)` — Postgres-reachable **only** via the from/using-join limb (the direct-join path is NOT-APPLICABLE), so entirely uncovered on PG.
  - Home: `update.join.test.ts` / `delete.join.test.ts`. `leftOuterJoin` bakes alongside `leftJoin` as its kind-string sibling (§C). Fixtures present.

**T2 · `Values` view as a compound (UNION) arm source** *(SEL-SEAM A1; sound per its CTE sibling).* `conn.selectFrom(vValues).select({…}).union(conn.selectFrom(tProject).select({…}))` — an arm whose FROM is an inline `Values` view must bubble its `WITH name(cols) AS (VALUES …)` up to the top-level compound WITH clause (`SelectQueryBuilder.ts:1562-1570`). No matrix test puts a `Values` source in any compound arm. Sound: the identical WithView bubble for a `forUseInQueryAs` CTE arm is green (`customize-query.compound` `customize-compound-with-query-hooks-wrap-cte`). Docker/native run advised (WITH-VALUES tuple casts are dialect-specific). Needs a `Values` fixture usable in a compound.

**T3 · Plain `update…from` RETURNING a FROM-table column** *(MUT-SEAM A3; probed VALID, candidate-defect refuted).* `update(tProject).from(tOrganization).set(…).returning({ id, … : tOrganization.name })` — the delete twin is active (`delete.using.variants` returns `project.slug`), the update twin (flat and nested, without oldValues) is absent matrix-wide. Probe confirms valid PG SQL. Marginal (the oldValues variant is covered), but a distinct `_buildUpdateReturning` from-table-qualification path.

### Tier 2 — distinct return-branches / overloads

**T4 · Projection `requiredInOptionalObject` remap edges** *(F3-PROJ A1/A2 + F9-TYPEVAR A1; all type↔runtime-verified sound — no misfire).*
  - **T4a (F3-PROJ A1, strongest):** `OptionalTypeForWith` (`asWithView.ts:58-63`) maps `requiredInOptionalObject → optional`, so a CTE that projects an `.asRequiredInOptionalObject()` leaf and is re-selected **loses the gate** — rule-1 `meta?: { gate: string; … }` (gate required-when-present, object dropped when gate is null) becomes rule-4 `meta?: { gate?: string; … }` (dropped only when all leaves null). Observable type + value distinction. Home: `select.complex-projection.inner-rules.test.ts`.
  - **T4b (F3-PROJ A2, dual):** `OptionalTypeForLeftJoin` (`asLeftJoin.ts:44-48`) passes `requiredInOptionalObject` through **unchanged** via `forUseInLeftJoin` (leftJoin preserves the gate) — the inverse of T4a.
  - **T4c (F9-TYPEVAR A1):** `MergeOptional<requiredInOptionalObject, optional> → optional` demotion — `meta: { flag: tIssue.priority.asRequiredInOptionalObject().equals(tIssue.assigneeId), ownReq: tIssue.number }` → flag demotes to optional, ownReq keeps the object required → rule-3 `meta: { flag?: boolean; ownReq: number }` (the inverse of the covered preserve arm). Value-realized at the `assigneeId=NULL` boundary row (type says `meta` required, runtime always supplies `ownReq` — matched, sound). + as-nullable twin.
  - **T4d (F3-PROJ A3, weak):** pick over an optional left-join container under `projectingOptionalValuesAsNullable` with `Exact` (the covered `deep-pick` uses `Extends` + default projector only).

**T5 · `notBetween` mixed value-source overloads** *(F1-EQCMP A1).* `ComparableValueSource.notBetween(TYPE, VALUE)` / `(VALUE, TYPE)` (`values.ts:305-308`) have **0** matrix occurrences while their `between` mixed twins have 48 — a between/notBetween asymmetry. One test reusing `durationMs`/`costCents`/`externalRef` + `loSub`/`hiSub` closes both overloads.

### Tier 3 — borderline / low-value (listed per the maximalist bar)

- **T6 · F4-UPDDEL A4** — `extendShape` post-set WHERE-required arm (arm 2 of 4; impl identical to arm 3, only the not-executable return-state differs).
- **T7 · F3-SELECT A1** — `query()`/`params()` on a *compound* select (`CompoundSelectQueryBuilder.__asSelectData` is a distinct builder path; the Round-26 accessor test was plain-only).
- **T8 · F1-BOOLIF A1** — boolean `valueWhenNull<VALUE>`/`nullIfValue<VALUE>` value-source overload → the never-emitted double-coalesce-remap `coalesce((approved = 'A'), (invoiced = 1))`.
- **T9 · F6-DYN A-1** — `undefined` element inside `and`/`or` arrays (`Array<… | undefined>`, `values.ts:160-161/228-229`) — the conditional-spread idiom `and: [cond ? {…} : undefined]`; zero matrix hits, and the sole type-legal route to `DynamicConditionBuilder.processFilter`'s top-level `null|undefined` guard.
- **T10 · SEL-SEAM A2/B1 (thin)** — chained-CTE double-WITH via a non-JOIN consumer (inline-aggregated-array / compound arm); Oracle `connectBy` × compound (`connectByResult.union`).

---

## §B — needs a fixture

**None** for the §A findings above (all reachable with existing `tProject`/`tIssue`/
`tOrganization`/`tAppUser`/`tIssueWorklog` fixtures). One exception is **T2** (Values-in-compound-arm): it needs a `Values` view instance usable in a compound arm — check whether an existing `with-values` fixture is reusable before adding one.

---

## §C / OUT — degenerate, scope-flagged, or refuted (kept so the next round doesn't re-chase)

- **MUT-SEAM-A3 defect reading — REFUTED** (probed valid). Kept as clean §A (T3).
- **customInt `valueWhenNull<VALUE>`/`nullIfValue<VALUE>` SOURCE-union asymmetry — compile-only, OUT (re-confirmed, persistent 2 rounds).** `CustomIntValueSource` (`values.ts:603/605`) returns `CustomIntValueSource<SOURCE, …>` — it **drops** the `| VALUE[typeof source]` union that every other value-source type carries, including its sibling `CustomDouble` (`:669/:671`). A genuine src type-safety inconsistency (customInt is the lone outlier), but its only manifestation is at the type level (phantom `SOURCE`, absent from the projected shape / SQL / value), so it is `types.negative/` territory — **OUT of the audit's runtime/value §A scope, not filed to BUGS.md**. Flagged for the src owner: adding `| VALUE[typeof source]` to the two customInt overloads + a `types.negative` lock would close it. *(Note added to the runbook's OUT list so it is not re-litigated as new next round.)*
- **Standard degenerate fan-outs** — per-kind through shared `DBColumnImpl`/connection dispatchers (F2-COL, F5-CONN); native-leaf value-source-operand twins where a subquery operand is tested (F1-EQCMP); `left join` vs `left outer join` kind-string; `.join`-alias vs `innerJoin`; recursiveUnion-dedup vs -All; compound-of-3 arm count; subSelectUsing arity 3-5; deeper projection nesting (flatten is depth-agnostic); F6-DYN A-2/A-3/A-4 (no-op skip branches, `expandType*` nullability wrappers). All confirmed §C.
- **Version-band / driver-layer reasons** — `UNSUPPORTED_QUERY` (MySQL compat-mode), driver-layer `TsSqlErrorReason` members — OUT (F7-EXTRAS, unchanged from Round 26).
- **Non-gap notes** — `optionalComputedColumn`/`Values.optionalColumn` `__writable` (type-invisible, re-verified); the stale `between` comment in `dynamic-condition.operators.test.ts:13`.

---

## Per-surface counts + saturation map

| Agent | §A | §B | verdict |
|---|---|---|---|
| F-RECENT (fresh `1b00764e`) | 0 | 0 | fix shipped its own lock; **covered** (extract-fn confirmed) |
| F4-UPDDEL | 4 | 0 | join-after-from/using left-join limb (A1/A2 converge w/ MUT-SEAM) |
| MUT-SEAM | 3 | 0 | left-join limbs (converge) + update-from-returning-from-col (probed valid) |
| SEL-SEAM | 1 + 2 thin | 0 | Values-in-compound-arm; chained-CTE / connectBy×compound thin |
| F3-PROJ | 3 marginal | 0 | requiredInOptionalObject remap edges; type↔runtime verified |
| F9-TYPEVAR | 1 | 0 | MergeOptional demote arm (sound) |
| F1-EQCMP | 1 | 0 | notBetween mixed value-source overloads |
| F1-BOOLIF | 1 (edge) | 0 | boolean valueWhenNull<VALUE> double-coalesce-remap |
| F3-SELECT | 1 | 0 | query()/params() on a compound |
| F6-DYN | 1 (+3 minor) | 0 | undefined array element in and/or |
| F5-CONN | 0 | 0 | **SATURATED** (3rd round) |
| F4-INSERT | 0 | 0 | **SATURATED** |
| PARITY | 0 | 0 | **SATURATED** (twin parity clean ~10th round) |
| F1-NUM | 0 | 0 | **SATURATED** (3rd; modulo-on-double stays fixed) |
| F1-STR | 0 | 0 | **SATURATED** (3rd) |
| F1-CUSTOMNUM | 0 | 0 | **SATURATED** (brand-survival landed; 1 compile-only OUT) |
| F2-COL | 0 | 0 | **SATURATED** (3rd) |
| F1-TEMP | 0 | 0 | **SATURATED** (4 dedicated files) |
| F2-VALVIEW | 0 | 0 | **SATURATED** |
| F7-EXTRAS | 0 | 0 | **SATURATED** (45/45 exports) |

---

## Recommended implementation order

1. **T1a/T1b/T1c** — the left-join-after-from/using limb (two agents converged; probed valid). Highest value; bake snapshots + docker/native validate (control = the inner-join sibling from Round 26).
2. **T2** — `Values` view as a compound UNION arm (needs a Values-in-compound fixture; sound per the CTE sibling).
3. **T4a/T4c** — the `requiredInOptionalObject` with-view strip (T4a) and the `MergeOptional` demote arm (T4c); then T4b/T4d.
4. **T5** — `notBetween` mixed value-source overloads (one test, existing fixtures).
5. **T3, T6-T10** — the Tier-3 tail (update-from-returning-from-col, extendShape arm, compound query()/params(), boolean valueWhenNull<VALUE>, undefined array element) as time permits.
6. Hand the **customInt SOURCE-union asymmetry** to the src owner (a `types.negative` lock, not a suite test).

## Honest verdict

A clean **mature saturating round** — the third consecutive with **zero confirmed
bugs**. The only `src/` change since Round 26 was an emission fix that **shipped
its own regression lock** (verified by direct `src/` read of the extract functions),
so the top-priority fresh surface came back fully covered. Eleven surfaces are
genuinely saturated; twin-interface parity is clean for the ~10th consecutive round.
The value is a clean §A tail: the **left-join twins** of the from/using-join limb
(independently found by F4-UPDDEL and MUT-SEAM, probed to valid SQL), the
`Values`-in-a-compound-arm WITH-bubble, and the `requiredInOptionalObject`
projection-remap edges — each type↔runtime-verified sound. No bug was fabricated,
no §A padded; the one persistent type-level asymmetry (customInt SOURCE-union) is
honestly scoped OUT as a compile-only `types.negative` candidate for the src owner.
