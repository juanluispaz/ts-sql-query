# Missing-tests audit (Round 9) — EXHAUSTIVE, fresh/independent type-coverage pass

**Mandate.** Discover tests the TYPES imply but the suite lacks — *total coverage in all casuistry*:
every union-input member, every overload, every return-type branch. Unit = type-branch; COVERED = a
`test/`-matrix test asserts the distinction via SQL+params and/or `assertType<Exact<…>>` and/or (where the
type promises a value) the value via `toEqual`/`toBe` (`void X` / `<any,any>` / signature-snapshot = NOT
covered). **Fresh and independent:** no prior round's gap list or conclusion (including "this is the
floor") was taken on faith — every verdict was re-derived against the actual current files.

**Method.** 11 discovery agents rebuilt explicit enumeration matrices over the whole public surface; 5
adversarial verifiers then tried to *refute* every candidate. Scope rules unchanged (negatives +
`queryRunners/` + contrived-`as any` + new-fixture-requiring + version-band-needing-an-absent-cell items
out of scope; reference cell `postgres/newest/pg` (193 files), matrix symmetric; dynamic gaps pair with
their direct equivalent; date/time under `TZ=UTC`).

**State of the field.** Genuinely thin — three whole surfaces verified **fully covered** (columns/Table/View/
Values; temporal/uuid/base-hierarchy value sources; the Connection API), and the rest near-full. **No source
bug with behavior** (one cosmetic src typo noted below). The fresh pass nonetheless surfaced a real residual
the prior "floor" call had not enumerated — concentrated in four places: the **plain-select nullable
projector** (a genuine null-vs-undefined *value* gap), **two builder-error reasons** every prior round
missed, a few **extras-runtime branches**, and a handful of **write execute/composition** arms. It also
**corrected a round-8 worry**: F8 alleged the §3 RETURNING-adapter-read never landed — verification shows
**both §3 legs did land** (F8's grep was mis-scoped); see Refuted.

---

## 📍 Tier 1 — genuine value/behavior gaps (existing fixtures)

- **§1 · NULL projector, pure Rule-4 optional object → `{…} | null` present-as-`null` (runtime VALUE)** ·
  `src/complexProjections/resultWithOptionalsAsNull.ts:56-206`. The strongest projector gap and a true
  null-vs-undefined *value* distinction: the asUndefined twin drops the key (`inner-rules.test.ts:184`,
  expected `{iid:3}`), but no `projectingOptionalValuesAsNullable()` twin asserts the object surfaces as
  `opt: null` at runtime. The plain-select asNull ladder carries the outer `| null` (its own `…Nullable2/3/4`
  helpers), so the aggregate-projector tests cannot stand in. Fix: one plain-select
  `.projectingOptionalValuesAsNullable()` test over an all-optional nested object, asserting `{…} | null` +
  the runtime `null`.

- **§2 · NULL projector, `originallyRequired` DIRECT scalar leaf, join-miss → `null` (type + VALUE)** ·
  the asUndefined twin pins only a join *hit* (`operator-composition.test.ts:148`, `orgPlus?: number`); the
  asNull twin (`tOrgLeft.id.add(1)` → `number | null`, miss → `null`) is absent in both type and runtime.

- **§3 · INSERT on-conflict DO NOTHING `.returning(...).executeInsertMany()`** · `src/expressions/insert.ts`
  (`ExecutableInsertReturningOptional.executeInsertMany`). `values([...]).onConflictDoNothing().returning(...)`
  reaches a valid execute branch that every do-nothing returning test skips (they all use
  `executeInsertNoneOrOne`). (The *absence* of `executeInsertOne` on that interface is types.negative → out of
  scope.) Real-DB-validatable.

- **§4 · INSERT on-conflict returning × `customizeQuery`** · the one returning-source whose
  returning×customizeQuery composition is unasserted — the `onConflict ∩ customizeQuery` file set is empty
  matrix-wide, while plain / from-select / UPDATE / DELETE returning×customize are all covered.

- **§5 · UPDATE `executeUpdateNoneOrOne()` with OBJECT-shape returning (`{…} | null`)** · only the
  single-column branch (`returningOneColumn`) is asserted for UPDATE; INSERT and DELETE both cover their object
  `noneOrOne` (`insert.returning.test.ts:236`, `delete.returning.execute-shapes.test.ts:47`).

- **§6 · `valueWhenNull` / `nullIfValue` redefined on the bigint / customInt / customDouble leaves** ·
  `src/expressions/values.ts:520-523 / 602-605 / 668-671` — each leaf redefines these with a brand-keeping
  return branch; only the plain `NumberValueSource` versions are tested (the only file exercising these leaves,
  `custom-numeric.test.ts`, has zero `valueWhenNull`/`nullIfValue`). Fixtures `durationMs` (optional bigint),
  `costCents` (customInt), `billedAmount` (customDouble) — real-DB-validatable, no new DDL.

- **§7 · Two genuinely-reachable builder-side error reasons, asserted nowhere** —
  **`MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`** (`AbstractQueryBuilder.ts:59`): three comment mentions, zero
  assertions; reachable mock-only and the `fromDbReason` helper + required `tIssue.title` already exist (one
  test). **`ERROR_EXECUTING_DEFERRED_IN_TRANSACTION`** (`PromiseUtils.ts:42/51`): the wrapper reason is in the
  chain `reasonsInChain` already walks in `transaction.deferring-guards.test.ts`, but the asserts only
  `.toContain` the inner reasons — a one-line add pins the wrapper.

- **§8 · `IDEncrypter.decrypt` internal-checksum mismatch path** · `src/extras/IDEncrypter.ts:165`. The tamper
  test flips the last char → fails at the *public* checksum (`:140`), never reaching `:165`. Reachable WITHOUT
  contrivance via encrypt-with-key-A / decrypt-with-key-B (public checksum passes `:140`, the wrong key fails
  at `:165`); no such test exists.

- **§9 · `deepPick` whole-nested-object selection + leaf-not-in-`src` skip (runtime)** · `src/extras/deepUtilities.ts:121-124`.
  Every runtime `deepPick` test uses leaf/dotted paths; the bare whole-object-key branch and the
  reachable-intermediate-but-leaf-absent skip are unreached.

- **§10 · Dynamic VSM inline `customInt`/`customDouble` filter** · `src/expressions/dynamicConditionUsingFilters.ts:183-184`.
  Every other value-source filter kind has a paired un-annotated inline `dynamicConditionFor({...}).withValues({...})`
  test exercising the `MapValueSourceToFilter` arm; customInt/customDouble are covered only via a
  `const f: DynamicCondition<{…descriptor…}>` annotation (the `FilterTypeOf` path) + `const` stand-ins whose
  "no filterable column exists" comments are now **stale** — `tIssueWorklog.costCents`/`billedAmount` exist. Two
  paired tests (each with its direct equivalent). Type-level distinction, but clears the bar (real-DB-validatable,
  paired, distinct validating mapping — `ICustomIntValueSource` extends `IComparableValueSource` directly).

## 📍 Tier 2 — narrow / type-only (genuine but low risk)

- **§11 · NULL projector plain-select nested arms (type-only Exact):** a Rule-2 nested inner object
  (`AllFromSameLeftJoinWithOriginallyRequired`) and a same-left-join object containing an *optional* leaf — both
  pinned for the aggregate projector but never as a plain-select `assertType<Exact>` (the leaf *value* is covered
  via the aggregate path; only the nested-`…Nullable2` arm lacks a direct type assertion).
- **§12 · String single-value-source-arg overloads** (the one-side `MergeOptional` contribution, tested only at
  the all-const and all-VS extremes): `replaceAll(const,VS)` & `replaceAll(VS,const)`, `substr(num,VS)`,
  `substring(VS,VS)`, `replaceAllIfValue(str,VS)` & `(VS,str)`. Emission-distinct; some type-degenerate (`replaceAll`
  is flat). LOW. (`substr(VS,num)` was refuted — covered at `string-ops.test.ts:604`.)
- **§13 · A USER `TypeAdapter`'s `transformPlaceholder?` hook** · `src/TypeAdapter.ts`. Only the built-in
  `ForceTypeCast` (and the connection-level override) exercise the placeholder path; a user adapter returning a
  custom placeholder on a column is `void`-stubbed in doc-code. PG-only, real-DB-validatable.
- **§14 · `extras/utils` exclusion branches for `extractWritableShapeFrom` / `extractWritableColumnNamesFrom` /
  `extractId*`:** the View-source exclusion (`__type !== 'table'`) is untested for *every* writable/id helper (no
  View ever passed), and computed/virtual exclusion is missing for these three (it *is* covered for
  `extractWritableColumnsFrom`).

## 📍 Tier 3 — `Exact`-tightening only (no behavior; symmetry/regression-hardening)

Every item here is a transform already runtime/SQL/assignability-validated that merely lacks the `assertType<Exact>`
tightening — **there is no public transform alias with zero assertion of any kind.** Read-side aliases
(`SelectedRow`, pick, `InsertableValues`) *are* `Exact`-pinned; the asymmetry is on the write/shape side:

- `TableOrViewOf` / `TableOrViewLeftJoinOf` — assignability-only, no `Exact`; the `ALIAS=any/false` arm is
  structurally identical to the default arm (`types.ts:86≡88, 93≡95`) → near-zero payload.
- The eight `*ShapedAs` variants + write-side `*Row` aliases (`InsertableRow`/`UpdatableRow`/`UpdatableValues`/
  the on-conflict variants) — assignability/`Extends`/alias-equality only; the remap-correctness of `*ShapedAs`
  is proven only by full-object assignment, never shape-pinned (`UpdatableOnInsertConflictValues` is the one with
  just a bare `void`-probe — slightly higher value).
- Branded `& {__brand}` const→select round-trip (`postgres-const-force-type-cast.test.ts:139+`, SQL-only; brand
  proven via the Values path) and `InsertableRow` omittability (`Exact`-locked on the sibling `InsertableValues`).

---

## ❌ Refuted / out-of-scope (verified — do NOT chase)

- **§3 RETURNING-adapter-read from round 8 — BOTH legs landed (F8 was wrong).** Leg A
  (`fragmentWithType` trailing adapter): `fragments.type-coverage.test.ts:246-268` (`bracketAdapter`,
  `'CODING'→'[CODING]'`). Leg B (adapter `transformValueFromDB` through `.returning(...)`):
  `update.custom-columns.test.ts:67-92` (`returningOneColumn(tIssueWorklog.activityTagged)` carrying
  `bracketAdapter`, asserts `'[CODING]'`, present in all 17 cells). F8's grep was scoped to `*.returning.test.ts`
  basenames + `CustomBoolean|loggingAdapter` and missed the `bracketAdapter` virtual-column path. The only
  cosmetic residual: the *physical-column* `CustomBooleanTypeAdapter` ('Y'→true) through `.returning()` is not
  *separately* asserted, but that code path is already exercised → close-as-covered.
- **`fromRef` left-join overload (`FromRefBySourceLeftJoin`)** — covered (`doc-code.generated.test.ts:3561`,
  proven by compile-repro: `ForUseInLeftJoin` doesn't extend `ITableOrView`, so the ref must hit overload #2;
  recovered columns drive asserted SQL). Both F7 and F8 over-reported it.
- **`minValue`/`maxValue` value-source arm on bigint/customInt/customDouble** — DEGENERATE (type via the covered
  `add(VS)` per leaf; emission via the covered plain-Number `minValue(VS)`).
- **`lessOrEqualIfValue`/`greaterOrEqualIfValue`** — covered (`dynamic-condition.equivalence.test.ts:596-597` +
  `deep-and-or.test.ts:152`).
- **`substr(VS, num)`** — covered (`string-ops.test.ts:604`).
- **`MAPPED_SHAPED_COLUMN_NOT_IN_TABLE`, `NO_PRIMARY_KEY_FOUND`, `INVALID_SQL_FRAGMENT_RETURN_TYPE`,
  `UNKNOWN_DATA_TYPE`** — re-confirmed OUT-OF-SCOPE (reachable only via `as any`/impossible state; `shapedAs` is
  typed to `ColumnsForSetOf`, fragment callbacks return typed value sources, `NO_PRIMARY_KEY_FOUND` is gated off
  in PG18+). Prior rounds were right; a peer agent's "reachable" re-flag is rejected.
- **`dynamicBooleanExpressionUsing` multi-table arities** — mechanical SOURCE-union widening over a shared
  dispatcher; identical runtime. Connection-API mechanical tail likewise (verified 100% of genuinely-distinct
  branches asserted).

## 🔧 Source note (not a test gap)

`src/expressions/insert.ts:794` — a parameter of `setIfValueWhen` is misspelled `olumns` (positional, no
functional effect). Cosmetic; mention to the maintainer, not a behavior bug.

---

## ⚡ Quick-win order

1. **§1** AsNull Rule-4 object present-as-`null` (the one real null-vs-undefined value gap) + **§2** AsNull
   originallyRequired direct-leaf miss→null. One small projector block in `inner-rules` / `operator-composition`.
2. **§7** the two builder-error reasons (`MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` + `ERROR_EXECUTING_DEFERRED_IN_TRANSACTION`)
   — one test + one line, helpers already exist.
3. **§3 §4 §5** the three write execute/composition branches.
4. **§6** the bigint/customInt/customDouble `valueWhenNull`/`nullIfValue` leaves (one block, existing columns).
5. **§8 §9** IDEncrypter wrong-key decrypt + `deepPick` whole-object/skip runtime branches.
6. **§10** the two dynamic VSM inline custom-filter tests (paired with direct equivalents).
7. **§11–§14** the narrow type-only / extras-exclusion arms; **Tier 3** only if pursuing literal totality.

## How close to TOTAL coverage?

The fresh pass puts the type-distinction matrix at **~97–98%** and *confirms* three whole surfaces at 100%.
Critically, it found **no new systematic class and no behavior source bug**, and it *retired* a round-8 worry by
proving the §3 adapter-read legs shipped. What remains splits cleanly: a small set of **genuine value/behavior
gaps** (§1–§10 — the plain-select nullable projector value, two long-missed error reasons, a few extras-runtime
and write-composition branches) and a **cosmetic `Exact`-tightening rim** (Tier 3) where read-side aliases are
`Exact`-pinned but write-side ones rest on assignability. Closing Tier 1 (~10 focused, existing-fixture
additions) reaches effective totality on the value axis; Tier 2+3 is hardening. The honest call stands close to
round 8's: this is essentially the floor — the residual is completeness, not risk — with the caveat that even at
the floor an independent pass keeps finding a handful of real, long-missed items (here: §1, §7, §8), which is the
ongoing argument for keeping each pass fresh rather than anchored. The three highest-leverage closeouts are §1+§2
(projector value), §7 (error reasons), and §3–§5 (write branches).
