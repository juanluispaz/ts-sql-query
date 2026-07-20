# Missing-tests audit (Round 7) — EXHAUSTIVE type-coverage pass

**Mandate (this round was deliberately more ambitious).** Goal: *total coverage of the types in all
their casuistry*. Where an operation accepts a **union** of input types, every member must have a test;
where it is **overloaded**, every overload; where its **return** type has multiple branches
(optionality/nullability transforms, union/conditional results, collapse rules), every branch. The unit
stays the **type-branch** (a distinction the TS type system makes even when runtime JS is identical), and
the COVERED bar is unchanged: a `test/`-matrix test asserts the distinction via emitted SQL+params and/or
`assertType<Exact<…>>` and/or — where the type promises a runtime value — the value via `toEqual`/`toBe`
(`void X` / `<any,any>` / signature-snapshot = compile-only = NOT covered).

**Method.** Fresh and independent (no prior verdict trusted). Because value-expressions are the
combinatorial core (~4,000 lines), the discovery wave was **11 agents** building *explicit enumeration
matrices* (numeric / string / boolean-if / temporal-equalable value sources; columns; SELECT+projectors;
write; Connection API; dynamic; extras-dialects-errors; cross-cutting critic; a dedicated
complexProjections deep-dive). Then **7 adversarial verifiers** tried to *refute* every candidate against
the actual current files. ~**1,200 type-branch cells** were enumerated across the 11 matrices; the
overwhelming majority are covered. After verification: **~30 genuine residual gaps**, **3 source bugs**,
and **1 doc/code discrepancy**. Scope rules unchanged (negatives + `queryRunners/` + contrived-`as any` +
new-fixture-requiring items out of scope; reference cell `postgres/newest/pg`, matrix symmetric; dynamic
gaps pair with their direct equivalent; date/time under `TZ=UTC`).

> **UPDATE (post-audit, src/ fixed).** The **3 source bugs and the doc discrepancy were re-verified against
> the real builder/runtime and resolved in `src/`** (commit on `master`) — **not** deferred to `BUGS.md`.
> Two of the original bug diagnoses were **inverted or incomplete**; the corrected write-ups + concrete
> regression-test recipes are in the rewritten "✅ Source bugs" / "✅ D-1" sections below. For the
> test-generating agent: do **not** add `// TODO[BUG]` markers or re-state these as defects — add the
> *positive* regression tests described. The Tier-1/2/3 gaps below are unaffected.

**Round-6 closure verified.** §1 (is/isNot required leaf), §3 (do-update `returningLastInsertedId`), §4
(boolean dynamic filter), §5 (cross-join `from`) are **implemented** (`column-vs-column.test.ts:366`,
`insert.on-conflict-do-update-extras.test.ts:178`, `equivalence.test.ts:1393`, `select.join.test.ts:150`).
**§2 (MySQL-5 `UNSUPPORTED_QUERY`) is still open** — carried here as §E3.

**Cross-round contradictions resolved.** `createTableOrViewCustomization` **P2 *is* covered**
(`documentation/doc-code.generated.test.ts:120/4479/4493`, all 6 dbs — round-6's *grep* failed, the
*claim* was right); the dynamic boolean→`'boolean'` from-model arm **is covered**
(`types.type-edges.test.ts:58-61`), which also closes the `→ never` arm (`:64-76`).

---

## ✅✅ IMPLEMENTATION OUTCOME — round closed

