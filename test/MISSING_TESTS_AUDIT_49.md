# MISSING_TESTS_AUDIT_49 — type-driven missing-tests audit (Round 49)

**Mandate.** Maximal-saturation, type-driven, multi-agent audit of the `test/` matrix
against the `src/` type surface. Standard: total coverage of every reachable typed
path *and every variant*; output-coincidence does NOT close a cell (→ Tier-4); OUT only
when a distinction has ZERO real-validatable SQL/params/value surface. Re-derived from
the CURRENT files; no verdict inherited from prior reports.

**Method.** Pre-flight (§0.5) + 20 read-only discovery agents (≤10 concurrent, all
reported) + coordinator verification (compile-repro, mock/boundary-row probe, direct
source read). Reference cell `test/db/postgres/newest/pg/`; matrix symmetric.

**Headline counts.**
- Matrix: **17 cells · 247 files · 3900 tests/cell** (66 300 tests, symmetric — `tests:audit` ✓).
- Both R48 fixes (commit `62b5c05b`) verified **COMPLETE and SOUND**; R48 backlog baked-in scan **CLEAN**.
- **2 bugs filed (both maintainer-ruled):**
  - SEL-SEAM-R49-1 — recursive `forUseInQueryAs` ordering-path drops `afterSelectKeyword`/`beforeColumns`/`customWindow` while the wrapping-CTE SELECT survives → **DEFECT** (should render, matching direct-select).
  - F1-STR base-dialect defect — `AbstractSqlBuilder._startsWithInsensitive`/`_notStartsWithInsensitive` pass swapped `_escapeLikeWildcard(value, params, …)` args AND omit SQLite's `escape '\\'`. `AbstractSqlBuilder` is the **base dialect** (SQLite-shaped), so its broken impl is a real bug — masked because every dialect overrides it (the overrides were added by the insensitive-comparison rework `85ec8ded` instead of fixing the base).
- **Surfaces returning §A=0 (saturated):** 10 — F6-DYN, F1-EQCMP, F4-INSERT, F3-SELECT, F1-CUSTOMNUM, F1-TEMP, F1-BOOLIF, F2-COL, F2-VALVIEW, F1-STR.
- **§A backlog:** enumerated below — dominated by the BUG-2 projection-sibling completeness cluster (probe-confirmed SOUND) + the BUG-1-family Row value-source regression-lock trio (convergent, compile-confirmed).

---

## Part I — Bugs, candidates, fix-verification, baked-in scan

### I.0 — Verification of the two R48 fixes (commit `62b5c05b`) — both COMPLETE & SOUND

Both R48 bugs were fixed in a single commit. Independently re-derived by F-RECENT, PARITY,
F7-EXTRAS, F9-TYPEVAR + coordinator compile-repro/boundary-row probe.

**BUG-1 fix (`src/extras/types.ts:56-57`)** — `UpdatableOnInsertConflictRowShapedAs` now
`OnConflictUpdateSetsContent<TABLE, AllowsNoTableOrViewRequired<TABLE[source]>, ResolveShape<…>>`
(was the literal-only `OnConflictUpdateValues`). **COMPLETE.**
- Twin-parity of all 12 `*Row`/`*Values`/`*ShapedAs` delegations re-derived **method-by-method** (coordinator + PARITY + F7-EXTRAS, 22/22 correct): every `*Row`/`*RowShapedAs` → a `*SetsContent` (value-source-accepting) form with `AllowsNoTableOrViewRequired` threaded; every `*Values`/`*ValuesShapedAs` → the 2-arg `*Values` (literal-only) form. **No sibling slip remains.**
- Enshrining test rewritten to a value-source probe (`docs.advanced.utility-types.test.ts` `updatable-on-insert-conflict-row-shaped-as`, `literal`+`valueSrc` assignments + keyof-pin). Correct lock.
- Runtime shaped-on-conflict with a value source under a renamed key IS exercised (`insert.shaped-on-conflict.test.ts:481`, `do update set name = excluded.name`) — no runtime gap.

