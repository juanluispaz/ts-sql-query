# Missing-tests audit — ROUND 19

> Type-driven, multi-agent. Discovery = RAW READING of `src/` **types** only.
> UNIT = the **type-path**. COVERED ⇔ a test asserts the distinction via emitted
> SQL+params and/or `assertType<Exact>` and/or the runtime VALUE. Reference cell
> `postgres/newest/pg/`; matrix symmetric. Degeneracy bar = **narrow** (a distinct
> reachable overload/interface/per-receiver-method/arity/input-classification is a
> GAP even when its output coincides). Scope: §A existing fixtures · §B needs a
> fixture · OUT (new cell / negatives / `queryRunners` / as-any / driver-layer /
> pure compile-only-no-value).

## Mandate & method

Continuation of the maximalist passes. The prior round's findings were
implemented (BUGS.md was clean at start; the suite grew **+94 tests/cell** to
1908/cell across 231 files) and several corrections landed. This round
**re-derived all coverage FRESH** (inherited no verdict) and pushed to the next
layer. **17 surfaces** fanned out in two waves at **≤10 agents concurrent** (the
raised limit), led by the theme-10 structural parity sweep. Every load-bearing
claim was coordinator-verified (tsgo compile-repro for reachability/type; a
**runtime SQL probe** for the emission bug; wide-grep for absence). All probes
deleted; tree clean.

### Pre-flight

- `bun run tests:audit` → **17 cells, 231 files, 1908 tests/cell (32 436 total),
  symmetric, 0 problems.**
- `bun run tests:index` refreshed. Domain re-read — the prior round's §B fixtures
  all landed and are exercised: `scaledArgThresholdFragment` (arg+adapter),
  `withMinIdFilter` (P1 customization), `tProjectRelease.publishedAt` (required
  customLocalDateTime), `vReleaseOverview.versionBracketed`/`cutoffClock` (View
  adapter + customLocalTime), `tAuditEntry.id` (seq-PK adapter).
- BUGS.md empty at start; **this round files one verified divergence (BUG-1).**

## Headline

| Bucket | Count |
|---|---|
| **Confirmed `src/` divergence (→ BUGS.md, verified by runtime probe)** | **1** (BUG-1) |
| Tier-1 gaps (distinct code-path / seam / classification / bug-class family) | ~9 clusters |
| Tier-2 gaps (distinct overloads / per-type / next-layer) | ~9 clusters |
| Tier-3 gaps (§B fixtures / mechanical / low-value) | ~6 clusters |
| **Genuinely SATURATED surfaces (0/0, re-verified fresh)** | **CONN, F1-STR, F1-CUSTOMNUM, F6-DYN** + barrel 28/28 |
| PARITY structural defects | **0** (4 candidates chased to the runtime oracle, all sound-by-design) |

---

## BUG-1 — `customizeQuery` hooks silently dropped / mislanded on a recursive-union SELECT (CONFIRMED → BUGS.md)

**Found by:** the F8-META seam critic (customizeQuery × recursive-CTE).
**Verified by:** coordinator **runtime SQL probe** on the PG reference cell (mock;
emitted SQL captured, probe deleted). **Where:** the `with recursive …` emission
path vs `customizeQuery` hook rendering.

`customizeQuery({...})` is typed & callable both before `.recursiveUnion*(...)`
(on the anchor) and after it (on the recursive expression), but the impl does not
render the CTE-level hooks the way the non-recursive `forUseInQueryAs` CTE path
does:

