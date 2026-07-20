# MISSING_TESTS_AUDIT_32 — type-driven missing-tests audit (Round 32)

**Mandate**: generous, extensive type-driven audit of the `test/` matrix against
the `src/` type surface; find tests the TYPES/emission imply but the suite lacks,
and hunt type-vs-impl divergences. **Degeneracy bar in force**: the narrow bar
(§4 of the runbook) — a distinct reachable overload/interface/arity/classification
is a path even when its output coincides with a covered one; degenerate only when
same-overload-through-shared-dispatcher + kind-string-only + provably-generic +
representative-tested (and even then listed).

**Method**: 20 read-only discovery agents (≤10 concurrent) over the ~16 surfaces +
F-RECENT + F9-TYPEVAR + the two seam critics (MUT-SEAM / SEL-SEAM) + the PARITY
twin/variadic/overload-body sweep. Each raw-read its `src/` slice (types only),
built an enumeration matrix, and coverage-checked the CURRENT test files. Every
load-bearing claim was coordinator-verified (runtime probe on the mock / wide-grep
for absence). No verdict was inherited from a prior report.

**Matrix**: 17 cells, 235 files, **2418 tests/cell** (41 106 total), symmetric
(`tests:audit` ✓). Reference cell `postgres/newest/pg/`.

## Headline counts

- **Confirmed src bugs: 1** — the **18th** in the method's ledger:
  `InsertQueryBuilder.ts:102` single-row `returningLastInsertedId` null-id guard is
  dead code (method-vs-field typo). Runtime-probe-confirmed; filed in
  [`BUGS.md`](./BUGS.md).
- **Bug-vs-boundary candidates (both readings): 0.** The Round-31 C1 candidate
  (empty-batch min-guard asymmetry) was **RESOLVED** by the maintainer in commit
  `07edb90f` (reading (a) — enforce the guard consistently); no new pending
  candidate surfaced.
- **§A (existing cell + existing fixtures): 8 substantive + 4 borderline**, grouped
  into 3 themes below. Dominated by **execute-shape throw/value-inhabitant parity**
  and the **aggregate maybe-optional optional branch**.
- **§B (needs a fixture): 3** (one MySQL-compat error-guard, one VALUES boolean-adapter
  emission, one low-confidence picking×rule-demotion).
- **Saturated surfaces: 15 of ~20** came back 0 genuine gaps (named below). This is
  a mature round: most per-surface matrices are mined out; the yield is at the seams
  and the freshly-changed surface, exactly as §9 predicts.

---

## 1. CONFIRMED BUG (filed in BUGS.md, ledger #18)

### BUG-1 — single-row `returningLastInsertedId().executeInsert()` never throws on a null id (dead guard)

`src/queryBuilders/InsertQueryBuilder.ts:102` reads `if (!this.onConflictDoNothing)`
— the **method** `onConflictDoNothing` (:1676), not the **field**
`this.__onConflictDoNothing` (:41). A method reference is always truthy, so
`!this.onConflictDoNothing === false` always, and the null-id guard body (:103–108)
is **dead code**. A plain (non-do-nothing) `returningLastInsertedId()` is typed
non-null, yet a null/undefined id from the DB resolves `null` instead of throwing
`MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` — a type-vs-runtime **soundness**
violation.

**Coordinator runtime probe** (mock, `postgres/newest/pg`, then deleted):

| chain | mockNext | result | correct behaviour |
|---|---|---|---|
| plain `returningLastInsertedId().executeInsert()` | `null` | **RESOLVES null** | THROW `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` |
| plain (same) | `undefined` | **RESOLVES null** | THROW |
| `.onConflictDoNothing().returningLastInsertedId()` (control) | `null` | RESOLVES null | correct (type is `number \| null`) |

The plain and do-nothing arms are runtime-indistinguishable though their result
types differ — which is precisely what the guard is meant to differentiate. Found
by **MUT-SEAM**; the multi-row/from-select array branch (:117–166) has its own
always-on per-row guard and is unaffected; Update/Delete builders have no equivalent
typo. **Fix**: `this.onConflictDoNothing` → `this.__onConflictDoNothing`. The
positive test is *blocked by the bug* (fails on the plain arm today), so the
BUGS.md entry is the marker.

