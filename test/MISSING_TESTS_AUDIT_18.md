# Missing-tests audit — ROUND 18

> Type-driven, multi-agent. Discovery = RAW READING of `src/` **types** only
> (never coverage / searcher for discovery). UNIT = the **type-path**. COVERED ⇔
> a test asserts the distinction via emitted SQL+params and/or `assertType<Exact>`
> and/or the runtime VALUE. Reference cell `postgres/newest/pg/`; matrix
> symmetric. Degeneracy bar = **narrow** (a distinct reachable
> overload/interface/per-receiver-method/arity/input-classification is a GAP even
> when its output coincides — output-coincidence is where type-vs-impl bugs hide).
> Scope: §A existing fixtures · §B needs a fixture · OUT (new cell / negatives /
> `queryRunners` / as-any / driver-layer / pure compile-only-no-value).

## Mandate & method this round

Continuation of the recent maximalist passes. The previous two rounds (16/17)
landed the shaped-`*When` repair and its tests; BUGS.md was empty at the start of
this round. **17 surfaces** fanned out in 3 waves (~4–6 agents each, to stay
under the server-side rate limit), led by the **structural twin-interface parity
sweep (theme 10)** over `insert/update/delete/select`. Every load-bearing claim
was coordinator-verified (tsgo compile-repro for reachability/exact-type;
wide-grep for absence-at-scale). All compile-repros deleted; tree clean.

### Pre-flight (today's numbers)

- `bun run tests:audit` → **17 cells, 221 test files, 1814 tests/cell (30 838
  total), whole matrix symmetric, 0 problems.**
- `bun run tests:index` refreshed.
- `domain/connection.ts` re-read — now very mature: `tLedgerEntry` (every
  column-factory adapter overload), `tInvoice` (PK adapter), `tProjectReview`
  (scaledTenth/bracket adapters), full custom-type fan-out on
  `tProjectRelease`/`tIssueWorklog`, `vReleaseOverview`/`vProjectOverview`. The
  themes-3/9 adapter fixtures from prior rounds are present **and exercised**.
- BUGS.md was empty; **this round files one confirmed bug (PD-1, below).**

## Headline counts

| Bucket | Count |
|---|---|
| **Confirmed `src/` bug (→ BUGS.md, never fixed here)** | **1** (PD-1, spans 2 twin interfaces) |
| Tier-1 gaps (distinct code-path / runtime-branch / bug-class) | 8 themes |
| Tier-2 gaps (distinct overloads / per-type emission / seams) | ~9 clusters |
| Tier-3 gaps (mechanical per-kind / §B fixture completeness) | ~6 clusters |
| **Genuinely SATURATED surfaces (0/0, re-verified)** | **F1-STR, F1-CUSTOMNUM, F6-DYN** |

---

## PARITY-DEFECTS — confirmed type-vs-impl bug

### PD-1 — single-row insert `keepOnlyWhen` return type mis-folds `MISSING_KEYS` (CONFIRMED, filed in BUGS.md)

**Found by:** the theme-10 parity sweep. **Verified by:** coordinator tsgo
compile-repro (both twins). **Where:** `src/expressions/insert.ts` —
`MissingKeysInsertExpression.keepOnlyWhen` (line **293**) and the shaped twin
`ShapedMissingKeysInsertExpression.keepOnlyWhen` (line **352**). **Runtime
proof:** `src/queryBuilders/InsertQueryBuilder.ts:1437-1442` — `keepOnlyWhen(true,
...c)` returns *exactly* `this.keepOnly(...c)`, so the `when:true` result type
must equal `keepOnly`'s.

- `keepOnly` (:265) → `…, Exclude<RequiredColumnsForSetOf<TABLE>, COLUMNS> | MISSING_KEYS>`
- `keepOnlyWhen` (:293) → `…, Exclude<RequiredColumnsForSetOf<TABLE> | MISSING_KEYS, COLUMNS>>` ← divergent

The two differ whenever a named column is already in `MISSING_KEYS` (the normal
state right after `dynamicSet()`): `keepOnlyWhen` strips the named columns out of
`MISSING_KEYS` (over-removal), while `keepOnly` never clears a still-missing
required key. **Compile-repro (PG reference cell, both errored TS2344):**

