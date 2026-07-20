# Missing-tests audit — ROUND 22

**Method**: type-driven, multi-agent. 16 discovery agents (runbook §6 decomposition),
dispatched in waves of ≤10, **led by the parity sweep and TWO deep seam critics**
(mutation seams / select-CTE-projection seams — the seam is the highest-yield bug vein
once per-surface matrices saturate). Every agent touching conditional methods carried
the corrected **`*When` soundness oracle** (below) so the round-21 `disallowIfNoValueWhen`
false positive could not recur. The coordinator verified every load-bearing claim itself
(runtime probe for emission candidates, source read for impl-delegation questions).

**Degeneracy bar in force**: the narrow bar (§4). **`*When` soundness oracle** (§7/§9,
new since round 21): a `*When` whose key-tracking return type differs from its
unconditional sibling is NOT a bug by default — the oracle is *soundness under
`when === false`*, not runtime delegation under `when === true`.

**Pre-flight**: N=22. Matrix `bun run tests:audit` → **17 cells, 232 files, 2024
tests/cell** (34 408 total), symmetric, audit clean (up from 231/1990 — round-21
implementations + the BUG-2 fix's live test landed). Reference cell `postgres/newest/pg/`.
`test/BUGS.md` **empty** at start (round-21 BUG-2 fixed, BUG-1 closed as false positive).
Index refreshed. Domain fixtures re-read (round-21 View §B additions `channelBracketed` /
`versionUpperTagged` are now present — committed).

**Prelude — a false positive corrected before this round.** Round-21 BUG-1
(`disallowIfNoValueWhen`) was resolved by the fixing agent as **working-as-intended**.
The runbook §7/§9 and memory were updated with the soundness oracle; every §7-verified
`*When` divergence this round was checked against it, and all were correctly benign
(no re-file).

---

## ⟢ Resolution update (post-round, 2026-07-03) — the headline "bug" was re-adjudicated as a **legitimate boundary, not a bug**

The round's headline finding (below) — `customizeQuery` non-bracketing hooks
(`afterSelectKeyword` / `beforeColumns` / `customWindow`) dropped on
`recursive-union + forUseInQueryAs` — was handed to the fixing agent and, **with the
repo owner's decision, resolved as a legitimate NOT-APPLICABLE composition boundary, not
a `src/` bug.** The round's technical root-cause was *correct* (the compound CTE body has
no plain-SELECT clause to host those three hooks); what flipped is the **classification**.

**Why it's a boundary, not a bug.** The three hooks customize the recursive query's OUTER
`select ... from <cte>` projection. Consumed as a CTE via `forUseInQueryAs`, that outer
projection is **replaced by the consuming query**, so the hooks have nowhere to render —
and they cannot be emitted as valid SQL on the `anchor ∪ recursive` compound: a compound
has no SELECT clause, and wrapping it in an outer select is impossible because the
recursive self-reference cannot be nested inside a subquery. Rendering them was not
achievable; *"not applicable here"* is the correct semantics. (Repo-owner rule: **not
every customization is applicable in every context.**)

**How it was resolved** — this **ends the recurring whack-a-mole class** (round-21 BUG-2
and this follow-on were the same vein re-opening one hook at a time):

- **src** — the `forUseInQueryAs` recursive branch now re-homes the outer customization
  onto the compound CTE body via an **explicit allow-list** (`beforeQuery` / `afterQuery`
  + the order-by hooks only) instead of a blind spread-merge. Any current *or future*
  projection-only hook is excluded **by construction**, so the class cannot recur. **Zero
  observable SQL change** — the three hooks were already dropped; now it is intentional.
- **docs** — the boundary is documented in `docs/queries/sql-fragments.md` § Customizing a
  select.
- **test** — locked by a **passing** boundary test
  `customize-recursive-select-projection-only-hooks-not-applicable-as-cte` in all **17**
  `customize-query.select.test.ts` cells; its snapshot is byte-identical to the
  bracketing-hooks sibling → *proves* the three hooks leave no trace. **No `// TODO[BUG]`**
  marker — a documented boundary, not pending work.
- **`BUGS.md`** — the entry was **removed** (reclassified; not a bug); the file is empty again.

**Net for this round's tally: Confirmed `src/` bugs → 0.** The seam critic's value stands —
it surfaced the untested composition — but the composition's correct behavior turned out to
be "not applicable here", not a defect. All §A/§B missing-test findings are unaffected.

---

## Headline counts

