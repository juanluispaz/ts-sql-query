# Missing-tests audit — ROUND 21

**Method**: type-driven, multi-agent. 17 discovery agents (one per surface,
`test/TYPE_AUDIT_RUNBOOK.md` §6 decomposition), dispatched in waves of ≤10 to
stay under the server-side rate limit, led by the **parity sweep (theme 10)** and
the **seam critic (F8-META, theme 8)**. Each raw-read its slice of `src/` TYPES,
built an exhaustive type-path matrix, and checked every cell against the CURRENT
test files. The coordinator verified every load-bearing claim itself
(compile-repro for type questions, runtime probe for emission/throw candidates).

**Degeneracy bar in force**: the narrow bar (§4) — a distinct reachable
overload / interface / per-receiver method / arity / input-classification is a
GAP even when its output coincides with a covered case; degenerate only when
same-overload + shared-dispatcher + kind-string-only + provably-generic +
representative-tested (and even then LISTED, §C).

**Pre-flight**: N=21 (prior highest `_20`). Matrix `bun run tests:audit` →
**17 cells, 231 files, 1990 tests/cell** (33 830 total), symmetric, audit clean.
Reference cell `postgres/newest/pg/`. `test/BUGS.md` was **empty** at start.
Index refreshed. `domain/connection.ts` re-read in full (719 lines).

---

## Headline counts

| Bucket | Count |
|---|---|
| **Confirmed `src/` bugs** (→ `BUGS.md`, coordinator-verified) | **2 filed → 1 real (BUG-2, fixed), 1 false-positive (BUG-1, closed)** — see Resolution |
| Candidate defects adjudicated **latent / OUT** (documented, not filed) | 2 |
| **§A** missing tests (existing cells + existing fixtures) | ~14 clusters |
| **§B** missing tests (needs a fixture addition) | 3 |
| **Genuinely saturated** surfaces (0/0) | 7 |

**The round's value is the two candidate bugs at the seams** (on resolution: one
real, one false positive — see Resolution below), surfaced by the parity sweep /
seam critic, as the mature-phase note (§9) predicts. Most single-surface agents
came back saturated — a correct, expected outcome, not a shortfall. The
false-positive (BUG-1) is itself a lesson: the coordinator's repro confirmed a
*type divergence* but not its *wrongness* — a runtime-delegation oracle does not
establish a type-coincidence obligation (§ Resolution).

---

## Resolution (fixing agent — 2026-07-03)

The two entries were handed to the fixing agent. Outcome: **1 real bug fixed,
1 misdiagnosis closed.** The two `BUGS.md` entries have been removed.

- **BUG-2 — CONFIRMED and FIXED.** A genuine emission bug. Fixed in
  `SelectQueryBuilder.ts` `forUseInQueryAs` (recursive branch): the whole-statement
  SQL hooks `__applyRecursiveCustomization` parked on the now-discarded
  `__recursiveSelect` are re-homed onto the CTE body, so `beforeQuery`/`afterQuery`
  render **inside** the recursive CTE parens (mirroring the non-recursive path),
  verified across all six dialects (incl. Oracle `with tree(id, parentId) as …`
  and SQL Server bare `with tree as …`). A **live** test was added to
  `customize-query.select.test.ts` in all 17 cells and a CHANGELOG entry filed.

