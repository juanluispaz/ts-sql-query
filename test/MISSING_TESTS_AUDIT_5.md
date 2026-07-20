# Missing-tests audit (Round 5) — type-semantics coverage

**Purpose.** Same bar as rounds 1–4: list tests *missing* from the `test/` matrix judged by the
**semantics the type definitions convey** — not line coverage. The unit is a **type-branch**: a
distinction the TypeScript type system makes even when the runtime JS is identical (overloads;
union/optional params; per-type/per-arity arms; type transformations; optionality/nullability
propagation; result-shape inference). A branch is **covered** iff a `test/`-matrix test asserts that
specific distinction — its emitted SQL+params and/or its resulting TS type (`assertType<Exact<…>>`),
or — where the type promises a runtime value (`| null`, `| undefined`, empty array, branded
round-trip) — the produced VALUE via `toEqual`/`toBe`.

**This round was run FRESH and INDEPENDENT.** Nothing from rounds 1–4 was assumed beyond the audit-1
principles; in particular the prior "saturation" verdicts were *not* trusted. Every conclusion below
was re-derived against the **actual current test files**. Method: 8 parallel raw-reading discovery
agents over the public surface → aggregation → 5 adversarial verifiers that each tried to *refute*
every candidate by finding a covering test. Verdicts carried here are the post-verification ones.

**Scope/rules honoured:** coverage validated only against `test/` (not `src/examples/`); negative
type tests (`@ts-expect-error`, `types.negative` cells) out of scope as findings; `src/queryRunners/`
excluded; a variant present only as `void X` / `<any,any>` / a signature snapshot is **compile-only =
not covered**; reference cell `postgres/newest/pg`, matrix symmetric (a gap there is a gap in every
cell); pair every dynamic-condition test with its direct non-dynamic equivalent and assert identical
SQL+params; date/time under `TZ=UTC`. **No source bug was found this round.**

**Headline.** The suite is mature — most areas (columns/Table/View/Values, SELECT fluent surface +
both result projectors, write-side, Connection API) came back *fully covered with evidence*. The
residual tail is genuine but small and concentrated in two seams the prior anchored rounds under-served:
the **dynamic `FilterTypeOf<…>` descriptor arms** (a distinct public type-transform path from the
value-source map) and a few **method-vs-method dispatch arms** (SELECT's own `dynamicWhere()`, the
`expandType*` pick-helper overloads). All confirmed fixes are coverable with **existing fixtures**
(no new DDL).

---

## 📍 Confirmed gaps (verified — implementing agent: apply these)

### §1 — Dynamic `FilterTypeOf<…>` descriptor arms (the densest cluster)

There are **two independent, both-public** type-transform paths to a dynamic-filter type:
`FilterTypeOf<TYPE>` (the **descriptor** form — `dynamicConditionUsingFilters.ts:127-146`, keyed on a
string/tuple descriptor) and `MapValueSourceToFilter<TYPE>` (the **value-source-map** form —
`dynamicConditionUsingFilters.ts:172-193`). The user-facing `withValues(filter: DynamicFilter<DEFINITION>)`
(`dynamicConditionUsingFilters.ts:236`) maps each key via `MapValueSourceToFilter`, **not** `FilterTypeOf`.
So an inline `.withValues({ … })` literal exercises *only* the value-source-map arm; the `FilterTypeOf`
descriptor arm is reached **iff** a test declares `const f: DynamicCondition<{ …descriptor… }> = {…}` and
passes `f`. The equivalence suite is exhaustive on the value-source-map side, but the following descriptor
arms are **never typed** (matrix-wide grep = 0 non-comment hits each). All fixes go in
`dynamic-condition.equivalence.test.ts`, reuse existing columns/snapshots, and follow the *already-covered*
pattern at `equivalence.test.ts:424/787/822` (`const filter: DynamicCondition<{…}> = {…}`).

- **§1.1 `FilterTypeOf<'uuid'>` → StringFilter** · `dynamicConditionUsingFilters.ts:133` · **MED**.
  Only uuid dynamic test (`uuid-as-string-operator-path`, equivalence.test.ts:449) uses the value-source map.
  Fix: `const f: DynamicCondition<{ id:'int', externalRef:'uuid' }> = { externalRef: { containsInsensitive: 'abc' } }`
  → `dynamicConditionFor({ id: tIssue.id, externalRef: tIssue.externalRef }).withValues(f)`. Direct equiv
  `tIssue.externalRef.asString().containsInsensitive('abc')`; identical to the existing snapshot
  `… external_ref::text ilike ('%' || $1 || '%')`, params `["abc"]`.

