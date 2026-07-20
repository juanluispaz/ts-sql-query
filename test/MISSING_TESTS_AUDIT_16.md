# Missing-tests audit — ROUND 16

**Method:** type-driven discovery per [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md).
16 parallel discovery agents (one per surface) raw-read `src/` types, built an
exhaustive enumeration matrix, re-derived coverage from the **current** test files
(inheriting no verdict), and were told to stay alert to **type-vs-impl divergences**
(the bug class). The coordinator deduped, settled load-bearing claims himself, and
**compile-verified the one bug candidate** + source-confirmed its sibling.

**Mandate this round:** maximalist / very deep, same intent as rounds 14-15 — total
coverage of every reachable typed path; prefer excess; hunt the next layer on a
now-mature suite and surface any type-vs-impl divergence.

**Pre-flight:** matrix = 17 cells, 202 files, **1681 tests/cell**, 28577 total,
`tests:audit` ✓ symmetric (up from 1633/cell at round 15 — round 15's ~48
tests/cell landed). Reference cell `postgres/newest/pg/`. BUGS.md was empty / zero
`TODO[BUG]` at start. Round 15's implementation added the fixtures
`plusOffsetAdapter`, `callEstimatedTotalOffset` (executeFunction custom+adapter),
`issueIdSeqOffset` (sequence+adapter), `scaledThresholdFragment` (valueArg+adapter),
`tInvoice` (provided int PK + scaledTenthAdapter) — all re-verified live and **not
re-flagged**.

> **Operational note:** the initial 16-agent fan-out tripped a transient server-side
> rate limit; surfaces were re-dispatched in batches of ~4. One report
> (F1-CUSTOMNUM) survived the first wave; the rest were re-run. No coverage lost.

## Headline

**A real `src/` bug was found and compile-verified** — the type-driven method's
core value, again. On top of that, a deep re-sweep of all 16 surfaces on a suite
that is now **8 surfaces fully saturated** yields a tight, high-value residual
clustered in two themes: **shaped on-conflict static forms** (THEME 2, adjacent to
the bug) and a **new theme — per-column adapter / custom-type used as an operand
OUTSIDE the top-level WHERE** (join-`on`, subquery-WHERE, HAVING, combinator-receiver),
the exact adapter-drop divergence class, value-observable and mock-blind.

Counts: **1 confirmed bug** (filed in [`BUGS.md`](./BUGS.md)) + 1 source-confirmed
sibling asymmetry · **§A ≈ 13 gaps** · **§B ≈ 4** · **8 saturated surfaces**.

---

## ✅ Resolution — fixed in `src/` (post-audit)

The ★ bug and its INSERT sibling were both fixed, along with an adjacent
pre-existing defect the fix surfaced. The `BUGS.md` entry has been removed.

**`src/` changes**

- **F4-UPDDEL A1 (the ★ bug)** — [`src/expressions/update.ts`](../src/expressions/update.ts):
  the 10 shaped `*When` set arms on `ShapedExecutableUpdateExpression` /
  `ShapedNotExecutableUpdateExpression` now take `UpdateSets` / `OptionalUpdateSets<…, SHAPE>`
  instead of `…, undefined`. The 4 sibling `ignoreIfSetWhen` / `keepOnlyWhen` /
  `ignoreIfHasValueWhen` / `ignoreIfHasNoValueWhen` arms — the **same defect class,
  not enumerated in the original report** — now take `ColumnsForSetOfWithShape<TABLE, SHAPE>`
  to match their non-`When` siblings.
- **F4-INSERT B1 (the sibling)** — decided **bug, not intentional-terminal**.
  [`src/expressions/insert.ts`](../src/expressions/insert.ts): the static one-shot
  `OnConflictDoUpdateSetFnType` / `OnConflictDoUpdateSetWithoutTargetFnType` now
  return the **shaped** node when `SHAPE extends ResolvedShape` (mirroring the
  dynamic-set form), so a chained `.set({renamedKey})` after a shaped one-shot is
  accepted with the shape preserved.
- **Adjacent cleanup (surfaced while fixing B1)** — `ShapedInsertOnConflictSetsExpression`
  carried a **duplicated non-`When` block** and was **missing the `*When` family
  entirely**; the duplicate was replaced by the proper shaped `*When` block, and a
  `setIfValueWhen` parameter-name typo (`olumns`) was corrected.