**BUG-2 fix (`src/queryBuilders/AbstractQueryBuilder.ts:~251`)** — new branch `size > 1 →
alwaysSameRequiredTablesSize = false` (a single leaf spanning ≥2 tables can't be from one
single left join → disqualifies rule-2). **COMPLETE & SOUND.**
- Decisive soundness proof (F-RECENT, via `mergeOptional`, `ValueSourceImpl.ts:1988`): any merged leaf touching a left-join column resolves `originallyRequired` (demoted-to-optional) for **every** operator and **every** source mix (`required⊕originallyRequired → originallyRequired`; `originallyRequired⊕originallyRequired → originallyRequired`). The runtime `size>1` branch honors exactly this ⇒ type and runtime **cannot diverge** on the merged-leaf family.
- The genuine single-left-join rule-2 drop is **preserved** (`mixed-rules.test.ts:77-108`, `proj?` dropped on miss). The shipped regression test's boundary-row probes (`'obj' in miss`===true, `'combined' in miss.obj`===false; nullable `miss.obj.combined`===null) are **baked-in consistent** (assertType == toEqual).
- Load-bearing window (F9-TYPEVAR): the `size>1` branch is load-bearing only when a size-2 merged leaf is the **first** table-bound leaf AND something else (a no-table const) keeps the object alive; every other placement is already handled by the pre-existing size-comparison branch (`:271-282`). That exact load-bearing case IS covered. **⇒ no untested sibling can be a BUG — only completeness (Part II, §PROJ).**

**Baked-in scan of the R48 backlog (F-RECENT) — CLEAN.** All 5 just-landed tests are
internally consistent (`assertType<Exact>` ⇔ `toEqual`/key-presence/null-ness): PROJ-A-1
(`select.aggregation.test.ts:296`), UD-T4-1 (`update.with-old-values-and-from.test.ts:286`),
MUT-FROMSELECT-UPSERT-WHERE (`insert.on-conflict.from-select.test.ts:288`), INS-MULTI-BARE-UPSERT
(`sqlite3/insert.multi-row.test.ts:302`, pg correctly NOT-APPLICABLE-commented), DYN-NEG `{between}`
(`postgres/types.negative/dynamic-condition.test.ts:64`). No baked-in bug.

### I.1 — CANDIDATE (both readings, NOT filed) — SEL-SEAM-R49-1: recursive `forUseInQueryAs` ordering-path drops projection-only hooks while the wrapping-CTE SELECT survives

**What.** A recursive result carrying `orderBy`/`limit` AND the projection-only hooks
`afterSelectKeyword`/`beforeColumns`/`customWindow`, consumed via `forUseInQueryAs`, takes the
**ordering/paging wrapping-CTE** sub-path (`SelectQueryBuilder.ts:607-623`). That path builds a
fresh wrapping select `<as> as (select … from <recursive-member> order by … limit …)` and
`wrapCustomization` keeps ONLY `beforeOrderByItems`/`afterOrderByItems`, stripping the three
projection-only hooks.

**Coordinator mock probe (confirmed emission):**
```
…, tree as (select id as id, title as title from recursive_select_1 order by title asc, id limit $4) …
```
`beforeOrderByItems` (`title asc`) **renders** (re-homed to the wrapping select); `afterSelectKeyword`/`beforeColumns`/`customWindow` are **dropped** (no `/* hint */`, no `/* cols */`, no `window w1`).

**Both readings.**
- *Boundary (NOT-APPLICABLE):* the author wrote an **explicit allow-list "on purpose"** (`SelectQueryBuilder.ts:564-577`) and is demonstrably aware the ordering path has a plain select (`:596-599` "outerSelect already IS that `select … from <recursive-member>` … strip everything but the ORDER BY hooks off it"). The repo owner has a **standing NOT-APPLICABLE ruling** on the sibling (no-ordering) case (runbook §9). Under this reading, the wrapping select is ordering/paging plumbing, not the user's projection.
- *Defect:* the wrapping-CTE SELECT clause **survives** in the output (the runbook "drop is a bug iff the customized clause survives" test → render sites for `select`/columns/`window` all present); the non-recursive twin renders all five hooks in an identical `<name> as (select /* hint */ /* cols */ … window …)` structure (`customize-query.select.test.ts:269`); and `beforeOrderByItems` already re-homes to this same wrapping select — so dropping the other three is asymmetric. The allow-list *rationale* ("a plain SELECT clause the compound body does not have") is literally **false** for the wrapping select.

**Adjudication (maintainer-ruled): DEFECT — FILED to `BUGS.md`.** Presented as a
candidate with both readings; the maintainer ruled it a bug — since the direct-select and
the non-recursive-CTE paths render the three hooks, the ordering-path wrapping select
(which survives with a real SELECT clause) should too. The allow-list rationale is false on
this branch; the fix extends `wrapCustomization` to carry the three projection-only hooks
and narrows the allow-list to the no-ordering path only (where the recursive member IS the
CTE and no plain select survives — that stays a genuine NOT-APPLICABLE boundary). The SEL-1
item (Part II) becomes the `// TODO[BUG]` test asserting the hooks render.

