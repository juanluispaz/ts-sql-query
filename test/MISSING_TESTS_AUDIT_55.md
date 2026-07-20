# MISSING_TESTS_AUDIT_55 — type-driven missing-tests audit (Round 55)

**Family:** TYPE_AUDIT (missing-tests). Runbook: [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md).
**Matrix:** 17 cells / 249 files / **4083 tests per cell** (symmetric — `tests:audit` green).
**Method:** pruned roster (EXCLUDE surfaces kept excluded per the standing scoping decision — only the
re-armed SqlServer-uuid arm + the permanent agents). 6 agents, one wave. Coordinator owned every
`--docker`/tsgo probe serially. Reference cell `test/db/postgres/newest/pg/`.

## Headline

- **0 confirmed `src` defects.** BUGS.md stays empty.
- **The uuid×forced-collate CLASS is now FULLY CLOSED and real-DB-validated.** The R54 fix (`e744362e`)
  added SqlServer overrides for every remaining forced-collate site — `_collate`, the four insensitive
  comparisons, and a behavior-preserving base seam `_appendInsensitiveOrderByCollateReceiver` (SqlServer
  converts a uuid order-by column). RECENT-SRC enumerated every collate emission path and found **no
  remaining uuid → bare `collate`**; the affix-insensitive predicates are structurally safe (collate lands
  on `replace(…) + '%'`, a string). Coordinator `--docker`-confirmed: **CS-1/CS-2/CS-3 pass on real SQL
  Server**, and the one trace-only residual (affix-insensitive with a uuid VALUE operand) **round-trips on
  the engine**. → **F1-STR uuid arm folds to EXCLUDE.**
- **The R54 backlog (+11 → 4083) landed CLEAN and complete.** 0 baked-in type-vs-value contradictions;
  CS-1..4, MUT-A.1/2/3, SEL-54-1, RET-OPT-SHAPE-1, F9-54-A all correct with correct NA mirrors;
  RET-NULL-1 closed as already-covered.
- **Every permanent seam: 0 src defects, saturated.** Two candidates surfaced and were both **resolved
  clean by tsgo compile-repro:** PARITY's shaped-`values` overload ordering → **Reading B (inert, not a
  bug)** — TS binds an array to the Multiple overload even on an all-optional table; F9's
  brand-through-`recursiveUnion` → **clean §A** (the `ReleaseChannel` brand is preserved, no widening).
- **F1-TEMP Oracle-RETURNING arm is saturated** (the 2 residual RET-ORA shapes are redundant
  cross-products → close as covered).
- **§A tail: pure completeness** (all real-validatable, none a defect): CS-5 (affix-insensitive uuid
  value operand), MUT-SEAM-1 (INSERT one-column-many `undefined→null` twin), F9-A-1/A-2 (brand through
  `recursiveUnion`), plus the still-open negative-type-lock backlog (OUT of strict §A).

**Verdict up front: TOTAL COVERAGE REACHED.** 0 src defects; the re-armed uuid arm is closed and
real-DB-validated; the KEEP list empties; the remaining work is completeness fan-out, not risk surface.
From R56 the fan-out collapses to the permanent agents + whatever `src` changes next. See Part VIII.

---

## Part I — the uuid×collate fix (verified complete + real-DB-validated), the +11 backlog, the 2 candidates

