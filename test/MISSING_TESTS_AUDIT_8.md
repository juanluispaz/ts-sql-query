# Missing-tests audit (Round 8) — EXHAUSTIVE type-coverage pass

**Mandate.** Same as round 7: *total coverage of the types in all their casuistry* — every union-input
member, every overload, every return-type branch. Unit = type-branch; COVERED = a `test/`-matrix test
asserts the distinction via SQL+params and/or `assertType<Exact<…>>` and/or (where the type promises a
value) the value via `toEqual`/`toBe` (`void X` / `<any,any>` / signature-snapshot = NOT covered).

**Method.** Fresh and independent. 11 discovery agents rebuilt explicit enumeration matrices over the
whole public surface; 7… (this round) **5 adversarial verifiers** then tried to *refute* every candidate
against the actual current files. Scope rules unchanged (negatives + `queryRunners/` + contrived-`as any`
+ new-fixture-requiring items out of scope; reference cell `postgres/newest/pg`, matrix symmetric;
dynamic gaps pair with their direct equivalent; date/time under `TZ=UTC`).

**State of the field.** After seven prior rounds (round 7's ~30 gaps + 3 src fixes all shipped, commit
`8d4585c2`), the field is **thin**. Two whole surfaces came back **100% covered** (columns/Table/View/Values;
the result-shape projectors are at parity bar one low arm), and every other matrix reports "near-fully
covered". **No new source bug** surfaced — the three round-7 fixes (`between`/`notBetween` + `substr`/
`substring`/`replaceAll` both-operand optionality; `notEqualsInsensitive` on uuid; `CustomInt` arithmetic)
are verified consistent type↔impl in the current tree. What remains is **second-sibling completeness**: the
round-7 fixes were pinned on their *representative* method, leaving the symmetric siblings to shared
plumbing; plus a handful of genuine behavior/composition forks. **All confirmed gaps are coverable with
existing fixtures** (the one apparent exception — temporal `between(VS,VS)` — was verified `.asOptional()`-
synthesizable, refuting the discovery's new-fixture claim).

**Round-7 closure verified** across all surfaces (both-operand `between`, `notEqualsInsensitive` uuid,
`length()→number?`, INVALID_JSON, numeric `CustomBooleanTypeAdapter`, the null-projector-in-aggregate pair,
INSERT branded returning, required-const, bigint descriptor, adapter write→read). Skipped/refuted items
from round 7 (MySQL-5 `UNSUPPORTED_QUERY` — no `mysql/oldest` cell; old-values in SET/WHERE — typer-blocked;
depth-3 `Extends` — version-fragile) are **not** re-flagged.

---

## 📍 Tier 1 — genuine forks (highest value, existing fixtures)

- **§1 · `allowEmptyString = true` behavior branch is entirely unasserted** · `AbstractConnection.ts:38`
  (the protected flag) drives three guards — marshalling `'' → null` (`:1145`/`:1331`) and the SqlBuilder
  `_isValue` guard behind `setIfValue` (`AbstractSqlBuilder.ts:248`). Only the **default-`false`** arm is
  tested (`'' → null` both directions; `setIfValue('')` dropped at `docs.insert.test.ts:533`). The
  **`true`** arm (`''` sent VERBATIM; `setIfValue('')` NOT skipped) has zero assertion anywhere. The flag is
  a legal protected extension point (sibling to `compatibilityVersion`/`insensitiveCollation`); a one-line
  `protected override allowEmptyString = true` subclass (mirroring `config.platform-round.test.ts`) drives
  all three guards in the existing pg cell — no new matrix cell. Fix: assert `''` round-trips verbatim and
  `setIfValue('')` emits the column.

- **§2 · `BooleanValueSource.and(IfValueSource)` / `.or(IfValueSource)` → Bool collapse** · `values.ts:333/335`.
  The dual of the covered `IfValueSource.and(BooleanValueSource)→Bool` (`operator-composition.test.ts:152/205`),
  and a real **runtime fork**: when the `*IfValue` argument carries no value it elides to `''` and the AND/OR
  reduces to just the Boolean (verified in `AbstractSqlBuilder._and:2977` / `_or:3010`, the `!sql2` branch) —
  so `priority.equals(2).and(status.equalsIfValue(undefined))` must emit only `priority = $1`. Never tested
  for the Boolean-receiver direction anywhere in the matrix. Fix: 4 tests in `operator-composition.test.ts`
  (2 methods × {value-present projected, no-value elide}), mirroring `:152/:205` with receiver/arg swapped.

- **§3 · `TypeAdapter` threaded through `fragmentWithType(...)` + a `returning()`-adapter-column read** ·
  `AbstractConnection.ts:697+` — every `fragmentWithType` overload accepts an `adapter?: TypeAdapter`, but
  **no test ever threads one** (every call site is 2/3-arg). And the non-identity read transform
  (`bracketAdapter`) is proven only at the `virtualColumnFromFragment(…, bracketAdapter)` attachment point;
  no `.returning()` of an adapter column asserts `transformValueFromDB` (the column-level test uses an
  identity `LoggingAdapter`; `activityTagged` is never returned). Both legs reuse the existing `bracketAdapter`
  (`domain/connection.ts:15`). The "last attachment point" of the adapter-through-every-layer chain.

- **§4 · `.returning({...}).customizeQuery({...})` on INSERT / UPDATE / DELETE** · the object-RETURNING +
  customizeQuery arm (`ComposableCustomizableExecutableInsert.customizeQuery` `insert.ts:646`, and the UPDATE/
  DELETE analogues) — distinct from the `returningLastInsertedId().customizeQuery()` arm that *is* covered
  (`docs.sql-fragments.test.ts:109`, a different interface). `customizeQuery` is otherwise tested only on the
  count-only builders. The object-returning + customize arm preserves the RETURNING result type and is
  untested on all three mutations. Fix: one test per mutation in `customize-query.{insert,update,delete}.test.ts`.

## 📍 Tier 2 — round-7-fix sibling optionality (a coherent cluster; all `.asOptional()`, no new fixtures)

The round-7 commit pinned both-operand optionality on its *representative* method; the symmetric siblings
share the identical `MergeOptional` / `getOptionalType2`/`getOptionalType3` machinery but their VS-argument-
optional → optional-result branch is unpinned. All are synthesizable with `.asOptional()` on an existing
required column (verified — **no new fixture**, refuting the one new-fixture claim the discovery raised).

- **§5 · `CustomInt`/`CustomDouble` arithmetic both-operand optionality** (`required-custom.add(optional-custom)`
  → brand-KEPT + optional). The *exact* branch round-7 changed, for the types it named — untested because
  `costCents`/`billedAmount` are the only custom-numeric columns and both required; `.asOptional()` synthesizes
  the optional operand. Highest-value of this cluster. Target `select.value-source.custom-numeric.test.ts`.
- **§6 · `substr`/`substring`/`substrToEnd`/`substringToEnd` VS-argument-optional → optional result** —
  `replaceAll` got its optional-arg lock (`string-ops.test.ts:491`); these siblings did not. Use `assigneeId`.
- **§7 · `concat` VALUE-overload arg-optional** (`title.concat(body)` → `slug?`) and `concat` on an optional
  receiver → `string?` (the one transform omitted from round-7's optional-receiver block). `string-ops.test.ts`.
- **§8 · `BigintValueSource` value-source-RHS arithmetic overload** (`viewCount.add(<bigint VS>)`) — only
  const-RHS + receiver-optional are exercised. Buildable from `viewCount` / `.asOptional()`.
- **§9 · Temporal `between(temporalVS, temporalVS)` projecting the both-bound optional-boolean leaf** — pinned
  for numeric (`between.test.ts:152/174/197`), not temporal. **No new fixture:** `releasedOn.between(releasedOn.asOptional(),
  releasedOn)` (same column three times) is type-valid (`asOptional` preserves TYPE_NAME, `values.ts:314`) and
  real-DB-validatable. Target `select.date-ops.test.ts`.

## 📍 Tier 3 — composition + completeness (medium-low)

- **§10 · Chained compound** `union(a).union(b)` (and mixed) — no test chains two compound ops; RESULT/FEATURES
  preservation through the 2nd compound on `CompoundedExecutableSelectExpression` is unexercised. `select.compound*.test.ts`.
- **§11 · Compound-as-subquery** — a compounded select fed to `forUseAsInlineQueryValue()` / `forUseInQueryAs()`
  (verified: every such receiver in the cell is a plain/CTE select, never a compound). Distinct emission +
  inline-value type unpinned.
- **§12 · DELETE…RETURNING of a branded/custom column** — INSERT (round-7) + UPDATE (`update.custom-columns.test.ts:42`)
  are pinned; DELETE is the missing leg (`delete.returning*.test.ts` returns only plain columns). Fix:
  `deleteFrom(tProjectRelease).where(...).returningOneColumn(tProjectRelease.channel)` + `Exact<…, ReleaseChannel>`.
- **§13 · `fragmentWithType('customDouble','required')` and `('localDateTime','required')`** — the only two genuine
  `fragmentWithType` keyword holes (every other custom/temporal arm is covered in `fragments.type-coverage.test.ts`,
  which the discovery under-counted). `customDouble` resolves to a distinct `CustomDoubleFragmentExpression`
  (Money→double); `localDateTime` is a distinct full-timestamp read-back. Columns exist; `fragments.type-coverage.test.ts`.
- **§14 · `from(select).returningLastInsertedId()` → `number[]`** (`ReturningLastInsertedIdFromSelectType`,
  `insert.ts:717`) — distinct from the scalar VALUES path and the covered multi-row VALUES array; NOT-APPLICABLE
  on oracle (`OfDB` excludes it → `never`).
- **§15 · The boolean/if low-collapse rim** — `IfValueSource.or(boolean literal)→Bool` projected (only `.and(true)`
  twin pinned); `IfValueSource.valueWhenNoValue(BooleanValueSource)` value-source-arg collapse type-lock (literal
  twin pinned); `BooleanValueSource.or(<nullableVS>)` optional-widening (`.and` pinned at `operator-composition.test.ts:201`,
  `.or` not). All low — shared plumbing with a pinned twin.
- **§16 · asNull projector Rule-3 required-inner-object in a PLAIN select** — narrower than first stated: only
  non-degenerate when the required inner object *also* carries an optional leaf (Rule-3 flips optional leaves to
  `| null`); both existing plain-select asNull tests make the object itself nullable. Include an optional leaf and
  value-assert it `null`.
- **§17 · asNull aggregate-array Rule-2 arm** (`…ForOptionalNullableObjectResultSameOuterJoin`, the lone leaf
  mapper never reached through the array projector) — structurally near-identical to the covered round-7 §T1.3 case.
- **§18 · low sibling-completeness:** temporal `equals`/`notEquals`/`is`/`isNot` VS-column overload (only literal-Date
  arm tested); `valueWhenNull(VS)` optional-VS→optional-leaf for temporal/uuid; on-conflict `returningOneColumn`
  on both conflict arms; `DynamicPick` + `OrderByForModel` need a one-line `assertType<Exact>`.

---

## ⚙️ Mechanical tail / refuted / out-of-scope (verified — do NOT chase)

- **`arg`/`valueArg` keyword fan-out** (temporal / `valueArg('bigint'|'uuid')` / customInt/customDouble) — **MECHANICAL.**
  `arg`/`valueArg` share one dispatcher building a plain `Argument` field-holder; when a fragment binds a
  *ValueSource* the type-name is never read, and no fragment test binds a plain temporal/custom *value*. Only a
  literal-value bind would exercise the marshalling — low value.
- **`aggregateFragmentWithType` custom/temporal/uuid arms** — MECHANICAL-leaning: it builds the *same*
  `FragmentQueryBuilder` as `fragmentWithType` with an `isAggregate` flag; re-proves already-covered per-type
  transforms under that flag. (And `fragments.type-coverage.test.ts` already covers several of these.)
- **Dynamic vsm inline custom filters (customInt/customDouble/customUuid) + `FilterTypeOf<'localDateTime'>` descriptor**
  — MECHANICAL: `MapValueSourceToFilter` and `FilterTypeOf` resolve to the *same* Filter interface and the runtime
  dispatch is byte-identical to the paired descriptor/vsm tests already present. Type-surface symmetry only.
- **`executeFunction` boolean/uuid/localDate/localTime + branded-customInt return arms** — genuine per-arm Promise<T>
  transforms, BUT each needs a new DB function in `domain/schema.sql` + a fixture wrapper → **fixture-cost**, deferred
  (not existing-fixture). Note only.
- **`is`/`isNot` force-required projection** — covered (`column-vs-column.test.ts:366`); `isIfValue`/`isNotIfValue`
  return `IfValueSource` (not projectable as a required leaf) → degenerate.
- **`executeSelectNoneOrOne()` present-row value** — degenerate (the `T|null` union is pinned at both sites;
  `executeSelectOne` covers the present shape). Close.
- **required-uuid `asString()` bare leaf** — degenerate (pinned transitively, `uuid-cast.test.ts:136/319`).
- **MySQL-5 `UNSUPPORTED_QUERY`** — remains generated-snapshot-only per the standing no-new-cell decision (no
  `mysql/oldest`); not re-flagged as actionable.

---

## ⚡ Quick-win order

1. **§1** `allowEmptyString=true` (a real untested config-behavior branch; one subclass, existing pg cell).
2. **§2** Boolean `.and/.or(IfValueSource)` collapse (real runtime fork; 4 tests).
3. **§3** TypeAdapter via `fragmentWithType` + returning-adapter read (the last adapter attachment point; 2 legs).
4. **§4** `.returning(obj).customizeQuery()` × 3 mutations.
5. **§5–§9** the round-7-fix sibling optionality cluster — one coherent batch of `.asOptional()` leaves across
   `custom-numeric` / `string-ops` / `date-ops` (closes §5 §6 §7 §8 §9 together; they share `MergeOptional`).
6. **§10–§13** compound chaining + compound-as-subquery + DELETE branded returning + the two `fragmentWithType` arms.
7. **§14–§18** the low completeness rim (incl. the boolean low-collapse twins and the two `Exact` one-liners).
8. Skip the mechanical tail unless pursuing literal totality.

## How close to TOTAL coverage?

Closer than round 7 — the type-distinction matrix is now **~95%+** and *two* whole surfaces verify at 100%.
This round found **no new source bug** and **no new systematic class**: round 7's "dual" closures hold under
independent re-verification, and what remains is a thin, predictable **second-sibling rim** — a fix pinned on
its representative method, its symmetric twin (`.or` vs `.and`, DELETE vs INSERT/UPDATE, `substr` vs `replaceAll`,
custom vs plain numeric) left to shared plumbing — plus four genuine behavior/composition forks (§1–§4) and a
handful of compound/projector completeness arms. Closing Tier 1 + Tier 2 (≈13 focused, existing-fixture additions)
takes the type-distinction coverage to effective totality; Tier 3 + the rim is cosmetic. A round 9 would face an
essentially exhausted field — the honest call is that **this is the floor**: the remaining items are completeness,
not risk, and the marginal value of further full rounds is now low. The high-leverage closeouts are §1, §2, §3.
