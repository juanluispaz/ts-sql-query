# MISSING_TESTS_AUDIT_33 — type-driven missing-tests audit (Round 33)

**Mandate**: generous, extensive type-driven audit of the `test/` matrix against the
`src/` type surface; find tests the TYPES/emission imply but the suite lacks, and hunt
type-vs-impl divergences. Narrow degeneracy bar in force (runbook §4). No verdict
inherited from a prior report — every surface re-derived from the CURRENT files.

**Method**: 20 read-only discovery agents (≤10 concurrent) over the ~16 surfaces +
F-RECENT + F9-TYPEVAR + the two seam critics (MUT-SEAM / SEL-SEAM) + the PARITY
twin/variadic/overload-body sweep. Every load-bearing claim coordinator-verified (runtime
probe on the mock / wide-grep for absence). Reference cell `postgres/newest/pg/`.

**Matrix**: 17 cells, 236 files, **2435 tests/cell** (41 395 total), symmetric
(`tests:audit` ✓).

## Headline counts

- **Confirmed src bugs: 0.** A valid, successful mature round. All 20 surfaces re-derived
  clean; the Round-32 bug (#18) fix is verified complete + saturated. `BUGS.md` stays
  empty. Per runbook §9, a whole round validly closing with zero confirmed bugs is a
  success, not a shortfall — the method's worth is the ledger across the effort's whole
  history, and forcing a bug is an anti-pattern.
- **§A (existing cell + existing fixtures): 6 substantive + 2 borderline + ~7 Tier-3
  completeness clusters (§11, ~25+ cells)**, grouped into one dominant theme (**execute-shape
  throw/value-inhabitant parity**) + one completeness twin + one carry-over + the maximalist
  per-variant fan-out I under-surfaced on the first pass (§11 — added on review).
- **§B (needs a fixture): 0.** Round-32's two open §B (VALUES boolean adapter; picking ×
  rule-demotion) are both **closed** — one implemented, one refuted as already covered.
- **Saturated surfaces: 18 of 20** came back 0 genuine gaps (named below). Two more mature
  than Round 32: the entire per-surface value-source matrix, connection fan-out,
  projections, dynamic, parity, and type-var algebra are all mined out.

The single high-value finding is **A-1** (multi-row `returningLastInsertedId` per-row
MANDATORY null guard) — runtime-probe-confirmed, the direct multi-row twin of the
just-fixed single-row #18 guard, and the only place a MANDATORY error's `rowIndex` is
realized anywhere in the suite.

---

## 1. Confirmed bugs

**None.** The mutation seam critic, the select/CTE seam critic, the parity sweep, and every
per-surface agent hunted type-vs-impl divergences and found the `src/` clean. The two
candidate contradictions that arose (F4-INSERT vs MUT-SEAM on `executeInsertOne`
one-column NO_RESULT; F3-SELECT vs F-RECENT on the row-shape NoneOrOne too-many-rows) were
both **coverage** questions, not defects — settled by direct grep (§7).

---

## 2. §A — missing tests on existing cells + existing fixtures

### Theme A — execute-shape throw / value-inhabitant PARITY (Tier 1–2)

The round's coherent theme. Round-32's two execute-shape-throw implementations
(`update.returning.execute-shapes.test.ts` and the `select.one-column-and-count.test.ts`
too-many-rows additions) each landed on **some** branches of the
`{execute-shape × column-arity × inhabitant}` grid but left twins. Each execute-shape
family (`executeInsert*`/`executeUpdate*`/`executeDelete*`/`executeSelect*`) dispatches on
`__oneColumn` (→ `execute…ReturningOneColumnOneRow`) vs row-shape (→ `execute…ReturningOneRow`)
— **distinct runner methods**, each with its own throw/`→null` site. UPDATE got both NO_RESULT
arms + the mock-asserted NoneOrOne row-null; DELETE, INSERT and multi-column SELECT did not.