```ts
const base = conn.insertInto(tCountry).dynamicSet()   // MISSING_KEYS = 'code'|'name'|'region'
assertType<Exact<typeof base.keepOnly('code','name','region'),
                 typeof base.keepOnlyWhen(true,'code','name','region')>>()   // => false (diverge)
// keepOnly(all) keeps MISSING_KEYS = 'code'|'name'|'region' (still non-executable);
// keepOnlyWhen(true, all) collapses it to `never` (typed EXECUTABLE) — opposite of keepOnly's contract.
```

Same divergence on the shaped twin (`shapedAs({...}).dynamicSet().keepOnly(...)`
vs `.keepOnlyWhen(true,...)`, :324 vs :352). The multi-row twins
(`MissingKeysMultipleInsertExpression` 499/527, shaped 558/586) and all four
executable insert twins agree internally — **only the single-row `MissingKeys`
pair is wrong.** This is the round-13/16 bug class (a shaped/When continuation
that mis-types its key-tracking parameter) resurfaced in a new arm. **No test
currently exercises `keepOnlyWhen` on a `MissingKeysInsertExpression`** — so the
audit caught it before any test could; coverage was green. Filed in
[`BUGS.md`](./BUGS.md). The corollary missing-TEST (once fixed) is to exercise
`keepOnly`/`keepOnlyWhen` on the `MissingKeys` builder with a `// TODO[BUG]`
until the fix lands.

No other parity defect found: the round-16 `ShapedInsertOnConflictSetsExpression`
repair is confirmed solid (single clean `*When` block, `extendShape` present, no
`olumns` typo); delete/select twin towers are clean.

---

## Tier 1 — distinct code-path / runtime-branch / the bug class (highest value, mostly existing fixtures)

### T1-a — `int.modulo(double-column)` promotion: the round-14 bug class, untested on the int side (§A) — STRONGEST single test
The overloaded-number dispatcher promotes an `int` receiver to `'double'` when the
operand is a non-int value source; for `modulo` that flows into PG's `_modulo`
override emitting `mod((priority)::numeric, (estimated_hours)::numeric)`. The
suite covers `int.modulo(int-const)` (`priority % $1`), `int.modulo(int-column)`,
and `customDouble.modulo` — but **not** `int.modulo(double-column)` (the
promoted-to-double path). This is the exact int-side mirror of the round-14
`float % x` defect; a test pins the fix and closes the class. **Test:**
`tIssue.priority.modulo(tIssue.estimatedHours)` in a rollback (estimatedHours
seeded fractional), assert the `mod(…::numeric, …::numeric)` SQL + value.
(`select.numeric-overloaded-promotion.test.ts` is the pattern; estimatedHours
exists.) *Source: F1-NUM A1.*

### T1-b — projection input-classification: aggregate-element top-level rule-2, both projectors (§A, theme 5)
`ResultObjectValues*ForAggregatedArray`'s rule-2 branch
(`…ObjectResultSameOuterJoin`, both `resultWithOptionalsAsNull` and
`…AsUndefined`) is the **lone projection rule never asserted at the aggregate
element top level with a distinguishing shape**. Existing all-left-join element
coverage uses only `originallyRequired` leaves (`{id,name}`), so it cannot
distinguish rule-2 from rule-4 and has no nullable-projector twin. Compile-confirmed
by the agent:
`aggregateAsArray({ id: projLeft.id, name: projLeft.name, archivedAt: projLeft.archivedAt })`
→ default `Array<{ id: number; name: string; archivedAt?: Date }>` /
`.projectingOptionalValuesAsNullable()` → `Array<{ …; archivedAt: Date | null }>`.
Two tests (one per projector), existing `tIssue`/`tProject` left-join fixtures.
*Source: F3-PROJ A1.*

