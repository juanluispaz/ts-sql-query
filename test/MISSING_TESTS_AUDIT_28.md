# Missing-tests audit — ROUND 28

**Method.** Type-driven, multi-agent. 20 discovery agents (the full ~16 surface
decomposition + the two mature-phase agents F-RECENT and F9-TYPEVAR), read-only,
raw-reading the `src/` TYPE surface and checking each enumerated type-path against
the CURRENT test files. Coordinator verified every load-bearing claim itself
(tsgo compile-repro for reachability/exact-type; mock runtime-probe for
emitted-SQL/throw symptoms; wide-grep for absence), applying the four oracles
(`*When`-soundness, drop≠defect, type-self-consistency ≠ runtime-soundness,
probe-the-minimal-trigger). All repro/probe artifacts deleted; tree clean.

**Degeneracy bar in force:** the narrow bar (§4) — a distinct reachable
overload/interface/per-receiver-method/arity/input-classification is a gap even
when its output coincides with a covered case; degenerate only when the same
overload through a shared dispatcher differs by a kind-string alone with a
representative already tested.

**Pre-flight.** Matrix **17 cells × 2311 tests/cell** (symmetric ✓, +24/cell
since Round 27 — Round-27 §A findings landed). `BUGS.md` was empty. Last
**src**-touching commit is still `1b00764e` (Round-27 fresh surface, already
audited 0 §A); the four commits since are test-only. No new src type/emission
surface this round → mature-phase round led by the parity sweep, the two seam
critics, F9-TYPEVAR, and F-RECENT.

---

## Headline counts

| Bucket | Count |
|---|---|
| **Confirmed src bugs** (→ `BUGS.md` + §9 ledger) | **1** (CD-1) |
| **Functional extension** (→ `BUGS.md`; maintainer-resolved from a candidate) | **1** (CD-2) |
| **§A** (existing cells + existing fixtures) | **~10** across 6 surfaces |
| **§B** (needs a fixture) | **0** |
| **Refuted / OUT** (kept so next round doesn't re-chase) | 5 |
| **Surfaces genuinely saturated 0/0** | **13** |

This is a mature-phase round with real value concentrated where the runbook
predicts it: a type-param-wiring defect in a variadic overload arity (caught by
the select seam critic, missed by the per-surface CONN agent), an emission
asymmetry on a composition seam, and a cluster of §A on the mutation / projection
/ error-reason seams. The one confirmed bug is the **15th** this method has
caught.

---

## CONFIRMED BUG — CD-1 (filed in `BUGS.md`, 15th ledger entry)

**`subSelectUsing` / `subSelectDistinctUsing` arity-5 overload rejects five
distinct correlated tables.** `src/connections/AbstractConnection.ts:441` &
`:451`: the fifth parameter is typed `table5: T4 & SameDB<DB>` (copy-paste from
`table4`) while the return source union references a **distinct declared** `T5`.

- **Discovery:** SEL-SEAM (select/CTE seam critic), by reading the overload's
  type-param wiring — a place the per-surface F5-CONN agent, which audits
  value-level kind/arity/adapter fan-out, does not look. (F5-CONN independently
  returned "saturated" on this same surface — the cross-agent value of the seam
  critic.)
- **Coordinator compile-repro (deleted):** the arity-4 control
  (`subSelectUsing(t1,t2,t3,t4)` with four distinct tables) compiles; the arity-5
  form with a genuinely-distinct fifth table (`tIssueWorklog`) emits
  `TS2345: Argument of type 'TIssueWorklog' is not assignable to parameter of
  type 'TAppUser & SameDB<…>'` on **both** `subSelectUsing` (line 15) and
  `subSelectDistinctUsing` (line 18). `T4` is fixed to `TAppUser` by `table4`, so
  `table5: T4` forces the fifth argument to be a `TAppUser`.
- **Manifestation:** the variadic runtime handles five distinct correlated tables
  fine; the type rejects them. A "TS rejects what the runtime accepts" divergence.
  Secondary: `T5` is never inferred → falls back to its constraint
  `ITableOrView<any> | ForUseInLeftJoin<any>`, widening the return's correlated
  source scope (masked by the primary rejection). Fix: `table5: T5 & SameDB<DB>`
  on both lines.
- **Testability:** the positive arity-5 correlated-subquery test is **blocked**
  by the bug (cannot compile until fixed) — the `// TODO[BUG]`-equivalent is the
  `BUGS.md` entry. Once fixed: a positive five-table correlated-subquery test
  (SQL + params + value) plus a `types.negative/` out-of-scope-correlation lock.

Fits the pattern of every prior ledger bug — a path that "looks like the same
implementation" as a covered one (arities 1–4 are correct, so arity-5's dropped
type parameter stayed hidden) and a **dropped type parameter in a twin's
signature** (theme 10).