### I.2 — BUG (FILED to `BUGS.md`) — F1-STR: base dialect `AbstractSqlBuilder` `_startsWithInsensitive`/`_notStartsWithInsensitive` are wrong (swapped `_escapeLikeWildcard` args + not SQLite-shaped)

> **Reclassified from "latent/dead-code OUT" after maintainer input:** `AbstractSqlBuilder`
> is the **base dialect** (SQLite-shaped, expanded by PostgreSQL with minimal overrides), NOT
> an unreachable abstract fallback — so a broken base IS a real bug. History confirms the
> overrides were added by the insensitive-comparison rework (`85ec8ded`) instead of fixing the
> base. Two defects: (1) the swapped `_escapeLikeWildcard(value, params, …)` args (root cause:
> that function's signature is the sole `(params, value)` outlier vs the render-helper
> convention); (2) the base `else` branch omits SQLite's `escape '\\'`. Fix: reconcile the
> `_escapeLikeWildcard` signature to `(value, params)`, make the base SQLite-shaped, drop the
> redundant SQLite override + minimize PG's. See `BUGS.md`. Full detail retained below.

**What.** `AbstractSqlBuilder._startsWithInsensitive` (`:2814/2816/2818`) and
`_notStartsWithInsensitive` (`:2824/2826/2828`) call `this._escapeLikeWildcard(value, params, …)`
— first two args **swapped** vs the signature `_escapeLikeWildcard(params, value, …)` and vs
every sibling (`_startsWith`/`_notStartsWith`/`_endsWith`/`_notEndsWith` at `:2800-2809` use the
correct order). This would route the params array through the `typeof value === 'string'` escape
guard (always false → wrong branch).

**Root cause (the real oddity).** `_escapeLikeWildcard`'s signature (`AbstractSqlBuilder.ts:2932`)
is `(params, value, columnType, columnTypeName, typeAdapter, forceTypeCast)` — **params first** —
which is the **sole outlier** in the render-helper family: `_appendSql(value, params, …)`,
`_appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)` (identical
tail!), `_appendConditionSql(value, params, …)` all put **value first**. Whoever wrote the
insensitive-affix methods followed the pervasive `(value, params)` convention and wrote
`_escapeLikeWildcard(value, params, …)` — correct for the convention, wrong for this function's
odd signature. The correct callers (sensitive base + all overrides) had to write it *against* the
convention.

**Coordinator verification (direct read).** Confirmed swapped at the six base lines; confirmed
`PostgreSqlSqlBuilder._startsWithInsensitive:361` OVERRIDES with the (per-signature) correct order.
All six shipped dialects override both methods; only `NoopDBSqlBuilder` inherits the base.
**NoopDB is not a matrix cell** ⇒ the swap is **dead in the matrix** — no reference-cell test can
reproduce it. The overrides **cannot** be collapsed into the base: each emits genuinely
dialect-specific SQL (PG `ilike`; MySql/MariaDB `like concat(...)`; Sqlite/Oracle
`… escape '\\'`; SqlServer `+ '%'`/collate; base `lower() like lower()`).

**Adjudication.** NOT in `BUGS.md` (it requires a reproducing matrix test; none exists — a dangling
entry could never be closed via a `// TODO[BUG]` removal). Src-cleanup candidate. Two options:
**(a) minimal** — fix the 6 base call sites (2814/2816/2818/2824/2826/2828) to `(params, value)`;
**(b) convention-aligning (removes the footgun)** — change `_escapeLikeWildcard`'s signature to
`(value, params, …)` to match `_appendValue`/`_appendSql`, then flip all callers (the base
insensitive methods, already `(value, params)`, become correct with no change; the sensitive base +
overrides flip `(params, value)`→`(value, params)`). Overrides stay in all cases (dialect SQL).

### I.3 — Type-only owner candidates re-confirmed PRESENT (not bugs, not re-filed as tests)
- **CAND-A** (`update.ts` sqlite `ReturningOneColumnFnType` stray `| NOldValuesFrom` *outside* `ValueSourceOf`, admitting a bare source-name string) — vestigial/unreachable (`oldValues()` is `never` on `SqliteConnection`); latent inconsistency vs `ReturningFnType`. Owner-optional src cleanup, no runtime surface (F4-UPDDEL §C-2).
- **CAND-F** (`values.ts:253` `isIfValue` propagates `OPTIONAL_TYPE` while `is`/`isNot`/`isNotIfValue` force `'required'`) — over-widening in the SAFE direction, same `_is` op, no value surface (F1-BOOLIF §C). Not a bug.

