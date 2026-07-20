# Missing-tests audit — ROUND 20

> Type-driven, multi-agent. Discovery = RAW READING of `src/` **types** only.
> UNIT = the **type-path**. COVERED ⇔ a test asserts the distinction via emitted
> SQL+params and/or `assertType<Exact>` and/or the runtime VALUE. Reference cell
> `postgres/newest/pg/`; matrix symmetric. Degeneracy bar = **narrow**. Scope: §A
> existing fixtures · §B needs a fixture · OUT (new cell / negatives /
> `queryRunners` / as-any / driver-layer / pure compile-only-no-value).

## Mandate & method

Continuation of the maximalist passes; the prior round's findings were implemented
and BUG-1 (customizeQuery×recursive) was fixed. The suite grew **+57 tests/cell**
to 1965/cell across 231 files. This round re-derived all coverage FRESH (inherited
no verdict) and pushed to the next layer, at **≤10 agents concurrent**, led by the
two bug-catchers — the **parity sweep** (theme 10) and the **seam critic** (theme
8), each seeded to reason about *emitted SQL / runtime behaviour* of a cross-cutting
feature or twin interface composed onto a special builder. Every load-bearing claim
was coordinator-verified (tsgo compile-repro; runtime SQL/throw probe; wide-grep).
All probes deleted; tree clean.

### Pre-flight
- `bun run tests:audit` → **17 cells, 231 files, 1965 tests/cell (33 405 total),
  symmetric, 0 problems.**
- `bun run tests:index` refreshed. Domain re-read — the prior round's §B fixtures
  landed & are exercised: `tIssueWorklog.tagLabel`/`tagLabelOptional`
  (computedColumn+adapter), `vReleaseOverview.versionTagged` (View virtual+adapter).
- BUGS.md empty at start; **this round files two verified divergences (BUG-1, BUG-2).**

## Headline

| Bucket | Count |
|---|---|
| **Confirmed `src/` divergences (→ BUGS.md, coordinator-verified)** | **2** (BUG-1 compile-repro, BUG-2 runtime-probe) |
| **SATURATED surfaces (0/0, re-verified fresh)** | **8** — CONN, UPDDEL, F1-STR, F1-CUSTOMNUM, F6-DYN, F2-COL, F2-VALVIEW, F7-EXTRAS + barrel 28/28 |
| Tier-1 gaps (distinct code-path / seam / classification) | ~5 clusters |
| Tier-2 gaps (distinct overloads / per-type / next-layer) | ~7 clusters |
| Tier-3 gaps (§B / minor) | ~4 clusters |

The suite is now highly mature — 8 of 17 surfaces are genuinely exhausted. The
round's primary value is the **two confirmed bugs** (both on composition/twin
seams, both invisible to coverage) plus a still-generous next-layer gap list.

---

## BUG-1 — shaped-update `extendShape` drops the `dynamicSet` opener (→ BUGS.md; twin asymmetry, TS rejects what should work)

**Found by:** the parity sweep. **Verified by:** coordinator tsgo compile-repro.
`ShapedUpdateSetExpression.extendShape` (update.ts:295) returns
`ShapedNotExecutableUpdateExpression` — which has **no `dynamicSet`** — while its
AllowingNoWhere twin `ShapedUpdateSetExpressionAllowingNoWhere.extendShape` (:319)
returns its own opener family (keeps `dynamicSet`), and the INSERT
`ShapedInsertExpression.extendShape` keeps its own family too. Runtime `extendShape`
returns `this` (dynamicSet is callable). Compile-repro (all three lines settled it):

```ts
conn.update(t).shapedAs({projectName:'name'}).extendShape({projectSlug:'slug'}).dynamicSet()            // TS2339 (dynamicSet missing)
conn.updateAllowingNoWhere(t).shapedAs({projectName:'name'}).extendShape({projectSlug:'slug'}).dynamicSet() // compiles
conn.update(t).shapedAs({projectName:'name'}).dynamicSet()                                              // compiles (opener has it)
```

So the where-required path's `extendShape` (a shape *widener*, not a set op)
over-restricts by transitioning to the not-executable family. Likely fix: return
`ShapedUpdateSetExpression<…, SHAPE & ResolveShape<…>>`. Filed in [`BUGS.md`](./BUGS.md).

## BUG-2 — one-column recursive select as an inline query value throws `INTERNAL` (→ BUGS.md; TS accepts, impl throws)

