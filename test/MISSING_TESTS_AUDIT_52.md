# MISSING_TESTS_AUDIT_52 — type-driven missing-tests audit (Round 52)

**Mandate.** Maximal-saturation, maximal-rigor, type-driven missing-tests audit of ts-sql-query
(MariaDB/MySQL/Oracle/PostgreSQL/SQLite/SQL Server). Standing dial per
[`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md); this round the user set an explicit
**"maximize workload — do NOT reduce agent findings, enumerate every reachable variant, or
confirm we've reached max coverage"** directive. So every distinct real-validatable path is an
item, T4 tails are named one line each, and nothing was collapsed to §C to look tidy.

**Answer to the standing question up front: we have NOT reached maximum coverage.** The post-R51
type-surface (the `9a7910c7` projector rewrite, aggregate clause-checking, the collation forks,
minValue/maxValue NULL-propagation, the config knobs, the precision/date-JS re-bakes) opened a
large, coherent backlog — **two Tier-1 cross-confirmed clusters plus a long Tier-2/3/4 tail** —
even though most of the new features shipped *with* their own positive tests. The value-source
leaf matrices (EQCMP, BOOLIF, CUSTOMNUM, COLVAL, DYN, CONN) are at true saturation.

**Pre-flight.** N=52. `tests:audit` → **17 cells · 249 files · 3995 tests/cell · 67915 tests ·
symmetric · 0 problems**. BUGS.md empty. LIMITATIONS.md has 20+ entries. src delta since R51:
14 commits, headed by `9a7910c7` (projector rewrite + `exactOptionalPropertyTypes`).

**Operational note — OOM mid-round.** The machine OOM'd partway through the fan-out (an index
rebuild concurrent with the agent pool); the host restarted. **The 9 reports that had landed
were preserved; the remaining 10 surfaces were relaunched post-restart without an index rebuild
and all completed.** No findings were lost. Tree clean throughout.

**Fan-out.** 20 discovery agents (2 waves), plus coordinator verification of every load-bearing
claim below (compile-repro + mock-emission bake). All probes deleted; final tree clean.

---

## PART I — Verified headline findings, candidates, and doc-hygiene

**0 `src/` defects.** Every agent independently found the four big post-R51 changes landed
**correctly**: the projector rewrite is a *type-only* change with byte-identical SQL (SEL-SEAM),
aggregate clause-checking is complete and symmetric (F-AGG, PARITY, F1-BOOLIF), minValue/maxValue
NULL-propagation is emission-only and symmetric (PARITY), collation flows through self-parenthesising
value-source `__toSql` (MUT-SEAM). BUGS.md stays empty.

### I.1 — TIER-1 CLUSTER A (compile-repro CONFIRMED): DML-RETURNING optional-leaf-inside-optional-object `k?: T` is untested on insert/update/delete

The `9a7910c7` rewrite made `TransformOptionalProperties` distribute per-branch, so an **optional
leaf inside an optional nested container** now types as an **optional key** `k?: T`. SELECT asserts
this shape densely; the **insert/update/delete RETURNING** paths — which pass the result through a
*distinct* homomorphic remap `{ [P in keyof RESULT]: RESULT[P] }` — assert only (a) required inner
leaves, (b) object-level gates, or (c) the `projectingOptionalValuesAsNullable` twin. The
**default-projector `meta?: { leaf?: T }`** shape is asserted on **no** DML returning path.

**Coordinator compile-repro (CONFIRMED):**
`update(tProject).set({name:'x'}).where(tProject.id.equals(1)).returning({ id: tProject.id, meta: { archivedAt: tProject.archivedAt } }).executeUpdateOne()`
infers **exactly** `{ id: number; meta?: { archivedAt?: Date } }`. The type is correct (matches the
fix); it is simply unlocked on DML returning.

**5-agent converged** (PARITY §A-1/2/3, F4-INSERT INS-1, F4-UPDDEL F-1, MUT-SEAM §A-1, F-PROJ-NEW
select-side note). Enumerated as items **RET-1…RET-6** in Part II.

### I.2 — TIER-1 CLUSTER B (mock-emission baked CONFIRMED): minValue/maxValue both-optional poison CASE + no custom-leaf poison form is tested

`AbstractSqlBuilder._minAndMaxValueBetweenTwoValuesPoisoningNull` (PG + SqlServer) emits four
optionality-keyed shapes. The **both-optional** branch
`case when a is null or b is null then null else greatest/least(a,b) end` is produced by **zero
tests matrix-wide**; and **no custom leaf** (Money/ReleaseTag/Cents) ever reaches *any* poison-CASE
form (all 8 custom min/max call sites use required×required → bare `greatest`).

**Coordinator mock-bake (CONFIRMED):** `tIssue.assigneeId.minValue(tIssue.parentId)` (both optional
int) emits
`case when assignee_id is null or parent_id is null then null else greatest(assignee_id, parent_id) end`,
result `mn?: number` with the poison NULL realized (row dropped when either operand null). Grep
`is null or .* is null then null else greatest|least` = 0 across all test/db.

**6-agent converged** (F9-TYPEVAR F1, F1-NUM GAP-M1, PARITY, F1-CUSTOMNUM A1/A2, MUT-SEAM §A-5/6,
F4-UPDDEL F-2). Enumerated as **MM-1…MM-9** in Part II.

### I.3 — Doc-hygiene: `LIMITATIONS.md:111` "Aggregate functions are not flagged as aggregates in the type system" is STALE

The aggregate clause-checking (`NAggregate` source brand + `NSourceAllowingAggregate`) shipped, and
its point-1 ("the type system does NOT prevent `count()` in `where()`") is now **false**.
**Coordinator compile-repro:** `conn.sum(tIssue.priority).add(1).greaterThan(1)` in `where()` is a
**TYPE ERROR** — the `NAggregate` brand **survives `.add()`**, so even an aggregate-arithmetic
expression is rejected in where/groupBy/on. There is **no brand-drop residual**. The section should
be **removed or narrowed** to "the library does not auto-rewrite a WHERE predicate into HAVING; a
misplaced aggregate is now a compile error." (The published `docs/about/limitations.md` does not
carry the claim — only `test/LIMITATIONS.md`.) Not a bug, not a test — a maintainer doc cleanup.

### I.4 — Candidate (leans BOUNDARY, both readings): `beforeWithQuery`/`afterWithQuery` on a directly-executed plain/compound select silently no-op (SEL-SEAM C-1)

`customizeQuery({ beforeWithQuery })` is type-accepted on a plain/compound select, but `_buildWith`
emits those hooks only from a WITH-view's own customization — a directly-executed query is not a CTE
body, so they never render. Reading 1 (defect): a typed hook silently dropped. Reading 2 (boundary,
the plain test's own comment defines these as CTE-body-only): the no-op is the correct NOT-APPLICABLE
boundary → a **passing boundary test**, not a `BUGS.md` entry. Untested in both directions.
**Recommend: a passing boundary pin (§A items SEL-2/SEL-3), not a bug** — but the coordinator flags
it for the maintainer to confirm the render site truly doesn't survive.

### I.5 — Re-confirmed known non-bugs (present, NOT re-filed) + resolutions

- **CAND-A** — `update.ts:532` sqlite stray `| NOldValuesFrom` outside `ValueSourceOf` (vestigial). Present.
- **CAND-F** — `values.ts:253` `isIfValue` safe over-widen. Present (F6-DYN, F1-BOOLIF).
- **DEL-1** (R51) — LANDED on both delete AND update sides (`{delete,update}.returning.execute-shapes.test.ts`).
- **R50 fix** (multi-row bare doNothing drops executeInsertOne) — verified SOUND post-rewrite.
- **`ScoreCount`** — F2-COLVAL flagged it a "dead `baseTypeForCustom` entry"; **F5-CONN's grep (40 occurrences) resolves it USED** as a `const(7,'customInt','ScoreCount')` typeName. Not dead.
- **Doc-hygiene 2:** `select.value-source.custom-numeric.test.ts` header (~:9-11) still claims Meters/Score/Ratio "NOT marshalled → leak strings" — stale since they were added to `baseTypeForCustom` (F1-CUSTOMNUM). Minor comment fix.
- **Hallucinated API caught:** `forUpdate`/`lock`/`forShare`/`skipLocked` do NOT exist in the SELECT builder (F3-SELECT) — not tested, not a gap.

---

## PART II — §A backlog, per surface (every item; coordinator-verified or emission-flagged)

Verification key: **[C]** compile-repro confirmed · **[E]** mock-emission baked · **[H]** emission
HYPOTHESIS (bake at implementation; --docker where noted) · **[G]** grep-proven absent.

### Surface: DML RETURNING projector shape (Cluster A — Tier-1) [C][G]
- **RET-1 · T1** — `insert(tProject).values({...}).returning({ id, meta:{ archivedAt } }).executeInsertOne()`, default projector → `{ id:number; meta?:{ archivedAt?:Date } }`; boundary rows: archivedAt-present → `'meta' in row && 'archivedAt' in row.meta`; all-null → `'meta' in row === false`. Home `insert.returning.test.ts`. (F4-INSERT INS-1)
- **RET-2 · T1** — same on `update(tProject).set(...).returning({...}).executeUpdateOne()`. Home `update.returning.test.ts`. (F4-UPDDEL F-1, PARITY §A-2)
- **RET-3 · T1** — same on `deleteFrom(tProject).where(...).returning({...}).executeDeleteOne()`. Home `delete.returning.test.ts`. (PARITY §A-3)
- **RET-4 · T4** — RET-1 on the on-conflict-optional path (`onConflictDoNothing().returning({...})` → `{...}|null` with `meta?:{ archivedAt?:Date }`). (F4-INSERT INS-2)
- **RET-5 · T3** — the projector deep rungs: rule-1 optional container at L4 and L5 (`ResultObjectValues4/5` reqInOptObj branch), default projector, in a SELECT. (F-PROJ-NEW A1/A2)
- **RET-6 · T3** — rule-2 (same-left-join) optional container at L4 and L5 (`ResultObjectValues4/5` sameLeftJoin branch), default projector, in a SELECT + left-join-miss boundary. (F-PROJ-NEW A3/A4)
- **RET-7 · T4** — as-nullable twins of RET-5/RET-6 (L4/L5 reqInOptObj + sameLeftJoin under `projectingOptionalValuesAsNullable`). (F-PROJ-NEW A5–A8)
- **RET-8 · T3** — dynamicPick default-projector top-level null-drop probe (`dynamicPick(...,{body:true},['id'])` no nullable → `body?:string`, `'body' in row === false`). (F6-DYN DYN-1)

### Surface: minValue/maxValue NULL poison (Cluster B — Tier-1) [E][G]
- **MM-1 · T1** — both-optional int: `assigneeId.minValue(parentId)` + `.maxValue(...)` → the both-optional CASE, `mn?:number`, poison NULL realized. PG+SqlServer. (F1-NUM/F9/F1-CUSTOMNUM)
- **MM-2 · T1** — both-optional bigint: `durationMs.minValue(<optional bigint>)`.
- **MM-3 · T1** — both-optional double: `estimatedHours.minValue(assigneeId.asDouble())`.
- **MM-4 · T1** — custom Form-1 (receiver-optional, customDouble): `tReleaseDraft.budget.minValue(100)` → `case when budget is null then null else greatest(budget,$1) end`, `?:number`. (F1-CUSTOMNUM A2a)
- **MM-5 · T1** — custom Form-2 (operand-optional, customInt brand-keep): `vReleaseOverview.releaseOrdinal.minValue(<optional ReleaseTag>)`, `?:ReleaseTag`. (A2b)
- **MM-6 · T1** — custom Form-3 (both-optional, customInt): `optionalReleaseOrdinal.minValue(optionalReleaseOrdinal)` → both-optional CASE, `?:ReleaseTag` (closes A1∩A2). (A2c — strongest single item)
- **MM-7 · T3** — operand-optional same-leaf (Form-2) for int/bigint/double (`priority.minValue(assigneeId)`). (F1-NUM GAP-M2)
- **MM-8 · T2** — min/max poison CASE inside an UPDATE SET (`update(tIssue).set({ priority: priority.maxValue(<optional>) })`) [H — bake]. (MUT-SEAM §A-5, F4-UPDDEL F-2)
- **MM-9 · T2** — min/max poison CASE inside UPDATE…FROM SET (aliased context, both operands qualified) [H — bake]. (MUT-SEAM §A-6)
- **MM-10 · T2** — branded value-source clamp (Form-1/2 with a same-brand value-source operand keeping the brand: `releaseOrdinal.minValue(releaseOrdinal)` → `ReleaseTag`). (F1-CUSTOMNUM A3)
- **MM-11 · T3** — per-kind poison-NULL *value* realized only for int today (double/bigint/customInt/customDouble receiver Form-1 value). (F9-TYPEVAR F3)

### Surface: collation forks (Tier-1/2) [E for A1/A3/A4][H for rest][G]
- **COL-1 · T1** — `.collate()` on the **RHS** operand of a comparison: `email.equals(fullName.collate('C'))` → `email = (full_name collate "C")`. **[E confirmed]** (F-COLL A1)
- **COL-2 · T2** — `.collate()` under each comparison operator ≠ equals (notEquals/lessThan/greaterThan/lessOrEqual/greaterOrEqual/like/notLike/in/notIn/between/is/isNot) — one item per operator × dialect. (F-COLL A2)
- **COL-3 · T1** — `.collate()` as a **groupBy** column → `group by full_name collate "C"`. **[E confirmed]** (F-COLL A3)
- **COL-4 · T1** — `.collate()` as an **orderBy** column (explicit method) → `order by app_user.full_name collate "C"`. **[E confirmed]** (F-COLL A4)
- **COL-5 · T1** — `.collate()` as a **replaceAll argument** → `replace(email, full_name collate "C", $1)` [H]. (F-COLL A5)
- **COL-6 · T1** — `.collate()` on an **optional receiver** → `v?: string`, null-row absent. (F-COLL A6)
- **COL-7 · T1** — `replaceAllInsensitive(<value-source find>, const)` — the SQL-level regex-escape else-branch (PG/MySQL/MariaDB nested `replace`) [H --docker]. (F-COLL A7)
- **COL-8 · T1** — `replaceAllInsensitive(const, <value-source replace>)` — replacement-escape else-branch [H --docker]. (F-COLL A8)
- **COL-9 · T2** — `replaceAllInsensitive(<VS>, <VS>)` (both else-branches + optionality-merge). (F-COLL A9)
- **COL-10 · T2** — `replaceAllInsensitiveIfValue(str,VS)` / `(VS,str)` present-value arms. (F-COLL A10)
- **COL-11 · T2** — SQLite `.collate()` does NOT reach `LIKE` (documented boundary): emit carries `(? collate NOCASE) like ?`, native-sqlite value proves LIKE stayed sensitive [H native-sqlite]. (F-COLL A11)
- **COL-12 · T2** — `.collate()`/`replaceAllInsensitive` in a mutation SET value / update-delete WHERE [H]. (MUT-SEAM §A-2/3/4, F4-UPDDEL F-3)

### Surface: connection config knobs (Tier-2) [H — bake][G]
- **CFG-1 · T2** — Oracle `replaceInsensitiveCollation = ''` opt-out → bare `replace(...)`. (F-CONFIG A1, F-COLL A12)
- **CFG-2 · T2** — Oracle `insensitiveCollation = ''` × `replaceAllInsensitive` op → bare replace (distinct guard arm from CFG-1). (F-CONFIG A2, F-COLL A13)
- **CFG-3 · T2** — SQLite `replaceAllInsensitiveFunction = '<fn>'` ON arm → `fn(?,?,?)` (never set anywhere in the matrix; emission-only mock-safe, value needs UDF registration in the 3 UDF-capable connectors). (F-CONFIG A3)
- **CFG-4 · T3** — Oracle `replaceInsensitiveCollation = '<alternate>'` direct-set (same branch, different collation string). (F-CONFIG A4)

### Surface: temporal getters (Tier-2) [H --docker][G]
- **TMP-1 · T2** — `microStamp.getTime()` (the sole *rounding* getter) on the µs `tTemporalPrecision.microStamp` column → `round(extract(epoch from micro_stamp)*1000)`; 999600µs rolls up (…60000 vs the truncating siblings' …59999). The subsecond test covers only getSeconds+getMilliseconds. [H --docker: confirm round-up vs JS-truncation value]. (F1-TEMP F1)
- **TMP-2 · T2** — getters on `shiftHourAdapter` temporal columns (adapter-drop): `shiftedStamp.getHours()` extracts a fresh unbranded NUMBER leaf → returns the **raw** 10, not adapter-shifted 11. Sub-items: TMP-2a `shiftedStamp`×9 getters, TMP-2b `shiftedReleaseDay`×4, TMP-2c `shiftedCutoff`×4 [H --docker]. (F1-TEMP F2)

### Surface: string ops (Tier-2) [H --docker][G]
- **STR-1 · T2** — Oracle affix predicates poison-CASE with a NULL value-source term: only `startsWith` is covered; `endsWith`/`contains`/the three `*Insensitive`/the `not*` family each emit a distinct affix wrapped in its own poison CASE — all untested. (F1-STR gap 1)
- **STR-2 · T2** — SqlServer string methods on `uuid.asString()` beyond the covered trim/concat/substring/stringConcat: `.length()`/`.toUpperCase()`/`.toLowerCase()`/`.reverse()`/`.replaceAll()`/`.substr*()`/sensitive-affixes do NOT route through `_appendSqlMaybeUuid` (SqlServerSqlBuilder:973/1165 only wrap trim+string_agg) → emit the **bare uuid** → [H --docker: does SqlServer implicit-convert `uniqueidentifier` in `len`/`upper`, or is a convert missing?]. (F1-STR gap 2 — coordinator-resolved reachability)

### Surface: aggregate-expression positions (Tier-2/3) [H][G]
- **AGG-1 · T2** — an expression built from an aggregate as a SELECT column: `select({ x: conn.sum(tIssue.priority).add(1) })` → `sum(priority)+$1`, `x?:number`. (F-AGG A1)
- **AGG-2 · T3** — aggregate-expression in HAVING: `having(conn.count(tIssue.id).multiply(2).greaterThan(6))`. (F-AGG A2)
- **AGG-3 · T3** — aggregate-expression in ORDER BY: `orderBy(conn.sum(tIssue.priority).add(1))` → `order by sum(issue.priority)+$1`. (F-AGG A3, F3-SELECT A17)
- **AGG-4 · T3** — HAVING predicate over sum/average/min/stringConcat (only count/max covered in a HAVING today). (F-AGG A4)

### Surface: EQCMP / SELECT-seam residue (Tier-3) [G]
- **EQ-1 · T3** — enum `valueWhenNull(<value-source operand>)` (only const covered; the value-source overload untested — the lone Nullable-family hole, `activity.valueWhenNull(activityCustomKind)`). (F1-EQCMP A1)
- **EQ-2 · T3** — enum `nullIfValue(<value-source operand>)` (twin of EQ-1). (F1-EQCMP A2)
- **SEL-1 · T2** — recursive `executeSelectPage()` whose recursive-result `customizeQuery({ beforeOrderByItems, afterOrderByItems })` — assert the **count** strips the hooks (load-bearing: `_buildSelectOrderBy` re-emits order-by from hooks even when `__orderBy` is deleted). (SEL-SEAM A-1)
- **SEL-2 · T3** — boundary pin: `beforeWithQuery`/`afterWithQuery` on a directly-executed **plain** select is a no-op (I.4 plain arm). (SEL-SEAM A-2)
- **SEL-3 · T3** — same boundary pin on a directly-executed **compound**. (SEL-SEAM A-3)
- **DYN-2 · T4** — nullable `expandTypeProjectedAsNullableFromDynamicPickPaths` page/one overloads (only the array overload is covered; passthrough → `.toBe` + assertType). (F6-DYN DYN-2)

### Surface: Oracle concat poison in mutations (Tier-3) [H][G]
- **OCC-1 · T3** — Oracle concat NULL poison-CASE in a mutation SET with an optional operand: `update(tIssue).set({ title: title.concat(body) })` → `case when body is null then null else title||body end` (every Oracle mutation concat today uses a required operand). (MUT-SEAM §A-7, F4-UPDDEL F-4)
- **OCC-2 · T3** — Oracle concat poison over an `oldValues()` column in RETURNING. (MUT-SEAM §A-8)

---

## PART III — §B (needs a fixture) + OUT / negative-type guards

**§B (needs a fixture addition):**
- **PK-tail** — `primaryKey`/`autogeneratedPrimaryKey`/`autogeneratedPrimaryKeyBySequence` are the only non-virtual factories lacking a full 18-kind col-matrix table; ~63 **output-coincident T4** per-kind items (byte-identical to `tColMatrixColumn` reads, differ only by the write-side marker). Realistic subset if strict symmetry wanted: `tColMatrixPkAdapter` (the one missing `tColMatrix*Adapter`) comparable-completion (×string/uuid/bigint) + `autogeneratedPrimaryKey` ×uuid. Otherwise close. (F2-COLVAL PK-1/PK-2/AG-1/AG-2)
- **CFG-3 value arm** — a SQLite UDF (`ci_replace`) registered in the 3 UDF-capable connector setups (else CFG-3 stays emission-only mock).
- **COL-B** — PostgreSQL non-deterministic collation object for per-value case-insensitive equality (intentional NOT-APPLICABLE today; the canonical positive lives in sqlserver). Low priority. (F-COLL B2)

**OUT / negative-type guards (not §A per §5, but valid — enumerate for the negative-type file):**
- **exactOptional negative guard** — no `@ts-expect-error` locks `row.optKey = undefined` (the `9a7910c7` headline feature has no negative lock). Highest-value guard found. (F-PROJ-NEW)
- **N1–N7** — aggregate-in-`where`-via-`.and()`/`.or()`; in join `on().and()`; expr-built-from-aggregate in where (the N3 counterpart of AGG-1, now compile-confirmed rejected); `countAll()` in where; `aggregateAsArray({})` object-form in groupBy; `buildAggregateFragment*` in where; the cross-product per-aggregate enumeration. (F-AGG)
- **TEMP-A-1** — `getTime()` absence on custom-branded twins (`releasedOn.getTime()`) — marginal negative lock. (F1-TEMP R51-carryover)
- **SEL-A-1** — compound `customizeQuery` narrower-type lock (SELECT-only hooks rejected on a compound). (SEL-SEAM/R51)
- Standing OUT: L-1 custom-temporal const/arg bare-extract; sequence non-numeric kinds; `double.modulo` float%; int fractional-const untyped; bigint/customInt extended-math typed-never; `forUpdate`/lock (non-existent API); non-round-trippable date const echoes; queryRunners-layer reasons.

---

## PART IV — Per-surface saturation table

| Surface | §A | Verdict |
|---|---|---|
| DML-returning projector shape | **8 (RET-1…8)** | Tier-1, compile-confirmed, 5-agent converged |
| minValue/maxValue NULL poison | **11 (MM-1…11)** | Tier-1, emission-baked, 6-agent converged |
| Collation forks | **12 (COL-1…12)** | Tier-1/2, positions baked, rest --docker |
| Config knobs | **4 (CFG-1…4)** | Tier-2, opt-out arms unset matrix-wide |
| Temporal getters | **2 (TMP-1/2, ~18 instances)** | Tier-2, --docker (round/adapter-drop values) |
| String ops | **2 (STR-1/2)** | Tier-2, Oracle affix + SS uuid, --docker |
| Aggregate-expression positions | **4 (AGG-1…4)** | Tier-2/3 |
| EQCMP / SEL-seam / DYN residue | **7 (EQ,SEL,DYN)** | Tier-2/3 |
| Oracle concat in mutations | **2 (OCC-1/2)** | Tier-3 |
| F5-CONN | 0 | SATURATED |
| F1-BOOLIF | 0 | SATURATED |
| F1-EQCMP (base grid) | 0 (2 residue above) | near-saturated |
| F2-COLVAL (read/write) | 0 (§B PK-tail) | SATURATED |
| F6-DYN (base) | 0 (2 twins above) | SATURATED |
| F3-SELECT | 0 (1 in AGG-3) | SATURATED (seeds shipped w/ tests) |
| SEL-SEAM / MUT-SEAM emission | 0 defects | seams clean; gaps are coverage-only |

**~52 enumerated §A items** (2 Tier-1 clusters of 19 + a Tier-2/3 tail of ~33) + ~63 output-coincident
§B PK-tail + the negative-type guard set. **0 confirmed defects.** This is the LONG report the
maximal dial asks for — the surface is NOT saturated.

---

## PART IV-b — Surfaces that contributed NOTHING this round → EXCLUDE from future fan-outs (until their `src` changes)

Per the user's scoping decision: the surfaces below are at **true saturation** — they produced
**no unique actionable §A** this round (residue, if any, is Tier-3/4 output-coincident or folds into a
cluster tracked elsewhere). Future rounds may **skip these agents** and spend the fan-out only on the
contributing surfaces, until total coverage is reached.

**Two hard caveats (do not drop these — they are what keeps the exclusion safe):**
1. **Re-include a surface the moment its `src` changes.** A surface is saturated only against the
   `src` it was audited against. The `§0.5` pre-flight `git log --oneline` must gate each excluded
   surface on its owning `src` path (listed below); a commit touching that path re-arms the surface as
   the round's highest-value target (the "just-changed type surface" rule).
2. **The SEAM critics and parity are NEVER excluded.** `PARITY`, `SEL-SEAM`, `MUT-SEAM`, `F9-TYPEVAR`,
   and the "recently-changed src" agent stay in **every** round even when they return 0 defects — in the
   mature phase the marginal bug lives at the seams and the freshly-changed src, and those are the top
   targets by design. They returned 0 *defects* this round but each still corroborated a cluster (PARITY
   → RET, F9-TYPEVAR/MUT-SEAM → MM), which is exactly their job.

### EXCLUDE list (saturated per-surface enumerators)

| Agent | Why excludable now | `src` trigger that re-arms it (watch in pre-flight `git log`) |
|---|---|---|
| **F5-CONN** | 0 §A, 0 §B. const/optionalConst/fragmentWithType/aggregateFragmentWithType/buildFragment*/arg/valueArg/sequence/executeFunction/executeProcedure/createTableOrViewCustomization/aggregates/transaction all covered × kind × arity × {adapter,no-adapter}; all 3 R52 seeds landed. | `src/connections/AbstractConnection.ts`, `AbstractAdvancedConnection.ts`, per-db `*Connection.ts` (new method/overload/config field) |
| **F1-BOOLIF** | 0 §A. Boolean/IfValue/AlwaysIf/`*IfValue` + all 4 custom-boolean adapters + `_and`/`_or` paren branches + aggregate-boolean-in-having-vs-where all covered. | `values.ts` boolean/if-value interfaces; `AbstractSqlBuilder` `_negate`/`_and`/`_or`/custom-boolean remap |
| **F1-EQCMP** | Base cross-product (18 leaves × Equalable/Comparable/Nullable × const/value-source/subquery/mixed) saturated. Only residue = **EQ-1/EQ-2** (enum `valueWhenNull`/`nullIfValue` value-source operand, Tier-3) — implement once, then fully done. | `values.ts` base method interfaces or a new leaf interface |
| **F2-COLVAL** | 0 §A. Read+write path of all 12 factories × 18 kinds × optionality × {adapter,no-adapter} + Values/View dispatch covered. Only §B = the output-coincident PK per-kind tail (lowest-value in the matrix). | `src/Table.ts`, `src/View.ts`, `src/Values.ts` (new factory or per-kind dispatch) |
| **F6-DYN** | Base dynamic surface (operator×type×{descriptor,inline}×{base,IfValue}, pick/pickPaths/expandType, from-model, order-by-from-model, extension, errors) saturated. Residue = **DYN-1** (folds into the RET cluster) + **DYN-2** (T4 passthrough twin). | `src/dynamic/*`, `src/expressions/dynamicConditionUsingFilters.ts`, `DynamicConditionBuilder.ts` |
| **F3-SELECT** | 0 genuine §A — the 3 R52 seeds (unused-CTE-drop, count-omit-orderBy, aggregate-clause-check) all **shipped with their tests**. Only **A17** remains, and it folds into **AGG-3**. `forUpdate`/lock confirmed non-existent. | `src/expressions/select.ts`, `SelectQueryBuilder.ts` |
| **F1-CUSTOMNUM (base)** | Brand keep/erase algebra fully covered (abs/ceil/…/sign-erase, per-leaf). *But its min/max custom-leaf poison forms DID contribute* → those live in Cluster B (**MM-4/5/6**), not here. Exclude the base; the MM items stay in scope until implemented. | `values.ts` CustomInt/CustomDouble interfaces |

### KEEP-IN-SCOPE list (contributing surfaces — the R53 focus)

Until their backlog is implemented and re-verified: the **two Tier-1 clusters** (DML-returning projector
shape RET-1…8; minmax NULL poison MM-1…11), **F-COLL** (collation positions + `replaceAllInsensitive`
value-source overloads — the biggest active tail), **F-CONFIG** (config opt-out arms), **F1-TEMP**
(getTime-µs + adapter-drop getters), **F1-STR** (Oracle affix-NULL + SqlServer uuid-string), **F-AGG**
(aggregate-expression positions + the LIMITATIONS:111 cleanup), **F-PROJ-NEW** (projector deep rungs) —
plus the **permanent** seam/parity agents (PARITY, SEL-SEAM, MUT-SEAM, F9-TYPEVAR) and the
recently-changed-src agent. When the KEEP list is implemented and a round re-verifies it saturated with
no new src, the fan-out has reached total coverage and collapses to just the permanent seam agents +
whatever src changed.

---

## PART V — Coordinator verification (what was probed, how it resolved)

- **RET (Cluster A)** — compile-repro: `update(tProject)...returning({id, meta:{archivedAt}}).executeUpdateOne()` infers `{ id:number; meta?:{ archivedAt?:Date } }` **[confirmed]**. Type correct, untested on DML.
- **MM (Cluster B)** — mock-bake: `assigneeId.minValue(parentId)` emits `case when assignee_id is null or parent_id is null then null else greatest(assignee_id, parent_id) end` **[confirmed]**; poison NULL realized (row dropped).
- **Collation** — mock-bake: COL-1 `email = (full_name collate "C")`, COL-3 `group by full_name collate "C"`, COL-4 `order by app_user.full_name collate "C"` **[all confirmed]**. COL-2/5/7/8/11/12 flagged --docker (per-dialect collate placement/escape are exactly the premises this surface has had corrected before).
- **LIMITATIONS:111** — compile-repro: `sum(x).add(1).greaterThan(1)` in `where` is a type error → brand survives arithmetic → section is stale **[confirmed]**.
- **F1-STR uuid** — src read: `_appendSqlMaybeUuid` (SqlServerSqlBuilder:111) wraps only trim/ltrim/rtrim (973) + string_agg (1165); other string methods emit bare uuid → STR-2 reachability confirmed, value behavior --docker.
- **DEL-1 / R50 fix / CAND-A / CAND-F / ScoreCount** — resolved in I.5.
- All probes (`zzz-repro-r52.ts`, `zzz-probe-r52-emit.test.ts`) deleted; `git status` clean except the
  pre-existing R41-era `M .gitignore` and the untracked prior audit reports.

---

## PART VI — Recommended implementation order

1. **RET-1/2/3** (Tier-1, compile-confirmed) — the DML-returning `k?: T` lock on insert/update/delete; +RET-4 (on-conflict), then RET-5–8 deep rungs / dynamic-pick / as-nullable twins.
2. **MM-1/MM-6** (Tier-1, emission-baked) — the both-optional poison CASE on one plain int leaf (MM-1) + the custom Form-1/2/3 trio anchored on budget/releaseOrdinal/optionalReleaseOrdinal (MM-4/5/6); then MM-2/3 (bigint/double), MM-7–11.
3. **COL-1/3/4/6** (baked positions) → COL-2/5/7–12 (--docker) → CFG-1–4.
4. **TMP-1/2, STR-1/2** (--docker value confirmations).
5. **AGG-1–4, EQ-1/2, SEL-1/2/3, DYN-2, OCC-1/2** (Tier-2/3 tail).
6. **§B PK-tail** — only if strict 18-kind symmetry is wanted (lowest value, output-coincident).
7. **Doc-hygiene:** remove/narrow LIMITATIONS.md:111; fix the custom-numeric header comment (I.5).
8. **Negative-type guards:** the exactOptional `undefined`-assignment lock (highest-value), N1–N7, TEMP-A-1, SEL-A-1.

Maintainer decisions: (a) LIMITATIONS.md:111 — remove vs narrow? (b) SEL C-1 — confirm the
directly-executed `beforeWithQuery` no-op is a boundary (→ SEL-2/3 pins) vs a bug. (c) §B PK-tail —
bake for symmetry or close as output-coincident.

---

## PART VIII — Verdict (honest)

**Not saturated — a large, coherent backlog, and 0 `src/` defects.** The four big post-R51 changes
all landed correctly (independently confirmed: projector rewrite type-only + byte-identical SQL,
aggregate clause-checking complete+symmetric, minValue/maxValue NULL emission-only+symmetric,
collation self-parenthesising), and most shipped with their positive tests — so the round produced
**no bug**, exactly as a maturing library should. But the *type surface those changes introduced* is
under-tested along two Tier-1 seams the fix authors did not lock: the **DML-returning
optional-leaf-in-optional-object shape** (compile-confirmed, 5-agent converged) and the
**minValue/maxValue both-optional poison CASE + all custom-leaf poison forms** (emission-baked,
6-agent converged). Around them sits a genuine Tier-2/3 tail — the collation `.collate()`
positions and `replaceAllInsensitive` value-source overloads, the config opt-out arms, the µs
`getTime`/adapter-drop getters, the Oracle uuid-string and affix-NULL emissions, the
aggregate-expression positions — plus one stale LIMITATIONS entry (compile-confirmed) and one
leans-boundary candidate. The value-source leaf matrices (EQCMP, BOOLIF, CUSTOMNUM base, COLVAL,
DYN base, CONN, SELECT builder) are at true saturation. Implementing the enumerated backlog drives
the post-R51 surfaces to the same saturation the older surfaces already enjoy; `BUGS.md` stays empty.