- **A-1 (Tier 1 — the marquee, runtime-probe-confirmed). Multi-row `returningLastInsertedId()`
  per-row MANDATORY null-element guard.** `InsertQueryBuilder.ts:158-160` (default-adapter)
  / `:138-140` (typeAdapter) throw `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` with a
  decorating `rowIndex` when a returned id array contains a null element. Untested in **every**
  cell; and `rowIndex` on a MANDATORY error is realized **nowhere** in `test/db` (grep: the
  only `rowIndex` hit is the type-surface dump). This is the direct multi-row sibling of the
  just-fixed single-row #18 guard (whose test is `errors.insert-guards.test.ts:174`).
  **Coordinator runtime probe** (mock, then deleted): `ctx.mockNext([1, null])` +
  `insertInto(tOrganization).values([{...},{...}]).returningLastInsertedId().executeInsert()`
  → threw `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`, **`rowIndex: 1`**. Mock-only (a real
  insert always yields ids), so it belongs in `errors.insert-guards` / `insert.multi-row`
  guarded by `if (ctx.realDbEnabled) return`, like the single-row twin. Fixture:
  `tOrganization` (no-adapter id → the `:158` default branch). Found by **F-RECENT**.

- **A-2 (Tier 1 — 2-agent convergence, 0 vs 17). DELETE `executeDeleteOne()` +
  `returningOneColumn(col)` NO_RESULT throw.** `DeleteQueryBuilder.ts:118-119` (`value ===
  undefined → NO_RESULT`) is never exercised: `delete.returning.execute-shapes.test.ts`
  covers the one-column branch only on the non-empty path and NO_RESULT only on the row-shape
  branch. Grep: `delete-returning-one-column-throws-no-result` = **0 cells** vs the UPDATE twin
  `update-returning-one-column-throws-no-result-on-empty` = **17 cells**. Direct copy-bake of
  the update twin: `deleteFrom(tIssue).where(id.equals(99999)).returningOneColumn(status).executeDeleteOne()`,
  `mockNext(undefined)` → NO_RESULT. Found by **MUT-SEAM** + **F4-UPDDEL** independently.

- **A-3 (Tier 1 — settles a cross-agent contradiction, 0). INSERT `executeInsertOne()` +
  `returningOneColumn(col)` NO_RESULT throw.** `InsertQueryBuilder.ts:259-261` (one-column
  `value === undefined → NO_RESULT`) is never exercised: `insert.execute-variants.test.ts`
  covers the one-column branch only value-present, and NO_RESULT only on the **row-shape**
  branch (`execute-insert-one-throws-no-result-when-row-missing`). Coordinator settled the
  F4-INSERT ("branches covered") vs MUT-SEAM ("one-column untested") contradiction by direct
  multiline grep: no test pairs `executeInsertOne` + `returningOneColumn` + `NO_RESULT`. The
  covered control is the row-shape arm. Realize via the existing 0-row `INSERT…SELECT` pattern
  (`execute-insert-none-or-one-with-returning-one-column-empty-result`) or mock-only like the
  row-shape twin. Found by **MUT-SEAM**.

