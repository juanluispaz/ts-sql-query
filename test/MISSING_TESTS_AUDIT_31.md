# MISSING_TESTS_AUDIT_31

> Round 31 of the type-driven missing-tests audit (`test/TYPE_AUDIT_RUNBOOK.md` is the
> sole source of truth; this report is transient). Mandate: maximalist, **be generous
> even at length**. Narrow degeneracy bar (§4). Lead the mature phase with the parity
> sweep + the two seam critics + the freshly-changed-surface agent + the result-type
> agent; then the full ~16 per-surface agents, re-verifying prior "saturated" verdicts
> adversarially.

## Method

- **Pre-flight (§0.5):** N=31. `bun run tests:audit` → **17 cells, 235 files, 2396
  tests/cell, 40732 total — symmetric ✓** (up from 2363 in Round 30). `test/BUGS.md`
  empty (the two Round-30 bugs are fixed). `tests:index` refreshed. `git log` → the fresh
  `src/` surface is commit **`b5dc3f2e`** ("fix `buildFragmentWithMaybeOptionalArgs`
  optionality result on arg 3-5. Manage insert with no values to insert.") — the
  maintainer **fixed both Round-30 bugs**; test commits `1ad4c6cf`/`6bad181c` implemented
  a large part of Round-30's §A. Domain unchanged (no new fixture). So the round's
  high-value targets became: **(a) the positive/tail arms of the two fixes, (b) whether
  the fixes are complete/consistent, (c) which Round-30 §A items remain, (d) deeper sweeps.**
- **20 discovery agents** in two waves (≤10 concurrent), READ-ONLY, inline reports.
- **Coordinator verification (§7):** every load-bearing claim resolved by me — a compile-repro
  (`@ts-expect-error` key-omission) confirming the fragment fix, mock runtime-probes for the
  empty-values shapes + the min-guard interaction + the C1 inconsistency + the A4 recursive-inline
  composition. All probes deleted; **`git status --porcelain` clean** (only pre-existing
  untracked reports + the prior-round `M .gitignore` / `M TYPE_AUDIT_RUNBOOK.md`, plus this report).

## Headline

- **0 confirmed `src/` bugs.** The two Round-30 defects are fixed in `b5dc3f2e`, and I
  **verified both fixes are complete and correct**:
  - Fragment: all 7 mis-bracketed `FragmentFunctionMaybeOptional{3,4,5}` overloads re-bracketed
    (`OptionalTypeOfValue<T2> | T3[optionalType]`); a `[src, val, opt-src]` call now types
    **optional** (was required), the control (`[src, val, req-src]`) stays required. PARITY
    confirmed no residual/adjacent bug-class (grep for the merge helpers hits only `fragment.ts`+`values.ts`).
  - Empty `values([])`: `executeInsertMany`→`[]`, `executeInsertNoneOrOne`→`null`,
    `executeInsertOne`→reject `NO_RESULT`, `executeInsertMany(min)`→`MINIMUM_ROWS_NOT_REACHED`
    (min guard runs on count 0), one-column shapes → `[]` — all probed, all correct.
- **~10 clean §A tests** (existing cells + existing fixtures), dominated by **locking the two
  fixes' positive arms at the arities/shapes their own regression tests don't reach**, plus a
  few genuine composition/parity gaps.
- **2 §B** (a null-propagating 3-ary MaybeOptional fixture; the carry-over MySQL<8 helper).
- **1 maintainer-decision CANDIDATE** (both readings, not a bug): the empty-batch min-guard
  asymmetry between `executeInsert` and `executeInsertMany`.
- **13 surfaces re-verified saturated (0/0)** adversarially; the test commits closed most of
  Round-30's §A tail (verified per-surface below).

---

## §A — in scope, existing cells + existing fixtures (tiered)

### Tier 1 — the fragment fix's positive arms at arity 4/5 (5-way converged — the marquee)

**A-1. `buildFragmentWithMaybeOptionalArgs` `[…, plainValue, optionalValueSource, …]` optionality is locked at ARITY 3 ONLY.**
The `b5dc3f2e` fix touched **7 overloads** — 1 at arity-3 (`fragment.ts:436`), 2 at arity-4 (`:447`,`:456`),
4 at arity-5 (`:467`,`:475`,`:484`,`:492`) — but only the **arity-3** value-source-after-plain arm has a
regression test (`fragments.with-args.test.ts:190` optional + `:215` required control, on `coalesce3`).
The **6 arity-4/5 fixed overloads have no test**: the fixtures `frag4MaybeOptional`/`frag5MaybeOptional`
are called **all-plain everywhere** (`('a', undefined, 'c', 'd'[, 'e'])`), which lands on the untouched
all-`TypeOfArgument` overload — so the fixed `[src, plain, opt-src, …]` bodies are exercised at arity 3 only.
Each is a **separate compiler-resolved overload body** (the fix was 7 independent hand-edits); an arity-4/5-only
regression would pass the arity-3 test. Converged on independently by **F-RECENT, PARITY, F5-CONN, F9-TYPEVAR**.
- **Minimal lock (existing fixtures):** `frag4MaybeOptional(conn.const('x','string'), 'b', tIssue.body, 'd')`
  → `Array<{ r?: string }>` (optional ← `tIssue.body`); + required control `…, tIssue.title, 'd')` →
  `Array<{ r: string }>`. Same for arity-5: `frag5MaybeOptional(conn.const('x','string'), 'b', tIssue.body, 'd', 'e')`.
- Add to `fragments.with-args.test.ts` next to the arity-3 pair. §B empty.

**A-2. The optional-key `undefined` inhabitant of a value-source-driven optional fragment result is never realized at runtime** (F9-TYPEVAR A-2).
`fragments.with-args.test.ts:166` (`intPlus(const(3,'int'), tIssue.assigneeId)`) asserts the optional type
`r?: number` but value-probes only a **present** row. The NULL boundary (`assigneeId = NULL` → `3 + NULL = NULL`)
is never exercised. Add a boundary row: `mockNext([{ r: null }])`, assert `toEqual([{ r: undefined }])` +
`'r' in rows[0] === false`. Existing `intPlus` + `tIssue.assigneeId`.
(See **B-1** for the exact `[src-req, plain, opt-src]` value arm, which needs a null-propagating 3-ary fixture.)

### Tier 2 — the empty-values fix's positive arms + genuine insert/mutation gaps

**A-3. Empty `values([])` × the min/max guard interaction — untested for every execute-shape** (F-RECENT B1 / F4-INSERT A-1).
`errors.insert-guards.test.ts` locks the empty-batch positive arms (0 / [] / null / NO_RESULT) but **every call
is arg-less**; the min/max guard is never exercised on the 0-row short-circuit, and the only min test
(`insert.execute-variants.test.ts:279`) is **mis-named** — it inserts 2 real rows with `min=3`, never an empty
batch. Coordinator-probed: `values([]).returning(x).executeInsertMany(1)` → **`MINIMUM_ROWS_NOT_REACHED`** (count 0).
Add it. (This arm also exposes the C1 candidate below.)

**A-4. `values([oneRow]).returningLastInsertedId().executeInsert()` — the single-element-array `__isMultiple` wrap branch is unhit** (F4-INSERT A-2).
`values([single])` collapses to `.set()` leaving `__multiple` undefined but `__isMultiple=true`; `executeInsert`
takes the single dispatch and the `if (this.__isMultiple) return [result]` wrap at `InsertQueryBuilder.ts:105-107`
— emitting single-row `insert … returning id` but returning `[id]` typed `number[]`. Every `returningLastInsertedId`
test uses ≥2-element arrays (the distinct multiple-id path). Distinct dispatch + emitted SQL + value → §A. `tOrganization` suffices.

**A-5. DELETE `returning({optional branded column})` under the DEFAULT projector — UPDATE/DELETE parity hole** (F4-UPDDEL A1).
The `1ad4c6cf` work gave UPDATE a `…returning-object-optional-branded-default` test (`{ id; stage?: ReleaseStage }`)
but DELETE has no counterpart (it jumps to the as-nullable form). No delete test anywhere projects a default-projector
**optional** object leaf. Add `delete-release-draft-returning-object-optional-branded-default` mirroring
`update.returning.test.ts`. Src dual: `delete.ts:173-175` ≡ `update.ts:517-519`.

**A-6. `set({ <optional column>: <value source> })` — the `InputTypeOfOptionalColumnAllowing` /
`RemapIValueSourceTypeWithOptionalType` branch is unexercised** (F4-UPDDEL A2).
Every value-source-rhs SET in the matrix targets a **required** column (hits `RemapIValueSourceType`); every
optional-column SET uses a **plain value** (hits `ValueSourceValueType`). The nullable-source-into-optional-column
arm (`update.ts:401-408`) is a distinct conditional-type member. Add `update(tReleaseDraft).set({ minVersion: <optional
customComparable value source> })`. Type-only observability (emitted SQL identical) but a distinct type-acceptance branch.

### Tier 3 — composition / projection gaps (existing fixtures)

**A-7. Aggregate element-TOP rule-2 whole-element DROP on a join MISS, both projectors** (F3-PROJ A1).
The existing element-top rule-2 tests use a group that never misses; the rule-2 MISS test keeps a required own-table
column at the element top (making it rule-3). Add an aggregate whose element is entirely all-left-join
(`aggregateAsArray({ id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body })`) grouped so an element's
join misses (org 2 / project 4) → assert the all-null element is **dropped** (`items.length`) under both projectors.
Runtime-verified **sound** (`AbstractQueryBuilder.ts:281-293`); the missing twin of the rule-4 hit+miss pair.

**A-8. Recursive select carrying its OWN `customizeQuery`, consumed via `forUseAsInlineQueryValue` / `forUseAsInlineAggregatedArrayValue`** (SEL-SEAM A4).
The inline-value dual of the `forUseInQueryAs` recursive-hook allow-list. **Coordinator-probed** (the recursive-CTE-hook
whack-a-mole lineage): the inline path renders **all six hooks in sensible positions** and emits valid SQL —
```
with recursive recursive_select_1 as /*bwq*/ (...) /*awq*/ select id as id, (/*bq*/ select /*ask*/ /*bc*/ result ... /*aq*/) as root from project ...
```
— no drop, no misplacement. Per the drop≠defect oracle: **clean §A coverage gap, NOT a defect**. Add the composition test.

**A-9. UPDATE `from` × `oldValues()` × `customizeQuery` — the three-way stack** (MUT-SEAM A1).
Each pairwise cross exists; the union of all three is untested (no file contains both `oldValues` and `customizeQuery`).
Type-reachable; emission linear/likely-correct (a coverage gap, present as a probe candidate). Existing fixtures.

**A-10. `distinct` in the SECOND compound arm / on BOTH arms** (SEL-SEAM A1/A3).
The `1ad4c6cf` distinct×compound work covers distinct only as the **first/left** arm (`__firstQuery` via
`__asSelectData()`); the right arm enters through the distinct **argument-extraction** path
(`__compoundableAsSelectData` → `__secondQuery`) — a different code path asserted nowhere. Add
`selectFrom(t).select().unionAll(selectDistinctFrom(t).select())` → `… union all select distinct …`; and a both-arm case.
(distinct × intersect/except/minus is degenerate — kind-string-only.)

---

## §B — in scope, needs a fixture addition

**B-1 (F9-TYPEVAR).** A **null-propagating 3-ary `MaybeOptional` fixture** to realize the fix's `undefined`
inhabitant for the exact `[src-required, plain, src-optional]` shape at runtime. Both arity-3 regression tests use
`coalesce3`, whose present-required first arg makes the SQL structurally non-NULL — so the optional result's
`undefined` inhabitant is never observed. Add e.g.
`sum3MaybeOptional = buildFragmentWithMaybeOptionalArgs(arg('int','optional')×3).as((a,b,c)=>fragmentWithType('int','optional').sql\`${a}::int + ${b}::int + ${c}::int\`)`,
then `sum3MaybeOptional(const(3,'int'), 4, tIssue.assigneeId)` with `assignee_id = NULL` → `3+4+NULL = NULL` →
`{ r: undefined }`. Complements A-1/A-2 with a value-arm proof.

**B-2 (F7-EXTRAS, MySQL-dialect, carry-over from Round 30/6).** The two builder-reachable, compat-gated
`UNSUPPORTED_QUERY` throws in `MySqlSqlBuilder.ts:186` (recursive CTE) / `:190` (`values()` in FROM) under
`compatibilityVersion < 8_000_000` — **re-confirmed still open**. Writable **today** in `mysql/newest/mysql2` via the
in-file `protected override compatibilityVersion = 5_007_000` subclass pattern (`config.allow-empty-string.test.ts`
establishes it), or cleaner with a `withCompatibilityVersion` helper in `test/db/mysql/runners.ts`. MySQL-only.

---

## CANDIDATE (maintainer decides — both readings; not filed to BUGS.md)

### C1 — empty-batch min-guard asymmetry between `executeInsert` and `executeInsertMany`

**Coordinator-probed and CONFIRMED:**
```
insertInto(tProject).values([]).executeInsert(3)                        → resolved: 0  (history=0, min guard skipped)
insertInto(tProject).values([]).returning({id}).executeInsertMany(3)    → threw: MINIMUM_ROWS_NOT_REACHED
```
`executeInsert`'s empty-batch branch (`InsertQueryBuilder.ts:67-72`) does an **early `return`** of
`createResolvedPromise(0)` — **before** its own min/max guard (`:164-186`), so `executeInsert(3)` on an empty batch
resolves `0` without throwing. The new `executeInsertMany(min)` empty branch (`:286-291`) instead **falls through** to
its guard (`:317`) and throws on count 0. Two sibling execute-shapes handle the same logical operation differently.
**Both readings:** (a) *bug* — the fix's own comment ("the min/max guards below still run against the resulting count
of 0") states the intent that guards run on empty; `executeInsert` violating it is an oversight → it should also throw;
(b) *by-design* — `executeInsert` returns an affected-row count where an empty batch is a legitimate graceful 0. The
asymmetry is pre-existing but **sharpened** by the fix (which made `executeInsertMany` newly run the guard). Present for
the maintainer to reconcile; either way A-3's test pins the current behavior. Not asserted as a bug.

---

## Coordinator verification notes (what I checked myself)

| Claim | Method | Verdict |
|---|---|---|
| Fragment fix landed: `[src, val, opt-src]` now optional | tsgo `@ts-expect-error` key-omission (isolated) | **Confirmed** (fixed optional, control required) |
| Fragment fix complete + no adjacent bug-class | PARITY re-diff of all 7 overloads + grep of merge helpers | **Confirmed** (only `fragment.ts`+`values.ts` use them) |
| Empty-values fix per shape | mock probe | **Confirmed** — Many→`[]`, NoneOrOne→`null`, One→`NO_RESULT`, Many(min)→`MINIMUM_ROWS`, one-column→`[]` |
| C1 min-guard asymmetry | mock probe (both siblings) | **Confirmed** — executeInsert(3)→0, executeInsertMany(3)→throws |
| A-8 recursive customizeQuery × inline | mock SQL probe (drop≠defect oracle) | **Sound** — all 6 hooks render in valid positions → §A, no defect |
| A-7 aggregate rule-2 element drop | F3-PROJ src read of the projector | **Sound** → §A coverage, no bug |
| Round-30 §A residue | per-surface agents re-derived vs current tests | Largely **implemented** (see below); residue is A-1..A-10 |

## Round-30 §A items confirmed IMPLEMENTED by `1ad4c6cf`/`6bad181c` (do not re-report)

- tReleaseDraft **write-side** (INSERT of optional enum/custom/customComparable value/null/omitted → `insert.optional-custom-columns.test.ts`; on-conflict → `insert.on-conflict.test.ts`; UPDATE/DELETE returning → `update.returning`/`delete.returning`).
- The **bare-base-leaf Nullable family** value-source `valueWhenNull`/`nullIfValue` overloads (A-1a) **and** the
  `asRequiredInOptionalObject`/`onlyWhenOrNull`/`ignoreWhenAsNull` modifier trio (A-1b) → `null-and-if-value-modifiers.test.ts`.
- `aggregateAsArrayOfOneColumn(optional col)` null-strip value-probe + branded-adapter variant (Round-30 A-2) → `value-type-coverage.test.ts:430/461`.
- Aggregate element-top rule-4 all-optional drop, both projectors (Round-30 A-3) → `element-projection-rules.test.ts:579/614`.
- Aggregate rule-2 nested-inner miss (partial Round-30 A-4) → `element-projection-rules.test.ts:650/694` (element-top rule-2 miss remains → A-7).
- Branded literal-union optional leaf under `projectingOptionalValuesAsNullable` (Round-30 A-6) → `mixed-rules.test.ts:269-298`.
- `orderBy(<aggregate value-source>)` (Round-30 F3-SELECT) → `order-by.variants.test.ts:155`.
- `distinct` in the first compound arm (Round-30 SEL-SEAM) → `select.compound`/`select.distinct` additions.

## Per-surface saturation summary

| Agent | §A/§B/candidate | Note |
|---|---|---|
| **F-RECENT** | A-1, A-3; C1 | the two fixes' tail arms; both fixes verified complete |
| **PARITY** | A-1 | fragment fix re-diffed clean; no adjacent bug-class; variadic wiring clean |
| **F5-CONN** | A-1 | value-level saturated; the arity-4/5 gap is the fix's regression surface |
| **F9-TYPEVAR** | A-2, B-1 | fix is type-only; runtime `__mergeOptional` already correct; Round-30 A-2/A-6 closed |
| **F4-INSERT** | A-3, A-4; C1 | on-conflict/shaped/from-select saturated; tReleaseDraft write-side implemented |
| **F4-UPDDEL** | A-5, A-6 | method-family saturated; tReleaseDraft returning ~90% implemented |
| **MUT-SEAM** | A-9 | seam saturated; empty-values composed cases degenerate (short-circuit before on-conflict/nesting) |
| **SEL-SEAM** | A-8, A-10 | A-8 probed clean; compound orderBy explicit-mode + recursive lineage covered |
| **F3-PROJ** | A-7 | Round-30 A-2/A-3/A-4-nested implemented; element-top rule-2 miss residual |
| **F7-EXTRAS** | B-2 | extras/adapters/errors/config saturated except MySQL<8 |
| **F1-EQCMP** | — | **SATURATED** — Round-30 §A-1 residue fully closed by `1ad4c6cf` |
| **F1-NUM / F1-CUSTOMNUM / F1-STR / F1-TEMP / F1-BOOLIF / F2-COL / F2-VALVIEW / F6-DYN / F3-SELECT** | — | **SATURATED (0/0)** each, re-verified adversarially |

**Deferred OUT observation (F2-COL):** `optionalComputedColumn` (`Table.ts:388`) routes through `__asOptionalColumn()`
which sets runtime `__writable = true` (unlike `computedColumn`'s `false`). The **type** correctly excludes both from
`WritableColumnKeys` (asserted), so there is no type/value surface → not a testable gap; recorded for the maintainer as
a possible runtime-flag cleanup, not a finding.

## Recommended implementation order

1. **A-1** — fragment arity-4/5 optional arms (+ required controls). Locks the `b5dc3f2e` fix where its own
   regression test doesn't reach; a per-body regression could otherwise pass the arity-3 test.
2. **A-2 / B-1** — the optional-key `undefined` value arm (existing `intPlus`) + the null-propagating 3-ary fixture.
3. **A-3, A-4** — empty-batch min-guard interaction + the single-element-array `returningLastInsertedId` branch.
4. **A-5, A-6** — DELETE default-projector optional-branded returning parity + the optional-column value-source SET branch.
5. **A-7, A-8, A-9, A-10** — aggregate rule-2 element drop; recursive-customizeQuery-inline; update-from×oldValues×customize; second-arm distinct.
6. **B-2** — MySQL<8 UNSUPPORTED_QUERY (in-cell subclass or the mysql helper).
7. **C1** — await the maintainer's decision (make `executeInsert(min)` throw for consistency vs keep the graceful 0),
   then pin whichever.

## Verdict

A clean, honest **mature round with zero confirmed bugs** — the two Round-30 defects are fixed, and I verified both
fixes are **complete and internally consistent** (all 7 fragment overloads; all 3 empty-values shapes + the min guard).
The round's value is (a) **locking the fixes' positive arms at the arities/shapes their own regression tests miss** —
especially the 5-way-converged fragment arity-4/5 gap, where a per-body regression would slip past the arity-3 test —
and (b) a short tail of genuine composition/parity gaps (aggregate rule-2 element drop, recursive-customizeQuery-inline,
the DELETE/UPDATE returning parity hole, the optional-column value-source SET branch). Thirteen surfaces re-verified
saturated, the test commits closed most of Round-30's §A, the seam critics **cleared their own suspected defect**
(A-8 probed sound), and the one behavioral inconsistency (C1) is surfaced with both readings for the maintainer.
Nothing was manufactured.
