# Missing-tests audit — ROUND 2 (type-semantics coverage)

**This is the second audit pass.** The first pass ([MISSING_TESTS_AUDIT.md](MISSING_TESTS_AUDIT.md))
found ~50 type-branch gaps (sections A–G) which are now **all CLOSED** (and one source bug fixed). This
round re-ran the audit on the updated codebase to find **what the first pass missed** — none of the gaps
below overlap A–G.

**What this round targeted** (different decomposition from round 1, which enumerated the public surface
breadth-first):
1. **Fan-out families the first pass marked "covered (bounded)"** without verifying every arm — these
   turned out to be the richest vein (exactly like round-1's confirmed `executeFunction`/`sequence`
   fan-outs G1/G2): `const`/`optionalConst` per keyword, the fragment-builder families per arity/return
   type.
2. **Under-explored surface** the first pass touched only shallowly: per-dialect `Connection` subclasses,
   insert/update write-side (values/set), select clauses.
3. **Adversarial re-audit of round-1 "covered" verdicts** — hunting false negatives, now that the new
   custom fixtures (`tProjectRelease`, `tIssueWorklog`, `tCountry`, `vReleaseOverview`, `tAuditEntry`,
   new sequences/functions) make many branches reachable.

**Unit of analysis, bar, and rules are identical to round 1** — a *type-branch* (a distinction the type
system makes even when runtime JS is identical: each overload / union-param / per-type / per-arity arm,
each type-transformation); COVERED iff a `test/`-matrix test asserts that distinction (SQL+params and/or
resulting TS type via `assertType<Exact<…>>`); negative type tests + `src/queryRunners/` out of scope;
coverage validated only against `test/`; reference cell `postgres/newest/pg`, matrix symmetric. A
type/variant present **only** as `void X` / `<any,any>` smoke in `doc-code.generated.test.ts` or as a
signature line in `simplifiedDefinition.generated.test.ts` is **compile-only, NOT covered**.

**Method.** Raw reading of `src/` for branch discovery → independent adversarial verification (each gap
an agent *tried to refute* by finding a covering test before it was confirmed). The **completeness
critic found 0 further gaps**: transaction surface, `Sequence<T>`, table/view aliasing, the root-barrel
exports, and `TypeAdapter` chaining are all fully covered — the public surface is otherwise exhausted.

**Headline.** ~40 NEW confirmed gaps, concentrated in: the **`const`/`optionalConst` keyword fan-out**,
the **fragment-builder arity/return-type fan-out**, and the **operator surface on custom/branded &
bigint value sources** (the new custom columns are *declared and projected* but their operators are
barely exercised). A handful of write-side / projection / dialect gaps round it out.

> **Conventions to honour when implementing** (same as round 1): pair dynamic-condition tests with their
> direct equivalent (identical SQL+params); date/time under `TZ=UTC`; some fragment/custom gaps need a
> **new domain fragment helper** (touches all 6 `test/db/*/domain/connection.ts`); respect per-dialect
> `NOT-APPLICABLE`/`TODO[LIMITATION]` markers. No `src/` change from a test PR.

---

## H. `const` / `optionalConst` — per-keyword overload fan-out

`const(value, keyword[, typeName])` and `optionalConst(...)` each have one overload per `ValueType`
keyword × required/optional → a distinct `*ValueSource<…,'required'|'optional'>` and a distinct emitted
parameter/cast. Round-1 confirmed only int/string/bigint/boolean/customInt/custom (required) covered;
the rest is dark. (Same shape as the confirmed round-1 G1/G2 fan-outs.)

