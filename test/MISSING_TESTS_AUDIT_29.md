# MISSING_TESTS_AUDIT_29

> Round 29 of the type-driven missing-tests audit (`test/TYPE_AUDIT_RUNBOOK.md` is
> the sole source of truth; this report is transient). Mandate: maximalist —
> total coverage of every reachable typed path *and variant*; narrow degeneracy
> bar (§4); lead the mature phase with the parity sweep + the two seam critics +
> the freshly-changed-src agent + the result-type agent. This round's headline
> target was the **freshly-changed src surface** (commit `920d5c97`, the CD-1 +
> CD-2 fixes) and the **seams**.

## Method

- **Pre-flight (§0.5):** N=29 (`_28` was the highest present). `bun run tests:audit`
  → **17 cells, 234 files, 2331 tests/cell, 39627 total — symmetric ✓**.
  `bun run tests:index` refreshed. `test/BUGS.md` re-read → **empty** (`_None
  currently open._`, confirming the Round-28 CD-1/CD-2 fixes landed).
  `domain/connection.ts` re-read in full. `git log --oneline` → the fresh src is
  commit **`920d5c97`** ("executeSelectPage keeps customizeQuery hooks on the
  auto-generated count query; subSelectUsing/subSelectDistinctUsing now accept
  five genuinely-distinct correlated tables") — read the src diff and both its
  regression-lock test diffs before seeding.
- **20 discovery agents** in two waves (≤10 concurrent), READ-ONLY, inline
  reports. Led by PARITY, the two seam critics (MUT-SEAM, SEL-SEAM), F-RECENT
  (aimed at the CD-1/CD-2 fixes) and F9-TYPEVAR; then the full ~16 per-surface set.
- **Coordinator verification (§7):** every load-bearing claim resolved by me —
  runtime mock-probe for emitted-SQL/soundness questions, tsgo compile-repro for
  reachability/exact-type, my own operand-capturing wide-grep for absence-at-scale.
  All probes deleted; **`git status --porcelain` clean** (only the pre-existing
  untracked `MISSING_TESTS_AUDIT_*.md` reports + prior-round `M .gitignore` /
  `M TYPE_AUDIT_RUNBOOK.md` remain, plus this new report).

## Headline

- **Confirmed type-vs-impl bugs: 0.** A valid mature-round outcome (runbook §9).
  Nothing filed to `BUGS.md`.
- **1 maintainer-decision CANDIDATE** (presented with both readings, NOT asserted
  a bug): the CD-2 fix's `|| this.__customization` count-wrap **over-trigger**.
- **~10 clean §A tests** (existing cells + existing fixtures), concentrated on the
  freshly-changed surface's positive/tail arms + two genuine per-surface holes.
- **1 §B** fixture suggestion (optional enum/custom/customComparable column).
- **14 surfaces genuinely saturated (0/0).**
- The two projection **soundness candidates** the seam/projection critics raised
  were **runtime-probed and REFUTED as bugs** (both sound) — they survive only as
  §A coverage gaps.

---

## CANDIDATE (maintainer decides — both readings; not filed to BUGS.md)

### C-1 — CD-2's `|| this.__customization` count-wrap fires for customizations with nothing to decorate

The Round-28 CD-2 fix (`SelectQueryBuilder.__buildSelectCount`, `SelectQueryBuilder.ts:819`)
routes a plain (non-distinct, non-grouped) select's `executeSelectPage` count query
through a `with result_for_count as (...) select count(*) from result_for_count`
CTE **whenever `this.__customization` is truthy**. `customizeQuery` sets
`__customization` for *any* field — including ones that emit no SQL into the count
body. Two coordinator-probed edge behaviors (mock, reference cell):

**C-1a — metadata-only customization.** A `customizeQuery({ queryExecutionName,
queryExecutionMetadata })` (no SQL hooks) on a plain `executeSelectPage`:
```
count (probed) : with result_for_count as (select id as id, name as name from project where id <= $1 order by id) select count(*) from result_for_count
count (control): select count(*) from project where id <= $1          ← same query WITHOUT customizeQuery
```
The count query is CTE-wrapped purely because `__customization` is present, though
the metadata attaches independently (`__setQueryMetadata`, `:196`) regardless of the
wrap.

**C-1b — `beforeWithQuery`/`afterWithQuery` (WITH-clause hooks) on a plain select.**
A plain select owns no `WITH` clause, so these hooks render **nowhere** on the data
query; but on the page count query they decorate the library-**synthesized**
`result_for_count` CTE:
```
data  (probed): select id as id, name as name from project where id <= $1 order by id limit $2   ← hooks invisible
count (probed): with result_for_count as /*bwq*/ (select ... order by id) /*awq*/ select count(*) from result_for_count
```

**Both readings.** (a) *By design / consistent:* the maintainer's stated CD-2 intent
was "decorate EVERY statement emitted to the DB"; the count IS a statement, its wrap
IS a with-query, so decorating it is internally consistent and the SQL is valid
(count correct). (b) *Over-trigger / surprising:* the guard `|| this.__customization`
is coarse — a metadata-only customization has no SQL to render (C-1a: needless CTE,
different count SQL/plan), and `beforeWithQuery`/`afterWithQuery` authored for the
user's *own* with-clause now leak onto an internal, name-reserved synthetic CTE only
on the count query (C-1b). A tighter guard would test for an actual body-affecting
SQL hook. Per the drop≠defect oracle this is **not a drop** and emits valid SQL, so
it is a semantics call, not a defect — presented for the maintainer.
**Regardless of the verdict, the count-query SQL for these cases is a §A coverage
gap** (no test asserts it). Src: `SelectQueryBuilder.ts:819-848`.

---

## §A — in scope, existing cells + existing fixtures (tiered by risk)

### Tier 1 — freshly-changed-surface positive arms + genuine holes (highest value, cheapest)

**A-1 (marquee). `subSelectDistinctUsing` arities 2–5 have ZERO positive runtime coverage — the distinct twin of the CD-1 fix.**
Commit `920d5c97` fixed the arity-5 `table5: T4`→`T5` typo on **both**
`subSelectUsing` (`AbstractConnection.ts:441`) **and** `subSelectDistinctUsing`
(`:451`), but shipped a positive 5-distinct-table test + a `types.negative` lock for
the **non-distinct** method only (`select.subqueries.test.ts`,
`types.negative/select.test.ts`). The distinct twin is exercised **only at arity-1**
(`select.distinct.test.ts` `subSelectDistinctUsing(tProject)`) across the whole
matrix. Converged on independently by **PARITY** and **F-RECENT**.
*Coordinator-probed (mock + tsgo):* the 5-distinct-table distinct subquery **compiles
and emits** `(select distinct project_id as result from project_review where
project_id = project.id and project.organization_id = organization.id and
issue.assignee_id = app_user.id and issue_worklog.issue_id = issue.id)` — the
`distinct` marker renders. (The inline-scalar result key is optional in the default
projector — pin the exact `assertType` when baking; my `number` / `number | null`
hypotheses both failed `Exact`, so it is an optional key `reviewCount?: number`.)
Fixtures all present (`tOrganization/tProject/tIssue/tAppUser/tIssueWorklog/tProjectReview`).
Add an arity-5 (and, per the ladder, arity-2/3/4) distinct case to
`select.distinct.test.ts`, mirroring the non-distinct arity-5 test.

**A-2. CD-2 count-wrap tail arms — the non-`beforeQuery`/`afterQuery` `SelectCustomization` hooks on a plain-select `executeSelectPage`.**
The CD-2 regression test locks only `beforeQuery`/`afterQuery`. Since the new
`|| this.__customization` trigger fires for *any* hook, the other body-affecting
hooks now also ride the wrapped inner count query. *Coordinator-probed (mock):* all
five clause-internal hooks render **correctly** inside the count CTE — none dropped
or misplaced (drop≠defect: clean coverage gap, **no bug**):
```
count (probed): with result_for_count as (select /*ask*/ /*bc*/ id as id, name as name from project where id <= $1 window /*cw*/ order by /*boi*/, id, /*aoi*/) select count(*) from result_for_count
```
Add to `customize-query.select.test.ts`: a plain select + `orderBy` + `limit` +
`customizeQuery` carrying `afterSelectKeyword`/`beforeColumns`/`customWindow`/
`beforeOrderByItems`/`afterOrderByItems`, asserting `ctx.history[1].sql` (count).
Also **A-2b**: `distinct` and `groupBy`/`having` selects × `customizeQuery` on
`executeSelectPage` (the `__distinct`/`__groupBy` disjunct was already true; crossing
it with `__customization` is untested — `select.execute-count.test.ts` pins the wraps
with *no* customization; `customize-query.*` pins hooks on plain + compound only).
Probed: distinct × `beforeQuery`/`afterQuery` count = `with result_for_count as
(/*head*/ select distinct id as id from project order by id /*tail*/) select
count(*) ...`. Src: `SelectQueryBuilder.ts:819-848`. (SEL-SEAM + F-RECENT converge.)

**A-3. The Nullable-method family on the three BARE-BASE-interface leaves — `enum`, `custom`, `customComparable`.**
`enum`/`custom` columns are typed as the bare `EqualableValueSource`;
`customComparable` as the bare `ComparableValueSource`. Every *other* leaf overrides
the Nullable family, so the **base-interface redeclarations** of `valueWhenNull` /
`nullIfValue` / `asOptional` / `asRequiredInOptionalObject` / `onlyWhenOrNull` /
`ignoreWhenAsNull` (+ inherited `isNull`/`isNotNull`) at `values.ts:274-281`
(Equalable) and `:310-317` (Comparable) are reached by **no other leaf** and
exercised by **zero** tests — losing the brand-preserving return-type assertion
(a brand-dropping regression is caught only here). Found by **F1-EQCMP**;
*coordinator wide-grep confirmed* (`version|activity|channel|eventType` .{whole
Nullable family} = **0** across all of `test/db`; control `version.equals`=85 /
`version.lessThan`=68 present). Reachable via `tProjectRelease.version`/`.channel`,
`tIssueWorklog.activity`, `tWebhookEvent.eventType`. Add to
`select.value-source.null-and-if-value-modifiers.test.ts`, each with an
`assertType<Exact>` pinning the brand-preserving leaf return type
(`coalesce(version,$1)` / `nullif(activity,$1)` / optionality markers / `is null`).
Theme 1 (a leaf whose method family is fed into zero methods).

**A-4. Aggregate-element projection collapse — the gate-null drop and the sole-optional-inner collapse (both PROBED SOUND; lock the correct behavior).**
Found by **F3-PROJ**; both raised as soundness candidates and both **runtime-probed
by the coordinator and REFUTED as bugs** (type and value agree). They remain genuine
§A coverage gaps — the aggregate path's collapse behavior is unasserted:
- **A-4a — `aggregateAsArray` element whose `.asRequiredInOptionalObject()` gate is itself null.** The existing rule-1 aggregate test uses a never-null gate (`title`). Probed with a null gate (`tIssueLeft.body.asRequiredInOptionalObject()`): input element `{ref:null,assigneeId:1}` is **dropped** from the array → result `[{ref:'Kept',assigneeId:2}]`; type `Array<{ ref: string; assigneeId? }>` is SOUND (tsgo: `ref` is a required key, `@ts-expect-error` on the ref-omitted assignment satisfied). Add a test asserting the null-gate element is omitted.
- **A-4b — `aggregateAsArray` of a bare sole-optional-inner-object element.** Probed the all-null collapse: `wrapper` is **absent** on the collapsed element (`{iid:10}`) and **typed optional** (`{ iid: 1 }` assigns cleanly to the element type) — SOUND, mirroring the 143fe3b2 fix on the aggregate path. Add present + full-collapse cases in both projectors.

### Tier 2 — distinct overloads / per-type (existing fixtures)

**A-5. `dynamicBooleanExpressionUsing` arities 2–5** — tested only at arity-1 (268
single-arg calls; arities 2–5 appear only in the signature snapshot). Converged on
by **PARITY** and **F6-DYN**. The variadic impl is a no-op; the observable is the
type-level correlated-source union — a `dynamicBooleanExpressionUsing(t1,t2).and(cond
referencing both)` embedded in a correlated context emits SQL naming both tables.
Pair with its direct equivalent. `AbstractConnection.ts:1057-1062`.

**A-6. `subSelectUsing` (non-distinct) arities 3 and 4** — no positive runtime test
(arity-1/2/5 covered). Completes the arity ladder. `AbstractConnection.ts:439-440`.

**A-7. `selectOneColumn(<optional aggregate>).executeSelectMany()` → the `Array<T | null>` null element is never realized in the scalar-shortcut path.** (F9-TYPEVAR.)
`select.aggregation.test.ts` asserts the `Array<number | null>` type but its own
comment notes every group is non-empty; the null inhabitant is realized only via the
object-projector path, not the `selectOneColumn` scalar shortcut. Boundary:
`groupBy(projectId).selectOneColumn(max(assigneeId))` where a group's max is null →
`mockNext([2, null, 3])`, assert `Array<number|null>` **and** probe the null element.

### Tier 3 — completeness nits / low-confidence / dialect-specific

- **A-8 (F4-INSERT).** `returningOneColumn(<nullable column>)` on INSERT — the
  column-intrinsic `| null` never asserted (all calls use required columns). Near-degenerate.
- **A-9 (F4-INSERT).** MISSING_KEYS *reopening* a required column via
  `ignoreIfSet`/`keepOnly` — the additive arm; the non-reopening direction is tested.
  Type-tracking; a compile-repro + one runtime test.
- **A-10 (MUT-SEAM).** Three degenerate composition corners: `shapedAs(S).extendShape(E).dynamicSet()`
  no-arg opener on the where-required twin and on the allowing-no-where twin; DELETE
  `.using(j)` folding a using-joined column into a **nested** returning sub-object.
- **A-11 (F3-SELECT).** `orderBy(column, 'asc')` — the 13th of 13 `OrderByMode`
  values, never exercised through the mode-arg overload (`'desc'`=212, `'asc'`=0). The
  `asc` keyword *is* emitted by sibling modes; low behavioral risk. `select.order-by.variants.test.ts`.
- **A-12 (F9-TYPEVAR).** `select.scalar-min-max.test.ts` has zero `assertType`; the
  `minValue`/`maxValue` result leaf type is unasserted. Trivial completeness nit.
- **A-13 (F7-EXTRAS, cross-owner/dialect).** `UNSUPPORTED_QUERY` thrown from
  `MySqlSqlBuilder.ts:186/190` when `compatibilityVersion < 8_000_000` (MySQL <8.0
  compat) with a recursive CTE / `values(...)` in FROM — builder-reachable and
  compat-gated, but with **zero** behavioral coverage (the matrix sets no compat < 17M).
  Testable in the mysql cell via `new DBConnection(mock, 5_007_000)` without a new
  matrix cell. MySQL-dialect-specific (not symmetric) — flag for dedup with a
  version-work/dialect agent before filing.

---

## §B — in scope, needs a fixture addition

**B-1 (F1-EQCMP).** All `enum`/`custom`/`customComparable` columns are **required**.
A-3 is testable on required columns (the type-path + `coalesce`/`nullif` emission are
still exercised), but adding **one optional column of each kind** (e.g. an optional
`enum` on `tIssueWorklog`) would let `valueWhenNull`/`nullIfValue`/`isNull`/`isNotNull`
hit the real NULL branch for value-observability. Optional strengthening, not required.

No other §B: every other §A item closes with existing fixtures.

---

## §C — degenerate (listed, not dropped)

Named by the per-surface agents, all satisfying the full bar (shared dispatcher +
kind-string-only difference + provably-generic impl + representative already tested):

- **F2-VALVIEW:** ~72 absent (kind × Values/View × req/opt × virtual) cells — both
  impls pass `type` through one generic body; the sole per-kind observable (the
  VALUES-tuple cast) is pinned for all 18 kinds; View columns emit no cast.
- **F1-TEMP:** 7 optional-custom-`localDate`/`localTime` getter cells (no fixture
  column; `_getX` emission invariant across plain↔custom and req↔opt).
- **F1-NUM:** `number.nullIfValue(valueSource)` (const form + `valueWhenNull(VS)` +
  bigint/customInt `nullIfValue(VS)` cover it).
- **F1-CUSTOMNUM:** 5 groups (branded value-source overloads of subtract/multiply/
  min/max/power/roundn where the emission is proven on the non-branded leaf + brand
  on a literal).
- **F2-COL:** per-kind factory variants; custom-kind + trailing-adapter WRITE on a
  writable column (write transform byte-identical to the simple-kind+adapter path).
- **F1-STR / F1-BOOLIF / F3-SELECT / F4-INSERT:** the remaining per-type/per-flavor
  cells each with a same-dispatcher representative (enumerated in their inline reports).

---

## Coordinator verification notes (what I checked myself)

| Claim | Method | Verdict |
|---|---|---|
| CD-1 distinct-twin arity-5 reachable + `select distinct` emission | mock probe + tsgo | **Confirmed** reachable; emits `select distinct (...)` |
| CD-2 non-bracketing hooks on plain-page count | mock probe | **Render correctly** in count CTE — no drop/misplacement → clean §A, **no bug** |
| CD-2 metadata-only + `beforeWithQuery` count-wrap over-trigger | mock probe (+ no-customize control) | **Confirmed** asymmetry → CANDIDATE C-1 (both readings) |
| Nullable family absent on enum/custom/customComparable | operand-capturing wide-grep | **Confirmed 0** across matrix (control present) |
| PROJ gate-null aggregate element (A-4a) | mock probe + tsgo `@ts-expect-error` | **SOUND** (element dropped; `ref` required) → §A, **not a bug** |
| PROJ sole-optional-inner aggregate element (A-4b) | mock probe + tsgo assignment probe | **SOUND** (`wrapper` optional; absent on collapse) → §A, **not a bug** |
| 143fe3b2 sole-optional-inner fix positive arm | two agents (F9-TYPEVAR, F3-PROJ) + read | **Covered** for plain selects — NOT a gap |
| Variadic type-param wiring (9 overload families) | PARITY position-by-position diff | **Clean** post-CD-1 — no new asymmetry |
| 1b00764e compat<18 nested-old-values fix | MUT-SEAM + F4-UPDDEL read | **Runtime-tested** on oldest/pg — whack-a-mole class closed |

## Refuted / closed-on-sight (so the next round doesn't re-chase)

- **PROJ soundness candidates (A-4a/A-4b)** — REFUTED as bugs; both sound (type+value
  probed together, per the type-self-consistency≠runtime-soundness oracle). Survive
  only as §A coverage.
- **143fe3b2 positive arm** — NOT a gap (fully value-probed for plain selects at
  `select.complex-projection.inner-rules.test.ts`).
- **customInt `valueWhenNull<VALUE>`/`nullIfValue<VALUE>` SOURCE-union asymmetry**
  (`values.ts:603/605`) — closed on sight; phantom SOURCE, permanent `types.negative`
  territory, not §A/§B/BUGS.md (per runbook).
- **`update.ts:532` sqlite one-column returning stray `| NOldValuesFrom`** — closed on
  sight; inert type-text, sqlite-only, no Principle-#1 surface (cosmetic src cleanup at most).
- **Cosmetic internal typo** `CustomizableExecutableMultipleInsertOnConfict`
  (`insert.ts:109/…`, "Confict"→"Conflict") — internal fluent name, never imported by
  users; not a type-vs-impl bug. Cosmetic only.
- **`oldValues()` + join on MySQL/MariaDB** (MUT-SEAM out-of-scope note) — a *speculative*
  cross-dialect emission concern (`_buildUpdateFrom` splicing) outside the PG reference
  cell; typed `never` on PG. Deferred as a possible docker/dialect probe, not a PG-cell
  finding, not chased.

## Per-surface saturation summary

| Agent | §A | Note |
|---|---|---|
| **PARITY** | A-1, A-5(≙A-6) | variadic wiring clean; update.ts:532 OUT; cosmetic typo |
| **F-RECENT** | A-1, A-2, A-6 | CD-1/CD-2 tail arms; C-1 candidate |
| **SEL-SEAM** | A-2 | C-1a/C-1b candidates |
| **MUT-SEAM** | A-10 | 0 defects; 1b00764e confirmed; MySQL join note deferred |
| **F9-TYPEVAR** | A-7, A-12 | 0 soundness bugs; 143fe3b2 covered |
| **F1-EQCMP** | A-3 | Nullable family on bare-base leaves; §B-1 |
| **F3-PROJ** | A-4 | both probed SOUND |
| **F4-INSERT** | A-8, A-9 | low-confidence; 0 defects |
| **F6-DYN** | A-5 | dynamic core SATURATED |
| **F3-SELECT** | A-11 | select core SATURATED |
| **F7-EXTRAS** | A-13 | extras/adapters/errors/config SATURATED |
| **F5-CONN** | — | **SATURATED (0/0)** value-level |
| **F4-UPDDEL** | — | **SATURATED (0/0/0)** |
| **F1-TEMP** | — | **SATURATED (0/0)** |
| **F2-COL** | — | **SATURATED (0/0)** |
| **F1-CUSTOMNUM** | — | **SATURATED (0/0)** |
| **F1-BOOLIF** | — | **SATURATED (0/0)** |
| **F1-STR** | — | **SATURATED (0/0)** |
| **F2-VALVIEW** | — | **SATURATED (0/0)** |
| **F1-NUM** | — | **SATURATED (0/0)** |

## Recommended implementation order

1. **A-1** — `subSelectDistinctUsing` arity-5 (+2/3/4) positive tests. The marquee
   freshly-changed-surface positive arm; direct twin of the shipped CD-1 lock.
2. **A-2 / A-2b** — CD-2 count-wrap tail arms (non-bracketing hooks on plain-page;
   distinct/grouped × customize on page). Same fresh surface; probed to render correctly.
3. **A-3** — Nullable family on enum/custom/customComparable bare-base leaves
   (brand-preserving; theme 1). Optionally with **B-1**.
4. **A-4a/A-4b** — aggregate-element gate-collapse + sole-optional-inner (lock the
   probed-sound behavior; guards the 143fe3b2 class on the aggregate path).
5. **A-5, A-6, A-7** — dynamicBooleanExpressionUsing / subSelectUsing arities;
   optional-aggregate scalar null.
6. **Tier 3** (A-8…A-13) as completeness fill; **A-13** only after dedup with a
   version-work agent.
7. **C-1** — await the maintainer's semantics decision on the CD-2 over-trigger
   before writing either a pin-the-behavior test or a narrowed-guard test.

## Verdict

An honest mature round: **14 surfaces saturated, 0 confirmed bugs, ~10 clean §A
composition/edge tests** (concentrated on the freshly-changed CD-1/CD-2 surface's
positive/tail arms plus two genuine per-surface holes), one §B fixture suggestion,
and one maintainer-decision candidate (the CD-2 `|| this.__customization`
over-trigger). The two projection **soundness** candidates the critics surfaced were
probed and cleared — exactly the "critics clear their own suspected defects by
probing" shape the runbook describes for a high-maturity round. The variadic wiring is
clean post-CD-1, the 1b00764e nested-old-values fix is genuinely runtime-tested, and
the 143fe3b2 sole-optional-inner fix's positive arm is value-probed for plain selects
(its untested residue is only the aggregate path, A-4). Nothing was manufactured to
"produce" a bug.