> This round was implemented end to end. Everything below is the final state:
> what shipped, what was corrected (the audit's claim was wrong), and what was
> deliberately dropped. **Test comments do NOT reference this document** — a
> comment must earn its place by the test's own maintenance value, never by
> answering the audit. Three audit claims were **refuted against the real
> typer/runtime** and are NOT positive-test gaps.

**Shipped (matrix-symmetric, mock-green + real-DB validated on every engine, tsgo + tsc clean):**

| Item | Where it landed |
|---|---|
| **B-2** | `select.value-source.between.test.ts` (`between-with-optional-upper-bound…` + `notBetween` twin); `select.string-ops.test.ts` (`replaceAll-first-arg-optional-null-row`) |
| **B-3** | `dynamic-condition.equivalence.test.ts` (`uuid-not-equals-insensitive-rewrite`, `custom-uuid-not-equals-insensitive-rewrite`), each paired with its direct `.asString()` equivalent |
| **§T1.1** | `select.custom-boolean-remap.test.ts` (insert `verified=true` → re-select → `true`) |
| **§T1.2** | `insert.custom-columns.test.ts` (`returningOneColumn(channel)` → `ReleaseChannel`); NOT-APPLICABLE on mysql (no RETURNING) |
| **§T1.3** | `select.runtime-value-coverage.test.ts`. **Correction:** the nullable flag goes on the **aggregate** (`aggregateAsArray(...).projectingOptionalValuesAsNullable()`), NOT the query |
| **§T1.5** | `select.date-ops.test.ts` (equals/notEquals/is/isNot/in/inN/between/notBetween on temporal columns) |
| **§T1.6** | `select.aggregation.test.ts` — see *Domain coherence* below (real columns, not stubs) |
| **§T2.1 / §T2.2 / §T3.3** | `select.string-ops.test.ts`. **Note:** optional-receiver projections encode as `?: T \| undefined`. `reverse` is NOT-APPLICABLE on the 5 SQLite cells (no `reverse()`) |
| **§T2.3 / §T2.4** | `select.value-source.boolean-chain.test.ts` + `select.value-source.always-if-value.test.ts`. **Note:** the `IfValueSource`/`BooleanValueSource` types are NOT importable under the public-surface rule, so the collapse is pinned via the suite idiom — `let w` reassignment + projectability — not a direct `assertType<…IfValueSource…>` |
| **§T2.6** | `dynamic-condition.equivalence.test.ts` (`bigint-descriptor-dispatch`) |
| **§T2.7** | `select.custom-boolean-remap.test.ts` — see *Domain coherence* below (real column, not stub) |
| **§T2.8** | `marshalling.transform-validation.test.ts` (INVALID_JSON malformed + non-array via `aggregateAsArray`, mock-only) |
| **§T3.1** | `select.aggregate-as-array.modifiers.test.ts` (null-projector riOO gate → `meta: {…} \| null`) |
| **§T3.2** | `select.where.like-escape.test.ts` (not-like family, column arg) + `select.value-source.column-vs-column.test.ts` (lessOrEqual string, notIn/notInN, notBetween column bounds) |
| **§T3.4** | NEW `select.value-source.required-const.test.ts` (required-const leaf type per keyword; `localDate` arm omitted — a non-null date const is not round-trippable on every driver and `const` takes no null) |
| **§T3.7** | `docs.select-page.test.ts` (`executeSelectPage` both-`count`+`data` → zero-query arm) |

**Refuted against the real typer/runtime — NOT positive-test gaps (no test added):**

- **§T2.5 (old values in SET RHS)** and **§T3.5 (old values in WHERE)** — the typer **blocks** both: the SET/WHERE phantom source is `noTableOrViewRequired | table:T` and excludes `oldValues:*`. `oldValues()` is scoped to RETURNING (and the FROM-subquery) **by design**. Reaching the runtime `__sets`/`__where` branch would require a forbidden `as any`. The audit's "real-DB-validatable" premise was wrong. (Old values in a WHERE is also semantically meaningless.)
- **§B-1** — compiler-locked, no positive test (as the audit itself stated).
- **§D-1** — deliberate doc simplification, no change (as stated).

**Deliberately skipped / not tightenable:**

- **§T1.4 (MySQL-5 `UNSUPPORTED_QUERY`)** — version-specific (`mysql < 8_000_000`) and there is **no `mysql/oldest` cell**; per the standing decision not to add cells in a coverage round, it does not apply. The reason stays asserted only via generated snapshots.
- **§T3.6(a)** (tighten the depth-3 `Extends`→`Exact`) — **verified non-tightenable**: the depth-3 nested left-join shape is genuinely version-fragile (even a structural `Extends` fails). The original loose `Extends` is the defensible choice and was kept. **§T3.6(b)**'s null-projector-as-value intent is covered by §T1.3 + §T3.1 + the existing depth-1 null-projector test.

**Domain coherence follow-up (post-review — pre-existing was no excuse).** The audit's §T1.6/§T2.7 leaned on local stubs that reprojected `issue.priority` as `customInt 'IssueId'` / `customDouble 'Money'` (`tIssueCustomNum`, `tIssueScored`) — an incoherent model. These (and the pre-existing siblings using them) were **removed** and replaced with real, coherent shared-domain columns on `tIssueWorklog`, added across all 6 dialects (schema + seed + connection + marshalling):

- `costCents` — `customInt 'Cents'` (marshalled → int): worklog cost in cents.
- `billedAmount` — `customDouble 'Money'` (marshalled → double), `columnWithDefaultValue`.
- `invoiced` — `boolean` via the **numeric** `CustomBooleanTypeAdapter(1, 0)` (stored int 1/0).

`select.aggregation`, `select.value-source.custom-numeric` (the two `*-arithmetic-and-sign` arms) and `select.custom-boolean-remap` were migrated onto these columns. The shape test (`select.optional-computed-column`) was updated. Two unrealistic fixtures were renamed: `tProjectFC` → `tProjectForcedCast`; `tTwoAutoPk` (`t_two_auto_pk`) → `tMisconfiguredMembership` (a plausible `project_member` link table a developer wrongly gave two auto-PKs). Kept: `tProjectBranded` (id→'ProjectId' is coherent).

**A round 8 would start from a genuinely thin field** — Tier 1 + Tier 2 are closed (minus the refuted/skipped items above), and the type-distinction matrix is at effective totality. The only standing residue is the cosmetic Tier-3 tail already judged non-tightenable (§T3.6a).

---

## ✅ Source bugs — **FIXED in `src/`** (write *positive* regression tests asserting the corrected behavior)

> Verified against the real builder/runtime and fixed on `master`. Do **not** add `// TODO[BUG]` markers.
> Add the regression tests below (reference cell `postgres/newest/pg`, matrix symmetric — propagate). The
> SQL shown is the **post-fix postgres** emission; per-dialect quoting/casts differ, so let each cell's
> `toMatchInlineSnapshot` capture its own. CHANGELOG entries already landed under `v2.0.0-beta.2`.

- **B-1 · `CustomInt` arithmetic now tracks BOTH operands' source** · `src/expressions/values.ts`
  (`add`/`subtract`/`modulo`/`minValue`/`maxValue`, value-source overloads). **The original diagnosis was
  backwards.** `multiply` was the *only correct* member: every other numeric family — `NumberValueSource`
  (L420-433), `BigintValueSource` (L486-511) and the structural twin `CustomDoubleValueSource` (L642-666) —
  returns `SOURCE | VALUE[typeof source]`; the five CustomInt siblings wrongly returned bare `SOURCE`,
  dropping the argument's table from the result's phantom source. **Fix:** broadened the five to
  `SOURCE | VALUE[typeof source]` (now uniform with `multiply` + the rest of the library).
  **TEST NOTE — no positive test distinguishes this branch.** `SOURCE` is an internal phantom (not
  `Exact`-assertable), and both forms compile + emit identical SQL whenever both tables are in scope. The
  only regression that proves the tightening is a **negative-type** test (`a.customIntCol.add(b.customIntCol)`
  used where only `a` is in a query's scope → must error), which this round's scope rules exclude. Treat
  B-1 as **compiler-locked**; optionally add a `types.negative/` lock — there is nothing to add to the
  positive matrix.

- **B-2 · two-operand value ops now merge BOTH operands' optionality** · `src/internal/ValueSourceImpl.ts`.
  Confirmed, and **wider than first stated**: (a) `between`/`notBetween` called `getOptionalType2(this, value)`,
  dropping `value2`; (b) `getOptionalType3` (used by `substr`/`substring`/`replaceAll`) carried a latent
  `if (b.__typeAdapter)` gate that dropped the **first** argument's optionality unless it had a type adapter.
  The declared TS types already merge both operands (`values.ts:304` for between; `:758/:762/:769` for the
  string ops). **Fix:** `getOptionalType3` now merges all three symmetrically, and `between`/`notBetween`
  use `getOptionalType3` + `getTypeAdapter3` (the 2-arg pattern the string ops already used).
  **Tests** (each: SQL + params + `assertType<Exact>` + value over a NULL-producing row — all real-DB-validatable):
  - In `select.value-source.between.test.ts` add the **swapped-bound** case (required lower, **optional
    upper**) — the existing `between-with-optional-value-source-bound-projected-is-optional` only covers the
    optional-*lower* arm, which `getOptionalType2` already merged:
    `.select({ b: tIssue.priority.between(tIssue.number, tIssue.assigneeId) })`
    → `select priority between number and assignee_id as "b" from issue where …`;
    `assertType<Array<{ b?: boolean | undefined }>>`; mock a NULL row `[{ b: null }]` → result `[{}]` (the
    now-optional leaf is omitted in the default optionals-as-`undefined` projector). Mirror with `.notBetween(...)`.
  - In `select.string-ops.test.ts` add a **first-arg-optional** case proving the `getOptionalType3` gate fix:
    `tIssue.title.replaceAll(tIssue.body, tIssue.title)` (`body` is `optionalColumn`) → `t?: string`; mock a
    NULL row → the leaf is omitted. (The existing `replaceAll-with-value-source-find-and-replace` asserts the
    optional *type* but only mocks a non-null value, so it never exercised the gated runtime path.)

- **B-3 · `notEqualsInsensitive` on a uuid now casts to text** · `src/queryBuilders/DynamicConditionBuilder.ts`
  (`useAsStringInUuid`) + `src/expressions/dynamicConditionUsingFilters.ts` (`CustomUuidFilter`). **Not a
  crash — invalid SQL** (`ValueSourceImpl` implements every method on one class, so the missing-method theory
  is wrong). Before the fix the dynamic-condition path emitted `lower(external_ref) <> lower($1)` (`lower()`
  applied straight to the uuid), which engines reject (PostgreSQL `function lower(uuid) does not exist`); and
  `CustomUuidFilter` lacked the `notEqualsInsensitive` rule entirely. **Reachable today** via the typed API
  for a plain `uuid` column, since `FilterTypeOf<'uuid'> = StringFilter` (L133) which exposes
  `notEqualsInsensitive`. **Fix:** the rule now routes through `.asString()` like its `equalsInsensitive` /
  `notEqualsInsensitiveIfValue` siblings, and the custom-uuid filter type accepts it (the docs at
  `dynamic-conditions.md:63` already promised "uuid is treated as a string in *all* StringFilter methods").
  **Tests** (pair each dynamic filter with its direct equivalent — they emit **identical** SQL+params):
  - plain uuid: `dynamicConditionFor({ externalRef: tIssue.externalRef }).withValues({ externalRef: { notEqualsInsensitive: '…' } })`
    **and** `tIssue.externalRef.asString().notEqualsInsensitive('…')`
    → both `… where lower(external_ref::text) <> lower($1)`.
  - customUuid (covers the new filter-type member): `DynamicCondition<{ signingKey: ['customUuid', 'SigningKey'] }>`
    filter `{ signingKey: { notEqualsInsensitive: '…' } }` on **`tProjectRelease.signingKey`** (the `customUuid`
    'SigningKey' column), paired with `tProjectRelease.signingKey.asString().notEqualsInsensitive('…')`
    → `… where lower(signing_key::text) <> lower($1)`.
  - per-dialect cast differs (`::text` pg; `bin_to_uuid`/`raw_to_uuid` mysql/oracle; `convert(nvarchar(36), …)`
    sqlserver) — the matching `equalsInsensitive` cell is the shape reference; let each snapshot capture it.

## ✅ D-1 — **resolved: deliberate doc simplification, NO change**

- **`noValueBoolean()` / `dynamicBooleanExpressionUsing()` return types** (`AbstractConnection.ts:1044/1048-1053`).
  The code returns `IfValueSource` / `AlwaysIfValueSource`; the docs say `BooleanValueSource`
  (`docs/api/connection.md:291,297-301`). **This is the established simplification, not a stale type:** the
  simplified vocabulary collapses `IfValueSource`/`AlwaysIfValueSource` → `BooleanValueSource` **everywhere**
  (`equalsIfValue` etc. are documented as `BooleanValueSource` though the code returns `IfValueSource`;
  `simplifiedQueryDefinition.ts` has no `IfValueSource`/`AlwaysIfValueSource` interface at all). Confirmed
  against `simplifiedQueryDefinition.ts:38` and `dynamic-conditions.md`. **No doc edit, no src change.**
  *Optional only:* an `assertType` in `select.no-value-boolean.test.ts` / `select.value-source.value-when-no-value.test.ts`
  locking the *real* return types (`IfValueSource<…, 'required'>` / `AlwaysIfValueSource<…>`) if you want the
  suite to pin the split — low value (both are consumed only in `.where()`/`.and()`, where they're interchangeable).

---

## 📍 Confirmed gaps — Tier 1 (highest value)

- **§T1.1 · One `TypeAdapter` threaded write → read (→ returning) end-to-end** · the single highest-leverage
  addition. `CustomBooleanTypeAdapter` is validated at read (L1), write (L2) and projection (L5) in
  **separate** test bodies; no single test inserts an adapter value and reads it back, so a layer-interaction
  regression survives and the RETURNING-through-`transformValueFromDB` path (L4) is dark for *every* adapter.
  Fix (existing fixture, no DDL): one test inserting `tOrganization.verified = true` (→ stored `'Y'`) then
  reading it back (returning or re-select) asserting `true`. Closes cross-cutting classes #1 (the read leg)
  and #2 (per-layer-only adapters) at once.
- **§T1.2 · INSERT `returning`/`returningOneColumn` of a branded/custom column** · `src/expressions/insert.ts`.
  `insert.custom-columns.test.ts` / `insert.on-conflict.custom-columns.test.ts` have **zero** `returning`
  (every path is `executeInsert()→number`); the INSERT-side `ValueSourceValueTypeForResult` branded path is
  unproven. The UPDATE sibling proves the pattern (`update.custom-columns.test.ts:42`, `ReleaseChannel`). Fix:
  `insertInto(tProjectRelease).set({...}).returningOneColumn(tProjectRelease.channel).executeInsertOne()` +
  `assertType<Exact<…, ReleaseChannel>>` + value (use `channel` — `Semver` collapses to `string`).
- **§T1.3 · NULL projector on a left-join nested object INSIDE an aggregate array** ·
  `src/complexProjections/resultWithOptionalsAsNull.ts:71-77`. The undefined-projector twin
  (`select.runtime-value-coverage.test.ts:143-178`) proves the inner `issue` object is **absent** on a join
  miss; no test proves the null-projector twin yields `issue: null` **present**. This is exactly the
  null-vs-undefined-as-a-VALUE distinction, unverified inside an aggregate. Fix: clone that test + add
  `.projectingOptionalValuesAsNullable()`, assert `issue: {…} | null` and a miss giving `issue: null`.
- **§T1.4 · MySQL-5 `UNSUPPORTED_QUERY`** (round-6 §2, still open) · `src/sqlBuilders/MySqlSqlBuilder.ts:172`
  (recursive `with`) & `:176` (`Values` in FROM), gated `compatibilityVersion < 8_000_000` — the only two
  builder-side throw-sites of that reason, asserted nowhere (no mysql/oldest cell; reason only in generated
  snapshots). Reachable contrivance-free: `new DBConnection(runner, 5_007_000)`. Fix: new
  `config.mysql5-compatibility.test.ts` (mysql2 cell, mock-mode), assert `reasonOf(caught)==='UNSUPPORTED_QUERY'`
  for a recursive CTE and a `Values`-in-FROM, plus a positive contrast.
- **§T1.5 · Temporal equality / membership / between predicate arms** ·
  `src/expressions/values.ts` (Comparable/Equalable on temporal sources). Every temporal predicate test uses
  only the *ordering* members (`lessThan`/`lessOrEqual`/`greaterOrEqual`); `equals`/`notEquals`/`in([dates])`/
  `inN`/`between(d1,d2)`/`is(date)` on a temporal (localDate/Time/DateTime or custom) column are tested
  **nowhere**, so the Date→param encoding for those arms is validated only through `lessThan`. Fix
  (`select.date-ops.test.ts`): `releasedOn.equals(d)`, `createdAt.between(d1,d2)`, `workDate.in([d1,d2])` with
  SQL+params+value.
- **§T1.6 · Custom-numeric aggregate return-type branches** · `src/connections/AbstractConnection.ts:1106/1111`.
  Five arms unasserted: `sum(customDouble)`, `sumDistinct(customDouble)`, `sumDistinct(customInt)` (each keeps
  the brand, `'optional'`), and `average(customInt)`, `average(customDouble)` (each **erases** the brand to
  plain `Number 'optional'` via the hard-coded `'double'` impl) — a structurally distinct return branch.
  `aggregation.test.ts:225` even defers the customDouble arm in a comment. Real-DB-validatable via the existing
  `tIssueCustomNum` / `tIssueScored.dscore` ('Money') stubs (no new DDL). Fix in `select.aggregation.test.ts`
  / `select.aggregate-distinct.test.ts`.

## 📍 Confirmed gaps — Tier 2 (genuine, medium)

- **§T2.1 · `length()` optional type-SHIFT on an optional receiver** · `string?` receiver → `number?` leaf.
  No `.length()` is ever applied to an optional string source (`fragments.test.ts:95`'s `len?: number` is a
  raw fragment, not `StringValueSource.length()`). (Note: `trim`/`substring`/`concat` on an optional receiver
  ARE covered via `tIssue.externalRef.asString()` — uuid-cast.test.ts; only `length`'s type-shift and
  `toUpperCase`/`toLowerCase`/`trimLeft`/`trimRight`/`reverse` on an optional receiver remain.) Fix: a
  projection over `tIssue.body` asserting `{ up?: string; len?: number; sub?: string }`.
- **§T2.2 · A string predicate projected as a boolean leaf with an optional operand → `flag?: boolean`** ·
  broader than first stated: *no* string predicate (sensitive or insensitive) ever projects an optional
  boolean leaf — every projected string-predicate leaf uses required operands (`boolean`); the only `flag?:
  boolean` projections come from a boolean column or a Comparable `between`. Fix: project
  `tIssue.body.contains('token')` asserting `{ hasNeedle?: boolean }`.
- **§T2.3 · Boolean/if COLLAPSE return types are never pinned with a DIRECT `assertType`** · across all of
  `test/db/`, zero `assertType<Exact<…, BooleanValueSource…|IfValueSource…|AlwaysIfValueSource…>>` and zero
  type-imports of those names — every collapse arm (`If.and(Bool)→Bool`, `If.and(If)→If`, …) is witnessed only
  *indirectly* via projectability. The category is behaviourally covered but type-not-pinned. Fix: add direct
  `assertType` locks on the intermediate expressions (one per collapse arm); pairs naturally with the §T2.4
  overload additions and the D-1 return-type locks.
- **§T2.4 · IfValueSource overload arms unreached** (each a distinct overload/branch, all public,
  SQL-validatable): (a) `IfValueSource` receiver for `negate`/`onlyWhen`/`ignoreWhen` (only the Boolean &
  AlwaysIf twins are tested); (b) `IfValueSource.or(IfValueSource)→IfValueSource` stays-If arm (`.and` analogue
  covered, `.or` not); (c) the **two-elide** branch of `IfValue.and/or(IfValue)` (both operands no-value → WHERE
  elided — only all-fire and one-elide are covered); (d) `IfValueSource.and/or(boolean literal)→Boolean`;
  (e) `AlwaysIfValueSource.or(<value source>)` non-literal (only `.or(false)` is tested);
  (f) `IfValueSource.valueWhenNoValue(IfValueSource)→IfValueSource` stays-If (`values.ts:367`). Target
  `select.value-source.{boolean-chain,value-when-no-value,null-and-if-value-modifiers}.test.ts`.
- **§T2.5 · UPDATE old-values in the SET RHS** · `update(t).from(…).set({ col: oldValues.x })`. `oldValues()`
  only ever feeds RETURNING + the FROM-subquery; `set({col: old.x})` reaches a *distinct* emission branch
  (`_extractAdditionalRequiredColumnsForUpdate` scans `__sets`). Real-DB-validatable on the FROM-old dialects
  (PG/SQL Server/MariaDB); probe the per-cell snapshot.
- **§T2.6 · `'bigint'` descriptor arm of `FilterTypeOf`** · `src/expressions/dynamicConditionUsingFilters.ts`.
  Every other scalar carries both a `…-column-dispatch` (value-source-map) and a `…-descriptor-dispatch`
  (`DynamicCondition<{…:'kind'}>`) test; **bigint has only the value-source-map one** (`equivalence.test.ts:396`).
  Fix: `DynamicCondition<{ viewCount:'bigint' }>` filter `{ viewCount: { greaterThan: 10n, lessOrEqual: 99n } }`
  paired with `tIssue.viewCount.greaterThan(10n).and(…lessOrEqual(99n))` → `view_count > $1 and view_count <= $2`.
- **§T2.7 · `CustomBooleanTypeAdapter` numeric overload `(trueValue: number, falseValue: number)`** ·
  `src/TypeAdapter.ts:17`. Every fixture matrix-wide uses the **string** overload; the numeric arm emits a
  different SQL shape (`then 1 else 0` vs `then 'Y' else 'N'`, `_appendLiteralValue` AbstractSqlBuilder.ts:358),
  contrivance-free and real-DB-validatable.
- **§T2.8 · `INVALID_JSON_RECEIVED_FROM_DATABASE`** · `src/queryBuilders/AbstractQueryBuilder.ts:117` (malformed
  JSON) & `:134` (non-array JSON), inside `__transformAggregatedArray` — builder-side, in scope, zero coverage
  while every sibling marshalling reason is covered in `marshalling.transform-validation.test.ts`. Mock-only
  reachable via `aggregateAsArray` + a bad-JSON / non-array `mockNext` (the documented from-db pattern).

## 📍 Confirmed gaps — Tier 3 (low value: SQL-snapshot completeness / symmetry / narrow)

- **§T3.1 · NULL projector `requiredInOptionalObject` gate inside an aggregate array** ·
  `resultWithOptionalsAsNull.ts:63-70`. The undefined twin is covered (`modifiers.test.ts:262`); the null
  variant (`:302`) only proves the always-null path via `onlyWhenOrNull(false)`, never the leaf-type
  distinction (riOO-required vs plain-optional → `| null`).
- **§T3.2 · Eight negated-operator column-RHS (ValueSource) arms** — `lessOrEqual(col)` on a string,
  `notIn([col])`, `notInN(…col)`, `notBetween(col,col)`, and sensitive `notLike`/`notContains`/`notStartsWith`/
  `notEndsWith(col)`. Each affirmative twin's VS arm is covered; only the `not`/`<=` keyword path is unpinned —
  SQL-snapshot completeness (no new type branch). Target `column-vs-column.test.ts` / `like-escape.test.ts`.
- **§T3.3 · `toUpperCase`/`toLowerCase`/`trimLeft`/`trimRight`/`reverse` on an optional receiver** — the
  remaining optional-receiver transforms beyond §T2.1 (LOW; runtime/type identical to the covered required
  receiver except the `?`).
- **§T3.4 · `const(...)` REQUIRED per-keyword projection with `assertType<Exact>`** — the matrix-symmetric
  mirror of the exhaustive `optional-const` file. The required-const **SQL** is covered (pg-only,
  `postgres-const-force-type-cast.test.ts`, no `assertType`); the required leaf TYPE is only *implied*
  pervasively via operand-result assertions. A symmetry gap more than a risk gap.
- **§T3.5 · UPDATE old-values in the WHERE** · `where(oldValues.x …)`. Borderline-CONTRACT:
  `_extractAdditionalRequiredColumnsForUpdate` does **not** scan `__where`, and docs scope `oldValues()` to
  RETURNING — a WHERE-only `old.x` likely emits broken SQL. **Probe the real DB first**; may be NOT-APPLICABLE
  rather than a gap.
- **§T3.6 · Depth-3 nested projection asserted by `Exact`** — the only depth-3 projection
  (`docs.complex-projections.test.ts:114`) pins SQL+params+value exactly but the TYPE only by loose `Extends`;
  the null projector has no depth-2+ nesting test. And **§T3.7 · `executeSelectPage({count, data})` both-provided
  → zero-query** arm (`SelectQueryBuilder.ts:209`) is the one uncovered page branch.

---

## ❌ Refuted / out-of-scope (verified — do NOT re-chase)

- INSERT MissingKeys positive resolved-transition — **covered** (`docs.insert.test.ts:437-441`).
- String `trim`/`substring`/`concat` on an optional receiver — **covered** via `asString()` on the optional
  `tIssue.externalRef` (uuid-cast.test.ts:74/90/107).
- Dynamic boolean→`'boolean'` from-model arm AND the `→ never` arm — **covered** (`types.type-edges.test.ts:58-76`).
- `createTableOrViewCustomization` P2 — **covered** (`documentation/doc-code.generated.test.ts:120/4479/4493`,
  all 6 dbs); P1/P3/P4/P5 are **degenerate** (one shared variadic impl; P2 proves the param-threading).
- `subSelectUsing` 3-5 / `subSelectDistinctUsing` 2-5 / `dynamicBooleanExpressionUsing` 2-5 — **degenerate**
  source-union widening over a shared `(...tables: any[])` impl (max arity reached: 2 / 1 / 1).
- `customInt` Table column `assertType` (`tProjectBranded.id`) — **degenerate**: value type is plain `number`
  (a TYPE_NAME, not a nominal brand), so an added `assertType` would only pin `number`.
- The 6 `SqlFunction1` optional-merge-from-argument arms (`power`/`logn`/`roundn`/`atan2`/`subtract`/`multiply`/
  `divide`/`modulo`) — **degenerate**: same `getOptionalType2` merge as the tested `add` arm.
- `columnWithDefaultValue` uuid/double, `optionalColumnWithDefaultValue` non-int, branded `customDouble`/
  `customUuid` bare-Table projection — need a new fixture column (12-file cost) for a pure type-intersection
  already proven on a sibling → out of scope.
- Connection API otherwise **fully covered** (`optionalConst` exhaustive, the whole fragment family arity 0-5
  + keyword arms, `executeFunction`/`Procedure` Promise<T>/T|null/branded/void branches, transaction/isolation/
  deferred hooks, sequences). Cross-type int-OP-double has no distinct TS result type (both surface as
  `number`) → the only diff is SQL emission (out of scope); the one real cross-type distinction (optional merge)
  is covered.

---

## ⚡ Quick-win order

1. **§T1.1** adapter write→read→returning end-to-end (closes two cross-cutting classes in one test).
2. **§T1.4** MySQL-5 `UNSUPPORTED_QUERY` (a whole error path; one new mysql-cell file).
3. **§T1.2** INSERT branded returning · **§T1.3** null-projector aggregate nested object · **§T1.5** temporal
   equality/between/in · **§T1.6** custom-numeric aggregates — each one focused test/block, existing fixtures.
4. **§T2.x** the boolean/if overload + collapse-type batch (§T2.3+§T2.4 together, plus the D-1 return-type
   locks), `length()→number?` (§T2.1), string-predicate optional leaf (§T2.2), bigint descriptor (§T2.6),
   CustomBoolean numeric (§T2.7), INVALID_JSON (§T2.8), UPDATE old-values in SET (§T2.5).
5. **Source bugs B-1/B-2/B-3 are already FIXED in `src/`** → add the *positive* regression tests in the
   "✅ Source bugs" section (B-2 between swapped-bound + string-op first-arg-optional; B-3 plain-uuid &
   customUuid `notEqualsInsensitive`, each paired with its direct `.asString()` equivalent; B-1 is
   compiler-locked — no positive test). D-1 needs no doc change (optional `assertType` lock only).
6. **§T3.x** the low-value tail (negated-op snapshots, optional-receiver transforms, required-const symmetry,
   depth-3 `Exact`, zero-query page) — finish only if pursuing literal totality.

## How close to TOTAL coverage?

On the type-distinction axis the suite is genuinely **~90%+** and the *primary* matrix (every value-source
method's principal arm, every column factory, both projectors' main rules, the write surface, the Connection
API) is saturated. What this exhaustive pass surfaced is the **systematic dual** of that matrix — the casuistry
classes a write-first / positive-first / per-layer test design under-enumerates:
1. **the read/RETURNING leg** (branded + adapter values coming *back* — the suite's biggest shadow);
2. **per-layer-only adapters** with no end-to-end thread;
3. **optional-receiver / optional-operand** propagation (vs the well-covered optional-*argument*);
4. **negated / stays-If / collapse return-type** arms witnessed only indirectly;
5. **the null projector inside aggregates** (null-vs-undefined as a VALUE);
6. **rarer descriptor / numeric-overload / error-reason** arms.

Closing Tier 1+Tier 2 (≈18 focused additions, all existing-fixture) would put the type-distinction coverage
effectively at totality; Tier 3 is the cosmetic remainder. Three real source bugs and one doc/code split
surfaced along the way — the first source defects since round 3, which is itself evidence the exhaustive lens
reached new ground. A round 8 would face a genuinely thin field, but "total" is now within one focused
implementation pass.