---

## CD-2 — RESOLVED by maintainer as a functional extension (now filed in `BUGS.md`)

> Update: presented below as a candidate with both readings; the maintainer chose the
> "decorate every statement emitted to the DB" reading, so the plain-count hook-drop is a
> **functional extension** and is now filed in [`BUGS.md`](./BUGS.md).


**Plain-select `executeSelectPage` count query drops `customizeQuery`
`beforeQuery`/`afterQuery`; grouped/compound keep them.** `SelectQueryBuilder.ts`
`__buildSelectCount` (~:846-860).

- **Coordinator runtime-probe (deleted):** for a plain (non-distinct,
  non-grouped) select, the data query is
  `/* before */ select … /* after */` but the count query is bare
  `select count(*) from project` — hooks **dropped**. For a **grouped** select the
  count query is
  `with result_for_count as (/* before */ select … /* after */) select count(*) from result_for_count`
  — hooks **kept**. (SEL-SEAM reports the compound + distinct paths keep them too.)
- **drop≠defect oracle → genuinely ambiguous.** The plain-count path *replaces*
  the user's query with a freshly-synthesized `count(*)` (no original SELECT to
  carry the hooks); the grouped/compound path *wraps* the query as a CTE (hooks
  ride along). If `beforeQuery`/`afterQuery` mean "decorate the user's SELECT",
  the plain-count replacing it is a legitimate NOT-APPLICABLE boundary. If they
  mean "decorate every statement emitted to the DB" (e.g. a pooler routing
  comment that must ride on *both* page queries), dropping them on one is a bug —
  and the render site provably survives (the grouped path emits them). Per the
  runbook, present with both readings and let the maintainer pick; **do not assert
  bug from the drop alone.**
- **§A regardless of the verdict:** no test pins the plain-select ×
  `customizeQuery` × `executeSelectPage` count-query behavior today — a boundary
  test (or a bug fix + test) is warranted either way.

---

## §A — closeable on existing cells + existing fixtures, by risk tier

### Tier 1 — soundness-fix regression lock

- **PROJ-A1 — rule-1 short-circuit lock (both projectors).** A two-level
  container whose sole deciding member is a rule-1 inner that carries a
  *genuinely-required* leaf:
  `select({ iid: tIssue.id, wrapper: { inner: { gate: tIssue.body.asRequiredInOptionalObject(), ownReq: tIssue.number } } })`.
  The 143fe3b2 rewrite made `ContainsRequired` discard a rule-1 inner
  (`projectionRules.ts:89-90`) *before* checking for required members — a
  short-circuit that only changes behavior when the discarded inner ALSO has a
  genuinely-`required` leaf. Every existing `sole-optional-inner` test uses inners
  whose non-rIOO leaves are `optional`/`originallyRequired`, and the covered
  `rule-1-mixing-…-with-own-required-leaf` test is **one-level** (`meta` directly
  projected) — so **no current test would fail if the rule-1 short-circuit were
  reverted.** This is precisely the type-vs-runtime blind spot the Round-25
  compile-repro missed. Implement with the **boundary-row probe** the
  type-self-consistency ≠ runtime-soundness oracle mandates: `ctx.mockNext` the
  collapse row (issue 3, body NULL) and assert `'wrapper' in row === false` — the
  runtime must drop the container the type calls optional. `tIssue`; real-DB-
  validatable. (PROJ-A2, the rule-2 variant using a `const` NoTableOrView-required
  leaf inside a left-join rule-2 inner, is the same lock for the
  `AllFromSameLeftJoin` short-circuit — more contrived; secondary.)