- **§1.2 `FilterTypeOf<'double'>` → NumberFilter** · `dynamicConditionUsingFilters.ts:131` · **MED**.
  Notable: `DynamicDefinitionForModel` collapses model `number` → `'int'` (`condition.ts:26`), so the explicit
  `{ x: 'double' }` descriptor is the **only** route to this arm. Existing `double-column-dispatch`
  (equivalence.test.ts:348) is value-source-map. Fix:
  `const f: DynamicCondition<{ id:'int', estimatedHours:'double' }> = { estimatedHours: { greaterThan: 2.5 } }`;
  direct equiv `tIssue.estimatedHours.greaterThan(2.5)`; snapshot `… estimated_hours > $1`, params `[2.5]`.

- **§1.3 `['customInt', T]` → CustomIntFilter** · `dynamicConditionUsingFilters.ts:137` · **MED**.
  No `['customInt', …]` tuple literal anywhere. Mirror the covered customComparable pattern:
  `const tag = ctx.conn.const(5, 'customInt', 'ReleaseTag')`;
  `const f: DynamicCondition<{ id:'int', tag: ['customInt', ReleaseTag] }> = { tag: { greaterThan: 3, lessThan: 9 } }`
  → `dynamicConditionFor({ id: tIssue.id, tag }).withValues(f)`. Direct equiv
  `tag.greaterThan(3).and(tag.lessThan(9))`; expected `… where $1 > $2 and $3 < $4`, params `[5,3,5,9]`.

- **§1.4 `['customDouble', T]` descriptor** · `dynamicConditionUsingFilters.ts:138` · **LOW**.
  The test *named* `custom-double-descriptor-dispatch` (equivalence.test.ts:1100) and its comment claim to
  exercise this descriptor, but the body passes a **value source** (`const(5,'customDouble','Money')`), so the
  descriptor arm is untyped. Fix: type the literal —
  `const f: DynamicCondition<{ id:'int', amount: ['customDouble', Money] }> = { amount: { greaterThan: 3, lessThan: 9 } }`
  feeding the same `amount` const; snapshot already `$1 > $2 and $3 < $4`, params `[5,3,5,9]`. **Also fix the
  misleading comment** so it stops claiming descriptor coverage it doesn't provide.

- **§1.5 `['custom', T]` (EqualableFilter) + `['customLocalDate'|'customLocalTime'|'customLocalDateTime', T]`** ·
  `dynamicConditionUsingFilters.ts:140-144` · **LOW**. The four temporal/equality-only descriptor arms; their
  value-source-map twins (`custom-equality-ifvalue-dispatch` :950, `custom-local-*-descriptor-dispatch` :1009)
  are covered but the descriptors are untyped (the `['customLocal*', T]` strings present are comment lines).
  `['custom', T]` is the interesting one — it resolves to **EqualableFilter** (equality-only), the distinction
  vs ComparableFilter. Fix: descriptor-typed siblings reusing the same columns/brands, e.g.
  `DynamicCondition<{ channel: ['custom', ReleaseChannel] }>` and
  `DynamicCondition<{ releasedOn: ['customLocalDate', ReleaseDay] }>`; snapshots identical to :970 / :1032 / :1061 / :1091.

### §2 — Dynamic operator arm: uuid/customUuid `equalsInsensitive`

- **§2.1** · `DynamicConditionBuilder.ts:301-303` (the `useAsStringInUuid` equality-insensitive arm) · **MED**.
  `useAsStringInUuid` lists `equalsInsensitive` / `equalsInsensitiveIfValue` alongside the like/affix keys; the
  `asString()` rewrite fires (`:164-165`) when `__isUuidValueSource`. Every `equalsInsensitive` usage in the
  dynamic tests is on `tIssue.title` (a *plain string*, where the rewrite never fires); the real uuid sources
  (`externalRef`, `signingKey`) are exercised only with `containsInsensitive`/`contains`/`startsWith`. So the
  equality-insensitive branch of the uuid rewrite is unexercised. Fix (equivalence.test.ts):
  `dynamicConditionFor({ signingKey: tProjectRelease.signingKey }).withValues({ signingKey: { equalsInsensitive: '0a8f…' } })`;
  direct equiv `tProjectRelease.signingKey.asString().equalsInsensitive('0a8f…')` — pin the exact pg emission
  for the equality-insensitive rewrite. Bonus: route it through a `DynamicCondition<{ signingKey: ['customUuid', string] }>`
  descriptor to also close the CustomUuidFilter descriptor arm.

