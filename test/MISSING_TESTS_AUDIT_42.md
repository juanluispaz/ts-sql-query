# Missing-tests audit — Round 42

**Mandate.** Type-driven, maximal, multi-agent audit of the `ts-sql-query` typed
surface: find every test the TYPE DEFINITIONS imply but the `test/` matrix lacks,
drive toward saturation. Unit = the *type-path* (each overload / per-receiver
method / arity / kind / return-branch / input-classification). COVERED ⇔ a test
pins the exact distinction via emitted SQL+params and/or `assertType<Exact>`
and/or the realized VALUE (a `|null` / `|undefined` / absent-key / branded
round-trip must be realized). **This report is an EXHAUSTIVE, ITEM-BY-ITEM
implementation backlog — every test is its own line item, never a themed count.**

**Method.** 20 read-only discovery agents (16 per-surface + F-RECENT + F9-TYPEVAR
+ the two seam critics MUT-SEAM / SEL-SEAM + PARITY), ≤10 concurrent, each
raw-reading its `src/` slice and grepping the CURRENT test files. Every
load-bearing claim coordinator-verified (compile-repro / mock-probe /
source-read); all repros deleted, tree clean.

**Matrix at run.** 17 cells · 245 files · **2965 tests/cell** · `tests:audit`
symmetric, 0 problems. `BUGS.md` clean at start and at end.

**Headline. 0 confirmed `src/` bugs — a clean saturation round.** The one src
commit since Round 41 (`593a0a4f`, which fixed the two R41 bugs) is **sound and
complete**: the inline nullable path now uses the plain
`ResultObjectValuesProjectedAsNullable` (matching its non-dropping runtime), and
`__combineSubSelectUsing` propagates `__projectOptionalValuesAsNullable` to the
compound builder (matching the marker-preserving type). The five-round "bug lives
in the residual of the prior fix" streak **did not recur**; the fix hit the root
(a shared result-type reused across a dropping-vs-non-dropping runtime; a flag
copied to the recursive clone but not the compound one), not the symptom. Three
independent seam critics (F-RECENT, SEL-SEAM, F3-PROJ) each cleared their suspected
defects by trace + the coordinator's probes. **18 of 20 discovery surfaces
returned SATURATED.** The value of the round is a genuine-but-**sound** §A/§B
completeness tail — enumerated in full below (**42 discrete tests + 1 §B fixture
family**).

---

## Part I — Confirmed bugs, candidates, limitations

### Confirmed `src/` bugs — NONE