**Found by:** the seam critic. **Verified by:** coordinator source-read + runtime
throw-probe. `selectOneColumn(...).recursiveUnion*(...).forUseAsInlineQueryValue()`
is type-permitted, but `__buildRecursive` (SelectQueryBuilder.ts ~586-593) copies
`__columns`/`__subSelectUsing`/`__projectOptionalValuesAsNullable` onto the outer
`recursiveSelect` and **omits `__oneColumn`**, so the inline scalar init throws
`INTERNAL: Unexpected inline select` (ValueSourceImpl ~2487). Runtime probe:

```ts
conn.selectFrom(tIssue).where(tIssue.id.equals(1)).selectOneColumn(tIssue.id)
    .recursiveUnionOn((child) => tIssue.parentId.equals(child)).forUseAsInlineQueryValue()
// used as a scalar → THROWS INTERNAL   (control: non-recursive one-column inline works:
//   `select (select id as result from issue where id = $1) as "n" from project`)
```

Only the recursive×one-column×inline cell is broken (the recursive one-column via
`forUseInQueryAs`/`executeSelectMany` works). Contrast `__buildSelectCount` (~737),
which delegates through `__recursiveSelect` correctly. Filed in [`BUGS.md`](./BUGS.md).

---

## Tier 1 — distinct code-path / seam / classification (highest value, existing fixtures)

- **T1-a — value-transforming `TypeAdapter` COLUMN inside `aggregateAsArray({...})`
  element (§A, seam).** No test threads a user adapter's `transformValueFromDB`
  through the JSON aggregate-array element (existing coverage is built-in-type
  marshalling + the `aggregateFragmentWithType` dispatcher, a different surface).
  Runtime-verified: `aggregateAsArray({ score: tProjectReview.score, reviewerCode })`
  → `{score:850,'R-7A2'}` reads back `{score:85,'[R-7A2]'}` (both adapters fire per
  element). Existing fixtures. *Source: F8-META A-1.*
- **T1-b — `dynamicPick(...).select(picked).projectingOptionalValuesAsNullable()`
  (§A, theme 5 — compile-verified).** The picking × nullable-projector product on a
  real query with a present-null value: `{ id: number; title?: string; body: string | null }`
  (picked-required-key optional-value → `| null`, present not dropped). Currently
  reached only through the passthrough type helper, never a real `.select(picked)`
  query. Existing `tIssue.body`. *Source: F3-PROJ A1.*
- **T1-c — optional-DOUBLE-receiver arithmetic/math, value-level (§A).** `estimatedHours`
  (optional double) is never the receiver of any arithmetic/math method, and no
  `divide`/`power`/`logn`/`roundn`/`atan2`/`sqrt` runs on any optional receiver.
  `estimatedHours.divide(2)`/`.power(2)`/`.sqrt()`/`.round()` asserting `?: number`
  + SQL + value verifies the fixed-double `else`-branch threads `__optionalType`.
  *Source: F1-NUM A1.*
- **T1-d — recursiveUnion × outer-select customizeQuery hooks (§A, seam — post BUG-1
  layer).** The prior round's fix covered `beforeQuery`/`afterQuery`/`beforeWithQuery`/
  `afterWithQuery`; the *other* hooks (`afterSelectKeyword`, `beforeColumns`,
  `customWindow`, `beforeOrderByItems`, `afterOrderByItems`) route to
  `outerSelect.__customization` (`__applyRecursiveCustomization`) and land on the
  OUTER `select … from recursive_select_1` — untested. Runtime-verified correct.
  *Source: F8-META A-3.*

## Tier 2 — distinct overloads / per-type / next-layer

- **T2-a — direct-fluent equality/comparison: two coherent non-degenerate dimensions
  (§A).** The const-operand + subquery surface is saturated across all 18 leaves;
  the next layer:
  - **ordered comparison with a VALUE-SOURCE operand** (`lessThan`/`greaterThan`/
    `lessOrEqual`/`greaterOrEqual`(column|subquery)) — covered only on int/bigint(1)/
    string(1); absent on **double, customInt, customDouble, uuid, customUuid,
    customComparable, and all 6 temporal leaves**. Distinct `_appendSql` emission.
  - **the three mixed `between` overloads** (`between(TYPE,VAL)`/`(VAL,TYPE)`/`(VAL,VAL)`)
    — covered only on int/bigint/customLocalDate; absent on ~11 leaves.
  - **customInt/customDouble `*IfValue`** — no IfValue coverage at all for that shape
    family (one `costCents.equalsIfValue` fire+elide closes it).
  Representatives suffice per leaf-family; existing fixtures. *Source: EQCMP A1–A5.*