### §3 — SELECT builder's own `dynamicWhere()`

- **§3.1** · `src/expressions/select.ts:248/253/304/316` (impl `SelectQueryBuilder.ts:878`) · **MED**.
  `dynamicWhere()` is a distinct public SELECT member returning the `DynamicWhere…ExecutableSelectExpression`
  family with its **own** `.and()`/`.or()` overloads (`select.ts:258-259/266-267`) — a different interface tree
  from `Whereable`. Grep-and-classify of *every* `.dynamicWhere(` call site in `test/db/`: 100% are on the
  **UPDATE** (`update.where-in-subquery.test.ts`) and **DELETE** (`delete.where-in-subquery.test.ts`) builders;
  **SELECT has zero direct calls**. (The `docs.extreme-dynamic-queries.test.ts:46` hit is a false friend — a
  local var `const dynamicWhere = dynamicConditionFor(…)` fed to `.where()`, not the SELECT method.) The
  project's own dynamic-pairing convention is satisfied for UPDATE/DELETE but not SELECT. Fix (new
  `select.dynamic-where.test.ts` or add to `select.conditional.test.ts`; no fixture cost — uses `tIssue`):
  (a) `selectFrom(tIssue).dynamicWhere().and(tIssue.status.equals('open'))…` asserting **identical** SQL+params
  to the direct `.where(tIssue.status.equals('open'))` (`… where status = $1`, `["open"]`) + `assertType<Exact>`;
  (b) an `.and().and()` / `.or().or()` chain exercising the `DynamicWhere*.and/or` overloads;
  (c) the no-condition case (`dynamicWhere()` with no `.and()/.or()` → WHERE elided).

### §4 — `expandType*FromDynamicPickPaths` overload arms

- **§4.1** · `src/dynamic/pick.ts:179-207` (both barrel exports) · **MED-HIGH** (PARTIAL).
  Each helper carries 12 overloads = **3 result-shapes** (paged `{data,count}` = the *first* arm L179/195;
  `RESULT[]` array; single-object `RESULT`) **× 4 nullability variants**. Grep-and-classify of every call site:
  all hit the `RESULT[]` **array** arm only; the **paged `{data,count}` arm**, the **single-object arm**, and
  every **`| null` / `| undefined`** arm are unreached (the one `executeSelectPage()` doc snippet is `void`-ed,
  never piped through). Worse, the **only** call of `expandTypeProjectedAsNullableFromDynamicPickPaths`
  (`dynamic-condition.pick.test.ts:210`) asserts only the runtime value (`toBe`/`toEqual`) with **no
  `assertType<Exact>`** on the reshaped `T | null` type — despite a comment claiming "the call type-checking is
  the real assertion", so a `ResultObjectValuesProjectedAsNullable` regression would compile silently. Fix
  (dynamic-condition.pick.test.ts; no fixture cost): (a) pipe a real `executeSelectPage()` result through
  `expandTypeFromDynamicPickPaths` and `assertType<Exact<…, { data: Array<…>; count: number }>>` + value;
  (b) add an explicit `assertType<Exact<…, Array<{…: T|null}>>>` to the existing nullable-expand call;
  (c) optional: single-object arm via an `executeSelectOne()` result.

### §5 — Write-side: branded/custom RETURNING result type

- **§5.1** · `src/expressions/insert.ts:686/691` & the UPDATE/DELETE `returning*` overloads · **LOW**.
  `returning(...)` / `returningOneColumn(...)` types its result as `ValueSourceValueTypeForResult<COLUMN>`,
  preserving branded value types — but every mutation-returning test asserts only
  `number`/`string`/`Date|null`/nested/optional-as-nullable; custom columns are exercised only on the **input**
  (InsertableRow) side, never *read back* via RETURNING. The branded fan-out is pinned on the **select** path
  but not the write path (a distinct overload tree). Fix (update.custom-columns.test.ts; real-DB-validatable on
  PG, no new DDL): `update(tProjectRelease).set({ channel: 'beta' }).where(…).returningOneColumn(tProjectRelease.channel).executeUpdateOne()`
  + `assertType<Exact<…, ReleaseChannel>>` (use **`channel`** → `ReleaseChannel`, a real nominal union — `version`/`Semver`
  collapses to `string` structurally), wrapped in `withRollback`. The select path already pins this at
  `select.column-factory-types.test.ts:241`.