**Root cause (datable).** Commit `122458db` ("Add support to manipulate the data to
insert or update conditionally"), which introduced the `*When` family. The non-shaped
`InsertOnConflictSetsExpression` got the `*When` block correctly (25 methods); the
shaped twin had its **non-`When` block duplicated instead** (0 `*When`) — the wrong
block was pasted. The UPDATE side is the same slip in a milder form: the `*When`
blocks **were** added to the shaped interfaces, but with the wrong generic
(`undefined` instead of `SHAPE`). A later refactor (`76b55073`) only rewrote the
signatures on those lines, so it appears in `git blame` but did not introduce the
structural error.

**Tests (the fix landed, so they are live — *not* the §B "TODO[BUG] + types.negative"
plan).**

- **UPDATE shaped `*When`** — 3 representative tests (set-map / optional-map /
  column-list arms) added to `update.shaped.test.ts` and propagated across all 17 cells.
- **INSERT shaped on-conflict** — a chained-`set` + on-conflict `setWhen` test in
  `insert.shaped-on-conflict.test.ts`, **live** on the `onConflictOn` dialects
  (postgres, sqlite), **NOT-APPLICABLE** on mariadb/mysql (bare form) and
  oracle/sqlserver (no `ON CONFLICT`).
- **`types.negative/` locks** — UPDATE in all 6 dialects; INSERT on-conflict in
  postgres/sqlite (`onConflictOn`) + mariadb/mysql (bare). Each asserts the **real**
  column key is `@ts-expect-error`-rejected on the `*When` / chained-set arms, so the
  negative flips if the `src/` fix is reverted.

**Verification.** `tsc` + `tsgo` green for both `src/` and `test/` · `tests:audit`
symmetric (1685 tests/cell) · full mock matrix **28555 pass / 0 fail** · real-DB
spot-checks on PostgreSQL (`--docker`) and SQLite (`--native`). Two user-facing
[`docs/CHANGELOG.md`](../docs/CHANGELOG.md) bullets added.

---

## ★ The bug — shaped UPDATE `*When` set family is unusable as typed (THEME 2)

**F4-UPDDEL A1 — confirmed via tsgo compile-repro by the coordinator. ✅ FIXED —
see [§ Resolution](#-resolution--fixed-in-src-post-audit) above; the `BUGS.md` entry
has been removed.**

`src/expressions/update.ts` — `ShapedExecutableUpdateExpression` /
`ShapedNotExecutableUpdateExpression` declare all **10** conditional set arms
(`setWhen`, `setIfValueWhen`, `setIfSetWhen`, …, `setIfHasNoValueIfValueWhen`) with
the `columns` param typed `UpdateSets<TABLE, USING, undefined>` (**UNSHAPED**), while
the non-When shaped siblings (`set`, `setIfValue`, …) correctly use `…SHAPE`.

Compile-repro (pg cell, `tProject`, shape `{ projectName: 'name' }`):
- `…set({ projectName })` → **compiles** (positive control; non-When shaped set accepts the renamed key).
- `…setWhen(true, { projectName })` → **TS2353** — the renamed shape key is **rejected**.
- `…setWhen(true, { name })` → compiles, but the runtime (`setWhen`→`set`, gated by
  `if (shape && !(property in shape)) continue`, where `__shape` is keyed by the
  *renamed* names) **silently drops** the set.

So the shaped `*When` family accepts only the keys the runtime discards and rejects
the keys it needs — the feature is **unusable as typed**, and untested everywhere
(zero `shapedAs(...)`-into-`*When` chains in `test/db`). Same shaped-key-remap class
as the round-13 ON CONFLICT fix (`1149a866`).

**Sibling (INSERT, source-confirmed type asymmetry, milder)** — F4-INSERT B1:
the static one-shot `OnConflictDoUpdateSetFnType` /
`OnConflictDoUpdateSetWithoutTargetFnType` ([insert.ts:937-949](src/expressions/insert.ts#L937))
thread `SHAPE` into the *input* (so the one-shot call accepts the renamed key) but
**return the non-shaped** `InsertOnConflictSetsExpression` — unlike the dynamic-set
form ([insert.ts:907-910](src/expressions/insert.ts#L907)) which returns the shaped
node. Consequence: a **chained** `.set({renamedKey})` after a shaped static
`onConflictDoUpdateSet({...})` is type-rejected though the impl would remap it. The
one-shot itself works, so this is milder; decide bug-vs-intentional-terminal when
fixing. (Both documented in the BUGS.md entry.)

---

## Themes, ranked by risk tier

### Tier 1 — distinct code-path / the bug class (existing fixtures)

**T1.1 — Shaped × on-conflict STATIC forms (THEME 2, the bug neighborhood).** Every
shaped on-conflict test exercises the **dynamic** bare form
(`onConflictDoUpdateDynamicSet().set({renamed})`) or the PG **targeted** form; the
**static one-shot bare** forms with a shape are asserted nowhere — and they share the
runtime remap path that B1/A1 show is fragile.
- **F4-INSERT A1** — shaped `onConflictDoUpdateSet({renamedKey})` (mariadb/mysql/sqlite live cells, `tProject`).
- **F4-INSERT A2** — shaped `onConflictDoUpdateSetIfValue({renamedKey, optional:undefined})` (renamed-key survives, renamed-optional dropped).
- **F4-INSERT A3** — shaped on-conflict DO UPDATE with a value-source / inserted-pseudo-row RHS under a renamed key (`OnConflictUpdateSets` ALLOWING includes `NValuesForInsertFrom`).
- **F4-INSERT A4** — shaped × multi-row `.values([...]).onConflictDoUpdateSet/DoNothing(...)`.

**T1.2 — NEW THEME: per-column adapter / custom-type as an operand OUTSIDE the
top-level WHERE.** Per-column adapters (`scaledTenth` ×10, `bracket`, the
custom-booleans) and custom-typed columns are exercised as comparison operands only
at the top-level WHERE. Every other operand position is a **distinct emission path**
where an adapter-drop or mis-remap is **value-observable** (scaled bound param) and
**mock-blind** — the round-13/14 divergence fingerprint. All compile-verified
reachable and confirmed absent matrix-wide.
- **F8-META A1** — adapter column as a JOIN `.on()` operand (e.g. `innerJoin(tProjectReview).on(tProjectReview.score.equals(85))` → ON param must be `850`).
- **F8-META A2** — adapter column as an operand in a correlated subquery WHERE (`subSelectUsing(...).where(adapterCol.equals(x))`).
- **F8-META A3** — the adapter-carrying `scaledThresholdFragment` (its `valueArg` ×10) in `.having(...)` (only `.where(...)` is tested; param must be `10`).
- **F1-BOOLIF A1** — boolean combinators (`.negate()`/`.and()`/`.or()`/`.onlyWhen()`/`.ignoreWhen()`) with a **custom-boolean column as the receiver** (`published.negate()` → `not (published = 't')`), routing through `_appendColumnNameForCondition`'s read-remap — a distinct, dialect-sensitive path no test reaches.

> **Docker note (per `feedback_docker_validate_delegated_custom_type_tests` + `project_docker_validation_gotchas`):** T1.2 and F2-COL A1 are custom-type/adapter operand assertions — mock cannot catch a per-driver value leak. `--docker` spot-check on PG + mssql + oracle (and the `t/f`, `Y/N`, `1/0` adapter shapes for F1-BOOLIF A1).

**T1.3 — Projection input-classification boundaries at the aggregated-array element
top level (THEME 5, F3-PROJ).** The element-top projector
(`ResultObjectValuesForAggregatedArray` / `…ProjectedAsNullableForAggregatedArray`)
is distinct from the inner-object projector; its rule-2/rule-3 arms are only covered
with all-required leaves (projectors coincide), never with a genuinely-optional leaf
(where they diverge).
- **F3-PROJ A1** — element-top **rule-2** with an optional leaf, both projectors: `aggregateAsArray({ id, name, archivedAt })` over one left join → default `archivedAt?: Date`, nullable `archivedAt: Date | null`. Assert with `'archivedAt' in element` + `toEqual`.
- **F3-PROJ A2** — element-top **rule-3** with an own-table optional leaf, both projectors: `aggregateAsArray({ title, body })` (tIssue not joined) → default `{ title: string; body?: string }`, nullable `{ title: string; body: string | null }`.

### Tier 2 — distinct overloads / per-type emission

- **F2-COL A1** — `tInvoice` adapter PK read back through `returning`/`returningLastInsertedId` (the ÷10 marshalling on the RETURNING read path is a distinct site from the covered SELECT read; mock-blind → `--docker`).
- **F2-VALVIEW A1** — `Values.virtualColumnFromFragment` REQUIRED base-type (non-custom) overload (`Values.ts:135-143`, the `'required'` impl branch) — only the optional-base-type and required-custom-type Values virtuals are tested. Borderline §A/§C (optionality-only distinction; required-base-type proven on a View via `nameUpper`).
- **F1-CUSTOMNUM A1/A2** — the two single-sided `modulo` twins: customDouble `modulo(value-source)` and customInt `modulo(const)`. Both ride the shared `createSqlOperation1ofOverloadedNumber('_modulo')` dispatcher whose other arm is tested → **low-value / borderline-degenerate**; listed per the bar, recommend deprioritize.

### Tier 3 / §B — needs a fixture or scaffold

- **F2-COL B1** — `autogeneratedPrimaryKeyBySequence` non-int / branded kind (round-15 §B not implemented; all cells still declare it `'int'`). Needs a bigint/branded-customInt PK-by-sequence column; only the returned-value marshalling differs → low-value.
- **F8-META B1** — sequence `nextValue()` as an explicit INSERT column value (`insertInto(tInvoice).values({ invoiceNo: conn.issueIdSeq.nextValue(), … })` emits `nextval(...)` raw in the VALUES list) — the SequenceValueSource × InsertSetValue seam, untested. (The *adapter* angle is degenerate — `nextval` is raw SQL, no bound param, so the adapter never fires.)
- **F4-UPDDEL B** — a `types.negative/` lock for the A1 bug, asserting the renamed key is currently `@ts-expect-error`-rejected on the `*When` arms, so the negative flips when `src/` is fixed.
- **F5-CONN B1** — parameterized `createTableOrViewCustomization` (P1-P5) — only the 0-param `withSqlHint` is exercised; the typed `p1..pN` threading is a thin overload over a `...params` rest-spread (near-degenerate; the parameterized form lives in the legacy/docs suites).

---

## Per-surface counts & saturation

| Agent | §A | §B | Verdict | Divergence? |
|---|---|---|---|---|
| F1-NUM | 0 | 0 | **SATURATED** | none (per-dialect `_modulo`/`_power` checked) |
| F1-CUSTOMNUM | 0* | 0 | near-sat (*2 borderline modulo twins) | none (brand keep/erase holds) |
| F1-STR | 0 | 0 | **SATURATED** | none |
| F1-BOOLIF | 1 | 0 | 1 gap (combinator-on-custom-bool receiver) | none |
| F1-TEMP | 0 | 0 | **SATURATED** | none (getter emission type-agnostic) |
| F1-EQCMP | 0 | 0 | **SATURATED** | none (one operand-marshalling path) |
| F2-COL | 1 | 1 | tInvoice RETURNING read; PK-by-seq kind | none |
| F2-VALVIEW | 1 | 0 | 1 borderline (required base-type virtual) | none |
| F3-SELECT | 0 | 0 | **SATURATED** | none (compound orderBy(VS) covered) |
| F3-PROJ | 2 | 0 | 2 element-top boundaries | none |
| F4-INSERT | 4 | (B1 type) | shaped static on-conflict matrix | **B1 type-asymmetry** |
| F4-UPDDEL | 1 | 1 | **★ the bug** + negative-type lock | **★ A1 type-vs-impl** |
| F5-CONN | 0 | 1 | **SATURATED** (B1 near-degenerate) | none (4 adapter2-shift sites live) |
| F6-DYN | 0 | 0 | **SATURATED** | none |
| F7-EXTRAS | 0 | 0 | **SATURATED** | none |
| F8-META | 3 | 1 | adapter-operand-outside-WHERE seams | (the seam IS the divergence risk) |
| **TOTAL** | **~13** | **~4** | **8 saturated** | **1 bug + 1 sibling** |

**Genuinely saturated (re-verified this round):** F1-NUM, F1-STR, F1-TEMP, F1-EQCMP,
F3-SELECT, F5-CONN, F6-DYN, F7-EXTRAS — plus F2-VALVIEW effectively and F1-CUSTOMNUM
near. The saturation is real: F1-EQCMP established the operator-string dispatcher
routes every operand through one `_appendValueParenthesis` path (so once a leaf's
marshalling is proven by any method it's proven for all); F1-TEMP confirmed getter
emission is temporal-type-agnostic; F5-CONN verified all four adapter2-shift sites
(executeFunction / fragmentWithType / aggregateFragmentWithType / sequence) are now
live after round 15.

## Coordinator verification notes

1. **F4-UPDDEL A1 — BUG, compile-verified.** Wrote a type-only repro in the pg cell
   with the renamed key on `setWhen` (TS2353), the renamed key on the non-When `set`
   (compiles), and the real key on `setWhen` (compiles). Confirmed the impl drops the
   real key (`__shape` keyed by renamed names). Deleted the repro; tree clean. Filed
   to BUGS.md.
2. **F4-INSERT B1 — source-confirmed.** Read [insert.ts:907-949](src/expressions/insert.ts#L907):
   the static set fns return `InsertOnConflictSetsExpression` (non-shaped) vs the
   dynamic fns' `ShapedInsertOnConflictSetsExpression`. The return-type asymmetry is
   real; classified as the milder sibling of A1 (the one-shot input is correctly
   shaped). Documented in the BUGS.md entry.
3. **No cross-agent contradictions** this round — the adapter-operand-outside-WHERE
   theme surfaced independently and consistently across F8-META (join/subquery/having)
   and F1-BOOLIF (combinator receiver), reinforcing rather than conflicting.
4. **All "saturated" verdicts re-derived from current files**, not inherited.
   Round-15 closures (the 5 new fixtures, the from-select on-conflict matrix,
   guard×returning, the projection boundaries, the branded-leaf equality, the
   adapter2-shift sites) all verified present.

## §B fixture / scaffold plan

| ID | Add | For |
|---|---|---|
| F4-UPDDEL B | a `types.negative/` `@ts-expect-error` lock on shaped `*When` renamed key | locks the bug; flips on fix |
| F2-COL B1 | a `autogeneratedPrimaryKeyBySequence` of bigint or branded customInt | PK-by-sequence value-type fan-out |
| F8-META B1 | (no fixture) one insert-test body using `issueIdSeq.nextValue()` as a column value | sequence × InsertSetValue seam |
| F5-CONN B1 | a domain `createTableOrViewCustomization` carrying ≥1 typed param | parameterized customization (near-degenerate) |

## Recommended implementation order

1. ~~**The bug** — write the failing shaped `*When` test with `// TODO[BUG]` + the
   `types.negative/` lock (F4-UPDDEL A1 / B); decide F4-INSERT B1's bug-vs-intentional
   while there (same file family).~~ ✅ **Done** — fixed in `src/` (so the tests are
   live, not `TODO[BUG]`); B1 decided a bug and fixed. See [§ Resolution](#-resolution--fixed-in-src-post-audit).
2. **Tier-1 on existing fixtures** — F4-INSERT A1-A4 (shaped static on-conflict, the
   bug neighborhood); F8-META A1-A3 + F1-BOOLIF A1 (adapter-operand-outside-WHERE,
   `--docker` spot-check PG/mssql/oracle); F3-PROJ A1-A2 (element-top boundaries).
3. **Tier-2** — F2-COL A1 (`--docker`), F2-VALVIEW A1, F1-CUSTOMNUM A1/A2 (low).
4. **§B** — F2-COL B1, F8-META B1, F5-CONN B1.

## Verdict

A deep, full-16-surface pass that did its primary job: **it found a real, compile-
verified `src/` bug** (the shaped UPDATE `*When` family, unusable as typed — the
round-13 shaped-key-remap class resurfacing in a new arm) plus its source-confirmed
INSERT sibling. The rest of the round honestly reflects a **mature suite — 8 surfaces
saturated** — with a tight, high-value residual concentrated in two themes: the
**shaped on-conflict static forms** (adjacent to the bug, same fragile remap path)
and a **newly-named theme — per-column adapter / custom-type as an operand outside
the top-level WHERE** (join-`on`, subquery-WHERE, HAVING, combinator-receiver), which
is exactly where an adapter-drop divergence would hide and which mock coverage cannot
see. Bar held high; nothing manufactured — the saturated surfaces are reported as
saturated, and the one borderline-degenerate item (F1-CUSTOMNUM modulo twins) is
flagged as low-value rather than inflated.