### T1-c — compound interface's own overload subset: chained set-difference op (§A, theme 6)
`CompoundedExecutableSelectExpression` (select.ts 198-207) re-declares its OWN
`union/unionAll/intersect/intersectAll/except/exceptAll/minus/minusAll`. The suite
chains only the UNION pair after an initial compound (`a.union(b).union(c)`); the
chained **set-difference** ops reached *through the compounded interface*
(`a.union(b).except(c)`, `a.union(b).intersect(c)`, `.minus`, `.exceptAll`…) are
untested — a distinct overload-set on a distinct interface (the round-14
compound-orderBy bug lived in exactly this kind of compound-only overload). PG
supports all. One focused test in `select.compound-extras.test.ts`. *(The
round-14 compound-`orderBy(valueSource)` wrap bug was re-derived and confirmed
**fixed/guarded** — `_needsCompoundExpressionOrderByWrap` wraps position-independently.)*
*Source: F3-SELECT A1.*

### T1-d — optional→null projection mode × compound (§A, theme 8 seam) — strongest seam
`projectingOptionalValuesAsNullable()` is tested alone on plain selects, mutation
returning and aggregate elements; compound nested-object re-projection is tested
only with **required** leaves. The seam "compound result re-projection × optional
leaf → null flip" is uncrossed by any single test (verified zero crossings).
**Test:** UNION two arms, one projecting an `optionalColumn`/left-joined nested
object, under `.projectingOptionalValuesAsNullable()`; assert the leaf becomes
`T | null` in SQL/type and value. *Source: F8-META A1.*

### T1-e — custom-boolean adapter × `*IfValue` ELIDED branch (§A, theme 9)
The `*IfValue` contract's defining behavior — **elision on absent value** — is
asserted for custom-boolean receivers only in its *present-value* half
(`published.equalsIfValue(true)` → `(published = 't') = $2`). The impl
short-circuits (`if (!_isValue) return ''`) **before** the adapter remap, so the
elided custom-boolean path emits genuinely distinct SQL (no `(published='t')`
clause). No test SQL-asserts that a custom-boolean constant is *correctly omitted*
when its IfValue elides. **Tests (fire/elide twins of the existing
`adapter-into-methods` cases):** `published.equalsIfValue(undefined)` (string
adapter) and `invoiced.isIfValue(undefined)` (numeric adapter 1/0). *Source:
F1-BOOLIF A1/A2.*

### T1-f — multi-row × targeted ON CONFLICT (§A, distinct interface family)
The `OnConflictDoMultipleInsert` / `CustomizableExecutableMultipleInsertOnConfict[Optional]`
interfaces (reached via `.values([r1,r2]).onConflictOn(cols).doNothing()/.doUpdateSet({...})`)
are reachable from the public API but exercised by **no test** — every multi-row
on-conflict test today uses the bare `onConflictDoNothing()`. Pins
`ReturningMultipleLastInsertedId[Optional]Type` off a *targeted* upsert. Plus the
**shaped × multi-row × on-conflict** twin (`ShapedExecutableMultipleInsertExpression`
on-conflict, renamed keys → real columns on the multi-row conflict node). Reuses
`tProject`'s existing `UNIQUE(organization_id, slug)`. *Source: INSERT A1/A2 (=
PARITY §B shaped-multi-row corollary).*

### T1-g — repaired-twin families still unexercised at runtime (§A, theme 2/10 follow-through)
The round-16 shaped-`*When` repair is type-correct, but several repaired/parallel
shaped families are **present-but-unexercised** — exactly the copy-paste-prone
surface where the next regression hides:
- **Shaped UPDATE `*When` arms** (~8): `setIfSetIfValueWhen`, `setIfNotSetWhen`,
  `setIfHasValueWhen`, `setIfHasValueIfValueWhen`, `setIfHasNoValueWhen`,
  `setIfHasNoValueIfValueWhen`, `ignoreIfSetWhen`, `ignoreAnySetWithNoValueWhen`
  — tested unshaped, and the non-When siblings tested shaped, but the shaped×When
  cross (renamed-key remap under a boolean gate) is untested.
- **Shaped UPDATE `disallow*When` family** entirely absent under shape
  (`update.shaped-disallow.test.ts` covers only the non-When shaped disallows).
- **Shaped multi-row insert `setForAll*`/`setForAll*When`** never exercised
  (the one shaped multi-row chain is commented out).