- **Post-recursive** `…select({...}).recursiveUnionAll(fn).customizeQuery({beforeQuery, afterQuery, beforeWithQuery, afterWithQuery})` →
  `with recursive recursive_select_1 as (/*BQ*/ select …anchor… where id = $2 /*AQ*/ union all …) select …` —
  `beforeQuery`/`afterQuery` land **inside** the CTE body wrapping only the anchor
  member (violating `beforeQuery`'s documented "before any other SQL"), and
  `beforeWithQuery`/`afterWithQuery` are **silently dropped**.
- **Anchor-side** `…customizeQuery({beforeWithQuery, afterWithQuery}).recursiveUnionAll(fn)` →
  SQL identical to plain recursive — both hooks silently dropped.

Contrast the non-recursive CTE, which honors them
(`customize-query.select.test.ts:customize-select-before-with-query-and-after-with-query-wrap-cte`):
`with x as /* warmup */ (…) /* end-of-with */ …`. So **TS accepts `customizeQuery`
hooks on a recursive select that the impl ignores or mislands** — a "TS accepts
what the impl doesn't deliver" divergence. Filed in [`BUGS.md`](./BUGS.md). The
missing-TEST (once resolved) is the composed `customizeQuery × recursiveUnion*`
path with a `// TODO[BUG]` until the fix lands.

---

## Tier 1 — distinct code-path / seam / classification / bug-class (highest value, mostly existing fixtures)

### T1-a — round-14 promotion-dispatcher family completeness: `int.subtract(double-column)` (§A)
Every member of the overloaded-number promotion dispatcher
(`add/multiply/modulo/minValue/maxValue`) has its int-receiver + **double-column**
operand (promotion-to-double) arm tested — **`subtract` is the single omission.**
`tIssue.priority.subtract(tIssue.estimatedHours)` → `priority - estimated_hours`
carried as double, `?: number` leaf, fraction surviving. This is the exact unit
that surfaced the round-14 modulo bug; the family should be complete. *Source: F1-NUM A1.*

### T1-b — projection rule-INTERACTION shapes, both projectors (§A, theme 5 — compile-verified)
The four projection rules × plain/nested/aggregate-element/compound are each
covered; the gaps are **rule interactions** the agent compile-verified:
- **A1** three optionality-kinds coexisting under rule-1 in ONE flat object
  (own-required + requiredInOptionalObject + originallyRequired-left-join) — the
  only place the reqInOptObj-vs-originallyRequired **demotion divergence** is
  observable in a single object: default `meta?: { ownId: number; gate: string; projName: string | undefined }` / nullable `… projName: string | null } | null`.
- **A2** rule-3 REQUIRED outer object CONTAINING a rule-4 all-optional INNER
  object (inner-container demotion while outer stays required).
- **A3** `dynamicPick` with a WHOLE nested-object key in the mandatory list
  (`MANDATORY_PARENT` propagation keeps the entire inner object required).
- **B1** aggregate element containing a nested rule-1 (requiredInOptionalObject)
  inner object (existing fixtures suffice — likely §A). *Source: F3-PROJ A1–A3, B1.*

### T1-c — shaped UPDATE `setIfNotSetIfValueWhen`: the ONE shaped `*When` arm with zero coverage (§A)
Of the 15 shaped `*When` arms, 14 have a false/true dispatch test;
`setIfNotSetIfValueWhen` under an active shape has **0** hits (its unshaped twin
and its shaped non-When form are covered). The double-gate composed-remap under a
shape is exactly the copy-paste-prone surface. *Source: UPDDEL A1.*

### T1-d — compound interface's own overload subset: chained `intersectAll`/`exceptAll`/`minus` (§A, theme 6)
`CompoundedExecutableSelectExpression` re-declares its own set-op overloads. The
chained UNION pair and `except`/`minusAll`/`intersect`-after-compound are now
covered; the remaining three arms reached *through the compounded interface*
(`a.union(b).intersectAll(c)`, `.exceptAll(c)`, `.minus(c)`) are untested. PG
supports all. *Source: F3-SELECT A1.*

### T1-e — the two NEW required custom-temporal columns have ZERO method coverage (§A) — absence wide-grep-verified
`tProjectRelease.publishedAt` (required customLocalDateTime) and
`tProjectReview.reviewTime` (required localTime) are only **raw-read /
type-asserted** — coordinator wide-grep confirmed **zero** getter or
equality/comparison usage on either. Two distinct, high-value units:
- **temporal getters** on `publishedAt` — all 9 required-custom-localDateTime
  getters (the required twin of the covered optional `signedOffAt`); *F1-TEMP A1.*
- **Equalable/Comparable** surface on `publishedAt` + `reviewTime` (equals/is/
  between/single-bound/in) on a **required** custom-temporal / localTime receiver;
  *EQCMP A7.*

### T1-f — INSERT on-conflict CONTINUATION seams (§A)
The prior round's multi-row-targeted-conflict and shaped-multi-row-conflict seams
are now covered; the next layer is the RETURNING/IfValue **continuations** of the
already-covered openers:
- **A1** `onConflictOn(cols).doUpdateSet({...}).where(cond).returning({...})` — the
  partial-UPDATE-WHERE node still carries the full RETURNING surface; never asserted.
- **A2** multi-row × targeted on-conflict × **returning-OBJECT** / `returningOneColumn`
  (today only `returningLastInsertedId` on that path).
- **A3** `onConflictOnConstraint(...).doUpdateSetIfValue({...})` / `.doUpdateDynamicSet(...)`
  (the IfValue/dynamic-set arms reached only through the column-target opener today).
*Source: INSERT A1–A3.*

### T1-g — composition seams beyond the prior round (§A, theme 8)
- **CTE(`forUseInQueryAs`) × per-column `TypeAdapter` read round-trip** — no CTE
  test re-projects a value-transforming adapter column (`score`÷10, `reviewerCode`
  `[...]`) and asserts the transformed value; the CTE-brand test uses a
  `custom`-marshalled column, not a value-transforming adapter. *F8-META A2.*
- **`withMinIdFilter` (parameterized customization) composed beyond a plain `.as()`
  selectFrom** — used in exactly one place; the bound param's ordering as a
  leftJoin target / inside a compound arm / as update|delete target is unproven
  (compile-verified reachable). *F8-META A3.*
- **aggregate-as-array (left-join, grouped) INSIDE a compound arm** (union of two
  aggregate-array-carrying selects) — the top-level compound re-projector merging
  array-typed columns is untested (distinct from the covered inverse). *F8-META A4.*
- **shaped × from × returning** three-way UPDATE seam (each pairwise cross exists;
  the three-way never). *UPDDEL A2.*

---

## Tier 2 — distinct overloads / per-type / next-layer

### T2-a — direct-fluent equality/comparison: the value-marshalled & value-source-operand next layer (§A)
The prior round CLOSED the const-operand + subquery surface across all 18 leaves
(re-verified saturated). The next layer, richest first:
- **A4 — `*IfValue` twins on non-int/non-string leaves** (the richest vein):
  `is/isNotIfValue` (distinct `is not distinct from` + skip-on-undefined branch),
  `notEquals/notInIfValue`, and the ordered `*IfValue` (`lessThanIfValue`…) on
  temporal/uuid/numeric-non-int leaves. Pair each with its direct equivalent.
- **A6 — mixed variadic `inN(const, column)`** — the const+value-source spread
  overload, untested on ANY leaf (distinct `MergeOptional` result + mixed emission).
- **A3 — ordered value-source-column operand + the three `between` mixed overloads**
  beyond int/customLocalDate (at least one more Comparable leaf gets all three
  `between(TYPE,VAL)/(VAL,TYPE)/(VAL,VAL)` arms).
- **A1 — `isNull`/`isNotNull` on the 6 optional non-int/string leaves** (bigint
  `durationMs`, localTime `startedAt`, double `estimatedHours`, uuid `externalRef`,
  customUuid `signingKey`, customLocalDateTime `signedOffAt`) — VALUE-validatable
  via existing NULL rows.
- Micro-gaps the round-18 files left: `bigint.durationMs` ordered-const single
  bounds; `string.title` `is`/`isNot` const. *Source: EQCMP A1/A3/A4/A6 + micro.*

### T2-b — temporal getters on newly-reachable receiver classes (§A)
Beyond T1-e's `publishedAt` getters: **View custom-localTime getters** via
`vReleaseOverview.cutoffClock` (the only View temporal-getter path with a fixture),
**custom-source `.asOptional()` getter** (`releasedOn.asOptional().getFullYear()`
— the custom-source optional-getter arm), and **View plain-localDateTime getters**
via `vProjectOverview.archivedAt`. *Source: F1-TEMP A2–A4.*

### T2-c — `IfValueSource.and(IfValueSource)` both-values-present (§A)
The `.or(IfValue)`-both-fire (stays-If) case is covered; the `.and(IfValue)`
both-fire twin (`_and` vs `_or` — distinct SQL + parenthesization) is not.
*Source: F1-BOOLIF A1.*

### T2-d — compound `orderBy(column, OrderByMode)` simple modes (§A)
The compound `orderBy(column, mode)` enum overload is exercised only with
`'asc insensitive'` (wrapping); the simple modes (`'desc'`, `'asc nulls first/last'`,
`'desc nulls first/last'`) render inline through the compound and are untested
(distinct from the covered `orderByFromStringArray` string-parser path).
*Source: F3-SELECT A2.*

### T2-e — the `updateAllowingNoWhere(t).from(t2)` AllowingNoWhere-from twin (§B — small)
Present, type-correct, and unexercised — the one limb of the AllowingNoWhere
join/from/using twin quartet left untested (the DELETE analog
`deleteAllowingNoWhereFrom().using()` is covered). Add a no-WHERE `UPDATE … FROM`
asserting SQL+params+affected-rows. *Source: PARITY B1.*

---

## Tier 3 — §B fixtures / mechanical / low-value

- **T3-a — `computedColumn` / `optionalComputedColumn` trailing-`TypeAdapter` (§B).**
  No computed column in any dialect carries an adapter; the read-transform on a
  DB-computed column is distinct from the fragment-based `activityTagged` path.
  Add `computedColumn('...','string', bracketAdapter)` (+ optional twin) to
  `tProjectRelease.notes`/`tIssueWorklog.activityLabel`'s table. *Source: F2-COL B1.*
- **T3-b — Values per-column `TypeAdapter`-object branch (§B, no domain change).**
  Every `Values` subclass passes a bare type or a typeName string; the
  adapter-object arm of `Values.column(type, adapter)` (read + VALUES-tuple write,
  observable with `scaledTenthAdapter`) is never exercised — the Values-side twin
  of View's `versionBracketed`. Declarable inline in a new test. *Source: F2-VALVIEW B1.*
- **T3-c — degeneracy-eligible EQCMP representatives** (one leaf each, LIST): A2
  value-source-operand `equals`/`notEquals` on a non-int/string leaf; A5 `notInN`
  on one non-int leaf; A8 `is`-value-source-operand on enum/custom/customUuid.
- **T3-d — F7-EXTRAS type-edges (§B, low value):** `SelectedRowProjectedAsNullable`/
  `…ValuesProjectedAsNullable` non-`ITable` (column-bag) else-arm; `fromRef`
  left-join overload selection. Both borderline-degenerate.
- **T3-e — INSERT A4/B1:** `defaultValues().onConflict…/.returning({...})` continuation
  — reachable but only **mock-validatable** without a defaults-only real table
  (per-dialect schema ripple); close as mock-only-degenerate unless judged high value.
- **T3-f — F2-COL B2:** a View required `virtualColumnFromFragment` + adapter
  (near-degenerate with the Table `activityTagged` coverage — listed).

---

## Saturated surfaces (re-verified 0/0 this round — valid outcome)

- **CONN** — both prior fixtures exercised (P2 customization landed in the docs
  cell); `executeFunction` extra return-kinds and P3–P5 customization arities are
  degenerate-by-shared-dispatcher. 0 gaps.
- **F1-STR** — every predicate × operand-kind × receiver × IfValue fire/elide,
  transforms, concat/substr/substring/replaceAll full overload sets; adapter
  re-bracket value-asserted. 0 gaps.
- **F1-CUSTOMNUM** — every method × {const, value-source} × {required,
  synthetic-optional} + brand keep/erase (`sign()` erase value-asserted); round-14
  `mod(…::numeric)` fix pinned in BOTH const+VS arms. 0 gaps.
- **F6-DYN** — 55 operator keys × 18 descriptor branches × VSM arms × base/IfValue,
  pick/orderBy-model/from-model/extension/errors; every dynamic path paired with
  its direct equivalent. 0 gaps.
- **`src/index.ts` barrel** — 28/28 cross-database symbols imported AND invoked.

---

## Coordinator verification notes

1. **BUG-1 (customizeQuery × recursiveUnion)** — wrote a runtime probe test
   building both the anchor-side and post-recursive compositions, ran it, captured
   the emitted SQL: `beforeWithQuery`/`afterWithQuery` dropped in both positions,
   `beforeQuery`/`afterQuery` mislanded inside the CTE body around the anchor
   member. Contrast pinned against the working `forUseInQueryAs` CTE snapshot.
   Probe deleted; tree clean. Filed in BUGS.md.
2. **T1-e absence (publishedAt / reviewTime)** — wide-grep confirmed both columns
   are raw-read / type-asserted only; **zero** getter or eq/cmp method calls. Both
   the EQCMP and F1-TEMP claims hold.
3. **F3-PROJ A1/A2/A3** — the agent compile-repro'd each predicted result-shape
   against the real domain (temp files deleted); container-optional vs leaf-required
   distinctions verified precise (no round-15-style refutation).
4. **PARITY candidates (4)** — each chased to the runtime-delegation oracle
   (`xWhen(true)≡x`): `disallowIfNoValueWhen` and `ignoreIfSetWhen` fold
   `MISSING_KEYS` **conservatively-safe** (the When form cannot narrow because
   `when` may be false), NOT defects; the prior-round `keepOnlyWhen` fix confirmed
   holding across all 6 twin pairs.
5. **Refuted / inert (so next round doesn't re-chase):**
   - **UPDDEL CD1** — the sqlite `ReturningOneColumnFnType` old-values fold
     asymmetry is **inert**: `oldValues()` is typed `never` on `SqliteConnection`,
     so no usable old-values column can reach either arm. Cosmetic, unreachable,
     no test would catch it. NOT a bug.
   - **F7-EXTRAS `UNKNOWN_DATA_TYPE`** — SQLite-only, reachable only via an
     `as any` cast + private-hook stub (same tier as the intentionally-disabled
     `NO_PRIMARY_KEY_FOUND`). OUT.
   - **`projectingOptionalValuesAsNullable × compound`** public path is typed-`never`
     and correctly parked with a `TODO[BUG]` marker — not re-flagged.

## §B fixture-addition plan (small)

| # | Fixture | Closes |
|---|---|---|
| B-1 | `computedColumn('...','string', bracketAdapter)` + optional twin on an existing computed-bearing table | T3-a |
| B-2 | (inline in a test, no domain change) a `Values` subclass with `column('int', scaledTenthAdapter)` | T3-b |
| B-3 | (optional) a `updateAllowingNoWhere().from()` case — no fixture, existing tables | T2-e |

Everything in Tier 1, most of Tier 2, and the EQCMP/temporal/boolean gaps are §A —
closeable on existing cells with existing fixtures (incl. the new `publishedAt`/
`reviewTime`/`cutoffClock`/`versionBracketed` columns, which currently have only
raw-read coverage).

## Recommended implementation order

1. **BUG-1 resolution** (a `src/` decision by the fixing agent: render the hooks
   consistently, or narrow the recursive-select typed surface) + its composed test
   with `// TODO[BUG]`.
2. **Tier 1 on existing fixtures** — T1-a (subtract promotion; completes the
   round-14 family), T1-b (projection rule-interactions ×2 projectors), T1-e
   (publishedAt/reviewTime getters + eq/cmp — new columns, zero coverage), T1-c
   (shaped `setIfNotSetIfValueWhen`), T1-d (chained compound set-ops), T1-f
   (on-conflict continuations), T1-g (composition seams).
3. **Tier 2** — T2-a (the `*IfValue`/mixed-variadic/ordered-V-operand/isNull vein;
   large but cheap), T2-b (temporal getters), T2-c/T2-d.
4. **§B fixtures** (B-1, B-2) then their tests; Tier-3 mop-up.

## Verdict

**Not saturated — the method is still paying off.** Four whole surfaces (CONN,
string, custom-numeric, dynamic-conditions) and the barrel came back genuinely
0/0, confirming the mature areas. But the round's primary value is again a
**verified `src/` divergence** — BUG-1, `customizeQuery` hooks dropped/mislanded
on a recursive-union select, caught by the seam critic and reproduced by a runtime
SQL probe — plus a **generous** next-layer gap list clustered exactly on the
runbook themes: the round-14 promotion-family completion (T1-a), projection
rule-**interaction** boundaries (T1-b), the newly-added-but-unexercised required
custom-temporal columns (T1-e), the shaped `*When` straggler (T1-c), the
compound-overload subset (T1-d), the on-conflict/CTE/customization **composition
seams** (T1-f/T1-g), and the direct-fluent `*IfValue`/value-source-operand vein
(T2-a). All findings are §A or have a small concrete §B; none were silently
truncated.