| Bucket | Count |
|---|---|
| **Confirmed `src/` bug** (→ `BUGS.md`, coordinator runtime-probed) | **1 → 0** (resolved post-round as a legitimate boundary — see Resolution update) |
| Candidate defects adjudicated (SEAM-A) → §A missing-tests, not bugs | 2 |
| **§A** missing tests (existing cells + existing fixtures) | ~13 clusters |
| **§B** missing tests (needs a fixture addition) | 3 |
| **Genuinely saturated** surfaces (0/0) | 6 |

**The round's headline is a confirmed seam bug — and it's an *incomplete-fix follow-on*
of round-21's BUG-2**: the fix re-homed the recursive-CTE `customizeQuery` hooks onto a
*compound* builder that can't emit the non-bracketing ones, so they're still dropped.
Six single-surface agents came back saturated; the value again concentrated at the seam
critics.

> **Post-round correction:** this headline was **re-adjudicated as a legitimate boundary,
> not a bug** — the compound body genuinely cannot host those three projection-only hooks,
> and consumed-as-a-CTE they are *not applicable* (the outer projection is replaced by the
> consuming query). Resolved via an explicit allow-list re-home + docs + a passing boundary
> test; `BUGS.md` re-emptied. See the **Resolution update** above.

---

## Confirmed bug (filed in `BUGS.md`, `src/` NOT touched)

### BUG — `customizeQuery` non-bracketing hooks (`afterSelectKeyword`/`beforeColumns`/`customWindow`) silently dropped on `recursive-union + forUseInQueryAs`

> **RESOLVED (post-round): legitimate NOT-APPLICABLE boundary, not a `src/` bug.** The
> technical root-cause described below is correct, but the classification flipped — those
> three hooks target the outer projection, which is replaced by the consuming query when the
> recursive select is materialised as a CTE, and cannot render as valid SQL on the compound
> body. Rendering them was never achievable; the correct semantics is "not applicable here".
> Fixed via an explicit allow-list re-home in `forUseInQueryAs` (no future projection hook
> can silently drop) + a docs note + a **passing** boundary test in all 17 cells; the
> `BUGS.md` entry was removed. See the **Resolution update** near the top.

- **Class**: recursive-CTE customizeQuery-drop — **the incomplete-fix follow-on of
  round-21's BUG-2**. That fix re-homed the outer customization onto the CTE body
  (`SelectQueryBuilder.forUseInQueryAs` recursive branch, ~:549-553), but that body is a
  **CompoundSelectQueryBuilder**, and the compound emitter (`AbstractSqlBuilder` ~:811-864)
  renders only the bracketing hooks + order-by hooks — **not** `afterSelectKeyword` /
  `beforeColumns` / `customWindow` (which live only in the plain-select emitter,
  ~:934/:942/:1022). So those three are re-homed onto a builder that cannot emit them → still
  dropped.
- **Found by**: the **select/CTE seam critic** (SEAM-B), which root-caused it structurally.
- **Coordinator verification**: my own runtime SQL probe (mock, `ctx.lastSql`), two arms:
  - direct `.executeSelectMany()` (control) → `… select /* hint */ /* cols */ id …, depth from recursive_select_1 window w1 as (partition by depth) order by title asc, id asc` — all five hooks render (this is the *existing passing test* `recursive-union-all-customize-query-outer-select-hooks`).
  - `.forUseInQueryAs('tree')` → `with recursive tree as (… order by title asc, id asc) select id from tree` — **`/* hint */`, `/* cols */`, `window w1 …` GONE**; only order-by hooks survive.
  Probe deleted, tree clean.
- **Lesson (in the §9 ledger)**: when a fix re-homes state onto a *different builder kind*,
  re-audit the destination builder's full capability set — a compound builder emits a
  narrower hook set than a plain select. **After a seam fix lands, re-probe the whole
  hook/field family and the other builder kind, not just the one hook that motivated it.**

---

## SEAM-A candidate defects — adjudicated to §A missing-tests (not filed as bugs)