*Source: UPDDEL A1/A2 + PARITY §A/§B.*

### T1-h — gate-walk reaching the on-conflict UPDATE-set / WHERE nodes (§A, theme 8 seam)
`allowWhen`/`disallowWhen` is tested on INSERT-values, UPDATE-set, WHERE,
RETURNING, customizeQuery fragments and all SELECT compositions — but **not** on
the on-conflict `doUpdateSet` node (a distinct builder traversal; `doUpdateSet`
accepts a value-source RHS) nor the on-conflict `.where(cond)` gated condition.
*Source: F8-META A2.*

---

## Tier 2 — distinct overloads / per-type emission / composition seams

### T2-a — direct-fluent equality/comparison sparse on temporal/uuid/string leaves (§A, theme 4)
The *dynamic* surface is exhaustively per-type (F6-DYN saturated), but the
*direct* fluent surface remains sparse off int/string — Round-14's finding holds
and extends to **temporals**. Genuine §A gaps (existing fixtures), highest-value
first:
- **A1** plain `localDateTime` (`createdAt`): `equals`/`notEquals`/`is`/`isNot`/`in`/`inN`/`between`/`notBetween` const-operand (only `lessOrEqual`/`greaterOrEqual` exist today). *(§B caveat: verify the seed gives ≥2 deterministic distinct timestamps for `in`/`between`; else add a fixed-timestamp seed.)*
- **A2** plain `localDate`(`workDate`)/`localTime`(`startedAt`): the missing equality/`is`/`between`/single-bound arms.
- **A3** `customLocalTime`(`cutoffTime`)/`customLocalDateTime`(`signedOffAt`): equality/membership/between (only `lessThan`/`greaterOrEqual` today).
- **A5** plain `string` ordered comparison with a **const** operand + `between` (today only `lessOrEqual(column)`).
- **A7** `uuid`(`externalRef`) ordered comparison `lessThan/greaterThan/lessOrEqual/greaterOrEqual` (today only `between`/`notBetween`).
- **A4** `customUuid`(`signingKey`) `is`/`isNot` (optional column → null-safe meaningful) + the value-source-operand overload.
- **A6** `customComparable`(`version`) `greaterOrEqual` + `notBetween` (the two remaining Comparable arms).
- **A8** `customDouble`(`billedAmount`) `in(subquery)`/`notIn(subquery)` (the one numeric leaf with no subquery test).
*Source: EQCMP A1–A8.*

### T2-b — Connection: two distinct factory branches (§A/§B)
- **`arg(...)` trailing-`adapter?` (combined-mode `adapter2`)** branch — every
  `this.arg(...)` omits the adapter; the sibling `valueArg(..., adapter)` is
  covered but `arg`'s adapter routes through a *distinct* `'combined'`/`adapter2`
  construction. §B: add one `this.arg('int','required', scaledTenthAdapter)`
  fragment field.
- **Parameterized `createTableOrViewCustomization` (P1–P5)** — only the
  0-extra-param `withSqlHint` is exercised; the 6-overload parameterized family
  (`fn(table, alias, ...params)` threading runtime params into the raw fragment)
  is unreached. §B: add one P1 customization field (P2–P5 degenerate once P1
  exists). *Source: CONN A1/B1.*

### T2-c — Values/View source-dispatch breadth (§A + §B)
- **A2/A3** INNER `.join(view)` / `.join(values)` — both surfaces test only
  `leftJoin`; the non-left join arm (required, non-widened columns, distinct
  result-shape projector) is unexercised. §A on existing `vReleaseOverview` /
  inline Values.
- **A4/A5** Values / View used as a **subquery / inline-query-value** source
  (`forUseAsInlineQueryValue`, nested `selectFrom(values|view)`) — the WITH-hoisting
  (`__addWiths`/`__registerTableOrView`) when a Values/View feeds an inner select
  is uncovered (A4 explicitly in-scope; A5 borderline). *Source: F2-VALVIEW A2–A5.*