- **T2-b — View custom-temporal getters (§A).** View custom-localDate getters
  (`vReleaseOverview.releasedOn`, 4 getters) and View custom-localDateTime getters
  (`vReleaseOverview.signedOffAt`, 9 getters, also the sole optional-custom-LDT-on-View
  cell) — raw-read-only today, never fed a getter. *Source: F1-TEMP A1/A2.*
- **T2-c — 6 `insensitive` OrderByMode values on the compound-wrap path (§A).** The
  `CompoundedOrderByExecutableSelectExpression.orderBy(col, mode)` insensitive family
  triggers the `select * from (…) as o_1_` wrap; only `'asc insensitive'` is tested —
  the other 6 (`insensitive`, `desc insensitive`, `asc/desc nulls first/last insensitive`)
  each emit a distinct suffix through that compound-specific branch. *Source: F3-SELECT A1.*
- **T2-d — INSERT on-conflict continuations (§A).** The on-conflict WHERE-continuation
  returning surface beyond `returning({obj})`: `where(cond).returningOneColumn(col)`,
  `where(cond).returningLastInsertedId()`, `where(c1).and(c2).or(c3).returning({obj})`;
  the **multi-row × on-conflict-doUpdate × where** partial-update-on-a-batch path;
  and `defaultValues().returning({obj})` / `.returningOneColumn(col)` (only
  `returningLastInsertedId` is tested). *Source: INSERT A1–A3.*
- **T2-e — parenthesized compound arm (§A, seam).** No snapshot shows a compound arm
  parenthesized by its OWN inner `limit`/`orderBy` — `left.limit(2).union(right)` →
  `(select … limit $1) union …`; `left.unionAll(right.orderBy('label').limit(3))` →
  `… union all (select … order by label limit $1)`. Runtime-verified. *Source: F8-META A-2.*
- **T2-f — `_negate` constant-swap + elide branches (§A).** `conn.true().negate()` /
  `conn.false().negate()` hits the constant-swap branch (per-dialect: pg `false`,
  Oracle `(0=1)`), and `status.equalsIfValue(undefined).negate()` / `noValueBoolean().negate()`
  hits the empty-string branch (WHERE drops). No test negates a constant or an elided
  IfValue anywhere. *Source: F1-BOOLIF A1/A2.*

## Tier 3 — §B / minor

- **T3-a — recursiveUnion × `forUseAsInlineAggregatedArrayValue` (§A, minor).** The
  aggregated-array inline path over a recursive select is type-reachable and
  runtime-verified CORRECT (columns resolve against `recursive_select_1`) — untested;
  lower yield than T1-a…T1-d. *(This is the aggregated-array sibling of BUG-2's
  broken one-column scalar path — worth co-locating the test near the BUG-2 fix.)*
  *Source: F8-META A-4.*
- **T3-b — plain-localDate/localTime View getters (§B).** No plain localDate/localTime
  column on any View; would need a plain temporal View column. Low priority
  (near-degenerate — the plain-localDateTime-View path is already covered). *F1-TEMP B1.*
- **T3-c — EQCMP degeneracy-eligible representatives** (`notInN` per non-int leaf,
  `is`-value-source-operand on enum/custom/customUuid, `equals(V-source)` on
  numeric-custom) — one representative each; mostly shared-dispatcher. *EQCMP A2/A5/A8.*
- **T3-d — optional-adapter Values column (§C, borderline).** An `optionalColumn('int',
  scaledTenthAdapter)` Values tuple member (optional twin of the covered required
  `VScaledSampler.score`) — degenerate against the required twin; listed only. *F2-VALVIEW §C-1.*

---

## Saturated surfaces (re-verified 0/0 — a valid outcome; 8 this round)

- **CONN** — the ~45-path scalar/fragment/sequence/exec/aggregate/transaction+isolation
  surface; new prior fixtures exercised; executeFunction extra return-kinds & P3–P5
  customization arities degenerate-by-shared-dispatcher.
- **UPDDEL** — the shaped set/`*When`/disallow family (all 10 arms remap-exercised),
  from/using/returning/execute-shapes, allowing-no-where; prior 4 items implemented.
- **F1-STR** — every predicate/transform/substr/replaceAll overload × operand-kind ×
  receiver × IfValue fire/elide; adapter re-bracket value-asserted.
- **F1-CUSTOMNUM** — every method × {const, value-source} × {required, synthetic-optional}
  + brand keep/erase; round-14 `mod(…::numeric)` pinned both arms.