Both were ranked Tier-1 by the mutation seam critic as *probe targets* ("probably-fine-but-
untested"), because their code path differs materially from the covered sibling. Coordinator
verdict:

- **SA-C1 — `insertInto(<adapter-PK>).from(select).returningLastInsertedId()` (multi-id
  path).** NOT a bug — source read confirms the multi-id branch
  (`InsertQueryBuilder.ts:119-123`) applies the column's
  `typeAdapter.transformValueFromDB(row, columnTypeName, defaultTypeAdapter)` per row,
  identically to the covered single-row path. The adapter fires; it's simply never exercised
  with an adapter PK → **§A missing-test** (value-validatable: seed N rows, assert each
  returned id is `dbValue + 1000`).
- **SA-C2 — `update(t).from(...).returning({ oldValues().<adapterCol> })`.** The old value is
  emitted as raw SQL inside a synthesized subquery with a renamed alias, then round-trips
  through `__transformRow` keyed by the ValueSource. The suspicion (alias/rename breaking the
  ValueSource↔result-key mapping) is a **real-DB SQL concern the mock cannot adjudicate** (the
  mock returns rows by key and never exercises the emitted subquery alias). Classified **§A
  missing-test flagged for MANDATORY docker-validation on PG** — not filed as a bug I cannot
  confirm. If the test surfaces a real-DB failure when written, it becomes a bug then.

---

## §A — missing tests (existing cells + existing fixtures), by theme/tier

### Tier 1 — seam compositions (feature × special builder), value-observable

- **SEAM-B A1-A5** (all existing fixtures):
  - adapter column projected through a **compound** (union), read-value ÷10/bracket survives (the CTE sibling is covered, the union one isn't).
  - adapter column through **`forUseAsInlineAggregatedArrayValue`**, per-element read-value survives.
  - **`projectingOptionalValuesAsNullable()` on a recursive-union select executed directly**, optional leaf → present-null.
  - **compound + `projectingOptionalValuesAsNullable()` + `forUseAsInlineAggregatedArrayValue()`** (the nullable-projector-then-inline-aggregate combination).
  - **compound + `customizeQuery` + `forUseAsInlineAggregatedArrayValue`** (inline-aggregate wrapper sibling of the covered CTE form).
- **SEAM-A** (adapter-through-composed-mutation — a systemic hole: no adapter column is ever
  driven through a composed mutation seam): adapter × on-conflict do-update-set + returning;
  adapter marshalled through insert-from-select; delete-using × returning × adapter; update-from
  × returning × adapter; **SA-C1** (multi-id returningLastInsertedId, above); **SA-C2**
  (update-from oldValues adapter, docker-validate). Plus SQL-snapshot gaps: update-from ×
  customizeQuery, delete-using × customizeQuery, insert defaultValues × customizeQuery;
  `projectingOptionalValuesAsNullable` × {from-select returning, update-from-old-values returning,
  delete-using returning}.
- **PROJ GAP-1** — rule-2 *discard* boundary: a same-left-join object whose leaves are ALL
  genuinely-optional (no `originallyRequired` leaf) → falls to rule-4, demoting the leaves. Both
  projectors. The classifier's `IsOriginallyRequired` arm (projectionRules.ts:67-79) is never
  exercised with an all-optional same-left-join object. (GAP-3: aggregate-element left-join-inner
  nullable twin, promised-but-missing. GAP-2: rule-2-with-inner-object — reachability to pin by
  compile-repro at test-authoring time.)
- **SELECT A1** — the recursive result's OWN overload set (`OrderByExecutableSelectExpression`):
  `orderBy`/`limit`/`offset` + `executeSelectOne`/`NoneOrOne`/`Page` — every recursive test
  terminates at `.executeSelectMany()`.

### Tier 2 — distinct overloads / per-type / adapter fan-out

- **INSERT A1** — shaped single-row `*When` octet: **14 of 20 methods** still uncovered (the
  round-21 file `insert.shaped.set-when-helpers.test.ts` exists but covers only 6; the per-node
  convention wants the full octet).
- **UPDDEL A1** — DELETE-USING → RETURNING a USING-joined **auxiliary column** (never asserted
  matrix-wide; every `delete.using.variants` projects target-table columns only).
- **UPDDEL A2** — shaped-**executable** (AllowingNoWhere) `*When` octet: only `setWhen` tested on
  the executable arm; the rest are tested only through the where-required not-executable twin.
- **PARITY A1/A2** — `updateAllowingNoWhere`/`deleteAllowingNoWhereFrom` **join limbs**
  (`.innerJoin/.join/.leftJoin/.leftOuterJoin` → the distinct `OnExpressionAllowingNoWhere`
  interface; mysql/mariadb-only) — typed-live, never exercised.
- **BOOLIF A1-A4** — plain native-boolean **column** as a combinator receiver
  (`tIssueWorklog.billable.negate()/and/or/onlyWhen/ignoreWhen` — only ever an operand today,
  emits `not billable` / `not (billable = 1)` per dialect); the custom-boolean
  `onlyWhen`/`ignoreWhen` quadrant for `verified`/`approved`/`invoiced`; `approved.and/or` +
  `invoiced.or`; the custom-boolean elide branch.
- **EQCMP** — a broad direct-fluent tail (≈12 groups, ~70 cells): the Equalable-only branded
  leaves (`enum`/`custom`) lack `notInN`, `in`/`notIn(subquery)`, value-source-operand
  equality, and half the `*IfValue` twins; the custom-temporal Comparable leaves
  (`customLocalDate`/`customLocalTime`) lack single-bound ordered comparison, membership
  variadics, and the **entire** `*IfValue` family (0 hits).
- **INSERT A2** — `values([oneRow])` single-element-array branch (returns `Multiple` type,
  emits single-row SQL — a distinct arity/branch).

---

## §B — missing tests (needs a fixture addition)

- **CONN B1** — `sequence(name, customKind, typeName, adapter)`: the custom-kind `adapter2`
  slot of `sequence` (`AbstractAdvancedConnection.ts:43-48`). Round 21 closed this `adapter2`
  parallel for const/arg/valueArg/fragmentWithType/executeFunction but left `sequence` open.
  Add `releaseTagSeqOffset = this.sequence<ReleaseTag,'ReleaseTag'>('release_tag_seq','customInt','ReleaseTag', plusOffsetAdapter)`;
  assert `nextValue`/`currentValue` read value shifted +1000 (4 advanced-connection cells).
- **COL B1** — Table `optionalColumn` + a **non-boolean plain** value-transform TypeAdapter
  (the distinct writable+optional `__asOptionalColumn` branch — every existing Table
  `optionalColumn`+adapter is the SQL-changing boolean `CustomBooleanTypeAdapter`). Add a
  nullable adapter-bearing int column to `tLedgerEntry`.
- **VALVIEW** — the **View source's per-kind read marshalling** (theme 9): plain
  `boolean`/`bigint`/`double`/`uuid`/`localDate`/`localTime` have **no View column at all**, so
  the bare-`DBColumnImpl` read path per kind (BigInt coercion, boolean adapter, uuid normalize,
  Date coercion) is never observed on a View; plus the **custom-kind + trailing-adapter** branch
  reached with a non-undefined adapter **nowhere** (Values inline B1 / View DDL B2). Needs new
  View DDL columns + seed.

---

## Per-surface verdicts

| Agent | Result |
|---|---|
| SEAM-B (select/CTE) | **BUG** (C1 confirmed) + 5 §A seam compositions |
| SEAM-A (mutation) | 2 candidates → §A (SA-C1 not-bug; SA-C2 docker-validate) + 8 §A adapter-through-mutation |
| PARITY | 2 §A (AllowingNoWhere join limbs); twin surface clean; `*When` soundness held; update.ts:532 wart re-confirmed unreachable/OUT |
| PROJ | 3 §A (rule-2-discard Tier-1, aggregate-nullable twin, rule-2-inner-object) |
| SELECT | 1 §A Tier-1 (recursive result's own overload set) |
| EQCMP | broad §A direct-fluent tail (~70 cells, branded/custom-temporal leaves) |
| INSERT | 2 §A (shaped *When 14/20, values single-elem array); `*When` folds sound |
| UPDDEL | 2 §A (delete-using aux-column returning, shaped-executable *When octet); no defect |
| BOOLIF | 4 §A (plain-boolean receiver, custom-boolean onlyWhen/ignoreWhen quadrant) |
| CONN | 1 §B (sequence custom-kind adapter2) |
| COL | 1 §B (Table optionalColumn + non-boolean plain adapter); Table side saturated |
| VALVIEW | §B View per-kind read + custom+adapter; Values near-saturated |
| **DYN** | **SATURATED 0/0** |
| **TEMP** | **SATURATED** (0 Tier-1; one near-degenerate carry-over) |
| **NUM / CUSTOMNUM / STR** | **SATURATED 0/0** (re-verified; modulo/double + brand keep/erase intact) |
| **EXTRAS** | **SATURATED 0/0** |

Round-21 findings landed and closed this round (verified by the agents re-deriving fresh):
PROJ's two classification boundaries, compound `executeSelectOne`/`NoneOrOne`, 3-table
comma-`from()`, custom-boolean combinators (verified/approved/invoiced), theme-3
const/arg/valueArg custom-kind `adapter2`, View optional+adapter §B, Values optional
adapter arm, shaped-update `extendShape` post-set arm, EQCMP customUuid ordered arm +
customLocalTime `is`/`isNot`.

---

## Coordinator verification notes

1. **BUG (SEAM-B C1)** — my own runtime probe (`zz_probe_recursive_cte_hooks.test.ts`,
   deleted) with a direct-execute control arm; the emitted-SQL diff isolates the drop to the
   three non-bracketing hooks on `recursive × forUseInQueryAs`. *(The drop is real; post-round
   it was re-adjudicated as a legitimate boundary rather than a bug — see Resolution update.)*
2. **SA-C1** — source read of `InsertQueryBuilder.ts:119-123`: the multi-id path applies the
   column adapter per row → not a bug, §A.
3. **SA-C2** — mock cannot exercise the emitted subquery alias → §A docker-validate, not filed.
4. **`*When` soundness** — every agent that met a `*When` divergence (PARITY, INSERT, UPDDEL)
   applied the oracle and correctly declined to file (`disallowIfNoValueWhen` not re-examined;
   shaped/MissingKeys folds confirmed sound; the AllowingNoWhere `*When` dispatchers are thin
   monotonic delegators).
5. **update.ts:532** malformed `NOldValuesFrom` union — re-confirmed LATENT/unreachable
   (sqlite `oldValues()` is `never`), OUT; not re-filed (consistent with round 21).
6. Tree confirmed clean after every probe.

---

## Recommended implementation order

1. **BUG (SEAM-B C1)** — ✅ **DONE — resolved as a legitimate boundary, not a bug.** The
   fixing agent + repo owner adjudicated the three projection-only hooks as NOT-APPLICABLE
   when a recursive select is consumed as a CTE. Resolution: explicit allow-list re-home in
   `forUseInQueryAs` (excludes any current/future projection hook by construction) + a docs
   note + a **passing** boundary test in all 17 cells (no `// TODO[BUG]`); `BUGS.md` entry
   removed. See the **Resolution update** near the top.
2. **Tier-1 §A (existing fixtures)**: SEAM-B A1-A5 seam compositions; SEAM-A adapter-through-
   mutation (incl. SA-C1; **SA-C2 with a docker run**); PROJ GAP-1; SELECT A1.
3. **Tier-2 §A**: INSERT shaped *When octet; UPDDEL delete-using aux-return + shaped-executable
   *When; PARITY AllowingNoWhere join limbs; BOOLIF; EQCMP direct-fluent tail.
4. **§B**: CONN sequence adapter2; COL Table optionalColumn adapter; VALVIEW View per-kind read.

---

## Verdict

**A saturating round whose headline seam finding resolved to a legitimate boundary, not a
bug** — exactly the mature-phase signature (§9): six surfaces genuinely 0/0, and the value at
the two seam critics. The headline finding (`customizeQuery` non-bracketing hooks dropped on
`recursive × forUseInQueryAs`) was surfaced as the follow-on of round-21's BUG-2, but on
resolution it was **re-adjudicated as a NOT-APPLICABLE composition boundary** — the three
projection-only hooks target an outer projection that no longer exists once the recursive
select is consumed as a CTE, and cannot render as valid SQL on the compound body. So the round
**nets 0 confirmed `src/` bugs**; the seam critic's value was in *surfacing the untested
composition*, whose correct semantics turned out to be "not applicable here". The fix (explicit
allow-list re-home + docs + a passing boundary test) closes the recurring whack-a-mole class so
no future projection hook can silently drop. The `*When` soundness oracle held across every
agent — no recurrence of the round-21 false positive. The §A/§B tail is a healthy, honest set
(seam compositions, the recursive/compound own-overload sets, the branded/custom-temporal EQCMP
direct-fluent tail, the View per-kind read marshalling, the `sequence` and `optionalColumn`
adapter slots) and stands unchanged. `src/` was touched only for the boundary allow-list (no
observable SQL change).

---

## ⟢ Implementation status (post-round, 2026-07-03) — what was built, deferred, and newly found

The §A/§B findings above were taken through the generation half (canonical-first in
`postgres/newest/pg`, propagated across all 17 cells, snapshots baked, mock + docker/wasm
validated). Final state: **`tests:audit` symmetric (233 files, 2111 tests/cell), `validate:tests`
(tsgo) + `validate:tests:tsc` green, full mock 35 338 pass / 0 fail**, and every value-observable
batch was value-validated on the real engines (docker + wasm). Native-SQLite cells were
real-validated by the plain mock run. `src/` untouched.

### One `src/` bug found — now FIXED by the follow-up fixing agent

Implementing **SELECT A1** (the recursive result's own overload set) surfaced a genuine defect
the discovery pass had classified as a benign §A missing-test:

- **`orderBy` / `limit` / `offset` on a `recursiveUnion*` result rendered inside the CTE anchor
  member instead of wrapping the outer `select … from recursive_select_N`.** The type
  (`OrderByExecutableSelectExpression`) promises result-level ordering/paging; the impl ordered/limited
  the *seed*. **Docker-confirmed against real PostgreSQL**: `.orderBy('id').limit(2).executeSelectPage()`
  returned `count: 2` instead of `3` (the count query wrapped the already-limited CTE). The
  `executeSelectOne` / `executeSelectNoneOrOne` terminals (no ordering) ran live and were correct.
  Lesson consistent with §9: the maximalist bar caught a "looks like the same builder" path — the
  no-op NULL-`parent_id` seed made `executeSelectMany` coincide with the intended result and masked it.
- **Resolution (post-round).** Fixed in `src/` (commit `c3f64158`): a `__orderingAndPagingTarget()`
  helper in `SelectQueryBuilder` routes the four state writes (`__addOrderBy`, `orderingSiblingsOnly`,
  `limit`, `offset`) to the outer `__recursiveSelect` when the recursion is built (mirroring the
  existing `customizeQuery` re-home; no-op for non-recursive selects). The two `// TODO[BUG]`-wrapped
  tests (`recursive-result-order-by-limit-offset`, `recursive-result-execute-select-page`) are now
  **uncommented and live in all 17 cells**; validated across the mock matrix + docker
  (PostgreSQL/Oracle/SQL Server/MariaDB — Oracle/SQL Server emit `offset … rows fetch next … rows only`
  on the outer select) + native SQLite. `BUGS.md` entry removed.

### Implemented (all validated)

| Finding | What landed | Applicability / validation |
|---|---|---|
| **INSERT A1** | 14 missing shaped single-row `*When` methods → `insert.shaped.set-when-helpers.test.ts` (octet completed) | LIVE all cells; mock+docker |
| **INSERT A2** | `values([oneRow])` single-element-array (Multiple node via `setForAll`, single-row SQL) → `insert.multi-row.test.ts` | LIVE all cells; mock+docker |
| **UPDDEL A2** | 19 remaining `*When` methods on the AllowingNoWhere **shaped-executable** arm → `update.shaped-conditional-sets.test.ts` | LIVE all cells; mock+docker |
| **UPDDEL A1** | `DELETE … USING … RETURNING` an auxiliary/USING-joined column → `delete.using.variants.test.ts` | LIVE pg×8/oracle/sqlserver; mariadb TODO[LIMITATION], mysql/sqlite NOT-APPLICABLE. **Docker-confirmed pg/oracle/mssql all accept the USING column in RETURNING/OUTPUT** |
| **PARITY A1/A2** | `updateAllowingNoWhere`/`deleteAllowingNoWhereFrom` join limbs (innerJoin/join/leftJoin/leftOuterJoin), 4+4 tests → `update.join`/`delete.join.test.ts` | LIVE mysql/mariadb; NOT-APPLICABLE elsewhere; docker |
| **BOOLIF A1-A4** | plain-boolean `billable` receiver (5) → `select.bool-ops.test.ts`; custom-boolean `onlyWhen`/`ignoreWhen` kept quadrant + `approved.and/or` + `invoiced.or` + elide (11) → `select.custom-boolean-remap.test.ts` | LIVE all cells; docker+wasm confirmed per-dialect `not billable` vs `not (billable = 1)` |
| **EQCMP** | custom-temporal single-bound/membership/`*IfValue` (7) → `direct-fluent-temporal`; enum/custom notInN, in/notIn(subquery), value-source equality, `*IfValue` (6) → `equality-comparison-by-type` | LIVE all cells; docker+wasm. Corrected during authoring: **no `betweenIfValue`/`notBetweenIfValue`** exists in the Comparable `*IfValue` family |
| **SELECT A1** | recursive result `executeSelectOne` / `executeSelectNoneOrOne` + `orderBy/limit/offset` + `executeSelectPage` → `cte.recursive-union-variants.test.ts` | LIVE all cells; docker. `orderBy/limit/offset` + `executeSelectPage` surfaced a bug, now **fixed** (`c3f64158`) and live (see above) |
| **SEAM-B (partial)** | adapter through a compound (union) + through `forUseAsInlineAggregatedArrayValue` (2 tests) → new `select.adapter-through-compositions.test.ts` | LIVE all cells; docker+wasm |
| **SEAM-A (partial)** | adapter (`score` ÷10) through `DELETE … USING … RETURNING` → `delete.using.variants.test.ts` | LIVE pg/oracle/sqlserver; **docker-validated** |
| **CONN B1** (§B) | `releaseTagSeqOffset` fixture (customInt + trailing adapter) on the 4 advanced-connection domains + 2 tests → `sequence.next-current-value.test.ts` | LIVE advanced (pg/oracle/mariadb/sqlserver); NOT-APPLICABLE mysql/sqlite; docker |
| **COL B1** (§B) | nullable `discount` int + scaledTenth adapter added to schema.sql/seed.sql/connection.ts × 6 dialects + 3 tests (read ÷10 / write ×10 / null-absent) → `column.factory-adapter-overloads.test.ts` | LIVE all cells; **docker+wasm confirmed the schema change applies to every engine** |
| **PROJ GAP-1** | all-optional same-left-join object → rule-4 (the `IsOriginallyRequired`-false arm), **both projectors** (2 tests) → `select.complex-projection.inner-rules.test.ts` | LIVE all cells; docker+wasm |

### ⟢ Continuation session (2026-07-03) — the deferred items, now resolved

All items below were picked up in a follow-up session and either **completed + validated** or
**assessed + documented**. Final tree state after this session: **`tests:audit` symmetric (233 files,
2124 tests/cell), `validate:tests` (tsgo) + `validate:tests:tsc` green, full matrix mock 35 571 pass /
0 fail**, and a **docker + wasm pass of 898 tests / 0 fail** across every real engine (mariadb, mysql,
oracle, postgres, sqlserver + pglite/sqlite-wasm + native sqlite) covering the value-observable
additions. `src/` still untouched.

- **VALVIEW (§B)** — **DONE + docker+wasm validated.** All 7 per-kind read columns landed on
  `vReleaseOverview`: plain `boolean` / `bigint` / `double` (backed by new `project_release` base
  columns `is_signed` / `download_count` / `avg_rating`, typed per dialect to match
  `billable`/`view_count`/`estimated_hours`), plain `uuid` (reuses `signing_key`), plain `localDate` /
  `localTime` (reuse `released_on` / `cutoff_time` as new distinct view outputs), and a **custom-kind +
  trailing adapter** column (`releaseOrdinal` = `id` through `plusOffsetAdapter`, read +1000, branded
  `ReleaseTag`). 2 tests → `select.view-column-types.test.ts`, LIVE all cells. **The uuid-on-binary
  risk did not materialise**: `signing_key` is stored binary on mysql (`UUID_TO_BIN`) / oracle
  (`UUID_TO_RAW`) and `uniqueidentifier` on sqlserver, yet the plain-uuid view column round-trips
  correctly on every engine (the connector's uuid marshalling applies through the view). Fixture work:
  `project_release` base columns + 7 portable view outputs + seed × 6 dialects; `ReleaseTag` type +
  `baseTypeForCustom` case added to mysql/sqlite (the two non-advanced connections lacked it) so the
  vReleaseOverview block is identical across all 6.
- **PROJ GAP-2 / GAP-3** — **DONE + docker+wasm validated.** GAP-2 (rule-2 same-left-join **outer**
  object containing a nested inner object, default + nullable — reachability pinned by compile-repro,
  non-degenerate: `proj?: { id; inner: {…} | undefined }` / `proj: { id; inner: {…} | null } | null`)
  and GAP-3 (the promised aggregate-element left-join-inner nullable twin, default + nullable) → 4
  tests in `select.complex-projection.inner-rules.test.ts` + `select.aggregate-as-array.element-projection-rules.test.ts`, LIVE all cells.
- **SEAM-A** — **6 seams DONE + docker-validated; the long tail assessed.** Landed: update-from ×
  returning × adapter (`update.from.variants.test.ts`); SA-C2 adapter through `oldValues()` in RETURNING
  (`update.with-old-values-in-returning.test.ts`, the audit's mandatory-docker item — validated on
  pg/sqlserver); `customizeQuery` × {update-from, delete-using, insert-defaultValues}
  (`customize-query.{update,delete,insert}.test.ts` — delete-using is line-commented NA on the 5 sqlite
  cells because its `rawFragment` bodies contain `*/`); and delete-using × returning × nullable-projector
  (`delete.using.variants.test.ts`). **Remaining micro-variants assessed, not implemented** (the
  systemic hole "adapter/transform through a composed mutation" is now represented by the seams above):
  on-conflict × returning × adapter is **fixture-limited** (no domain table pairs a *settable* natural
  conflict target with an adapter column — the adapter tables' only unique key is an autogenerated PK
  that can't be forced into a conflict); insert-from-select × adapter is degenerate on the write side (a
  SELECT source carries no JS value for the write adapter to transform); SA-C1 (multi-id
  `returningLastInsertedId` + adapter PK) adds only a weak real-DB invariant (ids advance across
  rollback, so exact +1000 can't be asserted) over the already-covered single-row PK-adapter path; and
  the from-select / update-from-old-values × nullable-projector variants are orthogonal compositions of
  two already-covered facets.
- **SEAM-B A4/A5** — **assessed, dropped (confirmed).** Compile-repro on pg: `compound
  .projectingOptionalValuesAsNullable().forUseAsInlineAggregatedArrayValue()` yields
  `projects: { archivedAt?: Date; id: number }[]` — the nullable projector **no-ops** across the
  inline-aggregate boundary (the optional leaf stays `?: Date`, not `Date | null`). Ambiguous whether a
  type gap or an intentional boundary; **not filed** (uncertain, no correctness obligation established;
  §7.2 guard) — and A4/A5 also type `never` on MariaDB, so a uniform live test isn't writable anyway.
- **Comment hygiene (bug-close sync)** — closing the `projectingOptionalValuesAsNullable` story surfaced
  a stale sibling the fixing agent missed: `select.compound-optional-as-nullable.test.ts` (17 cells) had
  a header claiming "no type-safe public path … tests block-commented … TODO[BUG]" that commit
  `35623776` had already invalidated (the tests are live and pass). Rewritten across all 17 cells to
  describe the live after-`union` path accurately (the "walk every place that reflected the old
  behaviour" step of the BUGS.md close protocol).

- **SEAM-B A3** — **resolved: NOT a bug; now covered by a live test.** The initial read (the method
  is absent on the `OrderByExecutableSelectExpression` that `recursiveUnionAll` returns) was correct
  but the framing was wrong: `projectingOptionalValuesAsNullable()` is meant to be called **immediately
  after `.select({...})`, before `.recursiveUnion*(...)`** (the documented "only immediately after
  select(...)" contract). On that reachable path both the type (`parentId: number | null`) and the
  runtime (`parentId: null`) work. The `union`/`unionAll` asymmetry is **mechanical, not a gap**:
  `union`/`unionAll` build a fresh `CompoundSelectQueryBuilder` that does not inherit the anchor's
  projection flag (a before-`union` call is silently lost, so they must re-expose the method after),
  whereas `recursiveUnionAll` returns the anchor whose flag `__transformRow` reads directly (the
  before-recursion call works). So the follow-up agent **did not widen the type** (widening would only
  let you write a call that violates the documented contract), **removed the `BUGS.md` entry**, and
  **added a passing test** (`recursive-result-projecting-optionals-as-nullable`) locking the reachable
  path in all 17 cells. *(Superseding the earlier deferral: the union-vs-recursive asymmetry was briefly
  filed as a functional-expansion in `BUGS.md`, then re-adjudicated as not-a-gap and the entry removed —
  see above.)*

### Fixture / infra changes made this session (beyond `test/db/*/*/*` cells)

- `test/db/{postgres,oracle,mariadb,sqlserver}/domain/connection.ts` — added `releaseTagSeqOffset`
  (CONN B1).
- `test/db/*/domain/{schema.sql,seed.sql,connection.ts}` (all 6) — added the nullable `discount`
  column (COL B1).
- One new file family: `select.adapter-through-compositions.test.ts` (17 cells).

**Continuation session (2026-07-03):**

- `test/db/*/domain/{schema.sql,seed.sql,connection.ts}` (all 6) — VALVIEW: added `project_release`
  base columns `is_signed` / `download_count` / `avg_rating` (plain boolean/bigint/double, per-dialect
  types), 7 portable `release_overview` view outputs, seed values, and the 7 `vReleaseOverview` columns.
- `test/db/{mysql,sqlite}/domain/connection.ts` — added the `ReleaseTag` brand + `baseTypeForCustom`
  case (the two non-advanced connections lacked them) so the VALVIEW view block is identical across all 6.
- No new file family this session — additions extended existing files (`select.view-column-types`,
  `select.complex-projection.inner-rules`, `select.aggregate-as-array.element-projection-rules`,
  `update.from.variants`, `update.with-old-values-in-returning`, `delete.using.variants`,
  `customize-query.{update,delete,insert}`).
- `test/BUGS.md` — the recursive `orderBy/limit/offset` entry was **fixed** by the follow-up fixing agent
  (`src/` commit `c3f64158`) and its entry removed; the file is back to `_None open._`.

`src/` was not modified **by the test work**; the one confirmed bug was fixed separately by the
fixing agent (test-author/fixing-agent split), and its two tests are now uncommented and live.