### I.4 — Doc-hygiene (report-only; not tests)
- **D-1** `dynamic-condition.operators.test.ts:10` header lists a `between` operator that does not exist (no `between` in `allowedOpreations`/any `*Filter`; the R48 DYN-NEG lock proves `{between}` is *rejected*). Confirmed by F-RECENT, F6-DYN, F1-BOOLIF (3 agents). Symmetric across all cells. Reword to "greaterOrEqual + lessOrEqual (range)" or delete.
- **D-VALVIEW** `with-values.test.ts` header opens `// … coverage of \`connection.Values\` …` — stale (no `Values` member on the Connection; the public API is the standalone `Values` class via `Values.create(...)`); plus a duplicated "pinned by the snapshot" sentence. Present identically across ~10+ cells (F2-VALVIEW §C).

---

## Part II — Enumerated §A backlog (by surface)

Every item is its own line with fixture + assertion + absence-grep. Tier is a priority label.
All items use existing cells + existing `domain/connection.ts` fixtures (§A) unless marked §B.

### §PROJ — BUG-2 projection-sibling completeness (all probe-confirmed SOUND; 0 bugs)

The R48 fix's own test lands where shapes coincide (merged-leaf + const → rule-3). These fill the
**complementary boundary rows** of the `size>1` guard. Coordinator boundary-row probes (default +
nullable) confirmed every predicted type == runtime. Each item = **2 test bodies** (default
projector + `projectingOptionalValuesAsNullable`). Fixtures: `tIssue` (projectId, assigneeId FK),
`tProject.forUseInLeftJoin()`, `tAppUser.forUseInLeftJoin()`, `tIssue.forUseInLeftJoin()`,
`ctx.conn.const`. Grep proving absence: the only nested merged-two-left-join objects in the matrix
are `mixed-rules.test.ts:923/968`, both carrying a `tag: const(...)` anchor.

- **PROJ-1 · T1** — merged 2-left-join leaf **ALONE, no const anchor** → rule-4. `select({ iid: tIssue.id, obj: { combined: tProjLeft.id.add(tAssigneeLeft.id) } })`. **Probe-confirmed:** default → `obj?` dropped on partial miss (`'obj' in row`===**false**); nullable → `obj` **collapses to `null`** (NOT `{combined:null}` — the `combined: number|null` inhabitant is unrealizable in a value-present position). Type: default `{iid;obj?:{combined:number|undefined}}`, nullable `{iid;obj:{combined:number|null}|null}`. [triple-converged F-RECENT-A6/F9-A1/F3PROJ-A1]
- **PROJ-2 · T1** — rule-4 via **own-table-OPTIONAL sibling** disqualifying rule-2, object SURVIVES a left-join miss. `selectFrom(tProject).leftJoin(tIssueLeft).select({ pid: tProject.id, obj: { issTitle: tIssueLeft.title, projArchived: tProject.archivedAt } })`. **Probe-confirmed** (project 4 = left-join miss but own `archivedAt` present): default → `'obj' in row`===**true**, `'issTitle' in row.obj`===**false**, `projArchived instanceof Date`; nullable → `row.obj` non-null, `row.obj.issTitle`===null. The `issTitle` left-join leaf is demoted `| undefined` (rule-4, NOT rule-2 required-when-present). A runtime boundary no two-left-join fixture can produce (both miss together). [F3PROJ-A2]
- **PROJ-3 · T2** — merged-leaf **FIRST** + own-table required anchor (size-1↔size-2 tracking interaction the const anchor, size-0, cannot exercise). `select({ iid, obj: { combined: tProjLeft.id.add(tAssigneeLeft.id), ownId: tIssue.id } })`. **Probe-confirmed:** obj survives (`'obj' in row`===true, own-table `ownId` anchor), `'combined' in row.obj`===false on partial miss. The bug comment itself names "a size-2 leaf reaching this point first". [F-RECENT-A1/A2]
- **PROJ-4 · T2** — merged leaf spanning a **left join + the MAIN table** (mixed source) + const anchor. `select({ iid, obj: { combined: tIssue.id.add(tProjLeft.id), tag: const('rel','string') } })`. `mergeOptional(required, originallyRequired)=originallyRequired` → obj REQUIRED (const), `combined?` demoted; on project-miss `combined` null, obj survives with `tag`. [F-RECENT-A3]
- **PROJ-5 · T3** — merged-leaf object nested **one level deeper** (`outer: { inner: { combined: tProjLeft.id.add(tAssigneeLeft.id), tag: const } }`) — exercises the `size>1` gate inside the recursive `__transformProjectedObject` call. [F-RECENT-A4]
- **PROJ-6 · T3** — merged leaf + const inside an **`aggregateAsArray` element** (`ResultObjectValuesForAggregatedArray` type entry + `__transformAggregatedArray`→`__transformProjectedObject` runtime entry). Coordinator note: bake-time confirm the aggregate-element projector resolves `combined` to demoted-optional. [F-RECENT-A5 / F3PROJ-B2]
- **PROJ-7 · T4** — merged **SAME-single-left-join** leaf (size==1 via merge) → still rule-2 (the OTHER side of the `size>1` guard). `selectFrom(tProject).leftJoin(tIssueLeft).select({ obj: { m: tIssueLeft.id.add(tIssueLeft.number) } })` → `obj?` dropped on miss. Confirms a merged-single-table leaf is NOT disqualified. [F3PROJ-B1]
- **PROJ-8 · T4** — rule-4 object mixing **own-optional + left-join-optional** (`{ body: tIssue.body, arch: tProjLeft.archivedAt }`) — a leaf-config combination not currently present. [F3PROJ-B3]