**H1. `optionalConst` — 14 keyword arms with ZERO coverage** —
[src/connections/AbstractConnection.ts:496-562](../src/connections/AbstractConnection.ts#L496) · **high**.
- Branch: `boolean, bigint, double, uuid, localDate, localTime, localDateTime, enum, customDouble,
  customUuid, customComparable, customLocalDate, customLocalTime, customLocalDateTime` — each
  `optionalConst` arm’s `'optional'` typed result + emitted placeholder/cast.
- Why missing: across the whole matrix `optionalConst` is only ever called with `'string'` (marshalling
  + allow-when tests). Grep for `optionalConst(…,'<kw>')` for the 14 → 0 real calls (signature-snapshot
  only). The 4 "dark" custom keywords appear elsewhere as `column(...)`/dynamic-condition descriptors —
  a different overload family, not `const`.
- Add → new `test/db/postgres/newest/pg/select.value-source.optional-const.test.ts` (propagate per
  dialect): one value arm + one `null` arm per keyword,
  `selectOneColumn(conn.optionalConst(<v>,'<kw>'[, '<TypeName>']))`, asserting the placeholder/cast (pg:
  `::bool`/`::int8`/`::float8`/`::uuid`/`::date`/`::time`/`::timestamp`; enum/customComparable/customUuid
  → bare param) and `assertType<Exact<typeof v, <T> | null>>`.

**H2. `optionalConst` int / customInt / custom — introspection-only** —
([AbstractConnection.ts:496-562](../src/connections/AbstractConnection.ts#L496)) · **medium (PARTIAL)**.
- Branch: the `'optional'` typed result + emitted SQL of `optionalConst(7,'int')` /
  `optionalConst<Score>(7,'customInt','Score')` / `optionalConst<MyType>('x','custom','MyType')`.
- Why missing: `select.value-source.const-value.test.ts` calls these but asserts only
  `isConstValue()`/`getConstValue()` — its header says "no SQL is emitted"; no `assertType`.
- Add → same new optional-const file: `::int4` + `number | null`; `Score | null`; bare + `MyType | null`.

**H3. Required `const` for the 4 dark keywords** —
([AbstractConnection.ts:496-562](../src/connections/AbstractConnection.ts#L496)) · **high**.
- Branch: `customComparable, customUuid, customLocalTime, customLocalDateTime` (required side) — distinct
  cast behavior (e.g. `customUuid` keeps the `::uuid` path; `customLocalTime`/`customLocalDateTime` are
  object-valued → no cast ladder, unlike the enumerated `localTime`/`localDateTime` which DO cast — that
  contrast is the point).
- Why missing: zero real `const(…,'<kw>')`; `select.postgres-const-force-type-cast.test.ts` covers
  uuid/localTime/customLocalDate but not these.
- Add → extend `select.postgres-const-force-type-cast.test.ts`:
  `const<ReleaseId>(…,'customUuid','ReleaseId')`→pg `::uuid` + branded type;
  `const<Version>('1.2.0','customComparable','SemVer')`→bare + branded; the two custom temporals → bare.

**H4 (secondary). Cross-dialect required-const cast emission off-pg** — lower priority. uuid/localDate/
localTime/localDateTime/customUuid required-const emit dialect-specific SQL but only the pg folder
asserts it (the `::cast` syntax is pg-specific). Optional add-on in a new dialect-folder const file.

---

## I. SQL fragment builders — arity / return-type / aggregate fan-out

Round-1 marked the fragment surface "covered (bounded)"; A5 closed only `buildFragmentWithMaybeOptionalArgs`
at arity 2. Every other arm is a distinct overload (a distinct `*FragmentExpression` / `FragmentBuilderN`
/ `RawFragment<…>` signature) and is unpinned. **All are `protected`, so closing them needs new helpers on
the shared domain connection** — one non-`int`, non-2-arity helper closes several rows at once; the
**aggregate family has 0 helpers and is the single highest-value addition.**

| # | Builder (`src/connections/AbstractConnection.ts`) | Untested branch | Verdict |
|---|---|---|---|
| **I1** | `fragmentWithType` (:697-750) | 14 of 17 return-type keywords (`bigint`/`double`/`uuid`/`localDate*`/`enum`/`custom*`/`customComparable`); the `custom*`/`enum` arms also thread untested `TYPE`/`TYPE_NAME` | CONFIRMED |
| **I2** | `fragmentWithType` required-vs-optional | both arms pinned only for `int`; `string`/`boolean` `'optional'` + all 14 other keywords' optional arm unpinned | PARTIAL |
| **I3** | `aggregateFragmentWithType` (:920-973) | 16 of 17 return families + **every `optional` aggregate arm** (only `('int','required')` pinned; the `NAggregate` marker × keyword matrix) | CONFIRMED |
| **I4** | `buildFragmentWithArgs` (:885-893) | arities 0,1,3,4,5 (only arity-2 `intLeftShift` declared) | CONFIRMED |
| **I5** | `buildFragmentWithArgsIfValue` (:895-903) | arities 0,1,3,4,5 (only arity-2 `intEqualsIfValue`); arity-0 is a degenerate `()=>IfValueSource` | CONFIRMED |
| **I6** | `buildFragmentWithMaybeOptionalArgs` (:905-913) | arities 0,1,3,4,5 (A5 closed arity-2 only); the `MergeOptionalUnion` per-arg fan-out | CONFIRMED |
| **I7** | `rawFragment` (:1014-1022) | source-union arms 3,4,5,6,7 (verified at ≤2 interpolations only) → `RawFragment<T1\|…\|TN>` widening | CONFIRMED |
| **I8** | `arg` / `valueArg` (:761-884) | every type keyword except `int`, plus the `'combined'` (arg) vs `'value'` (valueArg) mode gate (per-type coercion: `uuid`→string, `localDate`→Date, branded `enum`/`custom`) | CONFIRMED |

Recommendation pattern (in `fragments.test.ts` / `fragments.with-args.test.ts`): add domain helpers that
each project through `selectFromNoTable().select({...})` and `assertType<Exact<…>>` the leaf type + snapshot
SQL+params. Concretely — (a) a `bigint`/`uuid`/`customComparable`-returning `fragmentWithType` helper (both
required+optional) closes I1+I2 and the `TYPE_NAME` thread; (b) a 1-ary and a 3-ary `buildFragmentWithArgs`
whose `arg(...)` uses a non-int type closes I4+I8 and (via 3 interpolations) dents I7; (c) the same for the
`IfValue` and `MaybeOptional` builders closes I5+I6; (d) an `aggregateFragmentWithType('bigint','required')`
+ one `'optional'` helper, placed in a `select` to confirm the `NAggregate` gate, closes I3.

---

## J. Custom / branded value-source — OPERATOR surface

Round-1 closed the custom column *declarations* (C5–C8) and custom* *dynamic-condition dispatch* (F1).
The custom value sources are now declared and **projected**, but their **operators** (which each redefine
to carry the brand `TYPE`/`TYPE_NAME`, or to drop it) are essentially never exercised with a branded-result
assertion. Fixtures: `tProjectRelease.{version=customComparable, channel=custom, signingKey=customUuid?,
releasedOn=customLocalDate, cutoffTime=customLocalTime, signedOffAt=customLocalDateTime?}`,
`tProjectBranded.id=customInt`, `score`/`m,r,v,o` const operands, `releaseTagSeq`. **All high confidence;
all reproduced as 0 matrix-wide hits.**

**J1. `CustomInt` arithmetic + min/max + sign on a custom operand** —
[src/expressions/values.ts:547-593](../src/expressions/values.ts#L547) · **high (top value)**.
- Branch: `add/subtract/multiply/modulo/minValue/maxValue` → branded `CustomIntValueSource` (literal-RHS
  + the `<VALUE extends CustomIntValueSource>` custom-RHS overload); `sign()` → plain `NumberValueSource`
  (brand DROP — a cross-type branch).
- Why missing: the custom-numeric "double-arithmetic" test uses `tIssue.priority.asDouble()` (a plain
  number), not a customInt; grep `score.(add|subtract|multiply|modulo|minValue|maxValue|sign)` → 0. Only
  `ceil/floor/round/abs` are covered on `score`.
- Add → `select.value-source.custom-numeric.test.ts`: `score.add(2)`, `score.modulo(score)`,
  `score.minValue(5)`, `score.sign()`; assert SQL + `assertType<Exact<…, number>>` (the `sign()` line is
  the brand-drop proof).

**J2. `CustomDouble` arithmetic + min/max + abs/ceil/floor/round/sign** —
[src/expressions/values.ts:622-659](../src/expressions/values.ts#L622) · **high**.
- Branch: `add/subtract/multiply/minValue/maxValue` (branded) + the `SqlFunction0` rounding set on a
  customDouble (`sign()` drops brand). (math/trig/power/logn/roundn/divide/atan2 ARE covered.)
- Add → `select.value-source.custom-numeric.test.ts` on `v`/`o`/`m` consts: `v.add(o)`, `v.minValue(o)`,
  `m.abs()`, `m.round()`, `m.sign()`.

**J3. Custom-numeric value-source-RHS (custom ⊕ custom)** —
([values.ts:567-659](../src/expressions/values.ts#L567)) · **high (PARTIAL)**. Only logn/divide/atan2
reach a 2nd custom const; `add/subtract/multiply/minValue/maxValue` custom-RHS untested. Fold into J1/J2.

**J4. `CustomComparable` (`version`) comparison surface beyond `lessThan`** —
[src/expressions/values.ts:247-308](../src/expressions/values.ts#L247) · **high**.
- Branch: `lessOrEqual/greaterOrEqual/notEquals/is/isNot/between/notBetween/in/notIn/inN/notInN` + all
  `*IfValue` twins + the value-source `.asc()/.desc()` ordering form. (Only `{lessThan,greaterThan,equals}`
  run, all consumed as WHERE booleans.) The `select.column-factory-types.test.ts:248` comment claims
  "between is available" but no test asserts it.
- Add → `select.column-factory-types.test.ts`: project `version.lessOrEqual('1.3.0')`,
  `version.between('0.9.0','1.3.0')`, `version.in(['1.2.0','0.9.0'])`, `version.notEquals(...)` →
  SQL + `assertType<…, boolean>`; the `*IfValue` twins in `dynamic-condition.equivalence.test.ts`
  (paired with their direct equivalents).

**J5. `Custom` (Equalable, `channel`) non-equals surface** —
([values.ts:250-271](../src/expressions/values.ts#L250)) · **high**. `notEquals/in/notIn/inN/is/isNot/
*IfValue` untested (only `equals` covered). Add `channel.in(['stable','beta'])`, `channel.notEquals(...)`.

**J6. `CustomUuid` (`signingKey`) `asString()` result + comparison surface** —
[src/expressions/values.ts:803](../src/expressions/values.ts#L803) · **high**.
- Branch: `signingKey.asString()` → `StringValueSource` (brand AND uuid value-type erased) — never
  `assertType`-pinned (only used inside WHERE chains; the plain-uuid `externalRef.asString()` IS pinned but
  that's a different interface). Plus `notEquals/in/*IfValue` on `signingKey`.
- Add → `select.value-source.uuid-cast.test.ts`:
  `selectOneColumn(tProjectRelease.signingKey.asString())` → `assertType<Exact<…, string | undefined>>`
  (optional column) + SQL.

**J7. Custom temporal (`releasedOn`/`cutoffTime`/`signedOffAt`) getters + comparisons** —
[src/expressions/values.ts:901-976](../src/expressions/values.ts#L901) · **high** · *overlaps K2/K3
(different interface — the custom interfaces REDEFINE the getters, so the base-type tests don't reach
them)*.
- Branch: `getFullYear/.../getTime` → plain `NumberValueSource`; comparison `lessThan`/`between`/orderBy on
  the custom temporal column.
- Add → `select.date-ops.test.ts` / `select.column-factory-types.test.ts`: `releasedOn.getFullYear()`,
  `cutoffTime.getHours()`, `signedOffAt.getTime()` projected (`number`/`number|undefined`); plus one
  `releasedOn.lessThan(new Date(...))`.

**J8. Brand-preservation through nullable/optionality modifiers** —
[src/expressions/values.ts:602-975 (per-type redefs)](../src/expressions/values.ts#L602) · **high**.
- Branch: `valueWhenNull`/`nullIfValue`/`asOptional`/`asRequiredInOptionalObject` are re-declared on every
  custom type *specifically* to return the SAME branded `CustomX…ValueSource` — never asserted on any custom
  value source.
- Add → `signingKey.valueWhenNull('00000000-…')` projected → `assertType<Exact<…, SigningKey>>` (brand kept,
  now required) + SQL `coalesce(signing_key, $1)`; a `releasedOn.asOptional()` sibling.

**J9. `const(...,'customComparable'|'customUuid'|'customLocalDate|Time|DateTime')` + operator** —
([AbstractConnection.ts const block](../src/connections/AbstractConnection.ts#L496)) · **high** · *related
to H1/H3 (those pin the const result; this exercises an operator on a const-sourced custom value)*. Only
customInt/customDouble const operands exist. Add e.g.
`const('1.2.0','customComparable','Semver').lessThan('1.3.0')`.

**J10. `fragmentWithType(...,'customX',...)` + operator** —
([AbstractConnection.ts:697](../src/connections/AbstractConnection.ts#L697)) · **high** · *overlaps I1 —
no custom fragment kind exists anywhere*. Add `fragmentWithType('customInt','required').sql\`...\`.add(1)`
projected.

*(PARTIAL, low priority: `tProjectBranded.id` only runs `equals(1)` — add a branded-result operator;
`releaseTagSeq.nextValue()` is projected-branded but operator-free — add `.add(1)` to prove the brand
survives an operator.)*

---

## K. Base-type value-source — member completeness (re-audit of round-1 "covered")

The first pass marked these families "covered" at the family level; per-member checking found specific arms
that no test pins. **All high confidence, 0 matrix-wide hits.** (The bigint/custom arms of K4/K5 overlap
section J — fold each into a single test.)

**K1. Bigint dedicated arithmetic + `sign()` cross-type flip** —
[src/expressions/values.ts:453-528](../src/expressions/values.ts#L453) · **high (top value)**.
- Branch: `BigintValueSource` has its own `add/subtract/modulo/minValue/maxValue/abs` → `BigintValueSource`,
  and `sign(): NumberValueSource` — the ONE bigint→number cross-type method. (`multiply/divide/power/...`
  are intentionally absent.)
- Why missing: only `viewCount.ceil/floor/round` are called (they keep bigint); grep
  `viewCount.(add|subtract|modulo|minValue|maxValue|abs|sign)` / `durationMs.(…)` → 0. `sign()` is tested
  only on `int` (`priority`), where receiver and result are both `number` so the flip is invisible.
- Add → `select.value-source.custom-numeric.test.ts` (or `numeric-ops`):
  `select({ a: viewCount.add(1n), s: viewCount.subtract(1n), m: viewCount.modulo(2n),
  mn: viewCount.minValue(0n), mx: viewCount.maxValue(9n), ab: viewCount.abs(), sg: viewCount.sign() })` →
  `assertType<Exact<…, Array<{ a: bigint; s: bigint; m: bigint; mn: bigint; mx: bigint; ab: bigint;
  sg: number }>>>()` (the `sg: number` is the cross-type proof). Add an optional variant on
  `tIssueWorklog.durationMs.add(1n) → bigint | undefined`.

**K2. Date getters on a pure `localDate` column** —
[src/expressions/values.ts:819-837](../src/expressions/values.ts#L819) · **high**.
- Branch: `LocalDateValueSource` exposes ONLY `getFullYear/getMonth/getDate/getDay` (a real per-type
  capability split vs `LocalDateTimeValueSource`'s full set). Every getter test runs on the
  `localDateTime` `createdAt` arm; the new `tIssueWorklog.workDate` (localDate) has 0 getter calls.
- Add → `select.date-ops.test.ts`: `workDate.getFullYear()/getMonth()/getDate()/getDay()` →
  `assertType<…, Array<{ y: number; mo: number; d: number; dow: number }>>` (required); snapshot date-only SQL.

**K3. Time getters on a pure `localTime` column + optional propagation** —
[src/expressions/values.ts:843-861](../src/expressions/values.ts#L843) · **high**.
- Branch: `LocalTimeValueSource` exposes ONLY `getHours/getMinutes/getSeconds/getMilliseconds`. The new
  `tIssueWorklog.startedAt` is `optionalColumn('started_at','localTime')` → each getter yields
  `NumberValueSource<…,'optional'>` → projected `h?: number`. **Inherited-optionality propagation through a
  getter is asserted on NO value-source type anywhere.**
- Add → `select.date-ops.test.ts`: `startedAt.getHours()/getMinutes()/getSeconds()/getMilliseconds()` →
  `assertType<…, Array<{ h?: number; m?: number; s?: number; ms?: number }>>` (optional).

**K4. `sum`/`sumDistinct` result-type fan-out** —
[src/connections/AbstractConnection.ts:1078-1093](../src/connections/AbstractConnection.ts#L1078) · **high**.
- Branch: 4-arm overload — `INumber→Number`, `IBigint→Bigint`, `customInt→CustomInt`,
  `customDouble→CustomDouble` (all `'optional'`). Only the `int→number` arm is asserted (`sum(priority)`).
- Add → `select.aggregation.test.ts`: `sum(tIssue.viewCount)` → `{ s?: bigint | undefined }`;
  `sum(const(…,'customInt','Score'))` → branded. (Custom arms shareable with J.)

**K5. `min`/`max` type-preservation over non-int input** —
[src/connections/AbstractConnection.ts:1070-1077](../src/connections/AbstractConnection.ts#L1070) · **high**.
- Branch: `min`/`max` return `RemapValueSourceTypeWithOptionalType<…,TYPE,'optional'>` — they PRESERVE the
  input type (string/localDate/bigint/customComparable), flipping only optionality. Proven only for `int`
  (where input=output=number, so preservation is invisible).
- Add → `select.aggregation.test.ts`: `max(tProjectRelease.version)` → projected `{ v?: string }` (the
  branded comparable preserved, proving the remap cascade); optionally `min(tIssueWorklog.workDate)` →
  `{ d?: Date }`.

*(WEAK, low value: K6 plain-`uuid` direct `equals`/`in` emission — no `::text` rewrite — unproven, though
the type promise is covered via the `customUuid` sibling + shared dispatch; K7 getters on branded
custom-local columns — structurally identical to K2/K3, fold in once those land = J7.)*

> **Confirmed COMPLETE (do not re-chase):** the `*IfValue` family (all twins, fire+skip),
> `is`/`isNot`/`isNull`/`negate`, string-ops, `inN`/`notInN`, `stringConcat*`, `count`/`countDistinct`/
> `countAll` — the round-1 "covered" verdict holds for all of these.

---

## L. Insert / update write-side

Round-1 covered the RETURNING result shapes (D2/D3); this is the **values/set** side.

**L1. INSERT `.values()` / `.set({ col: <value-source> })` RHS** —
[src/expressions/insert.ts:1124-1130](../src/expressions/insert.ts#L1124) · **high · biggest write-side
gap · matrix-wide**.
- Branch: `InputTypeOfColumn`'s 2nd arm (`RemapIValueSourceType<NNoTableOrViewRequiredFrom,COL>`) accepts a
  no-table value-source — `const(...)`, a typed/raw fragment, a scalar subquery, `seq.nextValue()` —
  directly in an insert row. **UPDATE covers this (`update.from`/`update.join`); INSERT never does** (it
  only reaches a value-source RHS via `from(select)`, a different path).
- Add → `insert.execute-variants.test.ts` (or new `insert.value-source-set.test.ts`):
  `insertInto(tIssue).values({ projectId: 1, number: 999, title: 'x', status: 'open',
  priority: conn.const(3,'int') })` → assert the SET inlines the expr; add a fragment / scalar-subquery /
  `nextValue()` RHS variant; `assertType` on the accepted row.

**L2. `insertInto(tCountry)` provided-PK at the builder call-site** —
[src/expressions/insert.ts:1074-1089](../src/expressions/insert.ts#L1074) · **high**.
- Branch: a provided (non-autogenerated) PK is in `RequiredColumnsForSetOf` → `MandatoryInsertSets` makes it
  **required** in `values`/`set`; the INSERT emits the PK value. (`tCountry` exists but is used only in
  type-only tests; no write round-trips a provided PK.)
- Add → `insertInto(tCountry).values({ code:'US', name:'United States', region:'AMER' })` per cell,
  asserting the SQL carries `code`. Write-side companion to the closed type-only C2/E3. Optional negative
  peer (omitting `code`) in `types.negative`.

**L3. postgres on-conflict `doUpdateSet({ col: <value-source>/valuesForInsert() })`** —
[src/expressions/insert.ts:1142-1199](../src/expressions/insert.ts#L1142) · **medium · dialect-asymmetry**.
- Branch: `OnConflictInputTypeOfColumn` allows a value-source RHS referencing the existing column AND the
  attempted-insert row (`valuesForInsert()`). Covered on mariadb/oracle/sqlite/mysql; **literal-only in the
  postgres reference cell** (which supports `excluded.col`).
- Add → pg `insert.on-conflict.test.ts`:
  `doUpdateSet({ name: tProject.name.concat(tProject.valuesForInsert().name) })`.

*(PARTIAL: **L4** the `InsertableRow`/`UpdatableRow`/`UpdatableOnInsertConflictRow` value-source-acceptance
probes in `docs.advanced.utility-types.test.ts` assign only literals — tighten one probe to include a
value-source (`{ organizationId: tProject.id }`) so the distinction from the `*Values` twin is proven.
**L5** `dynamicSet()`'s `MissingKeys→Executable` type-narrowing is runtime-covered but never `assertType`-
pinned. **L6** (low) `subSelectUsing`/`subSelectDistinctUsing` arity 2-5 — only 1-arg correlation used;
bounded overload-completeness, no new type-transform.)*

---

## M. Projection / type-transformer recheck

**M1. `InsertableValues`/`InsertableRow`/`Updatable*` value-shape over `tProjectRelease`** —
[src/extras/types.ts:41-64](../src/extras/types.ts#L41) · **high (strongest in this section)**.
- Branch: the insert/update **value object** over a writable table mixing branded customs + a
  `computedColumn` (`notes`) + a `virtualColumnFromFragment` (`versionTag`) — the computed/virtual columns
  must be **absent** from the value object (not `WritableDBColumn`); the customs must surface with their
  resolved leaf types.
- Why missing: `docs.advanced.utility-types.test.ts` asserts only the KEY SETS over `tProjectRelease`
  (`ColumnKeys`/`WritableColumnKeys`); zero references to `InsertableValues<typeof tProjectRelease>` etc.;
  other Insertable* tests use non-branded, non-computed tables and loose `Extends`.
- **Note on brands:** `Semver`/`SigningKey`/etc are *type-name string brands* (the 2nd type arg), NOT
  distinct TS value types — the resolved leaf types are `version: string`, `channel: ReleaseChannel`,
  `signingKey?: string`, `releasedOn: Date`, `cutoffTime: Date`, `signedOffAt?: Date`. Write the assertion
  with those.
- Add → `docs.advanced.utility-types.test.ts`:
  `assertType<Exact<InsertableValues<typeof tProjectRelease>, { projectId: number; version: string;
  channel: ReleaseChannel; signingKey?: string; releasedOn: Date; cutoffTime: Date; signedOffAt?: Date }>>()`
  (id autogenerated → absent; `notes`/`versionTag` absent) + an `Extends`-based `UpdatableValues`. Fold in
  `SelectedRow<typeof tProjectRelease>` (full row incl. `notes: string`, `versionTag: string`) to pin the
  computed/virtual **select-side** (M6).

**M2. Rule-1 (`asRequiredInOptionalObject`) nested object × `projectingOptionalValuesAsNullable()` on a
plain select** —
[src/complexProjections/resultWithOptionalsAsNull.ts:92-186](../src/complexProjections/resultWithOptionalsAsNull.ts#L92)
· **high · cheap**.
- Branch: the rule-1 arm of `ResultObjectValuesProjectedAsNullable2..5` (required-in-optional leaf stays
  required; object `{...} | null`). D1 closed the **rule-2** (all-left-join) nullable arm; A4 builds a rule-1
  object but with the optionals-as-**undefined** projector — the two ingredients never meet.
- Add → `select.complex-projection.inner-rules.test.ts`:
  `select({ iid: tIssue.id, meta: { flag: tIssue.priority.asRequiredInOptionalObject().equals(tIssue.id),
  assigneeId: tIssue.assigneeId } }).projectingOptionalValuesAsNullable().executeSelectOne()` →
  `assertType<Exact<…, { iid: number; meta: { flag: boolean; assigneeId: number | null } | null }>>()`.

**M3. Nullable projector on a mutation `returning()` of a NESTED object** —
[src/expressions/insert.ts:686-696](../src/expressions/insert.ts#L686) · **medium**.
- Branch: `returning(COLUMNS extends DataToProject)` accepts nested object projections, so
  `.projectingOptionalValuesAsNullable()` on a mutation reaches the recursive `…Nullable2..5` arms. D3 closed
  only **flat** mutation-returning-nullable.
- Add → `insert.returning.test.ts` (+ update/delete where supported — respect the existing mysql/mariadb NA
  wraps): a nested-object returning under the helper, asserting the sub-object as `{...} | null`. *Implementer
  must shape the projection (e.g. an `asRequiredInOptionalObject` gate or all-optional nested object) so a
  recursive nullable arm actually fires — validate the inferred type before snapshotting.*

**M4. `DynamicConditionForModel<MODEL, EXTENSION>` second-param forwarding** —
[src/dynamic/condition.ts:39](../src/dynamic/condition.ts#L39) · **medium (thin, type-only)**. The EXTENSION
param is forwarded but every `…ForModel` use is single-arg; the extension is tested only through
`DynamicCondition<DEF, EXT>` directly. Add a type-only
`assertType<Exact<DynamicConditionForModel<M, EXT>, DynamicCondition<DynamicDefinitionForModel<M>, EXT>>>()`
in `dynamic-condition.from-model.test.ts`.

*(NICHE: **M5** aggregate × nullable × rule-1 arm (`resultWithOptionalsAsNull.ts:63-70`) — bundle with M2.
PARTIAL/low: **M7** the `DynamicFilter` aggregated-array type arm is reached only at runtime via `as any` —
pinning the positive `{ titles: {} }` accept is optional; the rejection side is a negative test, out of scope.)*

---

## N. Dialect-specific

**N1. PostgreSQL `usePlatformDependentRound = true`** —
[src/connections/PostgreSqlConnection.ts:58](../src/connections/PostgreSqlConnection.ts#L58) · **high · PG-only
· cheap**.
- Branch: when `true`, `_round` emits `round(<x>)` (libm round-to-even); the default `false` emits
  `round((<x>)::numeric)`. The default path is covered; the `true` path appears only in a discarded
  `void ex_*` doc-code fixture.
- Add → new `config.platform-round.test.ts` in `postgres/newest/pg` (precedent:
  `config.insensitive-collation.test.ts`): subclass `DBConnection` with
  `protected override usePlatformDependentRound = true`, run `tIssue.viewCount.round()` /
  `tIssue.priority.divide(2).round()`, assert `round(view_count)` / `round(priority::float / $1::float)` —
  **no `::numeric`** — contrasting the default cell.

> **LIMITATION (not a gap):** SqlServer `isolationLevel('snapshot')` is intentionally `TODO[LIMITATION]`-
> disabled (`transaction.isolation-level.test.ts:104-110`); `LIMITATIONS.md:249-275` states the mock
> `['snapshot']` pass-through is already covered by the other isolation levels. Honor the marker.

---

## Refuted / already-covered (do NOT re-chase)

Flagged during round-2 discovery and **disproved** during verification (or by the completeness critic):

- **`createTableOrViewCustomization` param-arity P1–P5** — P2 IS covered+asserted (`forSystemTimeBetween`,
  called with 2 params in the executed `documentation/doc-code.generated.test.ts` across all 6 dbs); the
  other arities carry no distinct type-transform.
- **`selectOneColumn(optionalColumn) → T | null`** — covered: `tIssue.externalRef` is an `optionalColumn`,
  and `select.value-source.uuid-cast.test.ts` asserts `string | null` via `.executeSelectOne()` (so the
  `| null` is from column-optionality, not cardinality), with required-contrast cases.
- **PG `transformPlaceholder` per-type cast arms** — all 8 (`::int4/int8/float8/text/uuid/date/time/
  timestamp`) + the value-heuristic fallback are asserted in `select.postgres-const-force-type-cast.test.ts`.
- **`tIssueWorklog` minimal/omittable insert shape** — covered (`select.column-factory-types.test.ts`
  inserts omitting `minutes`/`startedAt`/`durationMs`/`billable`).
- **plain-UPDATE `setIfValue({ col: null })`** — covered (`update.set-if.test.ts` pins the `null`-drop).
- **`forUpdate`/`forShare`/`forNoKeyUpdate`, `whereIfValue`/`andIfValue`/`orIfValue`, `dynamicGroupBy`,
  connection-level `selectCount`** — **these APIs do not exist** in the library (don't invent them).
- **SqlServer `isolationLevel('snapshot')`** — intentional `TODO[LIMITATION]` (see N).
- **`Money` via `executeFunction`** — returns a `Promise<Money>`, not a value source — no operator surface.
- **Transaction surface** (`transaction`/`beginTransaction`/`commit`/`rollback`/deferred-hooks/
  `getTransactionMetadata`/isolation overloads/nested), **`Sequence<T>`** (only `nextValue`/`currentValue`,
  both typed-asserted), **table/view aliasing** (`.as`/`forUseInLeftJoin(As)`/`fromRef`), **root-barrel
  exports** (`OpaqueValues`/`QueryExecutionSource`/`TransactionIsolationLevel`/`ForceTypeCast`/
  `DefaultTypeAdapter`), **`TypeAdapter` `next` chaining**, all five `extras/*` — fully covered
  (completeness critic, 0 new gaps).
- **The `*IfValue` family / `is`/`isNot`/`isNull`/`negate` / string-ops / `inN` / `stringConcat*` /
  `count*`** — confirmed complete (section K).

---

## Quick-win order (cheapest, highest confidence first)

1. **K1, K2, K3, K4, K5** — value-source member additions to existing `numeric-ops` / `date-ops` /
   `aggregation` / `custom-numeric` files (bigint arithmetic+sign, localDate/localTime getters, sum/min/max
   fan-out). No new fixture.
2. **J1–J8** — custom-operator additions to existing `custom-numeric` / `column-factory-types` /
   `uuid-cast` / `date-ops` / `dynamic-condition.equivalence` files. No new fixture (uses `tProjectRelease`).
   Fold the J4/J7 ⊕ K5/K2-K3 overlaps into shared tests.
3. **M1, M2, M3, M4, N1** — projection/dialect additions to existing `utility-types` / `inner-rules` /
   `*.returning` / `from-model` files + one new `config.platform-round.test.ts`.
4. **L1, L2, L3** — write-side additions to existing `insert.*` files.
5. **H1, H2, H3** — new `select.value-source.optional-const.test.ts` + extend the pg const-cast file.
6. **I1–I8, J9, J10** — need **new domain fragment helpers** (touch all 6 `domain/connection.ts`); one
   non-`int`/non-2-arity helper closes several rows; the `aggregateFragmentWithType` family (0 helpers) is
   the highest-value single addition.