### Tier 2 — distinct code-path / per-type emission, value-observable

- **UPDDEL-A1 / UPDDEL-A2 — `leftOuterJoin` on the UPDATE-from / DELETE-using
  limb.** `UpdateSetJoinExpression.leftOuterJoin` (update.ts:415) /
  `DeleteWhereJoinExpression.leftOuterJoin` (delete.ts:71) are non-DB-gated,
  reachable on PostgreSQL after `.from(...)` / `.using(...)`, and emit
  `left outer join` — distinct SQL from `leftJoin`'s `left join`. Round 27 landed
  `innerJoin` + `leftJoin` on these limbs but not `leftOuterJoin`; the SELECT
  suite's own `left-outer-join-emits-left-outer-join-keyword` proves the codebase
  treats it as a distinct pinnable path. Mirror the existing
  `update-from-table-then-left-join-*` / `delete-using-table-then-left-join-*`
  tests with `leftOuterJoin`. Fixtures exist.
- **MUT-A3 / MUT-A4 — value-transform adapter column through `ON CONFLICT DO
  UPDATE SET` / `… WHERE`.** No on-conflict test anywhere references a scaling
  adapter column (`tProjectReview.score` ×10, `tInvoice`, `tLedgerEntry`). The
  on-conflict SET/WHERE is a **distinct SqlBuilder path** from the UPDATE SET;
  coordinator-probed valid (`doUpdateSet({ score: 5 })` binds `50`;
  `.where(score.greaterThan(4))` binds `40`). Real-DB-validatable (the value
  round-trips through the adapter). Theme 9. `tProjectReview` (PK `id`) exists.
- **EXTRAS-A1 — `MORE_THAN_ONE_ROW` error reason.** Builder-reachable via seven
  public execute-one/none-or-one executors (`executeSelectOne`,
  `executeInsertNoneOrOne`, `executeUpdateOne`, `executeDeleteNoneOrOne`, …) that
  throw it when `rows.length > 1`; its executor-family sibling `NO_RESULT` is
  covered, this one has **zero** behavioral assertion in the ~14k-test matrix
  (appears only in the generated `simplifiedDefinition`). Mock can't drive it
  (`MockQueryRunner.executeSelectOneRow` gates to a single value) → a **real-DB /
  native-SQLite** test (runs green in the better-sqlite3/bun_sqlite/node_sqlite/
  sqlite3 cells on plain `bun run tests`, plus every `--docker` cell). The
  postgres seed has two `issue` rows with `project_id = 1`, so
  `selectFrom(tIssue).where(tIssue.projectId.equals(1)).select({…}).executeSelectOne()`
  throws it. Land in `errors.processing.test.ts` / `select.one-column-and-count.test.ts`.

### Tier 3 — declared-but-unasserted capability / distinct overload, low behavioral risk

- **MUT-A2 — `queryExecutionName` / `queryExecutionMetadata` on INSERT / UPDATE /
  DELETE `customizeQuery`.** Declared on `Insert`/`Update`/`DeleteCustomization`
  but the metadata test file (`docs.advanced.query-execution-metadata.test.ts`)
  is all `selectFrom(...)`; no mutation asserts it. Coordinator-probed: both
  fields propagate to the runner on plain/returning/on-conflict/returningLastId
  shapes, observable through the public `getQueryExecutionName` /
  `getQueryExecutionMetadata`. Existing `tProject`/`tIssue`.