**Oracle discipline applied**: not a `*When` (no soundness-under-`false` exception);
not a drop-vs-boundary (the non-null contract *survives* — the guard exists to
enforce it, so defeating it is a real defect); and it is a runtime-VALUE bug, not a
type divergence — so a mock runtime probe (not a compile-repro) was the correct
verifier, and it printed the actual `null` rather than being reasoned about.

---

## 2. §A — missing tests on existing cells + existing fixtures

Grouped by theme, tiered by risk. All wide-grep-verified absent by the coordinator.

### Theme A — execute-shape throw / value-inhabitant PARITY (Tier 1)

The strongest cluster this round. Each execute-shape family (`executeInsert*` /
`executeUpdate*` / `executeDelete*` / `executeSelect*`) declares sibling shapes
whose *distinguishing inhabitant* is a throw or a `null`/absent value; several
inhabitants are asserted on one sibling but never on its twin.

- **A-1 (Tier 1, pairs with BUG-1). `onConflictDoNothing().returningLastInsertedId()`
  null-VALUE arm.** The `| null` (conflict-suppressed) inhabitant of
  `OnConflictReturningLastInsertedIdOptionalType` is only *type*-asserted
  (`insert.on-conflict.test.ts:161` mocks a **non-null** id `100`); the null value
  is never realized. `mockNext(null)` on that chain → resolve `null` (real §A). This
  is the **control sibling** of BUG-1 and lands with it. Fixture: `tOrganization`.

- **A-2 (Tier 1). UPDATE `executeUpdateOne()` NO_RESULT-on-empty-returning.**
  `executeUpdateOne(): Promise<Row>` has no `| null` (unlike `executeUpdateNoneOrOne`)
  *because* the executor throws `NO_RESULT` when the RETURNING yields no row
  (`UpdateQueryBuilder.ts:143` one-column, `:154` row-shape). That type-implied throw
  is never value-exercised: wide-grep of all `test/db` for `executeUpdateOne` paired
  with `NO_RESULT`/`No result` → **zero** hits (only the type-surface dump). The
  **DELETE twin IS covered** (`delete.returning.execute-shapes.test.ts`,
  `delete.using.variants.test.ts`) and INSERT's is
  (`insert.execute-variants.test.ts`, `errors.insert-guards.test.ts`) — clean
  asymmetry. Home: a new `update.returning.execute-shapes.test.ts` (structural twin
  of the existing DELETE file). Fixture: `tIssue`. Found by **F4-UPDDEL**.

- **A-3 (Tier 2). UPDATE `executeUpdateNoneOrOne()` ROW-shape `null` (None) inhabitant.**
  `update.returning.test.ts:249` keys `id=1` (a match) so the row always returns; the
  `| null` None arm of the row shape is only in the `assertType`, never a `toBeNull()`.
  The one-column None arm *is* value-exercised (execute-variants), and DELETE
  value-exercises the row-shape None arm — so this is the missing UPDATE row-shape
  twin. Fixture: `tIssue` (no-match `where`). Found by **F4-UPDDEL**.

- **A-4 (Tier 2, borderline). SELECT `executeSelectNoneOrOne()` MORE_THAN_ONE_ROW
  inhabitant.** `executeSelectOne` asserts its too-many-rows throw
  (`select.one-column-and-count.test.ts:213/246`); `executeSelectNoneOrOne` asserts
  only its null branch (`:67`), never the `>1 rows` reject. Real-DB-validatable
  (`selectFrom(tIssue).where(projectId.equals(1))…executeSelectNoneOrOne()` — project 1
  has ≥2 issues). Borderline: the underlying runner throw is shared with the tested
  `executeSelectOne`. Found by **F3-SELECT**.

### Theme B — fragment / aggregate optional-type realization (Tier 1–2)