The three highest-risk candidates (all the "type-vs-runtime at a projection
boundary" class that produced the last three bugs) were **coordinator-probed and
found SOUND** (Part V) — they are §A coverage gaps, not defects.

### Candidates presented with both readings — NONE survived

Every seam critic cleared its own suspected defects. F-RECENT's baked-in-bug scan
of the R41 backlog (36 inline tests + the compound/wrap/recursive regression tests
+ STR-BSLASH) came back **CLEAN** — no `expected`/`toEqual` contradicts its own
`assertType`.

### Type-only / inert observation → OUT src-cleanliness note (not a bug, not a test)

- **`update.ts:532` sqlite `ReturningOneColumnFnType` has a top-level `| NOldValuesFrom<TABLE[typeof source]>` union member** (outside `ValueSourceOf<…>`), unlike its multi-column sibling `ReturningFnType` (no `NOldValues`), the delete.ts sqlite twin (no `NOldValues`), and its own non-sqlite branch (`NOldValues` nested *inside* `ValueSourceOf`). Flagged independently by F4-UPDDEL and PARITY. **INERT / untestable:** `NOldValuesFrom` is a source-*name* phantom, not a value source, so no real column argument inhabits that union member — sqlite `returningOneColumn(oldValues().col)` is still rejected (consistent with SQLite RETURNING seeing only the new row), producing no observable SQL/type/value difference. Matches the known intentional pending-SQLite-OLD scaffolding. Both readings (stray member to delete, vs. intentional-but-mis-nested) leave nothing to test → a src tidy-up decision for the owner, OUT of test scope.

### By-design limitations re-confirmed (do NOT file)

- **Custom-temporal CONST getters** (`const(v,'customLocalDate','ReleaseDay').getMonth()` → bare `extract(month from $1)`, PG-rejected) — user's `transformPlaceholder` responsibility, not real-DB-validatable → LIMITATION (F1-TEMP B-1).
- **`disallowIfNoValueWhen` returning `MISSING_KEYS` unchanged** — correct-by-design; UPDATE has no MISSING_KEYS param at all (F4-UPDDEL). Not re-filed.

---

## Part II — The enumerated backlog (every test = one line item)

Reference cell `test/db/postgres/newest/pg/`; every item propagates to all 17
symmetric cells unless a per-dialect note says otherwise. Tiers: **T1** distinct
code-path/bug-class · **T2** distinct overload/emission/seam · **T3** per-variant
completeness (may be §B) · **T4** output-coincident completeness fan-out (listed,
representative may suffice — but named so the next round doesn't re-discover it).

### Surface SEL-A — inline-query-value NULL inhabitant (highest value; F9-TYPEVAR A-1)

Every `forUseAsInlineQueryValue()` optional-leaf test types the leaf `prop?: T`
(optional *because a scalar subquery may return zero rows*) but realizes only the
PRESENT arm — the empty-subquery NULL is never realized anywhere in the matrix
(grep-confirmed: PG cell has zero inline-query-value null realizations). Fixture:
`subSelectUsing(tIssue).from(tIssueWorklog).where(wl.issueId.equals(tIssue.id).and(
wl.activity.equals('coding'))).selectOneColumn(wl.minutes).forUseAsInlineQueryValue()`
→ present (90) for the issue with a `'coding'` worklog, **zero rows → NULL** for the
others. Both coordinator-probed SOUND (Part V). File in `select.subquery-shapes.test.ts`.

1. **SEL-INLINEQV-NULL-DEFAULT · T1** — default projector. Assert `Exact<…,
   Array<{ id: number; m?: number }>>` + `'m' in emptyRow === false` (leaf absent) +
   present (90) for the coding row.
2. **SEL-INLINEQV-NULL-ASNULLABLE · T2** — `.projectingOptionalValuesAsNullable()`
   on the OUTER select. Assert `Exact<…, Array<{ id: number; m: number | null }>>` +
   `'m' in emptyRow === true` + `emptyRow.m === null`.

### Surface SEL-B — compound-inline-aggregate × nullable on the R41 discriminating axis (SEL-SEAM A3)

The sole compound-inline-nullable test (`inline-aggregate-of-compound-union-projecting-optionals-as-nullable`,
`select.aggregate-as-array-inline-wrapped.test.ts:977`) uses a rule-3 `body` leaf,
which does NOT discriminate the plain type (`T | null`) from `…ForAggregatedArray`
(`T`) — the exact R41 bug axis. Both use existing fixtures (`tOrganization`,
`tIssue`, `tProject.forUseInLeftJoin()`). File in `select.aggregate-as-array-inline-wrapped.test.ts`.

3. **SEL-COMPOUND-INLINE-NULL-RULE2 · T2** — `subSelectUsing(X).from(Y).leftJoin(P)
   .on(…).select({ projName: P.name }).projectingOptionalValuesAsNullable().union(
   <same arm>).forUseAsInlineAggregatedArrayValue()`, join-miss element. **Coordinator-
   probed SOUND** (Part V): type `Array<{ projName: string | null }>`, runtime present-
   `null`. Assert both.
4. **SEL-COMPOUND-INLINE-NULL-RULE1 · T2** — same composition with a rule-1
   `tIssue.body.asRequiredInOptionalObject()` gate element-top leaf on both arms.
   Traced sound (same `ColumnsForCompound` brand-preservation mechanism as #3).
   Assert the plain shape fires (`ref: string` gate + optional sibling → `| null`),
   runtime gate-null still drops the element.

### Surface SEL-C — three-arm compound flag second-hop propagation (SEL-SEAM A2)

`a.union(b).union(c)` with `.projectingOptionalValuesAsNullable()` on the arms
exercises a DISTINCT path the two-arm tests can't: the 2nd `union`'s
`__combineSubSelectUsing` reads `this` = the first `CompoundSelectQueryBuilder`
(compound→compound hop; only the first hop is proven today). Traced type- and
runtime-sound. All three arms need the flag to type-check. File in `select.compound-optional-as-nullable.test.ts`.

5. **SEL-COMPOUND-3ARM-NULL-EXEC · T2** — three-arm, `executeSelectMany` rows path,
   optional leaf → present-`null` on the null row.
6. **SEL-COMPOUND-3ARM-NULL-INLINE · T2** — three-arm, consumed via
   `forUseAsInlineAggregatedArrayValue()`, element leaf → present-`null`.

### Surface SEL-D — before-op flag × non-`union` compound ops (SEL-SEAM A1 / F-RECENT §A-1,§A-2)

All route through the same `__combineSubSelectUsing`; only the compound keyword
differs (value-identical). **T4 output-coincident regression guards** — listed one
per (op × path) so the set is explicit; a representative (e.g. `except`) may suffice
in practice. Mind per-dialect availability (already gated in `select.compound*.test.ts`:
`intersect`/`except` on more dialects, `intersectAll`/`exceptAll`/`minus`/`minusAll`
narrower). Each: before-op `.projectingOptionalValuesAsNullable()` + an optional leaf
→ present-`null`.

Execute-rows path (F-RECENT §A-1):
7. **SEL-COMPOUND-UNIONALL-NULL-EXEC · T4**
8. **SEL-COMPOUND-INTERSECT-NULL-EXEC · T4**
9. **SEL-COMPOUND-INTERSECTALL-NULL-EXEC · T4**
10. **SEL-COMPOUND-EXCEPT-NULL-EXEC · T4**
11. **SEL-COMPOUND-EXCEPTALL-NULL-EXEC · T4**
12. **SEL-COMPOUND-MINUS-NULL-EXEC · T4**
13. **SEL-COMPOUND-MINUSALL-NULL-EXEC · T4**

Inline-aggregate path (F-RECENT §A-2):
14. **SEL-COMPOUND-UNIONALL-NULL-INLINE · T4**
15. **SEL-COMPOUND-INTERSECT-NULL-INLINE · T4**
16. **SEL-COMPOUND-INTERSECTALL-NULL-INLINE · T4**
17. **SEL-COMPOUND-EXCEPT-NULL-INLINE · T4**
18. **SEL-COMPOUND-EXCEPTALL-NULL-INLINE · T4**
19. **SEL-COMPOUND-MINUS-NULL-INLINE · T4**
20. **SEL-COMPOUND-MINUSALL-NULL-INLINE · T4**

### Surface SEL-E — recursive-dedup (`union`) variants × flag (F-RECENT §A-3)

Only `recursiveUnionAllOn` is currently flag-tested; the dedup (`union`) recursive
methods `recursiveUnion` / `recursiveUnionOn` build via the same `__buildRecursive`
and differ from the `All` forms only by `union` vs `union all` SQL. **T4 output-
coincident** (grep-confirmed: no dedup-recursive + nullable pairing). File in
`cte.recursive-union-variants.test.ts`.

21. **SEL-RECURSIVE-UNION-NULL-EXEC · T4** — `.projectingOptionalValuesAsNullable()
    .recursiveUnion(fn)`, execute-rows, optional leaf → present-`null`.
22. **SEL-RECURSIVE-UNION-NULL-INLINE · T4** — same, inline-aggregate consumption.
23. **SEL-RECURSIVE-UNIONON-NULL-EXEC · T4** — `recursiveUnionOn(fn)` + flag, execute-rows.
24. **SEL-RECURSIVE-UNIONON-NULL-INLINE · T4** — same, inline-aggregate consumption.

### Surface MUT-A — mutation RETURNING × rule-1 gate drop (MUT-SEAM §A-2)

`asRequiredInOptionalObject` is ABSENT from every mutation test file (grep-confirmed);
the rule-1 drop-despite-value-bearing-sibling is exercised only on the SELECT side.
No join needed. Shape: `returning({ id, meta: { sibling: t.slug, gate:
t.archivedAt.asRequiredInOptionalObject() } })`, gate column null → `meta` drops.
Default projector coordinator-probed SOUND on update (Part V). Files:
`update.returning.test.ts` / `delete.returning.test.ts` / `insert.returning.test.ts`.

25. **MUT-RET-RULE1-UPDATE-DEFAULT · T2** — `update(t)…returning(…)`. Type
    `meta?: { sibling: string; gate: Date }`; runtime `meta` absent (`'meta' in row === false`).
26. **MUT-RET-RULE1-UPDATE-ASNULLABLE · T2** — same + `.projectingOptionalValuesAsNullable()`
    → `meta: {…} | null`, gate-null still drops (surfaces `meta: null`).
27. **MUT-RET-RULE1-DELETE-DEFAULT · T2** — `deleteFrom(t)…returning(…)`, same assertion.
28. **MUT-RET-RULE1-DELETE-ASNULLABLE · T2** — delete + nullable.
29. **MUT-RET-RULE1-INSERT-DEFAULT · T3** — `insertInto(t).values(…).returning(…)`,
    same rule-1 drop through the insert-returning entry (distinct builder, shared
    runtime → output-coincident with #25 but a distinct entry).
30. **MUT-RET-RULE1-INSERT-ASNULLABLE · T3** — insert + nullable.

### Surface MUT-B — mutation RETURNING × rule-2 mixed-left-join drop (MUT-SEAM §A-1)

Rule-2 needs a left join. On a join MISS, the sub-object drops even though a
value-bearing leaf (a `connection.const()` no-table leaf, or a matching-table
column) is present — distinct from the general-rule (all-null) drop the existing
all-optional mutation test proves. Also the only place the R40 const-first rule-2
regression guard is exercised through a mutation entry. Traced sound (shared runtime
with the green SELECT path). Files: `update.join.test.ts` / `delete.using.variants.test.ts`.

31. **MUT-RET-RULE2-UPDATE-FROM-DEFAULT · T2** — `update(t).from(j).leftJoin(a).on(…)
    .returning({ pid, obj: { x: a.col, k: conn.const(1,'int') } })`, join miss → `obj`
    dropped. Type `obj?: { x: string; k: number }`; runtime `obj` absent.
32. **MUT-RET-RULE2-UPDATE-FROM-ASNULLABLE · T2** — same + nullable → `obj: null` on miss.
33. **MUT-RET-RULE2-DELETE-USING-DEFAULT · T2** — `deleteFrom(t).using(j).leftJoin(a)…
    returning({ …, obj: { x: a.col, k: … } })`, same drop-on-miss.
34. **MUT-RET-RULE2-DELETE-USING-ASNULLABLE · T2** — delete-using + nullable.

### Surface AGG — aggregateAsArrayDistinct nullable projection (PARITY A-1)

35. **AGG-DISTINCT-NULL · T2** — `aggregateAsArrayDistinct({ … one optional leaf … })
    .projectingOptionalValuesAsNullable()` (grep-confirmed never paired). Assert the
    optional leaf → `T | null`, snapshot keeps `distinct`, real-DB value-validate.
    Applicable on **postgres, mariadb, sqlite** (mysql/oracle/sqlserver already carry
    NOT-APPLICABLE for the distinct object-array). Sound (distinct uses the DROPPING
    runtime, so the `…ForAggregatedArray` type is correct). One representative
    (rule-3 own-table optional leaf) proves the distinct path — the rule-1/2/4
    variants are type-identical (same `…ForAggregatedArray`, same dropping runtime,
    only the already-covered `distinct` keyword differs) → degenerate w.r.t. this item,
    do not fan out.

### Surface COL — custom-kind virtualColumnFromFragment branch (§B, F2-COL B-1)

All 54 virtual-column declarations across every dialect use the plain `'string'`
form; the `typeof arg1 === 'string'` impl branch (`Table.ts:419-422`, `View.ts:150-153`)
— which threads args as `typeName=arg1, fn=arg2, adapter=arg3` and builds a branded
`CustomXValueSource` — has **never been constructed**. Coordinator-confirmed
reachable + arg-threading correct on read (Part V) → §B (fixture), not a suspected
bug. Add the fixtures to `tProjectRelease` (Table) / `vReleaseOverview` (View) in the
shared `domain/connection.ts`; assert in `select.virtual-column-from-fragment.test.ts`.
Table and View impls are byte-identical but are distinct declaration sites.

36. **COL-VIRTUAL-CUSTOM-TABLE-REQ-CUSTOMINT · T2 (§B)** — `virtualColumnFromFragment
    <number,'Cents'>('customInt','Cents', fn)` on the Table; assert result type is
    the branded `CustomIntValueSource` (`assertType<Exact>` of the projected leaf) +
    realized value (marshalled through int).
37. **COL-VIRTUAL-CUSTOM-TABLE-OPT-CUSTOMINT · T2 (§B)** — `optionalVirtualColumnFromFragment
    <number,'Cents'>('customInt','Cents', fn)` on the Table; optional branded leaf + value.
38. **COL-VIRTUAL-CUSTOM-TABLE-REQ-ENUM · T3 (§B)** — a string-backed custom kind
    (`enum 'WorklogActivity'` or `custom`) `virtualColumnFromFragment` on the Table,
    to exercise the `EqualableFragmentExpression` arm of the custom branch (distinct
    fragment-expression family from the numeric one in #36).
39. **COL-VIRTUAL-CUSTOM-VIEW-REQ-CUSTOMINT · T3 (§B)** — the same custom-kind
    `virtualColumnFromFragment` on the View (distinct declaration site; `View.ts:150-153`).
40. **COL-VIRTUAL-CUSTOM-VIEW-OPT-CUSTOMINT · T3 (§B)** — `optionalVirtualColumnFromFragment`
    custom-kind on the View.
41. **COL-VIRTUAL-CUSTOM-ADAPTER · T3 (§B)** — one custom-kind virtual column
    carrying the trailing `TypeAdapter` (the `arg3` slot of the custom branch, e.g.
    `bracketAdapter`) with an observable read transform, so the adapter arm of the
    custom branch is asserted end to end.

### Surface INSERT — from-select on-conflict without-target set-variants (F4-INSERT C-1/C-2)

**T4 output-coincident** (no new SqlBuilder branch — same emission as the covered
from-select `onConflictDoUpdateSet` + the values-insert dynamic/if-value variants).
Without-target; sqlite/mysql/mariadb (postgres-`never`). File in `insert.from-select.variants.test.ts`.

42. **INS-FROMSEL-OC-DYNSET · T4** — `insertInto(t).from(select).onConflictDoUpdateDynamicSet({…})`.
43. **INS-FROMSEL-OC-SETIFVALUE · T4** — `insertInto(t).from(select).onConflictDoUpdateSetIfValue({…})`.

### Surface PROJ — nested aggregate-of-aggregate (§B, exotic — gate on SQL-reachability)

44. **PROJ-NESTED-AGG · T3 (§B, low-confidence)** — an `aggregateAsArray`/inline
    element that itself contains a nested `aggregateAsArray` leaf (F3-PROJ). Runtime
    handles it (`__transformAggregatedArray` recursion), type-reachable, but the
    nested `json_agg`-in-`json_agg` + `group by` SQL may be dialect-limited. **Verify
    real-DB SQL-reachability BEFORE investing** — may be degenerate / out-of-scope.

---

## Part III — OUT (named with reason, so they are not re-chased)

- **queryRunner-layer error reasons** (`SQL_*`, `TRANSACTION_*`, `INVALID_MOCKED_VALUE`,
  `OUT_PARAMS_NOT_SUPPORTED`, `ONLY_ONE_COLUMN_EXPECTED`, `UNSUPPORTED_DATABASE`) —
  thrown only in `src/queryRunners/*` → OUT.
- **`UNKNOWN_DATA_TYPE` / insert-guard `INTERNAL`** — impossible builder state → OUT.
- **`UNSUPPORTED_QUERY`** (MySQL `compatibilityVersion < 8_000_000`) — no mysql/oldest cell → OUT.
- **Non-PG `compatibilityVersion` emission branches** — version-band emission → OUT.
- **Value-source `limit(vs)` / `offset(vs)`** — runtime-only, not on the typed surface → OUT.
- **`isTrue`/`isFalse`, `padStart`/`padEnd`/`position`/`replace`/`ltrim`/`rtrim`,
  `conn.values(...)`, `with()`, `crossJoin`, `executeSelectCount`** — non-existent APIs → OUT.
- **Custom-temporal CONST getters** — by-design PG limitation (Part I) → OUT.
- **`INullableValueSource → NullableFilter` / final `else` VSM arms** (F6-DYN) — unreachable
  (the single `ValueSourceImpl` matches an earlier arm for every real column) → OUT.
- **Degenerate (shared dispatcher, no distinct SQL/type/value) → CLOSE (R-P7):** per-leaf
  sequence kinds; per-kind `DBColumnImpl` fan-out; int-receiver fractional-const on
  add/subtract/multiply/min/max; brand-erase on a plain-`number` column;
  opt×req vs req×opt merge; Values required-temporal `column` real-Date; per-View extra
  kinds coincident with covered compositions.
- **The F1-EQCMP `*IfValue` T4 tail (102 cells, CLOSE per R-P7 — output-coincident, each
  fires-and-elides proven on a representative + each marshalling-sensitive leaf on its own
  twin).** Enumerated by method so it is not re-discovered:
  `equalsIfValue`→{double, localDate, localTime, localDateTime, customComparable, customLocalDateTime};
  `notEqualsIfValue`→{bigint, double, localDate, localTime, localDateTime, customComparable, customInt, customDouble, customUuid, customLocalDateTime};
  `isIfValue`→15 leaves; `isNotIfValue`→16; `inIfValue`→11; `notInIfValue`→11;
  `lessThanIfValue`=`greaterThanIfValue`=`lessOrEqualIfValue`=`greaterOrEqualIfValue`→{uuid, localDate, localTime, localDateTime, customInt, customDouble, customUuid, customLocalDateTime} (8 each);
  plus `asRequiredInOptionalObject` on a double leaf (optionality-mark only). **Do NOT implement.**

---

## Part IV — Per-surface saturation table

| Surface | §A items | §B items | verdict |
|---|---|---|---|
| SEL-A inline-query-value NULL (F9-TYPEVAR) | 2 | 0 | gaps (sound) |
| SEL-B compound-inline nullable rule-1/2 (SEL-SEAM A3) | 2 | 0 | gaps (sound) |
| SEL-C three-arm compound 2nd-hop (SEL-SEAM A2) | 2 | 0 | gaps (sound) |
| SEL-D non-union op × nullable (SEL-SEAM A1 / F-RECENT) | 14 (T4) | 0 | listed regression guards |
| SEL-E recursive-dedup × flag (F-RECENT §A-3) | 4 (T4) | 0 | listed regression guards |
| MUT-A mutation-returning rule-1 gate (MUT-SEAM) | 6 | 0 | gaps (sound) |
| MUT-B mutation-returning rule-2 left-join (MUT-SEAM) | 4 | 0 | gaps (sound) |
| AGG aggregateAsArrayDistinct + nullable (PARITY) | 1 | 0 | gap (sound) |
| COL custom-kind virtual branch (F2-COL) | 0 | 6 | §B |
| INSERT from-select OC without-target (F4-INSERT) | 2 (T4) | 0 | listed |
| PROJ nested aggregate-of-aggregate (F3-PROJ) | 0 | 1 | exotic §B (gated) |
| F-RECENT (fix residual, non-degenerate) | 0 | 0 | **SATURATED** |
| PARITY (base twins) | 0 | 0 | **SATURATED** |
| F1-EQCMP · F4-UPDDEL · F3-SELECT · F5-CONN · F1-NUM · F1-CUSTOMNUM · F1-STR · F1-TEMP · F1-BOOLIF · F6-DYN · F7-EXTRAS · F2-VALVIEW | 0 | 0 | **SATURATED** ×12 |

**Totals: 37 §A line items (items #1–35 + #42–43) + 6 §B (COL-VIRTUAL family) + 1
exotic §B (PROJ-NESTED-AGG) = 44 enumerated tests.** 18 of 20 surfaces saturated;
the tail lives at three seams (inline-query-value / compound-nullable; the
mutation-RETURNING entry; the custom-kind virtual branch).

---

## Part V — Coordinator verification notes (what I checked myself)

1. **#3 SEL-COMPOUND-INLINE-NULL-RULE2.** Mock-probe: type `Array<{ projName:
   string | null }>` (tsgo `assertType<Exact>` held), runtime `[{ projName: null }, …]`
   (present-`null` kept). SOUND — `ColumnsForCompound` preserves the optional-type
   brand so the plain nullable type fires through the compound.
2. **#25 MUT-RET-RULE1-UPDATE-DEFAULT.** Mock-probe: type `Array<{ pid; meta?: {
   sibling: string; gate: Date } }>` (held), runtime `[{ pid: 1 }]` with `meta`
   DROPPED (`'meta' in row === false`) on gate-null. SOUND — the mutation entry
   applies rule-1 correctly.
3. **#1/#2 SEL-INLINEQV-NULL.** Mock-probe both projectors: default `m?: number` +
   `'m' in emptyRow === false`; nullable `m: number | null` + present-`null`. Both
   `assertType<Exact>` held. SOUND.
4. **#36–41 COL-VIRTUAL-CUSTOM reachability.** Read the `Table.ts` custom-kind
   overload set (23 overloads: `customInt/customDouble/customUuid/customLocalDate/
   customLocalTime/customLocalDateTime/enum/custom/customComparable`, `<T,TYPE_NAME>`
   and `<T>` forms) + the impl branch (`typeof arg1 === 'string'` → `typeName=arg1,
   fn=arg2, adapter=arg3`); arg-threading correct, branded ValueSource produced.
   Reachable + type-correct → §B, not a suspected bug.
5. **Absence grep-confirmed** — `asRequiredInOptionalObject` ABSENT from every
   mutation test file (#25–34); `aggregateAsArrayDistinct` never paired with
   `projectingOptionalValuesAsNullable` (#35); the compound-inline-nullable test uses
   only a rule-3 leaf (#3/#4); dedup-recursive never paired with the flag (#21–24);
   the grouped-having query-level nullable follow-up (PARITY) is COVERED
   (`select.aggregation.test.ts` / `select.aggregate-as-array-inline-wrapped.test.ts`) → not a gap.
6. **F-RECENT baked-in-bug scan** — the R41 backlog's `assertType`/`toEqual` pairs
   are self-consistent (the rule-3 inline pair coincides between the plain and
   ForAggregatedArray types — exactly why BUG-1 was invisible there). CLEAN.
7. **`ResultObjectValuesProjectedAsNullableForAggregatedArray` orphan check** — now
   consumed ONLY by `aggregateAsArray`/`aggregateAsArrayDistinct` (dropping runtime),
   correct; the inline path uses the plain variant. No orphaned consumer.
8. All repros deleted; `git status --porcelain` shows only the new report + the
   pre-existing untracked audit reports (+ `.gitignore`, + the pre-existing R41
   runbook additions).

---

## Part VI — §B fixture-addition plan

- **COL-VIRTUAL-CUSTOM (#36–41)**: add to the shared `domain/connection.ts`
  (propagates to all 17 cells): on `tProjectRelease` — a `customInt 'Cents'`
  `virtualColumnFromFragment`, an `optionalVirtualColumnFromFragment` sibling, a
  string-backed `enum 'WorklogActivity'` virtual, and one carrying `bracketAdapter`;
  on `vReleaseOverview` — a `customInt 'Cents'` virtual (required + optional). All are
  computed inline (no DB column), so no schema change is needed.
- **PROJ-NESTED-AGG (#44)** (only if SQL-reachable on a real DB): no fixture needed;
  reuses existing tables.

Doc-cleanup (not §B, not coverage debt — flag for housekeeping): the stale
`with-values.test.ts:5-7` / `with-values.advanced.test.ts:28-30` headers (34 cells)
still claim dialects that type Values `never` comment out the body — false since R40
(Values LIVE on all 17 cells), and a cross-cell reference violating the
comments-self-contained rule. R41 flagged it; it was not applied. Accurate wording
already exists at `with-values.join-and-subquery.test.ts:18-21`.

---

## Part VII — Recommended implementation order

1. **T1/T2 §A (high value, sound boundary VALUEs):** #1–2 (inline-query-value NULL);
   #25–28 + #31–34 (mutation-returning rule-1/rule-2, update/delete, both projectors);
   #3–4 (compound-inline rule-1/rule-2); #35 (aggregateAsArrayDistinct + nullable);
   #5–6 (three-arm compound).
2. **T3 §A / §B:** #29–30 (mutation-returning rule-1 on insert); #36–41 (custom-kind
   virtual-column family — needs the fixtures above); #44 PROJ-NESTED-AGG only if
   real-DB SQL-reachable.
3. **T4 (listed regression guards; representative may suffice):** #7–20 (non-union
   compound ops × exec/inline); #21–24 (recursive-dedup × flag); #42–43 (from-select
   OC without-target).
4. **Housekeeping:** the stale `with-values` header cleanup (34 cells); the owner's
   call on the inert `update.ts:532` sqlite `NOldValuesFrom` src-note.
5. **CLOSE, do NOT implement:** the F1-EQCMP 102-cell `*IfValue` tail (Part III).

---

## Part VIII — Verdict

A clean, honest saturation round at extreme maturity: **18/20 surfaces saturated,
0 confirmed `src/` bugs, 44 enumerated §A/§B tests.** The Round-41 fix (`593a0a4f`)
is sound and complete — the five-round "bug in the residual" streak ended not by
luck but because the fix addressed the root (a shared result-type reused across a
dropping-vs-non-dropping runtime, and a flag propagated to the recursive clone but
not the compound one) rather than the symptom. All three highest-risk residual
candidates (the compound composition of the R41 axis #3, the mutation-RETURNING
projection entry #25, and the inline-query-value NULL inhabitant #1) were
coordinator-probed and confirmed **sound** — they are genuine §A coverage gaps whose
value is realizing the never-realized NULL/drop boundary VALUE (the exact assertion
the COVERED bar demands, and the class that hid three prior bugs). The remaining tail
is a §B custom-kind virtual-column family (a distinct impl branch never once
constructed) and low-priority T4 completeness. Nothing was fixed in `src/` from this
audit; `BUGS.md` stays clean.
