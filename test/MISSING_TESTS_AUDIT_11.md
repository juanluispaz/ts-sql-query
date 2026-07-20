# Missing-tests audit (Round 11) — convergence check: total coverage achievable WITHOUT new cells

**Question this round answers.** Have we reached **total type-coverage of everything achievable without
adding matrix cells or fixtures**? Method unchanged: 12 fresh enumeration-matrix discovery agents
(re-deriving from the types against the current files, no prior verdict trusted) → 3 adversarial
verifiers (wide-grep + tsgo/compile-repro discipline). This round each agent also split its findings into
**(A) closeable with existing cells+fixtures**, **(B) out-of-target (needs a new cell/fixture)**, and
**(C) degenerate/refuted** — so the answer is precise.

**Answer: NOT QUITE — but the ceiling is one small, fully-enumerated wave away.** Five whole surfaces
verified **fully converged** (string, columns, temporal/uuid/base-hierarchy, boolean/if, cross-cutting
seams); the rest verified covered except a well-defined residual: **6 genuine gaps** (all existing-fixture)
plus **~20 LOW hardening sites** and **2 source naming flags**. No behavior source bug. Once the
section-A items below land, the achievable-without-new-cells ceiling is genuinely reached.

Scope rules unchanged (negatives + `queryRunners/` + contrived-`as any` + new-cell/new-fixture items out
of scope; reference cell `postgres/newest/pg` (194 files), matrix symmetric; dynamic gaps pair with their
direct equivalent; date/time under `TZ=UTC`).

---

## 📍 Section A — genuine gaps closeable WITHOUT new cells/fixtures (the closing batch)

### Write overloads (F4 — all 5 verified CONFIRMED-MISSING by wide-grep + interface inspection; reachable PG branches, not `never`)

- **§A1 · INSERT `dynamicSet(columns)` one-arg overload** · `src/expressions/insert.ts:611` (distinct return
  `MaybeExecutableInsertExpression`). Tree-wide `.dynamicSet(<arg>)` invocations = **0** (the only matches are
  signature snapshots in `simplifiedDefinition*.generated`); every real call is the no-arg form. Fix:
  `insertInto(t).dynamicSet({...}).executeInsert…` asserting the one-arg branch's SQL+type.
- **§A2 · UPDATE `dynamicSet(columns)` one-arg overload** · `update.ts:289/297/313/321`. All 11 `.dynamicSet(`
  calls are no-arg. Fix mirrors §A1 on UPDATE.
- **§A3 · UPDATE `updateAllowingNoWhere(...)` + `dynamicSet()` / `setIfValue()` (no WHERE)** · `update.ts:312-315`
  (returns `ExecutableUpdateExpression` directly). All 18 allowing-no-where update cells use only plain `.set(...)`;
  the dynamicSet/setIfValue-without-WHERE branch is unexercised.
- **§A4 · DELETE `deleteAllowingNoWhereFrom(t).using(j)…` (using, no WHERE)** · `delete.ts:56` + `:136-139`
  (`UsingFnTypeAllowingNoWhere`, PG-typed). Every `.using(` test supplies a `.where`; the allowing-no-where delete
  builder never calls `.using`.
- **§A5 · INSERT on-conflict `dynamicWhere()` (no-arg)** · `insert.ts:821/883/893` (`OnConflictDoUpdateDynamicWhereFnType`,
  PG-typed at `:951-954`). The non-dynamic `.where().and().or()` chain IS covered; the dynamic sibling on the
  do-update path has **0** hits in any insert/on-conflict file (the 51KB of `dynamicWhere` matches are all
  SELECT/UPDATE/DELETE where-clauses). Fix pairs `dynamicWhere()` with the direct `.where()`, identical SQL+params.

All five pin a distinct typed return-branch (`MaybeExecutableInsertExpression` / `NotExecutableUpdateExpression` /
the no-WHERE `ExecutableUpdateExpression` / `DeleteUsingExpressionAllowingNoWhere` / `DynamicOnConflictWhereExpression`),
each has a covered sibling proving testability, and each is real-DB-validatable with `tIssue`/`tProject`/`tOrganization`.

### Projector (F3 + F9 independently corroborated; the one genuine type+VALUE gap)