- **VALVIEW-A1 — `Values.virtualColumnFromFragment` /
  `optionalVirtualColumnFromFragment` with a trailing `TypeAdapter`.** `Values.ts`
  :164-171 / :200-207 — the adapter slot flows into the `ValueSourceFromBuilder`;
  every Values virtual column in the suite omits it, while the identical arm IS
  covered on the Table twin (`activityTagged`) and View twin
  (`versionTagged`/`versionUpperTagged`). Near-degenerate (same code path proven
  on the twins) — a factory-arm completeness item, value-validatable inline in
  `with-values.kind-coverage.test.ts` (`'[…]'` via `bracketAdapter`).
- **SELECT-A1 — groupBy-before-select scalar shortcuts.** The `WithoutSelect`
  interfaces re-declare their own `selectOneColumn` / `selectCountAll` overloads
  (select.ts:312-313, 324-325, 341-342); only the `.select({…})` object form is
  exercised on the groupBy-first path (the `where`-first scalar shortcuts ARE
  covered). Niche:
  `selectFrom(tIssue).groupBy(tIssue.projectId).selectOneColumn(conn.max(tIssue.priority)).executeSelectMany()`
  → `select max(priority) as result from issue group by project_id`.
- **STR nullIfValue(string-literal) micro-gap** (F1-STR) — a distinct
  `nullIfValue(value: string)` overload (values.ts:773) whose NULLIF-with-string
  emission and `?: string` return are already proven by covered siblings
  (`valueWhenNull('…')`, `priority.nullIfValue(0)`). Bake only if completeness-
  baking the family; listed transparently, not a behavioral gap.

### Borderline §A parked in §C by its agent (reviewer may promote)

- **UPDDEL-C2 — AllowingNoWhere from/using join-limb**
  (`updateAllowingNoWhere(t).from(j).innerJoin(j2).on(...)` /
  `deleteAllowingNoWhereFrom(t).using(j).join(j2)`): a distinct interface
  (executable without a WHERE after the join), but a cross of two independently-
  proven behaviors. F4-UPDDEL parked it in §C given the surface's maturity.

---

## §B — needs a fixture

**None.** Every §A item above is closeable with the existing
`postgres/domain/connection.ts` fixtures. The domain was unchanged this round.

---

## Coordinator verification notes (what I checked, and how it resolved)

- **CD-1 — CONFIRMED** by direct src read (lines 441/451 both `table5: T4`) + a
  tsgo compile-repro (arity-4 four-table control compiles; arity-5 five-table →
  TS2345 on both methods). Filed to `BUGS.md` + §9.
- **CD-2 — CONFIRMED asymmetry** by a mock runtime-probe (plain count drops the
  hooks; grouped count keeps them in a CTE). Classified **CANDIDATE** (bug-vs-
  boundary is a maintainer semantic call), per the drop≠defect oracle. Not filed.
- **CD-3 (PARITY) — REFUTED as a bug / OUT.** `update.ts:532` sqlite one-column
  returning has a stray top-level `| NOldValuesFrom<…>` (outside `ValueSourceOf`,
  where the non-sqlite sibling at :530 has it inside; the sqlite multi-column
  sibling at :525 omits it). Src-confirmed, but **inert**: a `NOldValuesFrom`
  brand cannot inhabit a `column` argument, sqlite already forbids old-values
  one-column returning, and the branch is sqlite-only with no Principle-#1
  surface. Cosmetic src cleanup at most — **not** a bug, not a testable gap.