### §6 — Value-expression dispatch arms (low value, but genuine)

- **§6.1 `notEquals(<column ValueSource>)` / `greaterOrEqual(<column ValueSource>)`** · `values.ts:252/300`
  (impl routes through the same `SqlOperation1ValueSource` as the tested `equals`/`greaterThan` VS-arms) ·
  **the highest-confidence value-expr gap, but trivial**. The column-on-column (ValueSource-RHS) arm of these
  *two specific* comparators has **0 hits** across all 192 pg files — every call passes a constant. The dedicated
  `select.value-source.column-vs-column.test.ts` covers ~18 other VS-arms but skips exactly these two. Fix: add
  `priority.notEquals(id)` and `priority.greaterOrEqual(id)` (param-free `… <> …` / `… >= …`) there, plus an
  optional-propagation variant via `assigneeId`.

- **§6.2 `BooleanValueSource.onlyWhen` / `ignoreWhen` → IfValueSource** · `values.ts:336/361` · **LOW** (PARTIAL).
  These return `IfValueSource` and are only ever exercised on an `AlwaysIfValueSource` seed, never on a
  `BooleanValueSource`/`IfValueSource` receiver (distinct from the well-covered `onlyWhenOrNull`/`ignoreWhenAsNull`).
  Runtime is shared (single definition at `ValueSourceImpl.ts:380`, no receiver override), so this is a
  type-surface/dispatch-line gap, not a behaviour gap → low value. **Side fix:** the comment at
  `select.value-source.conditional-projection.test.ts:14-18` *claims* `onlyWhen`/`ignoreWhen` are covered by the
  `select.conditional*` / `update.conditional-sets` families — verified **false** (those files contain zero such
  calls). Correct or delete that comment regardless of whether the test is added.

- **§6.3 `AlwaysIfValueSource.valueWhenNoValue(<literal boolean>)` on the neutral seed** · `values.ts:380`
  (override `ValueSourceImpl.ts:1449`) · **LOW** (narrow). `select.value-source.always-if-value.test.ts` tests
  only the value-source arm; the literal-boolean arm on the neutral seed is tested on a *different* class. Runtime
  delegates to the already-tested `trueWhenNoValue`/`falseWhenNoValue` → low value.

### §7 — Dialect/config error arm (weakest confirmed; reviewer may keep as observation)

- **§7.1 SQLite `INVALID_CONFIGURATION` (invalid `dateTimeFormat` name)** · `SqliteConnection.ts` (×6
  `getDateTimeFormat` consumers) + `SqliteSqlBuilder.ts:276` (×3) · **MED-LOW**. The `default:` arm of every
  `getDateTimeFormat` consumer throws when the configured format name is invalid — the negative of the 9 valid
  `dateTimeFormat` arms that *are* exhaustively covered, and the only builder-side `INVALID_CONFIGURATION`
  producer. Asserted nowhere. Reachable through a **legal** subclass extension point (`getDateTimeFormat` is a
  `protected override` already exploited by `test/db/sqlite/runners.ts:147 withDateTimeFormat`); a bogus return
  needs only one `as any` on the *return literal* (the documented "future format slips through" contract, not a
  contrived impossible builder state) and throws client-side via `.query()` with no DB. Fix: add to a sqlite-cell
  config test an override returning a bogus format string and `expect(...).toThrow(/INVALID_CONFIGURATION/)`.
  *Honest note:* this is the weakest confirmed item — a reviewer could reasonably downgrade it to an observation.

---

## ❌ Refuted / out-of-scope (verified — do NOT re-chase)

- **`customInt`/`customDouble` as a required branded *Table* column** — **REFUTED.** `select.value-source.custom-numeric.test.ts:27-32`
  already defines `tIssueScored extends Table` with required `customInt`/`customDouble` Table columns, SELECTed
  with SQL+params+value asserted; `select.column-with-custom-type-and-adapter.test.ts:35` adds the 4-arg
  `customInt` Table form. The only residual is a pure type nicety (the brand collapses to `number` structurally on
  a Table leaf) → close per audit scope (typed-surface ≠ type-only-test license).
- **`NO_COLUMN_SETS` four-way empty-`set` fork** — **REFUTED.** `update.execute-variants.test.ts` (17/17 cells)
  already pins all four arms: `executeUpdate`→0 (L175), `executeUpdateNoneOrOne`→null (L187), `executeUpdateOne`
  THROWS `NO_COLUMN_SETS` (L205), `executeUpdateMany`→[] (L223). The discovery's grep missed it (the reason is
  asserted via a `toMatch(/…/)` regex, not a quoted literal).