### T2-d — table-customization wrapper used anywhere but plain selectFrom/innerJoin (§A, seams) — reachability COMPILE-CONFIRMED
Coordinator compile-repro confirmed all reachable (not typed-never):
- **A6** `withSqlHint(t)` as a **leftJoin target** (`customized.forUseInLeftJoin()` exists; `leftJoin` accepts it).
- **A8** `withSqlHint(t)` as an **`update(...)` / `deleteFrom(...)` target** (both typecheck).
- **A7** `withSqlHint(t)` as a source **inside a compound arm**.
*Source: F8-META A6/A7/A8.*

### T2-e — customizeQuery × aggregate-as-array (§A, seam)
An outer select carrying an `aggregateAsArray({...})` column plus `.customizeQuery({...})`
is never composed (each alone is exhaustive) — exercises whether the aggregate's
column-forwarding coexists with the hook attachment. *Source: F8-META A4.*

### T2-f — shaped UPDATE `dynamicSet` overloads + shaped×from seam (§A)
- `ShapedUpdateSetExpression.dynamicSet(columns)` **one-arg** opener (only the
  no-arg shaped form is tested).
- `ShapedUpdateSetExpressionAllowingNoWhere.dynamicSet(...)` (both overloads).
- **shaped × `from`** seam (a shaped SET referencing a FROM-table column,
  `tProject`+`tOrganization` exist) and **shaped-set-`*When` × returning**.
*Source: UPDDEL A3–A6.*

### T2-g — `int.minValue/maxValue(double-column)` promotion (§A, mild)
Same promotion dispatcher as T1-a; emitted SQL coincides with the int-int case so
lower-risk, but a distinct result-type branch. *Source: F1-NUM A2.*

### T2-h — `DISALLOWED` error-reason code + `functionName` discriminant never pinned (§A) — absence CONFIRMED
`TsSqlError.ts:93` `{ reason: 'DISALLOWED', message, functionName }` is produced
by 12+ `allowWhen`/`disallowWhen`-with-string gate tests, **all** of which stop at
`toBeInstanceOf(Error)` + `.message.toContain(...)`. Coordinator wide-grep:
`toBe('DISALLOWED')` = **0** real assertions across the whole matrix (the 35 hits
are header comments claiming `reason: 'DISALLOWED'` + one signature snapshot);
`functionName` pinned nowhere. Distinct from the covered `DISALLOWED_BY_QUERY_RULE`.
Two-line fix in `select.value-source.allow-when.test.ts`: assert
`errorReason.reason === 'DISALLOWED'` and `functionName` (`'allowWhen'` /
`'disallowWhen'`) on the two existing throw paths. *Source: F7-EXTRAS A1.*

---

## Tier 3 — mechanical per-kind / §B fixture-completeness (lowest priority, in scope under "every variant")