- **MUT-SEAM A-1 (nested-object mutation RETURNING) — REFUTED** (false-ABSENT,
  the exact §7 over-report class). MUT-SEAM's grep pattern was too narrow; a
  broader scan shows nested `meta:{…}`/`audit:{…}` returning objects ARE covered
  on plain `update.returning`, plain `delete.returning`, plain `insert.returning`,
  and update-from / update-join / delete-join / update-with-old-values. Its
  surviving §A (A-2/A-3/A-4) were verified individually and kept.
- **F9-TYPEVAR aggregateAsArray candidate — self-REFUTED by the agent** (the
  `'InnerResultObject'` path routes each element through
  `__transformProjectedObject`, which drops rule-1-null and fully-null elements
  soundly — already covered). Good application of the type-self-consistency ≠
  runtime-soundness oracle: the agent chased a soundness-flavored candidate to a
  runtime probe rather than a type check, and cleared it.
- **F3-PROJ 143fe3b2 fix — confirmed correctly in place**, typing sound for every
  boundary traced; PROJ-A1/A2 are regression-*locks*, not live defects.
- **customInt `valueWhenNull<VALUE>` / `nullIfValue<VALUE>` SOURCE-union
  asymmetry — re-confirmed OUT** (known permanent-OUT: compile-only, phantom
  SOURCE, no Principle-#1 test). F1-CUSTOMNUM closed it on sight as instructed.

---

## Surfaces genuinely saturated 0/0 this round (re-verified against current files)

**F5-CONN** (4th consecutive round), **F4-INSERT**, **F1-EQCMP** (Round-27
notBetween mixed overloads confirmed landed), **F1-NUM**, **F1-CUSTOMNUM**,
**F1-STR** (1 degenerate micro-gap), **F1-BOOLIF**, **F1-TEMP**, **F2-COL**,
**F6-DYN**, **F9-TYPEVAR**, **F-RECENT** (the 1b00764e fix's regression lock
tightly covers both the tables-arm and columns-arm), and **PARITY** (all
insert/update/delete/select twin families structurally symmetric + runtime-
covered; repaired twins — shaped on-conflict `*When`, shaped-update `*When`,
`keepOnlyWhen`, `extendShape` — all exercised).

---

## Recommended implementation order

1. **Fix CD-1** (`table5: T5 & SameDB<DB>` on `AbstractConnection.ts:441` &
   `:451`), then add the blocked positive arity-5 correlated-subquery test +
   `types.negative/` lock. (src fix is the maintainer's, per policy.)
2. **Decide CD-2** (decorate-user-query vs decorate-every-statement); land the
   plain-count customize test as a boundary test or bug-fix test accordingly.
3. **Tier-1 PROJ-A1** — the 143fe3b2 regression lock (both projectors, boundary-
   row `'wrapper' in row` assertion). Highest-value §A.
4. **Tier-2** — UPDDEL-A1/A2 (`leftOuterJoin` limbs), MUT-A3/A4 (adapter through
   on-conflict), EXTRAS-A1 (`MORE_THAN_ONE_ROW`, real-DB/native-SQLite).
5. **Tier-3** — MUT-A2 (mutation metadata), VALVIEW-A1 (Values virtual adapter),
   SELECT-A1 (groupBy-first scalar shortcuts); STR micro-gap optional.

All §A propagate across the 17-cell symmetric matrix via the shared domain.

---

## Verdict

An honest mature-phase round. Thirteen surfaces saturated; **one confirmed src
bug** (CD-1 — the 15th this method has caught, and again a dropped type parameter
in a twin's signature found by the seam critic where the per-surface agent saw
"saturated"); **one candidate** requiring a maintainer semantic call (CD-2); and
a ~10-item §A tail concentrated on the mutation / projection / error-reason /
join-limb seams — exactly where the runbook says the marginal value lives once
the per-kind matrices saturate. No bug was manufactured, no §A padded with
degenerate per-kind fills, and the one false-ABSENT headline (nested mutation
returning) and the two type-text non-bugs (CD-3, the customInt SOURCE asymmetry)
were caught in coordinator verification rather than filed.