- **`DynamicDefinitionFieldForModel` boolean→`'boolean'` precedence arm** — **REFUTED.**
  `types.type-edges.test.ts:51-62` has `assertType<Exact<DynamicDefinitionForModel<BillingModel>, { id:'int'; billable:'boolean' }>>`
  with `billable: boolean` (and the `→ never` non-filterable arm at :64-76). Discovery only inspected
  `from-model.test.ts`.
- **Connection API (F5)** — **no genuine gap.** `const(...)` required-arm per-keyword distinctions are asserted
  (scattered across `postgres-const-force-type-cast` / `docs.select` / `custom-numeric` / `uuid-cast`);
  `subSelectUsing` arities 1 and 2 both covered with real values; the rest (createTableOrViewCustomization P1/P3/P4/P5,
  `executeFunction` return-keyword fan-out, `sequence` value-type fan-out, `subSelectUsing` 3–5,
  `dynamicBooleanExpressionUsing` 2–5) is runtime-identical mechanical tail (P0+P2 prove the param-threading).
- **Branded *intersection* newtypes (`Money`/`ReleaseTag` = `number & {__brand}`) through a structural projection,
  and a branded sequence value into insert `.set()`/`.returning()`** — **OUT-OF-SCOPE (needs new fixture).**
  Neither brand is ever a column; closing either leg requires a new branded `customInt`/`customDouble` column in
  `domain/connection.ts` + `schema.sql` across all 6 DBs (added emulated surface, the wrong side of the audit-scope
  boundary). The intersection-brand *transformation* is already representatively covered by the string-union
  brand-through-structure tests. Track as a deliberate fixture task only if a reviewer wants it.
- **The four prior-punted near-negative error reasons** (`MAPPED_SHAPED_COLUMN_NOT_IN_TABLE`,
  `NO_PRIMARY_KEY_FOUND`, `UNKNOWN_DATA_TYPE`, `INVALID_SQL_FRAGMENT_RETURN_TYPE`) — re-confirmed reachable only
  via contrived `as any`/impossible state → stay closed.
- **`columnWithDefaultValue`/4-arg-adapter over a custom kind, `autogeneratedPrimaryKey` over uuid/string** —
  degenerate (runtime-identical to covered arms, or not real-DB-validatable) → close.

---

## ⚡ Quick-win order (all coverable with existing fixtures, no new DDL)

1. **§6.1** `notEquals`/`greaterOrEqual` column-vs-column — 2 assertions in one existing file. Trivial, highest confidence.
2. **§1.1–§1.5** the `FilterTypeOf` descriptor cluster — 6–7 sibling descriptor blocks in `equivalence.test.ts`,
   each reusing an existing snapshot + a `const f: DynamicCondition<{…}> = {…}`. One coherent batch; also fix the
   §1.4 misleading comment.
3. **§3.1** SELECT `dynamicWhere()` — 3 tests pairing with the direct `.where()` (closes a real dynamic-pairing hole).
4. **§4.1** `expandType*` paged/object/nullable arms + the missing `assertType` — routes already-tested page/one
   shapes through the transform.
5. **§2.1** uuid `equalsInsensitive` — 1 test (pins the uuid `asString()` equality-insensitive rewrite).
6. **§5.1** branded RETURNING result type — 1 `returningOneColumn(tProjectRelease.channel)` + `assertType`.
7. **§6.2 / §6.3** the two value-expr dispatch arms (+ the §6.2 stale-comment correction) — low value, do last.
8. **§7.1** SQLite `INVALID_CONFIGURATION` — optional; ship only if you want the negative config arm pinned.

## Saturation observation (not a decree)

Run independently and told to distrust prior "saturated" claims, this pass still found a **non-zero but
low-density** tail: ~13 confirmed items, almost all LOW/MED, all closable with existing fixtures, and clustered in
exactly two seams (the dynamic descriptor path; cross-method dispatch arms). The big surfaces
(columns/Table/View/Values, SELECT + both projectors, write-side, Connection API, extras/adapters, per-dialect
config) verified as genuinely covered with the correct assertion kinds. Each fresh round now yields a thinner,
more peripheral set than the last — the value of another full round after this one is likely marginal, but (as
rounds 4 and 5 both demonstrate) **not yet zero**. No source/type-vs-impl bug surfaced this round.