### §ROWLOCK — BUG-1-family value-source regression-lock (compile-repro CONFIRMED addable)

The three **non-shaped** Row utility types are exercised only by literal + `keyof`-pin probes —
neither distinguishes a correct `*SetsContent` delegation from a BUG-1-style wrong `*Values` one
(a literal is assignable to both; the key sets are identical). The shaped twins ARE value-source-
locked (`docs.advanced.utility-types.test.ts:231/265/296`). Coordinator compile-repro confirmed
each value-source assignment compiles today ⇒ the lock is addable & meaningful. Convergent finding
(PARITY A1-A3, F7-EXTRAS A1).

- **ROWLOCK-1 · T2** — `InsertableRow<typeof tProject>` accepts a value source. Test `docs.advanced.utility-types.test.ts` `insertable-row-accepts-value-sources` (:93): add `const vs: InsertableRow<typeof tProject> = { organizationId: tProject.organizationId, slug: tProject.slug, name: tProject.name }; void vs`. Fails iff `InsertableRow` regresses to `MandatoryInsertValues`.
- **ROWLOCK-2 · T2** — `UpdatableRow<typeof tIssue>` (:116): add `const vs: UpdatableRow<typeof tIssue> = { title: tIssue.title }; void vs`. Locks `UpdateSetsContent` vs `UpdateValues`.
- **ROWLOCK-3 · T2** — `UpdatableOnInsertConflictRow<typeof tOrganization>` (:161, the non-shaped sibling of the type that carried BUG-1): add `const vs: UpdatableOnInsertConflictRow<typeof tOrganization> = { plan: tOrganization.plan }; void vs`. Locks `OnConflictUpdateSetsContent` vs `OnConflictUpdateValues`.
- **ROWLOCK-4 · T3** — a write-side utility type typing a **real builder call** (F7-EXTRAS A2): a helper `function f(row: InsertableRow<typeof tProject>) { return ctx.conn.insertInto(tProject).values(row)… }` invoked with a value-source row, asserting emitted SQL+params — validates the round-trip assignability the isolated `Exact<>` probes never exercise (the utility type ≠ the builder's own parameter type). Medium value.

### §MUT — mutation seam compositions (MUT-SEAM)

- **MUT-1 · T3** — `oldValues × UPDATE…FROM(join) × projectingOptionalValuesAsNullable` (genuine 3-way, tested only pairwise). `update(tProject).from(tIssue).innerJoin(tAppUser).on(…).set({name: tAppUser.fullName}).where(tProject.id.equals(tIssue.projectId)).returning({ oldArchivedAt: oldProject.archivedAt, assignee: tAppUser.fullName }).projectingOptionalValuesAsNullable().executeUpdateOne()`. Assert `… returning old.archived_at as "oldArchivedAt", app_user.full_name as assignee` + `assertType<Exact<…,{oldArchivedAt: Date|null; assignee: string}>>` (present-null) + value. In the `_old_`-subquery sibling cells (pg-oldest/mariadb/mysql/sqlserver) the optional-old column meets the subquery pre-projection AND the nullable reshape — the one place both mechanisms combine.
- **MUT-2 · T4** — `onConflictOn(cols).doUpdateSet(…) × nested-object RETURNING`. Every on-conflict returning test uses a **flat** object; nested-object RETURNING is proven only on plain INSERT / UPDATE…FROM. `.returning({ id, audit: { name: tProject.name, slug: tProject.slug } })` → `… returning id as id, name as "audit.name", slug as "audit.slug"`.

### §CONN — connection API (F5-CONN)

`aggregateFragmentWithType × temporal-kind × trailing-adapter (required)` — the non-adapter temporal
aggregate arms AND the numeric/string aggregate+adapter arms are covered, but the temporal×adapter
cross is not. `adapter2` slot + Date-under-adapter marshaller each proven independently ⇒ T4.
Observable via `max(<temporal col>)` + a `shiftHour` +1h read.
- **CONN-1 · T4** — `aggregateFragmentWithType('localTime','required',adapter).sql\`max(started_at)\``.
- **CONN-2 · T4** — `aggregateFragmentWithType('localDateTime','required',adapter).sql\`max(created_at)\``.
- **CONN-3 · T4** — `aggregateFragmentWithType('customLocalTime','CutoffClock','required',adapter)` (`adapter2` slot).
- **CONN-4 · T4** — `aggregateFragmentWithType('customLocalDateTime','SignOffStamp','required',adapter)` (`adapter2` slot).
- **CONN-5/6 · §B (mock-only)** — same for `localDate` / `customLocalDate`; the localDate marshaller rejects pg's date-only echo (the boundary that already excludes `const(date,'localDate',…)`), so real-DB asserts structurally only.

### §UD — update/delete (F4-UPDDEL)

- **UD-1 · negative-type (owner-optional)** — `oldValues()` is RETURNING-only but never negatively locked in `.set()` / `.where()` on **postgres/sqlserver/mariadb** (the oldValues-supporting dialects). Type premise (`src/utils/sourceName.ts`): `oldValues()` columns carry source `NOldValues<…>`, which `ReturningFnType` unions in but `.set()`/`.where()` (keyed on `USING[source]`) exclude. The three cells' `types.negative/update.test.ts` carry only a NOTE, while mysql/oracle/sqlite carry the complementary `@ts-expect-error oldValues() is not typed` lock. **Premise-probe required** before baking (compile-repro that `.set({name: oldProject.name})` / `.where(oldProject.name.equals(x))` are `TS` errors with correct `@ts-expect-error` span). Negative-type = OUT of the strict scope but the sanctioned content of `types.negative/`; owner-optional (same class the R48 DYN-NEG lock landed under).
- **UD-2 · T4** — DELETE `returningOneColumn(col).executeDeleteMany(0,1)` MAX-bound throw twin (UPDATE has it; DELETE has only the one-column-many MIN side + the row-shape MAX side). Distinct executor branch, shared count-guard. Low value.

### §NUM — numeric cast-chaining (F1-NUM)

- **NUM-1 · T4** — `asInt()` result chained into a numeric op (`<int-or-double>.asInt().modulo(2)` / `.add(1)`). `asInt()` is only ever projected as a leaf, never chained; the double→int arm into `%` (`round((..)::numeric) % $1`) is an unasserted emission. (`asDouble()`-then-chain is covered, establishing the pattern.)
- **NUM-2 · T4** — `asBigint()` result chained into a bigint op (`priority.asBigint().add(2n)` / `.modulo(2n)`). The Noop-wrapped-as-bigint composing into bigint arithmetic.

### §SEL — select/CTE seam (SEL-SEAM)

- **SEL-1 · T2 (boundary-lock)** — two-sided lock for the SEL-SEAM-R49-1 candidate (I.1): the recursive `forUseInQueryAs` **ordering path** renders `beforeOrderByItems`/`orderBy`/`limit` in the wrapping CTE but DROPS `afterSelectKeyword`/`beforeColumns`/`customWindow`. Snapshot the current behavior (fixture in I.1). Locks a subtle, currently-untested boundary regardless of the owner's bug-vs-boundary ruling.
- **SEL-2 · T4** — `customWindow` on a recursive result consumed via `forUseAsInline*` (a distinct render position; the two recursive-inline customize tests set only `afterSelectKeyword`/`beforeColumns`). Clone `customize-recursive-select-hooks-render-in-inline-scalar-value` + `customWindow: rawFragment\`w1 as (partition by result)\``, assert the scalar subquery carries `… window w1 …`.

---

## Part III — OUT (named, with reason — not re-chased)

- Base-builder `_escapeLikeWildcard` arg-swap (I.2) — dead in the matrix (NoopDB-only); no reference-cell test; latent src cleanup.
- CAND-A (sqlite stray `| NOldValuesFrom`) / CAND-F (`isIfValue` over-widen) — type-only, no runtime/value surface.
- `bigint` float-only/cast methods (multiply/divide/power/sqrt/cbrt/exp/ln/log10/trig/atan2/logn/roundn/asInt/asDouble/asBigint) — typed-never, already `@ts-expect-error`-locked (`types.negative/select.test.ts:345-391`).
- `customInt` commented-out math (divide/power/logn/roundn/exp/ln/log10/sqrt/cbrt/trig/asInt/asDouble/asBigint) + `customInt.modulo(2.5)` (INVALID_VALUE throw at marshalling) — typed-never / throw.
- `double.modulo` (`float % x` PG-rejects), int-receiver fractional-literal arithmetic (untyped `col + $n` PG-rejects), `roundn(double-places)` — engine LIMITATION boundaries.
- L-1: custom-temporal const/arg getter bare `extract` — LIMITATION (custom typeNames carry no built-in SQL type; user's `transformPlaceholder` responsibility).
- Brand-only PK / autogen distinctions (`primaryKey`/`autogeneratedPrimaryKey`/`…BySequence` per non-int kind read) — brand-only, no value/SQL surface.
- `INVALID_MOCKED_VALUE` / `ONLY_ONE_COLUMN_EXPECTED` / `SQL_*` / impossible-state error reasons — `src/queryRunners/` (MockQueryRunner / AbstractQueryRunner) driver layer.
- `UNSUPPORTED_QUERY` (needs `compatibilityVersion<8M`, no such cell) / `UNKNOWN_DATA_TYPE` (sqlite-only) — no pg cell.
- Phantom names checked and absent: `insertReturningMultipleColumnsForSequence`, `ForcedTypeAdapter` (real: `ForceTypeCast`, covered), `isDistinctFrom`/`isNotDistinctFrom`/`asOptionalNonEmptyString` (real: `is`/`isNot`, covered), `executeSelectCount`, compound `groupBy`/`having`, `getDayOfWeek` (real: `getDay`), `selectFromModel`.
- New matrix cells; negative-type tests broadly.

---

## Part IV — Per-surface saturation table

| Agent | §A | verdict |
|---|---|---|
| F-RECENT | 6 (PROJ-1..6, incl. A1-A5/A6) | both R48 fixes SOUND; baked-in CLEAN; 0 bug |
| PARITY | 3 (ROWLOCK-1..3) | extras twin-parity clean; 0 bug |
| MUT-SEAM | 2 (MUT-1/2) | SATURATED; 1 candidate REFUTED (oldValues×from×nested already handled in src); 0 bug |
| SEL-SEAM | 2 (SEL-1/2 + I.1 candidate) | near-saturated; 0 bug |
| F9-TYPEVAR | 1 (PROJ-1) | SOUND; BUG-2 siblings covered/redundant; 0 bug |
| F7-EXTRAS | 1 (ROWLOCK-4; A1↔ROWLOCK-1..3) | extras 22/22 correct; 0 bug |
| F1-EQCMP | 0 | **SATURATED** (~500 paths) |
| F6-DYN | 0 | **SATURATED** (13 surfaces) + D-1 |
| F5-CONN | 4 (+2 §B) | CONN-1..6 (T4 temporal aggregate-adapter); 0 bug |
| F4-INSERT | 0 | **SATURATED** |
| F4-UPDDEL | 2 (UD-1 neg + UD-2) | SATURATED; CAND-A present; 0 bug |
| F3-PROJ | 2+3 (PROJ-1/2 + B1/B3/agg) | 0 bug |
| F3-SELECT | 0 | **SATURATED** (subSelect 1-5 R48-fix locked) |
| F1-NUM | 2 (NUM-1/2, T4) | **CLOSED**; bigint typed-never locked; 0 bug |
| F1-CUSTOMNUM | 0 | **CLOSED** |
| F1-STR | 0 | **SATURATED** + I.2 latent src |
| F1-TEMP | 0 | **SATURATED** |
| F1-BOOLIF | 0 | **SATURATED**; CAND-F present |
| F2-COL | 0 | **CLOSED** |
| F2-VALVIEW | 0 | **R-P7 close** + D-VALVIEW |

**10 of 20 surfaces returned §A=0.** No surface with a live runtime/value gap remains beyond the enumerated backlog.

---

## Part V — Coordinator verification notes

- **Row-lock (ROWLOCK-1..3):** compile-repro (`validate:tests`, deleted) — value-source assignment to each non-shaped `InsertableRow`/`UpdatableRow`/`UpdatableOnInsertConflictRow` **compiles clean** ⇒ types accept value sources today; the lock tests are addable and would catch a Row→Values regression.
- **BUG-2 siblings (PROJ-1/2/3):** mock boundary-row probe (deleted) — PROJ-1 default `'obj' in miss`===**false** (rule-4 drop), nullable `missObj`===**null** (single-leaf collapses to `obj:null`, NOT `{combined:null}`; the `number|null` inhabitant is unrealizable value-present); PROJ-2 `'obj' in r`===**true** / `'issTitle' in r.obj`===**false** (own-optional keeps object alive on left-join miss); PROJ-3 `'obj' in r`===**true** / `'combined' in r.obj`===**false** (own-anchor keeps object, merged leaf dropped). All predicted types == runtime ⇒ SOUND, 0 bug.
- **SEL-SEAM-R49-1:** mock emission probe (deleted) — the ordering-path wrapping CTE renders `beforeOrderByItems`/`orderBy`/`limit` but drops the 3 projection-only hooks; the no-ordering control shows the recursive member IS the CTE (no plain select). Read `SelectQueryBuilder.ts:559-633` — explicit allow-list + author aware of the plain select on the ordering path ⇒ candidate both readings, not a filed bug.
- **F1-STR arg-swap:** direct read — base `_startsWithInsensitive`/`_notStartsWithInsensitive` swap the first two args; `PostgreSqlSqlBuilder:361` overrides with the correct order; all 6 dialects override, only NoopDB inherits ⇒ dead in the matrix.
- **BUG-1 twin-parity:** direct read of `src/extras/types.ts` — all 12 Row/Values/ShapedAs delegations correct (independently confirmed by PARITY + F7-EXTRAS).
- **`tests:audit`:** 17 cells / 247 files / 3900 tests-per-cell, whole matrix symmetric, 0 problems.

---

## Part VI — §B fixture additions

None required. CONN-5/6 are §B only in the sense of *real-DB mock-only* (existing fixtures suffice;
the localDate marshaller boundary limits real-DB assertion). No new columns/tables/helpers needed —
every §A item uses existing `domain/connection.ts` fixtures.

---

## Part VII — Recommended implementation order

1. **§PROJ (PROJ-1..8)** — the round's core; probe-confirmed SOUND; each 2 bodies (default + nullable). PROJ-1/2/3 (T1/T2) first — they exercise the untested directions of the BUG-2 `size>1` guard; PROJ-4..8 (T3/T4) complete the family.
2. **§ROWLOCK (ROWLOCK-1..3)** — cheap, high-value regression-locks on the BUG-1 family; add one value-source assignment per existing test. ROWLOCK-4 optional.
3. **§MUT (MUT-1/2)** — the 3-way / nested-returning seam completeness.
4. **§SEL (SEL-1 boundary-lock, SEL-2)** — SEL-1 pins the ordering-path behavior pending the owner's I.1 ruling.
5. **§CONN (CONN-1..4 T4)** + **§NUM (NUM-1/2 T4)** + **§UD (UD-2)** — output-coincident tails.
6. **§UD-1** (negative-type oldValues lock) — owner-optional, premise-probe first.
7. Doc-hygiene D-1 / D-VALVIEW — comment-only.
8. Latent src (I.2 arg-swap, CAND-A) — owner cleanup, no test.

---

## Part VIII — Verdict

An honest mature round. **0 confirmed `src/` bugs** — and that is the correct outcome: both R48
fixes are verified **complete and sound** (BUG-2's soundness has a decisive `mergeOptional` proof
that its whole merged-leaf sibling family cannot diverge type-vs-runtime; BUG-1's twin-parity is
22/22 clean), the R48 backlog baked-in scan is clean, and 10 of 20 surfaces are saturated. The
round's value is the **enumerated completeness backlog** — the BUG-2 projection-sibling cluster
(§PROJ, probe-confirmed SOUND, filling the guard's complementary boundary rows) and the BUG-1-family
Row value-source regression-lock trio (§ROWLOCK, convergent PARITY+F7-EXTRAS, compile-confirmed) —
plus two **latent candidates left to the maintainer** (SEL-SEAM-R49-1 ordering-path hook drop — an
allow-list the author wrote deliberately but whose rationale is false for the surviving wrapping
select; and the F1-STR base-builder arg-swap — a genuine but dead defect). Neither is filed to
`BUGS.md` (per the "drop ≠ defect / no reproducing test" discipline). The surface is at or near total
saturation; the residual is completeness fan-out, not correctness risk.