- **§A6 · Aggregate element RULE-2 (same-left-join, `originallyRequired` + optional leaf) under the DEFAULT
  (asUndefined) projector** · `src/complexProjections/resultWithOptionalsAsUndefined.ts:71-77`, mapper
  `ValueSourceValueTypeForOptionalObjectResultSameOuterJoin`. The **nullable** twin exists
  (`select.aggregate-as-array.modifiers.test.ts:171`, `Array<{ id:number; body:string|null }>`); the
  **default** twin (`Array<{ id:number; body?:string }>`, the null `body` produced **absent** inside the
  element) is missing in every cell. A tsgo probe confirms it's type-distinct (the `originallyRequired` leaf
  stays non-`undefined`, which nothing else covers). Fix: mirror `modifiers.test.ts:171` minus
  `.projectingOptionalValuesAsNullable()`, assert the type + `'body' in element === false` on the null-body row.
  Existing fixtures (`tIssue.forUseInLeftJoin()`); symmetric propagation.

## 📍 Section A-low — genuine but LOW value (one-line strengthenings; no new cells/fixtures)

- **§A7 · `aggregateFragmentWithType(...)` + trailing `TypeAdapter` overload** · `AbstractConnection.ts:971-978`
  (genuinely distinct dispatcher — `adapter2` 4th positional + aggregate-marker `true` 5th). No aggregate fragment
  threads an adapter anywhere; the non-aggregate twin (`fragmentWithType('string','required',bracketAdapter)`) is
  covered. Low value (the adapter transform itself is degenerate with the covered twin), but the
  adapter+aggregate co-occurrence is its own arm. Fixture owns `bracketAdapter`; one-line test.
- **§A8 · 13 utility-type WRAPPER aliases pinned by assignment-probe, not `assertType<Exact>`** ·
  `InsertableRow` (utility-types.test.ts:99), `InsertableRowShapedAs` (:211), `InsertableValuesShapedAs` (:197),
  `UpdatableRow` (:116), `UpdatableRowShapedAs` (:240), `UpdatableValuesShapedAs` (:226), the three
  `UpdatableOnInsertConflict{Values,Row,ValuesShapedAs}` (:143/:153/:254), and the four `TableOrViewOf`/
  `TableOrViewLeftJoinOf` arms (tables-views-as-parameter.test.ts:24/34/57/59 — that file has **zero**
  `assertType`). The non-wrapped siblings (`InsertableValues`, `SelectedRow`, both `*ProjectedAsNullable`) ARE
  full-Exact-locked, so only the thin wrapper layer is unpinned. Each: add `assertType<Exact<…>>` against the
  already-imported domain tables. (`UpdatableOnInsertConflictRowShapedAs` was a false-positive — already
  Exact-pinned at :267.)
- **§A9 · 6 builder-side error reasons asserted via message string, not `errorReason.reason`** ·
  `MINIMUM_ROWS_NOT_REACHED`, `MAXIMUM_ROWS_EXCEEDED`, `NO_RESULT`, `NO_COLUMN_SETS`, `DISALLOWED_BY_QUERY_RULE`,
  `DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE` — the throw IS asserted (via `String(caught).toMatch(/…/)` /
  `toContain` / attached props), but not the reason code. One-line tightening on the existing catch blocks
  (`reasonOf(caught) === 'X'`), matching the pattern `dynamic-condition.errors.test.ts:50-99` already uses for its
  sibling reasons. (~20 other builder-side reasons are already reason-code-asserted.)

## 🟡 Source naming flags (not test gaps; for the maintainer)

- **`disallowedRowIndex` vs `disallowedIndex`** · `src/TsSqlError.ts:46` types `disallowedRowIndex?`, built at
  `InsertQueryBuilder.ts:1188+` — but the runtime *also* attaches an untyped `error.disallowedIndex`
  (`:1191/1230/…`), and that's the one the test reads (`insert.multi-row.set-rules.test.ts:114`). The typed field
  is untested; the read field is untyped. Real inconsistency — pick one name. (`disallowedProperty` is consistent.)
- **`UpdatableOnInsertConflictRowShapedAs` resolves to `OnConflictUpdateValues`** (`src/extras/types.ts:56-57`),
  dropping the value-source acceptance the non-shaped `UpdatableOnInsertConflictRow` gets. Verified **intentional**
  (pinned Row===Values-equal at utility-types.test.ts:267) — maintainer-confirm only, no change.