- **BUG-1 — FALSE POSITIVE (working-as-intended); `src/` NOT changed.** The
  audit's load-bearing premise — *"`disallowIfNoValueWhen(true, …) ≡
  disallowIfNoValue(…)` at runtime, therefore their result types must coincide"* —
  is **wrong**. Runtime delegation does not imply type coincidence: the **entire
  `set*When` family** (`setWhen`, `setIfValueWhen`, `setIfSetWhen`, …) returns
  `MISSING_KEYS` unchanged while its non-When sibling narrows via `Exclude`, by
  deliberate design (`setWhen(true, all)` is runtime-identical to `set(all)` yet
  stays non-executable on purpose). This is exactly the "if it were a bug it
  wouldn't be limited to those two functions" tell. The governing principle —
  stated in the very `keepOnlyWhen` changelog fix the audit cites — is that **a
  conditional `*When` method must never *clear* a missing-key obligation**, because
  `when` is a runtime value. `disallowIfNoValue` clears keys soundly *because* it is
  unconditional and throws eagerly; `disallowIfNoValueWhen` clearing them would let
  `executeInsert()` compile on an insert whose required column was never set when
  `when === false` — the very unsoundness the `keepOnlyWhen` fix **removed**. The
  audit read that precedent backwards (keepOnlyWhen was fixed to *add* keys / stay
  non-executable, not to make the When form narrow). **Empirical proof**: with the
  candidate fix applied, `dynamicSet().disallowIfNoValueWhen(false, err, reqCol)
  .set(rest).executeInsert()` compiles (unsound); on the unchanged code it correctly
  does **not** (`TS2339: executeInsert does not exist on MissingKeysInsertExpression<…,
  "projectId">`). A **guard** lock — the sound invariant, *inverted* from the
  INSERT-A1 assertion the audit proposed — was added to all six
  `types.negative/insert.test.ts` (a `@ts-expect-error` on `.executeInsert()` after
  a `disallowIfNoValueWhen(false, …)` chain, plus a passing `disallowIfNoValue`
  control).

Everything below is the audit **as originally filed**; read it through this
Resolution.

---

## Confirmed bugs (as filed — see Resolution above for the outcome)

### BUG-1 — `disallowIfNoValueWhen` drops the `MISSING_KEYS` narrowing its runtime-twin `disallowIfNoValue` applies

> **RESOLUTION: FALSE POSITIVE — working as intended; `src/` unchanged.** The
> premise that runtime delegation forces type coincidence is wrong (the whole
> `set*When` family diverges by design; a `*When` must never clear a missing-key
> obligation). See the Resolution section above.


- **Class**: the `keepOnlyWhen` / shaped-`setWhen` MISSING_KEYS-mis-fold class
  (§9 ledger), resurfaced on a *different* set-rule.
- **Where**: `src/expressions/insert.ts`, all four `*MissingKeys*` interfaces —
  `disallowIfNoValue<COLUMNS>` returns `Exclude<MISSING_KEYS, COLUMNS>` at
  :281/:340/:515/:574, while `disallowIfNoValueWhen` returns `MISSING_KEYS`
  unchanged (and drops the `<COLUMNS>` generic) at :309/:368/:543/:602.
- **Why it must be a bug**: `InsertQueryBuilder.disallowIfNoValueWhen(true, …)`
  calls exactly `this.disallowIfNoValue(…)` (:1567-1569), so the result types
  must coincide. Through the downstream `[MISSING_KEYS] extends [never]`
  executability gate (insert.ts:1005-1006), the narrowing is observable: a later
  `.set(rest)` reaches executable via the direct form but not via `…When(true)`.
- **Found by**: the **parity sweep AND the F4-INSERT agent, independently**.
- **Coordinator verification**: compile-repro (tsgo) — `assertType<Exact<
  disallowIfNoValue(all), disallowIfNoValueWhen(true, all)>>` → **TS2344** on the
  single-row twin; the `keepOnly`/`keepOnlyWhen` positive control in the same
  repro passes (harness sound). The other three interfaces confirmed by direct
  signature reading (identical textual divergence). Repro deleted, tree clean.
- **Note**: `disallowIfNoValue` is the *only* disallow-rule whose non-When form
  narrows `MISSING_KEYS`, and the only one whose `When` twin forgot to — the rest
  of the `*When` octet is correctly benign (verified). Direction of fix (make
  When narrow, or make neither) is the fixing agent's call, oracle = the runtime
  delegation.

### BUG-2 — `customizeQuery` `beforeQuery`/`afterQuery` silently dropped on a recursive-union select consumed via `forUseInQueryAs`

> **RESOLUTION: CONFIRMED and FIXED** in `SelectQueryBuilder.ts` `forUseInQueryAs`
> (re-home the outer hooks onto the CTE body). Live test in all 17 cells; CHANGELOG
> filed. See the Resolution section above.

- **Class**: the recursive-CTE customizeQuery-drop class (§9 ledger), resurfaced
  on a *composition the earlier fix did not cover*.
- **Where**: `src/queryBuilders/SelectQueryBuilder.ts` — the recursive branch of
  `forUseInQueryAs` (~:539-547) returns only `recursiveView` and discards
  `this.__recursiveSelect`, on which `__applyRecursiveCustomization` (~:612-648)
  parked the whole-statement `beforeQuery`/`afterQuery` hooks.
- **Found by**: the **seam critic** (F8-META), composing customizeQuery × a
  recursive-union builder × forUseInQueryAs.
- **Coordinator verification**: runtime SQL probe (mock, `ctx.lastSql`), three
  arms sharing one `customizeQuery({beforeQuery:'/* head */', afterQuery:'/* tail */',
  beforeWithQuery:'/* warmup */', afterWithQuery:'/* end-of-with */'})`:
  - recursive + `forUseInQueryAs` → `with recursive tree as /* warmup */ (…) /* end-of-with */ …` — **`/* head */` & `/* tail */` GONE**.
  - same builder + `executeSelectMany` → all four present.
  - non-recursive + `forUseInQueryAs` → `with cte as /* warmup */ (/* head */ … /* tail */) /* end-of-with */ …` — all four present.
  Isolates the drop to the `recursive × forUseInQueryAs` seam. Probe deleted,
  tree clean.
- **Expected**: mirror the non-recursive CTE path — render
  `beforeQuery`/`afterQuery` inside the recursive CTE body.

---

## Candidate defects adjudicated — documented, NOT filed

### CD-A (latent) — malformed `NOldValuesFrom` union arm in the SQLite branch of UPDATE `returningOneColumn`

`src/expressions/update.ts:532` places `NOldValuesFrom<TABLE[typeof source]>` as
a **top-level** union arm of `COLUMN`'s constraint, whereas the non-SQLite branch
one line up (:530) correctly nests it inside `ValueSourceOf<…>`. `NOldValuesFrom`
is an `NSource` source-name brand, not a `ValueSource`, so on paper the SQLite
branch admits a raw brand as `COLUMN`. **Adjudication: LATENT / unreachable** —
`oldValues()` is typed `never` on `SqliteConnection`, so no public-API value of
`NOldValuesFrom<…>` can ever be constructed to reach the arm. It is a genuine
`src/` type inconsistency worth tidying (align :532 with :530), but it has no
observable/testable effect and cannot become a DESIGN Principle-#1 test, so it is
**not filed to `BUGS.md`** and yields no test. Recorded here so the next round
does not re-chase it. Found by F4-UPDDEL.

### CD-B (OUT — types.negative) — shaped opener `setIfValue` uses `MandatoryInsertSets` where the non-shaped opener uses `MandatoryOptionalInsertSets`

`src/expressions/insert.ts:627` (`ShapedInsertExpression.setIfValue`) constrains
its columns to `MandatoryInsertSets<TABLE, USING, SHAPE>` — identical to shaped
`set` (:626) — whereas the non-shaped `InsertExpression.setIfValue` (:613) uses
`MandatoryOptionalInsertSets<…>` (optionals may be `null|undefined`). So shaped
`setIfValue` is type-indistinguishable from shaped `set` and **narrows valid
input** (rejects `null|undefined` on optional shape keys). **Adjudication: OUT** —
this is an input-rejection (a `types.negative` concern), not an
emission/value/return-type divergence; low-confidence and needs a maintainer
intent call. Documented for the next round; not filed. Found by the parity sweep.

---

## §A — missing tests (existing cells + existing fixtures), tiered

### Tier 1 — distinct code-path / classification boundary (highest value, existing fixtures)

- **PROJ-A1 — rule-2 nested object mixing a left-join leaf with a `connection.const()`/no-table leaf** (`complexProjections/projectionRules.ts:70-77`). `AllFromSameLeftJoinWithOriginallyRequired` unions `NNoTableOrViewRequiredFrom<SOURCE>` (:72) so a `{ left-join-originallyRequired-leaf, conn.const(v,type) }` object STILL fires rule 2 (object optional). If the const leaf were misclassified as own-required, rule 3 would fire → object becomes required (shape diverges `proj?:` vs `proj:`). **No test anywhere** places a const/no-table leaf inside a left-join nested object. Both projectors. Fixtures exist (`tProject.forUseInLeftJoin()` + `conn.const`).
- **PROJ-A2 — single nested object whose value leaves come from TWO DIFFERENT left joins** (same classifier, negative direction). Two distinct left-joined tables in one object fail the single-`SOURCE` subset test → rule 2 does NOT fire → falls to rule 3 (object required, leaves demoted optional). Output coincides with an ordinary rule-3 object, hiding the rejected-rule-2 decision. Both projectors. Fixtures exist (`tProject`/`tAppUser` `forUseInLeftJoin()`).
- **SELECT-A1/A2 — compound-interface `executeSelectOne` / `executeSelectNoneOrOne`** (theme 6). The compound expression inherits both execute-shapes (select.ts:70-71); every compound test in the matrix ends in `executeSelectMany`/`executeSelectPage`. A `a.union(b).orderBy(...).executeSelectOne()` (one row) and the `…NoneOrOne()` null branch are the untested twins on the compound — exactly the divide where the `orderBy(valueSource)` wrap bug lived. Fixtures exist.
- **EQCMP-A1 — customUuid (`signingKey`) entire ordered-`Comparable` arm** — `signingKey` is declared `ComparableValueSource` (values.ts:802) but only its Equalable/Nullable surface is tested; `between`/`notBetween`/`lessThan`/`greaterThan`/`lessOrEquals`/`greaterOrEquals` (+ `*IfValue`) have **zero** representative on this branded leaf. Reachable as `tProjectRelease.signingKey.between(lo, hi)` with a seed-split value assertion. Fixtures exist.

### Tier 2 — distinct overloads / per-type emission / adapter fan-out (existing fixtures)

- **CONN-A1 — `const`/`optionalConst` custom-kind trailing-TypeAdapter (`adapter2` slot)** (theme 3). `const(v,'customX',typeName,adapterObj)` routes through the distinct `adapter2` branch (AbstractConnection.ts:523-528/:557-562). Its siblings `fragmentWithType`/`aggregateFragmentWithType`/`executeFunction` all test that branch; `const`/`optionalConst` don't. Reuses `Money`/`plusOffsetAdapter`.
- **CONN-A2 — `arg`/`valueArg` custom-kind trailing-adapter (`adapter2` slot)** (AbstractConnection.ts:812-817/:874-879). Plain-type `arg`/`valueArg` adapter fixtured (`scaledArgThresholdFragment`/`scaledThresholdFragment`); the custom-kind arm is absent.
- **UPDDEL-A1 — `ShapedExecutableUpdateExpression.extendShape` (post-set, executable, allowing-no-where twin)** (update.ts:97). The not-executable post-set `extendShape` (:220) and both openers (:295/:319) are tested; the executable post-set arm — `updateAllowingNoWhere(t).shapedAs({…}).set({…}).extendShape({…})` — is not. Return family verified consistent (no defect). Fixtures exist.
- **EQCMP-A2 — customLocalTime (`cutoffTime`) direct-fluent `is`/`isNot`** — every other Comparable temporal leaf has its null-safe `is`/`isNot` asserted; customLocalTime does not (0 hits). Reachable as `cutoffTime.is(new Date(Date.UTC(…)))` → `cutoff_time is not distinct from $1`. Fixtures exist.
- **BOOLIF-A1 — custom-boolean receiver into `negate()`/`and()`/`or()`/`onlyWhen()`/`ignoreWhen()` for 3 of 4 adapters** (theme 9). Only `published` (`'t'/'f'`) has combinator-receiver coverage; `verified` (`'Y'/'N'` → `not verified = 'Y'`), `approved` (nullable `'A'/'R'` → parenthesized `not (approved = 'A')`), `invoiced` (numeric `1/0` → unquoted `not invoiced = 1`) each emit a **distinct literal shape** and have zero. Highest value: `invoiced.negate()` and `approved.negate()`. Fixtures exist.
- **INSERT-A1 — `disallowIfNoValueWhen` guard lock** (paired with BUG-1). ~~No test asserts `disallowIfNoValue` vs `disallowIfNoValueWhen(true)` coincide on a `dynamicSet()` MissingKeys chain.~~ **DONE, but INVERTED** — BUG-1 was a false positive, so the assertion the audit imagined (`assertType<Exact>` that the two coincide) would itself have been wrong. The lock actually added is the *sound* invariant: a `@ts-expect-error` in `types.negative/insert.test.ts` proving `disallowIfNoValueWhen(false, …).set(rest).executeInsert()` does **not** compile (the When form never clears the missing-key obligation), with a passing `disallowIfNoValue` control. See Resolution.
- **INSERT-A2 — shaped single-row `*When` octet dispatch** — `insert.shaped.set-when-helpers` does not exist (only the on-conflict one); the single-row shaped `setIfValueWhen`/`setIfSetWhen`/… + `disallow*When` are never dispatched through a `shapedAs(...)` chain. Fixtures exist.

### Tier 3 — mechanical per-kind / low-value completeness (existing fixtures)

- **INSERT-A3** — shaped MissingKeys `keepOnlyWhen`/`ignoreIfSetWhen` fold-lock (types verified consistent → missing-test, not a defect).
- **PROJ-A3** — plain-object rule-1-over-rule-2 with a left-join-sourced `asRequiredInOptionalObject()` leaf (covered on the aggregate-element path, not the plain-object path; shape identical → low value).
- **SELECT-A3** — `SelectExpressionWithoutJoin.from(...)` chained 3-table comma join (second `from` overload; SQL coincides).
- **VALVIEW-A1** — Values `virtualColumnFromFragment`/`optionalVirtualColumnFromFragment` for non-{int,string,enum,customUuid} kinds (shared dispatcher; projected type/value differ). Weakest tier.

---

## §B — missing tests (needs a fixture addition)

The shared `domain/connection.ts` propagates to every cell. Three small,
symmetric additions:

- **B1 (theme 9) — View `optionalColumn` + trailing TypeAdapter, read path.** The
  *required* View column-adapter read path is covered (`vReleaseOverview.versionBracketed`);
  the *optional* one is not (no View class in any dialect carries an adapter on
  `optionalColumn`). Add `channelBracketed = this.optionalColumn('channel_bracketed', 'string', bracketAdapter)`
  (nullable) to `vReleaseOverview`; assert present→`'[…]'`, NULL→absent key. New
  6th test in `select.view-column-types.test.ts`. (F2-COL)
- **B2 (theme 9) — View `optionalVirtualColumnFromFragment` + trailing TypeAdapter.**
  Required View virtual+adapter covered (`versionTagged`); the Table optional twin
  covered (`tLedgerEntry.tag`); the View optional twin is not. Add
  `versionUpperTagged = this.optionalVirtualColumnFromFragment('string', fn, bracketAdapter)`
  to `vReleaseOverview`. (F2-COL)
- **B3 — Values `optionalColumn(type, adapter-object)` arm.** The required
  adapter-object Values arm is covered; the optional twin (`Values.ts:130-135`,
  `__asOptionalColumn()`) is not. Add an inline `Values` class with
  `score = this.optionalColumn('int', scaledTenthAdapter)` (adapter already inline
  in `with-values.kind-coverage.test.ts`); assert adapter fires + `T | undefined`
  + NULL-through-adapter. No domain change. (F2-VALVIEW)

---

## Per-surface counts + saturation

| Agent | §A | §B | Candidate defect | Verdict |
|---|---|---|---|---|
| PARITY (theme 10) | 0 | 0 | BUG-1 (dual), CD-B (OUT) | structurally clean; the round's bug vein |
| F8-META seam critic | 4 | 0 | **BUG-2** | recursive×forUseInQueryAs was entirely untested |
| F1-EQCMP | 2 | 0 | — | saturated except 2 branded-leaf gaps |
| F5-CONN | 2 | 0 | — | comprehensive; theme-3 adapter2 residue |
| F4-INSERT | 3 | 0 | BUG-1 (dual) | rich; the *When octet's one narrowing member |
| F4-UPDDEL | 1 | 0 | CD-A (latent) | near-saturated |
| F3-PROJ | 3 | 0 | — | near-saturated; 2 Tier-1 classification boundaries |
| F3-SELECT | 3 | 0 | — | near-saturated; compound execute-shapes |
| F2-COL | 0 | 2 | — | Table side saturated; 2 View optional+adapter holes |
| F1-BOOLIF | 1 | 0 | — | near-saturated; theme-9 per-adapter combinator gap |
| F2-VALVIEW | 1 | 1 | — | near-saturated |
| **F1-NUM** | 0 | 0 | — | **SATURATED** — modulo/double class closed |
| **F1-CUSTOMNUM** | 0 | 0 | — | **SATURATED** — brand keep/erase + round-trip pinned |
| **F1-STR** | 0 | 0 | — | **SATURATED** (0/0) |
| **F1-TEMP** | 0 | 0 | — | **SATURATED** — every getter × plain/custom × opt |
| **F6-DYN** | 0 | 0 | — | **SATURATED** — descriptor + VSM, every kind |
| **F7-EXTRAS** | 0 | 0 | — | **SATURATED** — utils/adapters/errors/config |

Seven surfaces genuinely 0/0. This is the mature-phase signature: per-surface
matrices are saturating, and the marginal bug has moved to the seams.

---

## Coordinator verification notes

1. **BUG-1** — dual-found (PARITY + F4-INSERT). I wrote my own compile-repro
   (`zz_repro_disallowWhen.ts`, deleted): line asserting
   `Exact<disallowIfNoValue(all), disallowIfNoValueWhen(true, all)>` → TS2344;
   `keepOnly`/`keepOnlyWhen` control passes. Confirmed the "all four" scope by
   direct signature reading. Confirmed observability via the `[MISSING_KEYS]
   extends [never]` gate (insert.ts:1006). **⚠ Interpretation error, corrected on
   resolution**: the TS2344 (types diverge) is *real but intentional*. The repro
   only proves the When/non-When types differ — it does **not** prove the When form
   is wrong. The `keepOnly`/`keepOnlyWhen` control coincides only because `keepOnly`
   *adds* keys (safe to mirror); `disallowIfNoValue` *clears* keys (unsafe to mirror
   conditionally). A second-direction repro — `disallowIfNoValueWhen(false, …)
   .set(rest).executeInsert()` — was the missing check: it compiles under the
   proposed fix (unsound) and correctly fails on the unchanged code. Adjudicated a
   FALSE POSITIVE. See Resolution.
2. **BUG-2** — seam critic. I wrote my own runtime probe
   (`zz_probe_recursive_customize.test.ts`, deleted) with two working-sibling
   controls; the emitted-SQL diff isolates the drop to `recursive × forUseInQueryAs`.
3. **CD-A** — F4-UPDDEL flagged a malformed union arm; I adjudicated it LATENT
   (SQLite `oldValues()` is `never`, so unreachable) and did not file it.
4. **CD-B** — parity sweep flagged shaped `setIfValue` input-type narrowing; I
   adjudicated it OUT (a `types.negative` input-rejection concern, not an
   emission/value divergence).
5. **Phantom-method hygiene** — agents correctly ruled out non-existent methods
   the prompts speculatively named (`getDayOfMonth`, `valueOf`, `asRequired` on
   temporals; `replaceAllIfValue(VS,VS)`; `radians`/`degrees`/`mod`/`log`/`negate`
   on NumberValueSource; `forUseAsInlineArrayOneColumn`; `rightJoin`/`forUpdate`),
   per "never invent an API".
6. Tree confirmed clean after every repro/probe (`git status --porcelain`).

---

## Recommended implementation order

1. ~~**BUG-1 + BUG-2** — hand to the fixing agent (`BUGS.md`).~~ **DONE.** BUG-2
   fixed (live test in 17 cells); BUG-1 closed as a false positive (guard lock in
   `types.negative`, `src/` unchanged). Both `BUGS.md` entries removed. See the
   Resolution section at the top.
2. **Tier 1 §A** (existing fixtures, highest value): PROJ-A1/A2 (classification
   boundaries), SELECT-A1/A2 (compound execute-shapes), EQCMP-A1 (customUuid
   Comparable arm).
3. **Tier 2 §A**: CONN-A1/A2 (adapter2), UPDDEL-A1, EQCMP-A2, BOOLIF-A1,
   INSERT-A2.
4. **§B** (one shared-domain change each): B1/B2 (View optional+adapter),
   B3 (Values optional adapter-object).
5. **Tier 3 §A** last (mechanical completeness).

---

## Verdict

A **saturating round with two runtime-/compile-verified seam bugs** — precisely
the shape the runbook (§9) calls a *better* round than fifty degenerate per-kind
additions. Seven surfaces are genuinely 0/0; the value concentrated at the
parity sweep and seam critic, whose CANDIDATE DEFECTs both survived the
coordinator's own repro/probe:

- **BUG-1** `disallowIfNoValueWhen` MISSING_KEYS "mis-fold" — **adjudicated a FALSE
  POSITIVE on resolution.** The TS2344 the compile-repro produced is real but
  intentional: the whole `set*When` family diverges from its narrowing non-When
  siblings by design (a `*When` must never *clear* a missing-key obligation). The
  audit inverted the `keepOnlyWhen` precedent it cited. `src/` unchanged; a sound
  guard lock was added instead. This is the round's lesson: **a runtime-delegation
  oracle does not establish a type-coincidence obligation** — confirm the *direction*
  (does the fix add or clear keys?) before filing.
- **BUG-2** `customizeQuery` `beforeQuery`/`afterQuery` dropped on
  `recursive × forUseInQueryAs` — **CONFIRMED and FIXED.** The recursive-CTE
  customizeQuery class on a new composition; runtime-probed with two working-sibling
  controls, fixed in `forUseInQueryAs`, live test added across the matrix.

The residual §A/§B is a modest, honest tail: two projection-classification
boundaries, the compound execute-shapes, two branded-leaf comparison gaps, the
theme-3 `adapter2` residue, the theme-9 custom-boolean combinator and View
optional-adapter holes. Both weaker candidates (CD-A latent, CD-B OUT) are
documented so the next round doesn't re-chase them. `src/` was not touched.