The only `src` change since R54 (HEAD `4227d528`) is `e744362e` ("More work on UUID as string in SQL
Server") — the fix for R54's confirmed uuid×forced-collate bug. `SqlServerSqlBuilder.ts` (+68) +
`AbstractSqlBuilder.ts` (+11). (`85109fcf`/`b4b28efd` = the R54 backlog +11, test-only.)

### I.1 — uuid×forced-collate: FULLY CLOSED (RECENT-SRC + coordinator `--docker`)

Every SqlServer `collate` emission site was enumerated; each convert-wraps a possibly-uuid operand or
structurally lands the collate on a string:

| Collate site | uuid handling | Status |
|---|---|---|
| `_collate` (`.collate()`) | SS override → `convert(nvarchar(36), …)` before collate | ✅ (CS-1, `--docker` green) |
| insensitive `orderBy` | base seam `_appendInsensitiveOrderByCollateReceiver`, SS override converts uuid | ✅ (CS-2, `--docker` green) |
| `_equalsInsensitive`/`_notEqualsInsensitive`/`_likeInsensitive`/`_notLikeInsensitive` | value operand via `_appendValueMaybeUuidParenthesis` | ✅ (CS-3, `--docker` green) |
| `_replaceAll`/`_replaceAllInsensitive` | receiver+match via the two helpers (R53/R54) | ✅ |
| affix insensitive (`startsWith…`/`endsWith…`/`contains…`) | uuid receiver → bare `like` (no collate); uuid value → `collate` lands on `replace(…) + '%'` (string) | ✅ structurally safe (CS-5, `--docker` round-trips) |

The **base seam is behavior-preserving**: `_appendInsensitiveOrderByCollateReceiver` base returns
`wrapped` unchanged, so every non-SqlServer dialect's insensitive-order-by-collate emission is
byte-identical to before (verified: oracle `… collate BINARY_CI`, pg `… ::text collate "C"`). No new
uuid → bare `collate` reachable → the class is closed; the F1-STR uuid arm is saturated.

### I.2 — the +11 R54 backlog: clean + complete (BAKED-VERIFY)

0 baked-in contradictions. CS-1/2/3 landed GREEN with the fix (no `TODO[BUG]`); CS-4 (uuid `replaceWith`
bare), MUT-A.1/2/3 (`returningLastInsertedId` INVALID_VALUE twins — **A.2/A.3 NA on mysql2 only, mariadb
LIVE**), SEL-54-1 (plain inline-value with-hook no-op), RET-OPT-SHAPE-1 (from-select optional returning
execute-shapes), F9-54-A (rule-2 operator leaf same-left-join) all correct. RET-NULL-1 did not re-land —
already covered by `insert.on-conflict.test.ts:161`.

### I.3 — the two candidates, both resolved CLEAN by compile-repro

- **PARITY — shaped `ShapedInsertExpression.values` lists the single-row overload first** (its twins —
  non-shaped `values`, both `dynamicValues` — are array-first). Compile-repro (an all-optional-column
  table, `.shapedAs(...).values([r1,r2]).executeInsertOne()` under `@ts-expect-error`): the directive
  **fired** — TS binds the array to the Multiple overload, so `executeInsertOne` is absent. **Reading B:
  inert, NOT a bug.** (Optional low-value pin: a shaped multi-row control on an all-optional table.)
- **F9 — brand survival through `recursiveUnion*`.** Compile-repro (`recursiveUnionAll` projecting
  `tProjectRelease.channel`, `assertType<Exact<…, {channel: ReleaseChannel}>>`): **held** — the brand is
  preserved, not widened to `string`. So F9-A-1/A-2 are a **clean coverage §A**, not a latent bug.

### I.4 — re-confirmed NON-bugs / retirements

MUT-SEAM candidates all held: C1 (`ONLY_ONE_COLUMN_EXPECTED`, mock-only OUT), C2 (R54 cosmetic
`value:undefined`, non-normal path), C3 (`froms.length < 0` dead-guard — non-observable). SEL-SEAM §C
(collate-in-special-builder — degenerate/output-coincident w.r.t. select structure). Held: CAND-A,
CAND-F, `disallowIfNoValueWhen`, `extendShape` by-design.

---

## Part II — the enumerated §A backlog (completeness only; each real-validatable, coordinator-probed)

### II.1 — SqlServer uuid affix-insensitive value operand (cell `sqlserver/newest/mssql`)

- **CS-5 · T3** — the affix-insensitive predicates (`startsWithInsensitive`/`notStartsWithInsensitive`/
  `endsWithInsensitive`/`notEndsWithInsensitive`/`containsInsensitive`/`notContainsInsensitive`) with a
  uuid VALUE operand under a set `insensitiveCollation`. Structurally safe (collate lands on
  `replace(…) + '%'`) — coordinator `--docker`-confirmed it round-trips (`@0 like (replace(replace(replace(external_ref,…)) + '%') collate Latin1_General_CI_AI` → ok). Add the 6-predicate test to the shared name set (dialect snapshots: SS `replace(…) collate`, pg `::text`, oracle `raw_to_uuid`).

### II.2 — mutation seam

- **MUT-SEAM-1 · T3** — INSERT one-column-many `undefined→null` element coercion twin. UPDATE and DELETE
  each have `{update,delete}-returning-one-column-many-coerces-undefined-to-null`
  (`ctx.mockNext([undefined, 'x'])` on a nullable `returningOneColumn` → the per-element
  `value===undefined→null` coercion, `InsertQueryBuilder.executeInsertMany:315-317`); INSERT has no twin
  (its `execute-insert-many-with-returning-one-column` primes non-null ids). Fixture `tIssue.body`. Mock-only.

### II.3 — result-type/value (F9, brand through recursiveUnion — brand PROVEN preserved)

- **F9-A-1 · T2** — brand survival through `recursiveUnionAll` at the result leaf, custom `ReleaseChannel`
  (`tProjectRelease.channel`). The brand-through-structure matrix covers left-join / aggregateAsArrayOfOneColumn
  / compound / CTE / View-left-join but **not** `recursiveUnion`. Anchor-only never-match recipe (recursive
  arm `id.equals(parent.id.add(1000))`); assert `Exact<…, Array<{id:number; channel:ReleaseChannel}>>` +
  realize `channel:'stable'`. Compile-repro confirms the brand is currently preserved.
- **F9-A-2 · T3** — sibling of A-1 for the enum brand `WorklogActivity` (`tIssueWorklog.activity`); distinct
  declared value type (enum-mapped), so not covered by A-1.

---

## Part III — OUT / refuted / negative-type-lock backlog (unchanged, still open)

**Resolved candidates (recorded):** PARITY shaped-`values` (Reading B, inert); F9 brand-through-recursiveUnion
(clean §A, brand preserved); CS-5 (structurally safe, real-DB confirmed).

**Negative-type-lock backlog (R54 PARITY A–F) — still open, `types.negative/`, OUT of the strict
real-validatable §A scope (runbook §5); enumerated in `MISSING_TESTS_AUDIT_54.md` Part III.** Not started
in the +11 batch. Maintainer's call whether to bake the unpinned DB-list `= never` exclusions.

**Type-only / degenerate OUT (F9-verified):** opt×req reverse-operand-order (emission concern, not
result-type); top-level scalar `originallyRequired`/`requiredInOptionalObject` (byte-identical to covered
optional-column scalar); MergeOptional intermediate lattice cells (shared-dispatcher); brand through
`forUseAsInlineQueryValue` / customInt-newtype through left-join/CTE/compound (compile-locked +
shared-carrier); brand keep/erase on customInt/customDouble methods (saturated). SEL-SEAM
collate-in-special-builder (degenerate). MUT-SEAM `ONLY_ONE_COLUMN_EXPECTED` (mock-only).

---

## Part IV — per-surface saturation table

| Surface (this round's roster) | Result |
|---|---|
| RECENT-SRC (re-armed uuid) | **uuid×collate CLASS closed + real-DB-validated**; 1 §A (CS-5); folds to EXCLUDE |
| BAKED-VERIFY (+11 backlog) | 0 contradictions; clean + complete; F1-TEMP Oracle saturated |
| PARITY (permanent) | 0 defects; shaped-`values` candidate → Reading B (inert) |
| SEL-SEAM (permanent) | 0 defects; saturated (1 §C) |
| MUT-SEAM (permanent) | 0 defects; MUT-A landed; 1 §A (MUT-SEAM-1) |
| F9-TYPEVAR (permanent) | 0 defects; F9-54-A landed; brand-through-recursiveUnion §A (A-1/A-2, brand proven preserved) |

---

## Part IV-b — EXCLUDE / KEEP / permanent roster (updated for R56) — KEEP now EMPTY

`e744362e` touched only `SqlServerSqlBuilder` + a behavior-preserving `AbstractSqlBuilder` seam (no
non-SqlServer emission change) — no EXCLUDE trigger. With the uuid×collate class closed and real-DB-validated:

**MOVE TO EXCLUDE for R56:** **F1-STR uuid arm** (the uuid×collate class is closed; CS-1..3 real-DB green;
re-arm only if `SqlServerSqlBuilder` uuid handling changes again) and **F1-TEMP Oracle-RETURNING arm**
(saturated; residual RET-ORA shapes redundant).

**EXCLUDE (unchanged):** F5-CONN, F1-BOOLIF, F1-EQCMP, F2-COLVAL, F6-DYN, F3-SELECT, F1-CUSTOMNUM base,
F-COLL/F-CONFIG, F-AGG, F-PROJ-NEW, F1-TEMP (plain), TEMP+STR non-uuid.

**KEEP: (empty).** No surface has an open src-driven residual.

**PERMANENT (never excluded, run every round):** PARITY, SEL-SEAM, MUT-SEAM, F9-TYPEVAR, recently-changed-src.

**→ From R56 the fan-out collapses to the permanent agents + whatever `src` changed since — the runbook's
definition of total coverage reached.**

---

## Part V — coordinator verification (the probes, with exact results)

All probes deleted; tree clean (only pre-existing `M .gitignore` + `M TYPE_AUDIT_RUNBOOK.md`; BUGS.md unchanged).
1. **PARITY shaped-`values` (tsgo compile-repro)** — all-optional table, `.shapedAs(...).values([r1,r2]).executeInsertOne()` under `@ts-expect-error`; `validate:tests` EXIT=0 → the directive fired → array→Multiple → **inert, not a bug**.
2. **F9 brand-through-recursiveUnion (tsgo compile-repro)** — `assertType<Exact<…, {channel: ReleaseChannel}>>` held → **brand preserved (clean §A)**.
3. **CS-1..3 (`--docker sqlserver/newest/mssql`)** — all "converts before collate" tests **pass on real SQL Server** (85 passed; the fix works on the engine).
4. **CS-5 (`--docker` probe)** — `@0 like (replace(replace(replace(external_ref,…)) + '%') collate Latin1_General_CI_AI` → **ok** (`v:false`, no error). Structurally safe confirmed.
5. Baked-in scan / saturation / reachability — grep + direct reads (no index rebuild during fan-out).

---

## Part VI — §B fixture additions

**None.** Every §A closes on existing cells + existing `domain/connection.ts`.

---

## Part VII — recommended implementation order

1. **T2/T3 completeness** — F9-A-1/A-2 (brand through recursiveUnion, brand proven preserved); CS-5
   (affix-insensitive uuid value, real-DB confirmed); MUT-SEAM-1 (INSERT `undefined→null` twin).
2. **Optional** — the shaped multi-row control (PARITY, low value; Reading B); the 2 redundant RET-ORA
   belt-and-suspenders shapes (F1-TEMP, redundant).
3. **Negative-type-lock backlog (R54 A–F)** — `types.negative/` completeness, maintainer's call (OUT of strict §A).

No `src` fix — 0 defects this round.

---

## Part VIII — verdict (honest): TOTAL COVERAGE REACHED

**R55 is the target-reached round the effort has been converging toward.** 0 confirmed `src` defects; the
re-armed SqlServer-uuid arm — the one surface that surfaced real bugs in R53 and R54 — is now **fully
closed and real-DB-validated** (every forced-collate site convert-wrapped, CS-1..3 green on real SQL
Server, the affix residual round-trips), and it **folds to EXCLUDE**. Both permanent-seam candidates
resolved clean by compile-repro (probe > trace once more: the shaped-`values` "ordering bug" is inert, and
the brand-through-recursiveUnion is preserved, not widened). The +11 R54 backlog landed clean and complete;
F1-TEMP Oracle is saturated.

**The KEEP list is now empty.** Every remaining item is completeness fan-out (three real-validatable §A
tests whose behavior is already proven correct — brand-through-recursiveUnion, the affix-uuid value operand,
the INSERT `undefined→null` twin) plus a negative-type-lock backlog that is OUT of the strict scope. None
is new risk surface. **From R56 the fan-out reduces to the permanent agents (PARITY, SEL-SEAM, MUT-SEAM,
F9-TYPEVAR) + the recently-changed-src agent** — a round runs only to (a) re-verify any new `src` and (b)
let the four seams corroborate that no marginal defect crept in. The type-driven missing-tests audit has
driven the typed surface to saturation; further rounds are maintenance, triggered by `src` change, not
discovery of a standing gap.