- **A-4 (Tier 3 — borderline, present with both readings, 0 vs 17). Multi-column
  `executeSelectNoneOrOne()` MORE_THAN_ONE_ROW throw inhabitant.**
  `select.one-column-and-count.test.ts` (commit 089d1406) added, for `executeSelectOne`, both
  the one-column and multi-column MORE_THAN_ONE_ROW twins **and** the **one-column**
  `executeSelectNoneOrOne` MORE_THAN_ONE_ROW — but not the **multi-column** NoneOrOne one.
  Grep: `multi-column-execute-none-or-one` = **0 cells** vs the one-column twin = **17**.
  **Both readings** (coordinator-adjudicated): (a) **§A / complete-the-matrix** — the maintainer
  deliberately added the one-column NoneOrOne too-many-rows test even though it shares a runner
  throw with the one-column executeSelectOne (already covered), so completing the
  `{One,NoneOrOne}×{one-col,multi-col}` 2×2 is consistent with their own precedent; (b)
  **§C / runner-redundant** (F-RECENT's reading) — multi-column NoneOrOne routes through the
  same `executeSelectOneRow` runner as multi-column executeSelectOne, whose too-many-rows throw
  IS covered, so the throw is exercised at the runner level regardless of shape. Lean toward
  (a) at low priority given the precedent; a maintainer may reasonably close as (b). Found by
  **F3-SELECT**.

- **A-5 (Tier 2 — soft). INSERT `executeInsertNoneOrOne()` + `returning({...})` row-shape
  `→ null` from a real dispatch.** `InsertQueryBuilder.ts:224-228` `else { return null }` (a
  dispatched insert returning no RETURNING row) is untested: every `executeInsertNoneOrOne` +
  `returning({...})` test returns a row, and the only null path is the **empty-batch
  short-circuit** (`createResolvedPromise(null)` before dispatch — a distinct code path).
  Trigger: `insertInto(tProject).values({... colliding slug}).onConflictDoNothing().returning({id}).executeInsertNoneOrOne()`
  → suppressed → no row → null; mock `mockNext(undefined)`. Same TYPE/VALUE as the covered
  empty-batch null but a distinct reachable executor branch (the update/delete twins each got a
  dedicated row-null test). Found by **MUT-SEAM**.

- **A-6 (Tier 2 — soft, mock-assertion parity). DELETE `executeDeleteNoneOrOne()` row-shape
  `→ null` is only real-DB-asserted, never mock-asserted.** `DeleteQueryBuilder.ts:90-95`.
  `delete.returning.execute-shapes.test.ts` test 1 does `mockNext(expectedMock)` (a present row)
  and `toBeNull()` **only** `if (ctx.realDbEnabled)`, so under the default mocked `bun run tests`
  the null inhabitant is never realized on the delete side. The UPDATE equivalent IS
  mock-asserted (`update.returning.execute-shapes.test.ts` test 1, `mockNext(undefined)` →
  `toBeNull()` in both modes). Mirror it on delete. Found by **F4-UPDDEL**.

### Theme B — projection completeness twin (Tier 2)

- **A-7 (moderate confidence). Default-projector twin of the nullable optional-`oldValues()`
  arm.** Commit 089d1406 added `update.with-old-values-in-returning.test.ts` with an optional
  old column under `projectingOptionalValuesAsNullable()` (`oldArchivedAt: Date | null`). Its
  default-projector twin — same query minus `.projectingOptionalValuesAsNullable()`, asserting
  `{ oldArchivedAt?: Date }` with the old value **dropped** (absent-key inhabitant) — is absent.
  Every other `oldValues()` test reads a **required** old column; only this one uses an optional
  one, only under the nullable projector. Distinct type-path (`?: Date` vs `| null`) and
  inhabitant (absent-key vs present-null) over the `_old_`-aliased synthetic-subquery
  projection. Coordinator caveat: at authoring, confirm the default optional-drop over an
  `old.`-aliased column is a distinct projector branch vs a plain optional column (else
  degenerate). Found by **F-RECENT**.

### Carry-over §A

- **A-8 (still open from Round 32). `UNSUPPORTED_QUERY` — MySQL compatibility-mode emission
  guard.** `MySqlSqlBuilder._appendTableOrViewNameForFrom` (`:186` recursive-CTE-reaching-FROM,
  `:190` with-values-reaching-FROM), both gated on `compatibilityVersion < 8_000_000`.
  Builder-reachable and the **34th of 34** builder-reachable `TsSqlError` reasons (the other 33
  are asserted-as-thrown); **not implemented by 089d1406** (grep: `UNSUPPORTED_QUERY` appears
  only in the type-surface snapshot). MySQL-only (MariaDB extends a different SqlBuilder and runs
  10M+; both engines' cells run at `POSITIVE_INFINITY`). Realizable **inline** on
  `mysql/newest/mysql2` with **no new fixture**: the domain `DBConnection` constructor already
  threads an optional `compatibilityVersion` (and `runners.ts` forwards it), so
  `new DBConnection(runner, 5_007_000)` + the existing recursive-CTE / with-values fixtures +
  `expect(...).toThrow`/reason `UNSUPPORTED_QUERY`. Found by **F7-EXTRAS** (re-derives the
  Round-32 carry-over).

---

## 3. §B — needs a fixture addition

**None.** Round-32's two §B items are closed:

- **B-1 (VALUES `column('boolean', CustomBooleanTypeAdapter)`) — IMPLEMENTED** by 089d1406
  (`with-values.kind-coverage.test.ts` → `VBoolAdapterSampler`, value-asserted, symmetric in all
  17 Values-typed cells). The Round-32 latent `'Y'::bool` worry is **disproven**: it emits
  `case when $1::bool then 'Y' else 'N' end` and reads `(flag = 'Y')` — well-formed on every
  dialect. Verified by **F2-VALVIEW**.
- **B-3 (picking × rule-demotion) — REFUTED as already covered** by **F3-PROJ**:
  `dynamic-condition.pick.test.ts` covers `dynamicPick` demoting a would-be-required nested
  object to rule-4 optional (`meta?: {...}`) + the drop-branch + whole-object-mandatory + the
  picked × nullable-projector present-null. The one theoretical un-probed arm (a pick that keeps
  a nested object whose sole runtime leaf is nullable, then the processor collapses it) is
  degenerate — byte-identical to the non-pick rule-4 collapse already probed.

---

## 4. §C — degenerate (listed, not filed)

- **Single-row `returningLastInsertedId` NO_RESULT arm** (`InsertQueryBuilder.ts:103-104`,
  `result === undefined`) is **unreachable**: the DB value is normalized `undefined→null` at
  `:83-85` before transform, and `transformValueFromDB(null)` returns `null`, never `undefined`.
  Only a misbehaving custom `TypeAdapter` returning `undefined` for null could reach it —
  defensive dead code. (F-RECENT confirmed coordinator hint (a).)
- **Row-shape `executeSelectNoneOrOne` too-many-rows** — runner-redundant with the row-shape
  `executeSelectOne` too-many-rows (same `executeSelectOneRow` runner). Distinct from A-4, which
  is the *multi-column NoneOrOne* cell the maintainer's own one-column-NoneOrOne precedent argues
  for completing.
- **`intCol.add/…/modulo(fractionalLiteral)`** — the dispatcher carries the result as `'double'`
  internally, but `NumberValueSource` projects `number` either way → no type/value distinction;
  emission-only, OUT of the typed-surface scope (F1-NUM).
- **Temporal `valueWhenNull`/`nullIfValue` twin-split** (6 cells) + **pure-flag Nullable
  modifiers** on non-representative leaves — leaf-agnostic impl, return-type-only, sibling-method
  covered (F1-EQCMP).
- **7 optional-receiver custom-temporal getter corners** — SQL-identical to the required twin,
  optional-marker covered on sibling kinds (F1-TEMP; same as Round 32).
- **Branded-leaf locks on the four optionality modifiers** for customInt/customDouble —
  compile-only over an already-covered runtime path (F1-CUSTOMNUM, OUT); the customInt
  valueWhenNull/nullIfValue SOURCE-union asymmetry (values.ts:603/605) remains permanently OUT.
- **View read-path `customDouble/customUuid/enum/custom`** and required-only base-kind twins —
  no cast on the View read, output coincides with covered kinds (F2-VALVIEW / F2-COL).

---

## 5. Cosmetic observation (not filed)

- **PARITY** noted a consistent internal misspelling **`OnConfict`** (missing `l`) in the
  non-exported fluent-return-type interface names in `insert.ts` (e.g.
  `CustomizableExecutableMultipleInsertOnConfict`). It is internal-only (not in the `exports`
  surface, not user-importable), consistently spelled across the base+Optional twin, so it is
  neither a type-vs-impl divergence nor a coverage gap — recorded only for awareness. A src-owner
  cosmetic rename at most.

---

## 6. Round-32 items IMPLEMENTED since last round (verified, not re-reported)

Commits `6abda53a` (the #18 bug fix) + `089d1406` (+8246-line test commit) landed essentially
all of Round 32:

- **#18 bug FIXED** (`6abda53a`): `InsertQueryBuilder.ts:102` `this.onConflictDoNothing` →
  `this.__onConflictDoNothing`. Regression-locked + **SATURATED** — `errors.insert-guards.test.ts:174`
  (plain single-row null-id → MANDATORY throw) + `insert.on-conflict.test.ts:194` (the Round-32
  A-1 control: `onConflictDoNothing` null-value → `null`). Independently confirmed by F-RECENT +
  F4-INSERT + MUT-SEAM.
- Round-32 §A all landed and **balanced/saturated**: aggregate maybe-optional optional (all 5
  arities `aggMO1..5`), distinct → `forUseAsInlineAggregatedArrayValue` (both one-column + object
  shapes), distinct → `forUseInQueryAs`, rule-1 aggregate element-drop under asNullable (carries
  the array-length DROP probe, verified by F3-PROJ), `update.returning.execute-shapes` (both
  executeUpdateOne NO_RESULT arms + NoneOrOne row-null), the OrderByForModel[] → orderByFromStringArray
  pairing, and the **D-1 duplicate removal** (`errors.insert-guards -12` = the doubled
  `empty-values-with-min-throws-minimum-rows` de-duplicated). The C1 min-guard candidate resolution
  (`07edb90f`) remains SATURATED.

---

## 7. Coordinator verification notes

- **A-1** — runtime-probed on the mock: `mockNext([1, null])` → `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`,
  `rowIndex: 1`. Probe file written to the reference cell, run, **deleted**; `git status --porcelain`
  clean.
- **A-2 / A-3** — direct grep settled both. `delete-returning-one-column-throws-no-result` = 0 vs
  update twin = 17 (A-2). For A-3, a multiline awk scan per test found no
  `executeInsertOne`+`returningOneColumn`+`NO_RESULT` pairing — settling the F4-INSERT-vs-MUT-SEAM
  contradiction in MUT-SEAM's favor (F4-INSERT over-generalized "branches covered"; the covered
  control is the row-shape arm).
- **A-4** — `multi-column-execute-none-or-one` = 0 vs one-column twin = 17 vs the multi-column
  executeSelectOne control = 17. Presented with both readings (the runner-redundancy caveat is real;
  the maintainer's own one-column-NoneOrOne test is the precedent for completing the matrix).
- **B-1 / B-3** — verified closed (implemented / covered) before dropping from the report, so they
  are not re-chased.
- **Cross-agent contradictions settled by inspection, never averaged**: F4-INSERT vs MUT-SEAM (A-3);
  F3-SELECT vs F-RECENT (A-4 vs the row-shape §C); SEL-SEAM's "both arms covered" vs F3-SELECT's
  precise branch-matrix (F3-SELECT's grep won — the multi-column NoneOrOne cell is genuinely absent).
- **No forced bug**: 18 surfaces returned genuinely saturated and are named; the execute-shape gaps
  are all coverage, not defects (the guard/throw code is correct — probed and read).

---

## 8. Recommended implementation order

1. **A-1** (multi-row `returningLastInsertedId` MANDATORY/`rowIndex` guard) — highest value: the
   multi-row twin of the just-fixed #18 guard, the only realization of `rowIndex`, probe-confirmed.
2. **A-2 + A-3** (DELETE + INSERT one-column `executeDeleteOne`/`executeInsertOne` NO_RESULT) —
   direct copy-bakes of the existing update twin; complete the NO_RESULT parity across all three
   mutation builders.
3. **A-5 + A-6** (INSERT NoneOrOne row-null real-dispatch; DELETE NoneOrOne row-null mock-assert) —
   finish the null-inhabitant parity.
4. **A-7** (default-projector optional-oldValues twin), **A-4** (multi-column SELECT NoneOrOne
   too-many-rows — if the maintainer accepts reading (a)).
5. **A-8** (UNSUPPORTED_QUERY MySQL compat guard) — inline low-compat connection on mysql/newest;
   docker-relevant.

## 9. Per-surface saturation

| Agent | verdict | §A | §B | notes |
|---|---|---|---|---|
| PARITY | 0 defects, SATURATED | 0 | 0 | 16th-bug class no residual; `OnConfict` cosmetic (not filed) |
| MUT-SEAM | 0 defects | A-2, A-3, A-5 | 0 | the execute-shape NO_RESULT/null parity cluster |
| SEL-SEAM | 0 defects, SATURATED | 0 | 0 | recursive-CTE lineage confirmed closed; distinct siblings landed |
| F-RECENT | 0 defects | **A-1**, A-7 | 0 | multi-row MANDATORY/rowIndex guard (probe-confirmed) |
| F9-TYPEVAR | SATURATED | 0 | 0 | optionality/brand/null-edge/container algebra mined out |
| F1-EQCMP | SATURATED | 0 | 0 | 17 leaves; untested cells all degenerate |
| F5-CONN | SATURATED | 0 | 0 | both adapter dispatch branches realized |
| F4-INSERT | SATURATED | 0 | 0 | (over-generalized on one-column NO_RESULT → A-3) |
| F4-UPDDEL | 0 defects | A-2, A-6 | 0 | DELETE-side execute-shape parity (converges w/ MUT-SEAM) |
| F3-PROJ | SATURATED | 0 | 0 | R32 element-drop has array-length probe; B-3 refuted |
| F1-TEMP | SATURATED | 0 | 0 | 7 degenerate getter corners (as R32) |
| F6-DYN | SATURATED | 0 | 0 | dynamic fully paired; OrderByForModel[] landed |
| F2-COL | SATURATED | 0 | 0 | 15 factories × adapter-slots |
| F7-EXTRAS | 1 gap | A-8 | 0 | UNSUPPORTED_QUERY still open (33/34 asserted) |
| F3-SELECT | SATURATED* | A-4 | 0 | *but multi-column NoneOrOne too-many-rows twin |
| F1-BOOLIF | SATURATED | 0 | 0 | combinators + *IfValue fire/elide |
| F1-NUM | SATURATED | 0 | 0 | 37+16 methods, promotion, modulo |
| F1-CUSTOMNUM | SATURATED | 0 | 0 | every method × keep/erase realized |
| F1-STR | SATURATED | 0 | 0 | 52 methods incl. adapter-into-transform |
| F2-VALVIEW | SATURATED | 0 | 0 | B-1 landed; latent `'Y'::bool` disproven |

## 10. Verdict

A **zero-bug mature round** — the honest, expected shape at this maturity: the #18 fix is
verified complete and saturated, 18 of 20 surfaces re-derive clean, and the entire per-surface
value-source / connection / projection / dynamic / parity / type-var matrix is mined out. The
value is one crisp §A theme — **execute-shape throw/value-inhabitant parity** — where the
Round-32 locks (which added the UPDATE and one-column-SELECT throw inhabitants) each left a twin:
the multi-row `returningLastInsertedId` MANDATORY guard (the marquee, uniquely realizing
`rowIndex`), the DELETE/INSERT one-column NO_RESULT arms, the multi-column SELECT NoneOrOne
too-many-rows, and the NoneOrOne row-null inhabitants — all real-validatable, all direct copies of
covered twins, none a src defect. Plus one projection completeness twin and the carried-over
UNSUPPORTED_QUERY MySQL-compat guard. No bug was manufactured; no §A padded with degenerate gaps;
the two Round-32 §B are closed (one implemented, one refuted). The parity/seam method again
proves its worth: it surfaced the exact sibling arms the maintainer's own thorough Round-32
implementation left one branch short of.

---

## 11. Tier-3 completeness expansion (added on review)

**Correction to the first pass.** The initial write-up closed the §C list too aggressively:
several items were filed "degenerate" that are, under the runbook's own type-path definition,
**distinct type-paths** — *receiver-optionality is an explicit distinct return-branch*, a
*per-receiver-redeclared method* is distinct even with a generic impl, and a *distinct emitted
SQL* is a covered-bar path in its own right (the historical double-`modulo` bug was an emission
bug). Per the maximalist standard ("prefer erring by excess; never label a distinct
overload/interface/arity/classification 'low value' and drop it — tier it and report it"), these
are Tier-3 §A: mechanical per-variant fan-out, lowest priority, but **in scope and
real-DB-validatable**. Each was wide-grep-confirmed absent (counts below). They do **not**
change the 0-bug verdict; they lengthen the honest §A tail.

- **T3-1. Temporal Nullable-modifier twin-split (6 cells).** The suite alternates
  `valueWhenNull` on the Time-family and `nullIfValue` on the Date-family, leaving the crossed
  cells untested: `valueWhenNull × {LocalDate (workDate), LocalDateTime (createdAt),
  CustomLocalDate (releasedOn)}` and `nullIfValue × {LocalTime (reviewTime/startedAt),
  CustomLocalTime (cutoffTime), CustomLocalDateTime (signedOffAt)}`. Each is a per-receiver
  redeclaration threading a **distinct return value-source type** and a **distinct value**
  (date vs time round-trip). Grep: `workDate.valueWhenNull` / `*.nullIfValue` on those leaves = 0.
  Both the literal and value-source overloads. (Mis-filed §C by F1-EQCMP.)
- **T3-2. Optional-receiver custom-temporal getters (7 cells).** `customLocalDate.asOptional().
  {getMonth,getDate,getDay}()` + `customLocalTime.asOptional().{getHours,getMinutes,getSeconds,
  getMilliseconds}()`. Receiver-optionality is an explicit distinct return-branch (`number |
  undefined` vs `number`); the required-custom twin is covered but the optional-custom getter
  is not. Grep = 0. (The same 7 corners F1-TEMP has now filed §C two rounds running — promote,
  don't keep deferring.)
- **T3-3. Plain-temporal getters via a VIEW column.** `vReleaseOverview.releaseDayPlain` /
  `cutoffPlain` are projected as `Date` but never fed a getter; the View read is a distinct
  code path (bare `DBColumnImpl`) from the Table getters. `releaseDayPlain.getMonth()` etc.
- **T3-4. `intCol.modulo(fractionalLiteral)` float-handling emission — PROBE-CONFIRMED, and
  the int-receiver sibling of the historical double-`modulo` bug.** Coordinator probe:
  `priority.modulo(2)` → `priority % $1` but `priority.modulo(2.5)` →
  `mod((priority)::numeric, ($1)::numeric)`. A genuinely distinct emitted SQL that no test
  snapshots; real-DB-validatable (PG accepts `mod(numeric, numeric)`). F1-NUM filed it OUT as
  "no type distinction" — but a distinct **emission** is a covered-bar path, and this exact
  float-handling branch is where the `double % x` engine-rejection bug lived. An emission-snapshot
  test on the int receiver with a fractional literal closes it.
- **T3-5. Adapter column into the *other* string methods (Theme 9).** `tProjectReview.reviewerCode`
  (bracketAdapter) is fed only into `startsWith` and `toLowerCase` (grep: those two, nothing else);
  `toUpperCase` / `trim` / `trimLeft` / `trimRight` / `reverse` / `substring` / `substr` / `concat`
  / `length` each propagate the adapter to the result leaf (re-bracket) through a **different**
  transform and are unrealized. This is the runbook's named Theme-9 recurring gap (an adapter
  column tested only via one method), not degenerate — ~8 value-observable cells.
- **T3-8. The typeAdapter branch of the multi-row `returningLastInsertedId` MANDATORY guard
  (§A on an existing fixture).** A-1 exercises the **default-adapter** branch
  (`InsertQueryBuilder.ts:158`). The **typeAdapter** branch (`:138`, plus its unique `:130-131`
  mid-map `rowIndex` catch-decoration) fires only when the id column carries a `TypeAdapter` —
  reachable **now** via `tLedgerEntry.entryNo` (`autogeneratedPrimaryKey` + `plusOffsetAdapter`).
  Grep: `insertInto(tLedgerEntry).values([…]).returningLastInsertedId()` = 0. Same probe shape as
  A-1 (`mockNext([id, null])`) but on `tLedgerEntry` → exercises the adapter-applied per-row guard.
- **T3-11. `asRequiredInOptionalObject()` on a customBoolean receiver.** Grep:
  `published/verified/approved.asRequiredInOptionalObject` = 0. The customBoolean-remap emission
  under the `requiredInOptionalObject` optional-type tag is unrealized (the tag is exercised on
  enum/custom leaves, the customBoolean emission on other modifiers — but not their combination).
  Low value; listed for completeness.
- **Borderline (lean §C, listed not asserted):** optional-value-source-operand merge variants on
  `power/logn/roundn/atan2/divide` (F1-NUM) and on the string predicates (F1-STR) — each a distinct
  `(method × optional-operand)` realization, though the `MergeOptional` mechanism is proven
  generically; `subSelectDistinctUsing(x).from(y).selectOneColumn(z).forUseAsInlineQueryValue()`
  (distinct one-column scalar inline, SEL-SEAM); `valueWhenNull(valueSource)`/`nullIfValue(valueSource)`
  on a *plain* boolean receiver (F1-BOOLIF).

**Correctly OUT (kept out — promoting these would violate degeneracy-by-non-validatability):**
the customInt/customDouble branded-leaf locks on the four optionality modifiers (identical SQL +
value, differ only in an `assertType` leaf → compile-only, negative-type territory); the customInt
`valueWhenNull`/`nullIfValue` SOURCE-union asymmetry (`values.ts:603/605`, phantom); `ContainsRequired5`
depth-5 cap (unsound only below the never-render floor); the single-row `returningLastInsertedId`
`NO_RESULT` sub-branch (unreachable — value is null-normalized before transform).

**Revised §A tally:** 6 substantive + 2 borderline (§2) **+ ~7 Tier-3 completeness clusters (T3-1..T3-11,
~25+ individual cells)**. Priority is unchanged — A-1..A-3 and A-8 first; the Tier-3 tail is a
generous, cheap, real-DB-validatable completeness sweep for whenever the per-leaf/per-modifier fan-out
is worth baking. Verification: T3-4 probe-confirmed; T3-1/T3-2/T3-5/T3-8/T3-11 grep-confirmed absent;
T3-6 (adapter `score` into numeric ops) was **checked and is covered** (102 matrix hits) — correctly
NOT promoted.