## ❌ Refuted / degenerate / out-of-target (verified — do NOT chase)

- **Aggregate element RULE-3 AsNull twin** (F9-A1) — DEGENERATE: AsNull RULE-3 and RULE-4 share the leaf mapper
  `ValueSourceValueTypeForNullableObjectResult`; both behaviors are already proven (`modifiers.test.ts:469` opt→null,
  `:171` required→non-null). No observable delta.
- **`DynamicDefinitionForModel` boolean→`'boolean'` arm** (F6-A2) — FALSE-POSITIVE: pinned at
  `types.type-edges.test.ts:51-62` (`Exact<…,{ id:'int'; billable:'boolean' }>`, plus the `→ never` arm), symmetric
  across cells. F6 only checked `from-model.test.ts`.
- **`Number.nullIfValue(VALUE)` numeric leaf** (F1-NUM-A1) — DEGENERATE-borderline: the asymmetry is real
  (`valueWhenNull(VALUE)` numeric is covered, `nullIfValue(VALUE)` numeric isn't) but the `'optional'` return is
  proven on the const arm and the `nullif(col,col2)` routing on the string leaf → optional one-line symmetry add, not
  a distinct branch.
- **`expandTypeProjectedAsNullableFromDynamicPickPaths` page/single arms** (F6-A1) — DEGENERATE-borderline: impl is
  `return result` (passthrough); the nullable reshape is proven on the array arm, the page/one wrapping on the
  non-nullable twin → optional symmetry add.
- **The five false regressions F8 re-refuted** (the `Cents`/`Money` branded-read "gaps" are a typeName-string brand
  over a plain `number` value type, so `Exact<…,number>` is the correct, already-present pin; DELETE-RETURNING union
  brand covered via `ReleaseChannel` at `delete.returning.test.ts:107`; `fromRef` left-join overload + TypeAdapter-per-layer
  covered).
- **Out-of-target (need a new cell/fixture, not counted):** per-kind exhaustive instantiation of every plain kind on
  every column factory; branded variants on `columnWithDefaultValue`/`computedColumn`/PK factories; MySQL-5
  `UNSUPPORTED_QUERY` (no `mysql/oldest` cell); `NO_PRIMARY_KEY_FOUND`/`MAPPED_SHAPED_COLUMN_NOT_IN_TABLE` (contrived/
  `oldValues()` is `never` on PK-less tables); depth-≥4 nested projection optionality (version-fragile); MSSQL
  uuid-literal uppercasing (docker value-runtime diff). All correctly excluded.

---

## ⚡ Quick-win order (the closing batch — all existing cells+fixtures)

1. **§A1–§A5** the five F4 write overloads (each a small test pairing the overload with its covered sibling).
2. **§A6** the aggregate element RULE-2 default-projector twin (mirror `modifiers.test.ts:171`, add the `'in'`-absent check).
3. **§A8** the 13 wrapper-alias `assertType<Exact>` strengthenings (one line each, already-imported tables).
4. **§A9** the 6 error-reason `reasonOf(...) === 'X'` tightenings (one line each on existing catch blocks).
5. **§A7** the `aggregateFragmentWithType`+adapter test; optionally the two degenerate symmetry adds (nullIfValue numeric,
   expandType page/single).
6. **Source flags** → maintainer (the `disallowedRowIndex`/`disallowedIndex` rename is the only one that warrants a code touch).

## Convergence verdict

**One small wave from the ceiling.** This is the thinnest harvest yet and — for the first time — it contains **no
new behavior gap requiring design thought**: it's 6 enumerated overload/projector branches + ~20 mechanical
one-line strengthenings + 2 naming flags, every one closeable on the existing matrix with existing fixtures. Five
surfaces are fully converged and the rest verified covered. After this batch lands, **total type-coverage
achievable without new matrix cells or fixtures is reached** — the only remaining residue (out-of-target above) is,
by definition, unreachable without adding cells/fixtures the project has decided not to add. The repeated lesson
held once more (an independent pass at the floor still found the 5 F4 overloads and the §A6 projector twin that ten
prior rounds missed), but the slope is now essentially flat: a round 12, run the same way, would be expected to
return "fully covered — evidence" across the board once §A1–§A9 ship.