- **T3-a — View per-column trailing-`TypeAdapter` overload (§B).** *Double-flagged
  by F2-COL B1 **and** F2-VALVIEW B1 — strong agreement.* No View column in any
  dialect carries an adapter; `View.column`/`optionalColumn` return the **bare
  `DBColumnImpl`** (a structurally distinct finalizer from Table's), so the View
  adapter read/write transform is never observed. Add one adapter-bearing column
  to `vReleaseOverview` (+ DDL/seed), e.g. `versionBracketed = column('version','string',bracketAdapter)`.
- **T3-b — value-marshalled `*IfValue` arms (§A).** `equalsIfValue`/`inIfValue`/…
  on the value-encoded leaves — bigint (`durationMs`), customInt (`costCents`),
  customDouble (`billedAmount`), uuid (`externalRef`), customUuid, enum
  (`activity`), numeric-custom-boolean (`invoiced`) — carry observable
  param-encoding through the IfValue dispatcher the int/string representatives
  don't prove. Plus compare-`*IfValue` on one non-int leaf, and `notInN` on a
  non-int leaf. *Source: EQCMP A9–A11.*
- **T3-c — optionality-flipped custom-temporal getters.** optional-custom-LocalDate
  & optional-custom-LocalTime getters (closeable §A via `.asOptional()` on the
  existing required column — no fixture) and required-custom-LocalDateTime getters
  (§B: a required `customLocalDateTime` column). *Source: F1-TEMP gaps 1–3.*
- **T3-d — View `customLocalTime` column (§B)** and **Values custom-temporal tuple
  members (§A, inline Values class — exercises the connection's temporal
  `baseTypeForCustom` arms via a VALUES tuple, currently reached only via
  Table/View). *Source: F2-VALVIEW B2/B3.*
- **T3-e — `autogeneratedPrimaryKeyBySequence` trailing-adapter overload (§B).**
  Dialect-gated (mariaDB/oracle/postgreSql/sqlServer); give `tAuditEntry.id` a
  `plusOffsetAdapter` (reuses `audit_tag_seq`); NOT-APPLICABLE pairing already
  exists on the other 2 dialects. *Source: F2-COL B2.*
- **T3-f — borderline (listed, low priority):** F1-BOOLIF A3 (custom-boolean
  `notEqualsIfValue`), F8-META A3 (allowWhen × shaped set) / A5 (customizeQuery ×
  recursive-CTE), F3-SELECT A2 (compound `orderBy(valueSource)` as sole key —
  degenerate, same wrap dispatcher; would pin the exact round-14 shape), UPDDEL A7
  (bare `returningOneColumn(old column)`).

---

## Saturated surfaces (re-verified 0/0 this round — a valid, reported outcome)

- **F1-STR (StringValueSource)** — every predicate (sensitive/insensitive) ×
  {const, value-source, IfValue fire+elide}, every transform (required + optional
  receiver), concat/substr/substring/replaceAll full overload sets, the adapter
  column → transform re-bracket value-asserted. Genuinely saturated.
- **F1-CUSTOMNUM (CustomInt/CustomDouble)** — every method × {const, value-source}
  × {required, synthetic-optional} + the brand keep/erase boundary (`sign()` erase
  value-asserted on both leaves). Round-14 `float % x` modulo class absent
  (emits `mod(…::numeric)`). 0 missing; the only conceivable additions are
  compile-only brand locks (OUT).
- **F6-DYN (dynamic conditions)** — 30/30 operators × IfValue, 17/17 `FilterTypeOf`
  descriptor arms, all reachable `MapValueSourceToFilter` arms, all 4
  builder-reachable error reasons, full from-model + extension + pick/expand API;
  every dynamic path paired with its direct equivalent. The 2 uncovered VSM arms
  are provably-unreachable type fallthroughs (degenerate).
- **`src/index.ts` barrel** — 25/25 runtime symbols imported AND invoked by tests;
  no exported-but-unreachable symbol. (F8-META.)

---

## Coordinator verification notes

1. **PD-1 (load-bearing bug)** — wrote a type-only repro in the reference cell:
   `insertInto(tCountry).dynamicSet()` then
   `assertType<Exact<keepOnly(all), keepOnlyWhen(true,all)>>()` for **both** the
   non-shaped and shaped twins → both TS2344 (`Exact` = false). Confirmed against
   the runtime delegation `keepOnlyWhen(true)≡keepOnly`. Repro deleted, tree clean.
2. **F8-META A6/A8 "verify-first" reachability** — wrote a repro asserting
   `update(withSqlHint(t))`, `deleteFrom(withSqlHint(t))`,
   `withSqlHint(t).forUseInLeftJoin()`, and `leftJoin(that)` — **all four
   typecheck** ⇒ real §A gaps, not typed-never boundaries. Repro deleted.
3. **F7-EXTRAS DISALLOWED absence-at-scale** — decomposed the wide-grep: 35
   matches are all comments + one signature snapshot; `toBe('DISALLOWED')` = 0,
   `functionName` pinned 0. Finding holds.
4. **Cross-agent dedup** — the **View per-column adapter overload** gap was
   surfaced independently by F2-COL (B1) and F2-VALVIEW (B1) → single Tier-3 item
   (T3-a). The shaped-`*When`/multi-row-on-conflict under-exercise was surfaced by
   PARITY, UPDDEL and INSERT → consolidated into T1-f/T1-g.
5. **Refuted / settled (so next round doesn't re-chase):**
   - `ShapedInsertExpression` has **no** `from(select)` — intentional boundary,
     not a gap (re-confirmed by source read).
   - round-14 compound-`orderBy(valueSource)` wrap bug — **fixed/guarded**
     (`_needsCompoundExpressionOrderByWrap` wraps position-independently); F3-SELECT
     A2 is degenerate, listed only.
   - `MORE_THAN_ONE_ROW` / `ONLY_ONE_COLUMN_EXPECTED` / `OUT_PARAMS_NOT_SUPPORTED`
     / `UNSUPPORTED_DATABASE` — **driver-layer** (`queryRunners/`), not
     mock/builder-reachable → OUT (re-confirmed).
   - `forUpdate`/`forShare` — **do not exist** in `src/`; not a path.
   - `connect-by`/sibling-ordering — typed `never` on PG, correctly
     NOT-APPLICABLE.
   - PD-1's `disallowIfNoValue`/`…When` look similar but are **symmetric** across
     twins (intentional) — not a defect.

## §B fixture-addition plan (consolidated)

| # | Fixture to add | Closes |
|---|---|---|
| B-1 | One adapter-bearing **View** column on `vReleaseOverview` (+ DDL/seed), e.g. `versionBracketed` (string+bracket) and/or a scaledTenth int | T3-a (View adapter read/write path) |
| B-2 | One `this.arg('int','required', scaledTenthAdapter)` fragment field on `DBConnection` | T2-b (`arg` combined-mode adapter) |
| B-3 | One **P1** `createTableOrViewCustomization` field (param threaded into the raw fragment) | T2-b (parameterized customization) |
| B-4 | A **required** `customLocalDateTime` column on `tProjectRelease` (+ DDL/seed) | T3-c gap-3 |
| B-5 | A `customLocalTime` column on `vReleaseOverview` (+ DDL/seed) | T3-d (View customLocalTime) |
| B-6 | `plusOffsetAdapter` on `tAuditEntry.id` (`autogeneratedPrimaryKeyBySequence`) | T3-e |
| B-7 | (verify-then-maybe) a fixed-timestamp seed for `tOrganization.createdAt` distinct values | T2-a A1 `in`/`between` determinism |

Everything else (Tier 1, most of Tier 2, T3-b/T3-c-gaps-1-2/T3-d-Values) is §A —
closeable on existing cells with existing fixtures.

## Recommended implementation order

1. **PD-1 fix** (a `src/` fix by the fixing agent, not the audit) + its
   `MissingKeys` `keepOnlyWhen` test with `// TODO[BUG]` until landed.
2. **Tier 1 on existing fixtures** — T1-a (int.modulo double-promotion; pins the
   round-14 class), T1-b (aggregate rule-2 both projectors), T1-c (chained
   set-difference compound), T1-d (optional→null × compound), T1-e (custom-boolean
   IfValue elided), T1-f (multi-row targeted on-conflict + shaped twin), T1-g
   (repaired-twin shaped `*When`/multi-row families), T1-h (gate × on-conflict).
3. **Tier 2** — T2-a (temporal/uuid/string direct-fluent; large but cheap),
   T2-d/T2-e/T2-f seams, T2-h (DISALLOWED reason pin — two lines).
4. **§B fixtures** (B-1…B-7) then their Tier-3 tests.

## Verdict

**Not saturated — but maturing fast.** The matrix is comprehensive; three whole
surfaces (string, custom-numeric, dynamic-conditions) and the barrel came back
**genuinely 0/0**, and most others are near-saturated with a small, sharp gap
list. The round delivered its primary value in the **parity sweep**, which found
**one confirmed type-vs-impl bug (PD-1)** invisible to coverage — the
keep-tracking-parameter bug class for the *fourth* time, now in the single-row
insert `keepOnlyWhen` twins. The remaining gaps cluster exactly on the runbook's
high-yield themes: the round-14 numeric-promotion bug-class mirror (T1-a), the
projection-classification and compound-overload boundaries (T1-b/T1-c), the
optional→null/gate/customize **composition seams** (T1-d/T1-h/T2-d/T2-e), the
**repaired-twin families still unexercised** (T1-g), and the **direct-fluent
temporal/uuid/string** sparseness (T2-a). All findings are §A or have a concrete
§B fixture; none were silently truncated.