- **A-5 (Tier 1). Aggregate maybe-optional optional-stamping branch is unexercised.**
  `buildAggregateFragmentWithMaybeOptionalArgs` is a **distinct runtime impl**
  (`AbstractConnection.ts:1007`) from the plain `buildFragmentWithMaybeOptionalArgs`
  (:908), yet every aggregate maybe-optional fixture is called with **required**
  columns: wide-grep confirmed `aggMaxColumnOptional(tIssue.priority)`,
  `aggMO2Max(priority,id)`, `aggMO3Max(…)`, `aggMO4Max(…)`, `aggMO5Max(…)` — all
  required int operands, all asserting a `number` result. The optional-result branch
  (feed `tIssue.assigneeId`, an existing optional column → `number | null` +
  realize the NULL inhabitant) is never asserted at any arity. Fixtures exist
  (`aggMaxColumnOptional`, `aggMO*Max`, `tIssue.assigneeId`). Found by **PARITY**,
  converged with F5-CONN's aggregate note.

- **A-6 (Tier 2 / borderline §C). Arity-1 plain `negateMaybeOptional` optional branch.**
  `FragmentFunctionMaybeOptional1`'s value-source-optional overload (`fragment.ts:418`)
  is only tested with a **required** column (`negateMaybeOptional(tIssue.priority)`).
  Arity 1 is the one arity the b5dc3f2e regression lock never touches. Leans
  degenerate vs the arity-2 `intPlus(const, assigneeId)` value-source-optional test
  (same overload-2 computation), so it is **listed but low priority**. Found by
  **PARITY**.

### Theme C — special-builder × cross-cutting-feature seam compositions (Tier 1–2)

- **A-7 (Tier 1). `select distinct …` consumed as `forUseAsInlineAggregatedArrayValue()`.**
  The entire aggregate-as-array family is covered except a `distinct` source.
  `selectDistinctFrom` carries the `'distinct'` FEATURE and the consumer emits
  observably distinct SQL (coordinator/​SEL-SEAM runtime-confirmed:
  `json_agg(...) from (select distinct … ) as a_1_`). Wide-grep: **zero**
  `forUseAsInlineAggregatedArrayValue` over a distinct source anywhere;
  `select.distinct.test.ts` never calls it in any cell. Two shapes (one-column
  `string[]`, multi-column object array). Real-DB-validatable. Fixture: `tIssue`.
  Found by **SEL-SEAM**.

- **A-8 (Tier 2). `select distinct …` consumed as `forUseInQueryAs('d')` (user CTE).**
  Runtime-confirmed `with d as (select distinct …) select …`; the only
  `as (select distinct …)` in the suite is the internal auto-generated
  `result_for_count` count-wrap (a different render site). Same interface as a plain
  CTE, so a distinct-emission composition rather than a type branch — lower confidence
  than A-7. Found by **SEL-SEAM**.

- **A-9 (Tier 2). Rule-1 aggregate top-element DROP-on-null-gate under
  `projectingOptionalValuesAsNullable()`.** The DEFAULT projector has
  `element-top-rule-1-required-in-optional-object-gate-null-drops-whole-element`
  (`select.aggregate-as-array.element-projection-rules.test.ts:446`); its rule-2 and
  rule-4 siblings both have `-as-nullable` twins that probe the length drop, **rule-1
  does not**. The nearest asNull rule-1 test uses a *required* column gate
  (`title.asRequiredInOptionalObject()`), so the gate is never null and the element
  never drops. Needed: the asNull twin with a *nullable* gate
  (`tIssue.body.asRequiredInOptionalObject()`), asserting `items: Array<{ ref: string;
  assigneeId: number | null }>` (ref stays required, assigneeId flips `| null`, the
  element itself is NOT `| null`) **and** a runtime `rows[0].items.length`-reduced
  probe (a null-gate element must DROP, not surface as `{ ref: null }`).
  **Coordinator note**: F3-PROJ traced the runtime materialization
  (`__transformAggregatedArray` uses `continue` — projector-independent) and confirmed
  the drop is SOUND, so this is a **coverage gap, not a soundness bug** — but per the
  143fe3b2 oracle it must carry the array-length VALUE probe, since a type-only check
  would miss a null-surfacing regression. Found by **F3-PROJ**. Fixture: `tIssue` +
  a left-join.