- **F6-DYN** — 57 operator keys × 18 descriptor branches × VSM arms × base/IfValue,
  pick/orderBy-model/from-model/extension/errors; each paired with its direct equivalent.
- **F2-COL** — all 3 new fixtures exercised; every factory's adapter + typeName-generic
  overload has a representative; remaining View optional-adapter cells degenerate.
- **F2-VALVIEW** — Values adapter-object branch + View `versionTagged` covered; per-kind
  Values/View dispatch, inner-join, inline-query-value hoisting all covered.
- **F7-EXTRAS** — 27/27 utility types, deep-utils, extract*, IDEncrypter, sync, all
  4 TypeAdapter classes, ~30 builder-reachable error reasons, config flags. Prior 2
  type-edges implemented.
- **`src/index.ts` barrel** — all cross-database exports reachable & invoked.

---

## Coordinator verification notes

1. **BUG-1** — tsgo compile-repro: normal path `TS2339` on `.extendShape(...).dynamicSet()`;
   AllowingNoWhere path compiles; normal opener compiles. Deleted; clean.
2. **BUG-2** — source-read confirmed `__buildRecursive` omits `__oneColumn` (vs
   `__buildSelectCount` delegating through `__recursiveSelect`); runtime probe: the
   recursive one-column inline **throws `INTERNAL: Unexpected inline select`**, the
   non-recursive one-column inline control emits valid SQL. Deleted; clean.
3. **T1-e absence (publishedAt/reviewTime)** was closed last round; this round the new
   `tagLabel`/`versionTagged` fixtures verified exercised.
4. **Refuted / inert (so next round doesn't re-chase):**
   - **sqlite `ReturningOneColumnFnType` old-values fold asymmetry** (update.ts:532,
     flagged by both PARITY-PD-2 and UPDDEL this round) — **inert**: `oldValues()` is
     typed `never` on `SqliteConnection`, so the dangling `| NOldValuesFrom` union
     member can never bind a real argument. Cosmetic, unreachable; NOT a bug (a
     maintainer cleanup at most). Same conclusion as the prior round.
   - **F1-NUM fractional-const promotion** (`priority.add(1.5)` emits uncast
     `priority + $1`) — a **known limitation**, not new: PG rejects an untyped
     fractional param added to an int column, which is exactly why the promotion
     tests use a double *column* operand (documented in the promotion test's header).
     OUT (docker-only-rejection pattern with an established convention).
   - **F6-DYN `between` operator comment** — the `operators.test.ts` header mentions a
     `between` filter operator that does not exist in any `*Filter` interface; a
     stale/misleading comment, not a coverage gap.

## §B fixture plan (minimal)

| # | Fixture | Closes |
|---|---|---|
| B-1 | (only if T3-b pursued) a plain localDate/localTime column on a View | T3-b (near-degenerate; low priority) |

Everything in Tier 1, all of Tier 2, and T3-a/T3-c/T3-d are §A — closeable on
existing cells with existing fixtures.

## Recommended implementation order

1. **BUG-1 & BUG-2 resolution** (a `src/` decision by the fixing agent) + their
   composed tests with `// TODO[BUG]` until fixed. (BUG-2's fix likely also unlocks
   T3-a — co-locate.)
2. **Tier 1 on existing fixtures** — T1-a (adapter × aggregate-array element), T1-b
   (pick × nullable projector), T1-c (optional-double math), T1-d (recursive × outer
   customizeQuery hooks).
3. **Tier 2** — T2-a (ordered-V-operand + mixed-between + customInt/Double IfValue;
   large but cheap), T2-b (View custom-temporal getters), T2-c/T2-d/T2-e/T2-f.
4. Tier-3 mop-up.

## Verdict

**Maturing hard — but the method is still catching bugs.** Eight surfaces plus the
barrel came back genuinely 0/0, confirming the exhausted areas. The round's decisive
value is again **two verified `src/` divergences** — BUG-1 (shaped-update
`extendShape` over-restricts, dropping the `dynamicSet` opener its twins keep) and
BUG-2 (one-column recursive select as an inline value throws `INTERNAL`) — both on
the **composition/twin seams** the parity sweep and seam critic target, both
invisible to coverage. The residual gaps cluster on the direct-fluent value-source-
operand / mixed-`between` vein (T2-a), the composition seams (T1-a/T1-d/T2-e), the
projection pick × nullable-projector boundary (T1-b), the compound insensitive-wrap
modes (T2-c), the on-conflict continuations (T2-d), and the View custom-temporal
getters (T2-b). All §A or a single tiny §B; none silently truncated.