- **A-10 (Tier 2). `oldValues()` optional-old-column in RETURNING ×
  `projectingOptionalValuesAsNullable()`.** Confirmed the two never co-occur in a
  single test (the `oldValues` token in `update.returning.test.ts` is a comment "no
  oldValues"; its asNullable tests use live columns). A distinct emission+shape path:
  the `_old_`-aliased synthetic-subquery projection driven through the nullable
  projector must flip an optional old column to present-`| null`. Fixture exists
  (`tProject.archivedAt` optional + `tProject.oldValues()`). Found by **MUT-SEAM**.

- **A-11 (Tier 3, borderline). `OrderByForModel<Model>[]` → `orderByFromStringArray(...)`
  documented idiomatic pairing.** The docs (`src/dynamic/orderBy.ts:18`,
  `src/experimental/types.ts:12`) recommend a typed `OrderByForModel<M>[]` array fed to
  `orderByFromStringArray`, but the existing `OrderByForModel[]` arrays are consumed
  via `.join(', ') → orderByFromString`, and `orderByFromStringArray` is only tested
  with plain strings. Near-degenerate (SQL already proven identical via the `.join`
  route); listed per "when in doubt → MISSING". Found by **F6-DYN**.

---

## 3. §B — needs a fixture addition

- **B-1 (§B, docker-validated payoff). `UNSUPPORTED_QUERY` MySQL compatibility-mode
  emission guard.** `MySqlSqlBuilder._appendTableOrViewNameForFrom` (`:186`, `:190`)
  throws `UNSUPPORTED_QUERY` with two distinct messages when
  `compatibilityVersion < 8_000_000` — a recursive CTE reaching FROM, and a
  `with-values` reaching FROM. Both are builder-reachable and type-callable, but the
  reason appears in the suite only inside the type-surface snapshot, never
  asserted-as-thrown (33/34 builder-reachable `TsSqlError` reasons are asserted; this
  is the 1 missing). Realizable on `mysql/newest/mysql2` with an inline low-compat
  `DBConnection` — the same pattern the `config.*` tests use to toggle a flag (add
  `protected override compatibilityVersion = 5_007_000` on a cell-local connection).
  Dialect+version-specific; a positive `toThrow`, not a NOT-APPLICABLE marker. Found
  by **F7-EXTRAS** (re-derives the Round-31 §B carry-over). *Fixture add*: a
  cell-writable low-`compatibilityVersion` connection helper in the mysql cell.

- **B-2 (§B, docker-validated payoff). `Values.column('boolean', CustomBooleanTypeAdapter)`
  in a VALUES tuple.** The adapter-object arm of the boolean Values column
  (`src/Values.ts:69`) is exercised only with an int adapter; boolean ×
  `CustomBooleanTypeAdapter` is untested. The write path transforms `true → 'Y'` (a
  string) while the plain boolean Values column emits a `::bool` cast — binding `'Y'`
  under `::bool` is a genuinely distinct, potentially-rejecting emission
  (`'Y'::bool` is invalid on PostgreSQL) that a mock bakes without validating. Thin
  type-path; payoff realized under `--docker` on PG/mssql/oracle. *Fixture add*: an
  inline `Values` subclass with a `column('boolean', new CustomBooleanTypeAdapter('Y','N'))`
  (no schema/seed change). Found by **F2-VALVIEW**.

- **B-3 (§B, low confidence). Picking × rule-demotion interaction.** `projectionRules.ts`
  iterates `RequiredKeys<TYPE>`, so a `dynamicPickPaths` that picks away the sole
  `originallyRequired` leaf of a left-join object demotes rule 2 → rule 4 (flips the
  container optionality). The pick tests cover pick mechanics + asNullable but not a
  nested-object pick that *changes the container-optionality rule*. Narrow/exotic;
  flag but do not prioritize. Found by **F3-PROJ**. Fixture: possibly reachable with
  existing `tIssue`+left-join + a pick shape (may be §A on closer look).

---

## 4. §C — degenerate (listed, not filed)

- **MAX-guard on an empty operation** (F-RECENT C1). After any empty branch
  `count === 0`, so `count > max` can only fire for `max < 0` (a pathological
  type-permitted input). The max-guard lines are already covered by non-empty tests.
  Correctly untested on empty.
- **`executeUpdateMany` empty-set + `returningOneColumn`** (F-RECENT C2). The empty-set
  arm resolves `[]` **before** the `__oneColumn` branch, so `returningOneColumn` vs
  `returning({…})` is invisible on empty — both hit the identical short-circuit. No
  new code exercised.
- **`intCol.modulo(fractionalLiteral)`** (F1-NUM). The one untested
  `_moduloRequiresFloatHandling` trigger (case 3), but it is the same
  `modulo(value: number)` const overload already tested with `modulo(2)` and the
  result type is `number` either way — no type distinction, a docker-only emission
  branch, OUT of the typed-surface scope.
- **7 optional-receiver custom-temporal getter corners** (F1-TEMP):
  `customLocalDate.asOptional().getMonth()/getDate()/getDay()` and all four
  `customLocalTime.asOptional().get*()` — SQL-identical to the tested required twin,
  optional-marker propagation covered on sibling custom kinds.
- **Plain `.join()` per-driver behavioral test** (F3-SELECT A2 / §C). The `.join` vs
  `.innerJoin` distinction is emitted-SQL-only (identical type signature) and the SQL
  is already asserted in `doc-code.generated.test.ts` — a symmetry/depth observation,
  not a type-path absent.
- Per-surface §C classes named in the saturation table (custom/enum-on-View,
  req/opt kind twins, col-vs-col-where-subquery-tested, etc.).

---

## 5. Test-hygiene finding (not a src bug)

- **D-1. Duplicate test name across all 17 cells.**
  `errors.insert-guards.test.ts` contains
  `insert-guards/empty-values-with-min-throws-minimum-rows` **twice** (lines ~97–107
  and ~144–154, byte-identical bodies), propagated by commit `41862686` into every
  cell (grep count = 2 in every copy). One of the two copies should be deleted
  matrix-wide. No src involvement; `tests:audit` does not flag it. Found by F-RECENT.

---

## 6. Round-31 items IMPLEMENTED since last round (do NOT re-report)

Commits `b5dc3f2e`, `07edb90f`, `41862686`, `788a8401`, `1ad4c6cf`, `5a08f2cf`
landed the bulk of Round 31:

- **`07edb90f`** — the Round-31 **C1 candidate RESOLVED** (maintainer chose reading
  (a)): `executeInsert`/`executeInsertMany`/`executeUpdate`/`executeUpdateMany` now
  run the min/max guard on an empty operation. Regression-locked by
  `errors.insert-guards.test.ts` + `errors.update-guards.test.ts` +
  `update.execute-variants.test.ts` + `insert.execute-variants.test.ts`. **SATURATED**
  (independently confirmed by F-RECENT + MUT-SEAM). The runbook C1 boundary note is
  updated to "resolved".
- **`b5dc3f2e`** — the 16th-bug fragment `MaybeOptional` optionality fix + empty-values
  handling. The regression lock (`fragments.with-args.test.ts`) asserts OPTIONALITY
  via `assertType<Exact>` (not SQL-only) at arity **3, 4 AND 5**, each with a
  required-arg control + a runtime `|undefined` / `'r' in row` realization.
  **PARITY diffed all 32 arity-5 body permutations + the adjacent
  `FragmentFunction`/`FragmentFunctionIfValue`/aggregate families — zero residual
  mis-bracketing.** Class fully closed.
- Round-31 §A/§B implemented: `insert.optional-custom-columns.test.ts`,
  `insert.multi-row.missing-keys.test.ts`, `mutation.shaped-compositions.test.ts`,
  `delete.using.variants.test.ts`, and extensions to `delete.returning` /
  `update.returning` / `select.compound` /
  `select.aggregate-as-array.element-projection-rules` / `fragments.with-args` /
  `customize-query.select` / `select.value-source.null-and-if-value-modifiers` /
  `select.distinct` / `select.subqueries` + `domain/connection.ts` fixtures
  (`sum3MaybeOptional`, the `frag*`/`agg*` arity families, `tReleaseDraft`). All
  confirmed present AND exercised at runtime.

---

## 7. Coordinator verification notes

- **BUG-1** — runtime-probed on the mock (table above); typo confirmed by source
  read (`onConflictDoNothing` method :1676 vs `__onConflictDoNothing` field :41; all
  other refs use the field). Probe file written to the reference cell, run, and
  **deleted**; `git status --porcelain` clean afterward.
- **A-5 (PARITY-A1)** — wide-grep captured the OPERAND, not just the method:
  `aggMaxColumnOptional`/`aggMO*Max` are all called with required int columns → the
  optional branch is genuinely unexercised.
- **A-2 (F4-UPDDEL-A1)** — looped every file containing `executeUpdateOne` and checked
  for a `NO_RESULT` pairing: **none**; the DELETE `executeDeleteOne` twin IS paired in
  2 files. Confirmed asymmetric.
- **A-7 (SEL-SEAM-A1)** — 0 `forUseAsInlineAggregatedArrayValue` over a distinct source
  anywhere; SEL-SEAM runtime-confirmed the emitted `json_agg(... select distinct ...)`.
- **A-9 (F3-PROJ-A1)** — the existing `-as-nullable` rule-1 tests use a *required*-column
  gate (never drops); the nullable-gate top-element drop under asNull is genuinely
  absent. F3-PROJ traced the runtime as projector-independent/sound → coverage gap,
  not a bug.
- **False-ABSENT avoided**: the UPDATE empty-op success/`NO_COLUMN_SETS` paths I first
  suspected untested are covered in `update.execute-variants.test.ts` (a different
  file from `errors.update-guards.test.ts`) — verified by wide-grep before the round,
  so they are NOT reported. F3-SELECT's initial "plain `.join()` absent" flipped to
  covered once `doc-code.generated` was grepped.
- **No forced bug**: 15 surfaces returned genuinely saturated and are named as such;
  the C1 candidate was checked against the git-log and found resolved (not
  re-derived as new).

---

## 8. §B fixture-addition plan

| Item | Add | Cell(s) | Notes |
|---|---|---|---|
| B-1 | cell-local low-`compatibilityVersion` `DBConnection` helper (`= 5_007_000`) | `mysql/newest/mysql2` | mirror `config.*` pattern; assert both `UNSUPPORTED_QUERY` messages (recursive-CTE, with-values) |
| B-2 | inline `Values` subclass with `column('boolean', new CustomBooleanTypeAdapter('Y','N'))` | shared (all cells) | no schema/seed change; **`--docker` validate** on PG/mssql/oracle (`'Y'::bool` latent) |
| B-3 | possibly reachable with existing `tIssue`+left-join + a `dynamicPickPaths` demotion shape | reference | re-check whether it's actually §A; low priority |

The A-1…A-11 items need **no** fixture — existing `tOrganization`/`tIssue`/`tProject`
+ the fragment/aggregate helpers suffice.

## 9. Recommended implementation order

1. **BUG-1 fix** (`this.onConflictDoNothing` → `this.__onConflictDoNothing`) + its
   test (A-1 is the control sibling; land together). Highest value — a real
   soundness defect.
2. **A-5** (aggregate maybe-optional optional branch) — distinct runtime impl, clean
   §A on existing fixtures, converges two agents.
3. **A-2 + A-3** (UPDATE execute-shape NO_RESULT / row-null parity) — one new
   `update.returning.execute-shapes.test.ts`, twin of the DELETE file.
4. **A-7 + A-8** (distinct → inline-agg-array / user CTE) — one new distinct-consumer
   test.
5. **A-9** (rule-1 asNull element-drop with the array-length probe), **A-10**
   (oldValues × asNullable), **A-4** (executeSelectNoneOrOne too-many-rows).
6. **§B** items (B-1 MySQL compat guard, B-2 VALUES boolean adapter) — docker-validated.
7. **A-6, A-11, D-1 (hygiene), §C** — optional / lowest priority.

## 10. Per-surface saturation

| Agent | verdict | §A | §B | notes |
|---|---|---|---|---|
| PARITY | 0 defects | A-5, A-6 | 0 | b5dc3f2e class fully closed (all overload bodies clean) |
| MUT-SEAM | **BUG-1** | A-1, A-10 | 0 | the round's defect + its control + oldValues×asNullable |
| SEL-SEAM | 0 defects | A-7, A-8 | 0 | recursive-CTE lineage confirmed closed; distinct-source consumer residual |
| F-RECENT | 0 defects | 0 | 0 | fresh C1/b5dc3f2e surface SATURATED; D-1 hygiene; C1/C2 §C |
| F9-TYPEVAR | 0 | 0 | 0 | **SATURATED** — optionality/brand/null-edge/container mined out |
| F1-EQCMP | 0 | 0 | 0 | **SATURATED** — 17 leaves × Nullable/Equalable/Comparable |
| F5-CONN | 0 | 0 | 0 | **SATURATED** — both adapter dispatch branches realized |
| F4-INSERT | 0 | 0 | 0 | **SATURATED** — repaired *When/shaped families live at runtime |
| F4-UPDDEL | 0 defects | A-2, A-3 | 0 | UPDATE execute-shape throw/null parity gap |
| F3-PROJ | 0 defects | A-9, (A2 minor) | B-3 | rule-1 asNull element-drop twin; runtime-sound |
| F1-TEMP | 0 | 0 | 0 | **SATURATED** — 7 optional custom-getter corners degenerate |
| F6-DYN | 0 | A-11 | 0 | **SATURATED** but the documented OrderByForModel[] pairing |
| F2-COL | 0 | 0 | 0 | **SATURATED** — 15 factories × adapter-slots |
| F7-EXTRAS | 0 | 0 | B-1 | 33/34 error reasons asserted; UNSUPPORTED_QUERY missing |
| F3-SELECT | 0 defects | A-4 | 0 | **SATURATED** fluent; executeSelectNoneOrOne too-many-rows |
| F1-BOOLIF | 0 | 0 | 0 | **SATURATED** — combinators + *IfValue fire/elide |
| F1-NUM | 0 | 0 | 0 | **SATURATED** — 37+16 methods, promotion, modulo triggers |
| F1-CUSTOMNUM | 0 | 0 | 0 | **SATURATED** — every method × keep/erase realized |
| F1-STR | 0 | 0 | 0 | **SATURATED** — incl. adapter-into-transform value path |
| F2-VALVIEW | 0 defects | 0 | B-2 | **SATURATED** — VALUES boolean-adapter residual |

## 11. Verdict

A textbook **mature round**: 15 of 20 surfaces genuinely saturated, the yield
concentrated at the seams and the freshly-changed surface. **One confirmed src
bug** (#18, the dead null-id guard) — a runtime-VALUE soundness defect on the
untested sibling of a covered path (single-row `returningLastInsertedId`), exactly
the ledger's recurring shape, surfaced by the mutation seam critic and proven by a
mock runtime probe. The §A tail is small and coherent — dominated by execute-shape
throw/value-inhabitant parity, the aggregate maybe-optional optional branch, and the
distinct-source inline consumers — all closeable on existing fixtures. Two
docker-flavoured §B items and one low-confidence §B. The Round-31 C1 candidate is
resolved and its fix saturated. No bug was manufactured; no §A padded with
degenerate gaps. The method continues to earn its keep: the 18th defect lived where
"it looks like the same implementation" as the multi-row guard that was correct all
along.
