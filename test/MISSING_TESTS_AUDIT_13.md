# Missing-tests audit (Round 13) — final convergence confirmation: is the without-new-cells ceiling reached?

> **IMPLEMENTATION OUTCOME (post-audit).** §A1 and §A2 were implemented. Writing the **§A1** test surfaced a **real
> `src/` bug**: a type-vs-impl divergence in the shaped ON CONFLICT path (the type advertises shape-key remapping in
> the on-conflict update-set; the implementation didn't deliver it correctly). The maintainer fixed `src/` directly.
> This is the headline result of the round — a bug that **code coverage could not have caught** (it measures
> lines-executed, not whether a type's advertised capability holds), found only by enumerating the capability the
> type *implies* and writing the specific assertion for it. The "no behavior source bug surfaced" notes below were
> true at **audit time** (the audit is read-only / type-level); the bug appeared at **implementation time** when the
> §A1 capability was first exercised. See memory `feedback_type_driven_catches_coverage_invisible_bugs`.

**Mandate.** A fresh, independent, extra-exhaustive pass to confirm — without trusting any previous audit's
conclusions — whether *total type-coverage achievable without adding matrix cells or fixtures* is reached, and
whether the work can be declared **done**. Method: 12 enumeration-matrix discovery agents re-deriving each surface
purely from the types against the current test files, sectioning into **(A) closeable with existing cells+fixtures**,
**(B) out-of-target**, **(C) degenerate/refuted**; then coordinator-run adversarial verification (compile-repro +
whole-matrix wide-grep) on every surviving candidate.

**Answer: essentially YES — converged, modulo FOUR LOW gaps.** Of the 12 surfaces, **ten report fully covered**. Four
candidates surfaced; coordinator verification (tsgo compile-repro on the reference cell + matrix-wide grep) confirms
all four are distinct reachable typed paths. (This is **revised up from an initial "two genuine, two degenerate"**:
on the project's standard — coverage of every reachable typed *path*, not merely every distinct observable *output* —
the two I first filed as degenerate, §A3 and §A4, are genuine. See the Refuted-section note.) **No behavior source
bug surfaced *at audit time* — but implementing §A1 surfaced one (see IMPLEMENTATION OUTCOME above).**

The four genuine gaps are all **LOW**, all closeable on the existing `postgres/newest/pg` cell with existing
fixtures, and one of them (§A1) is a gap **round 12 wrongly closed** as "not reachable" — the very one that carried
the src bug.

> **Why this round found something round 12 didn't.** Round 12 left `ShapedInsertOnConflictSetsExpression` as an
> unresolved *borderline* item, reasoning that `shapedAs()` exposes no `onConflict*` method. That inspected the wrong
> node: `shapedAs()` returns `ShapedInsertExpression` (no on-conflict — true), but `shapedAs().set(...)` returns
> `ShapedExecutableInsertExpression`, which extends `CustomizableExecutableSimpleInsert<…,SHAPE>` and **does** expose
> `onConflictOn` (insert.ts:90/98). A tsgo compile-repro this round confirms the full chain typechecks on PG. So §A1
> is a real gap, not out-of-target.

Scope rules unchanged (negatives + `queryRunners/` + contrived-`as any` + new-cell/new-fixture items out-of-target;
reference cell `postgres/newest/pg`, matrix symmetric; date/time `TZ=UTC`; dynamic gaps paired with their direct
equivalent). All agents READ-ONLY; working tree clean (only `MISSING_TESTS_AUDIT_*.md` + the pre-existing `.gitignore`).

---

## 📍 Section A — genuine gaps (existing cells+fixtures)

### §A1 · Shaped ON CONFLICT update-sets — `ShapedInsertOnConflictSetsExpression` · LOW(–MEDIUM) · `src/expressions/insert.ts:825-885`

A large, distinct typed interface that is **never reached anywhere in the matrix**, yet is reachable on PostgreSQL
without `as any`:

```
insertInto(t).shapedAs({ k: 'col', … /* covering all required cols */ })
             .set({ k: …, … })
             .onConflictOn(t.pk)            // PG route — supplies the conflict target
             .doUpdateDynamicSet()
             .set({ k: … })                 // ← SHAPE-RENAMED key accepted here
```

- **Why a distinct type-branch.** It is structurally different from the covered non-shaped
  `InsertOnConflictSetsExpression` (insert.ts:764): its `.set()` takes `OnConflictUpdateSets<TABLE,USING,SHAPE>` keyed
  by the **shape-renamed** projection, and it additionally exposes `extendShape`. The bare
  `onConflictDoUpdateSet`/`onConflictDoUpdateDynamicSet` are `never` on PG (the `WithoutTarget` FnType variants exclude
  PG by design — insert.ts:928/946), but the `onConflictOn(col).doUpdate*` route is open and, with `SHAPE extends
  ResolvedShape`, returns `ShapedOnConflictDoUpdateDynamicSetFn` → the shaped conflict-sets type (insert.ts:912-919, 907).
- **Reachability — COMPILE-VERIFIED.** A tsgo repro on `postgres/newest/pg` compiled clean: the chain above
  typechecks, the **shape-renamed key** in the conflict `.set()` is accepted (proving the node is the *shaped* type,
  not the non-shaped one), and `executeInsert()` returns `number`.
- **Where to test.** `test/db/postgres/newest/pg/insert.on-conflict.dynamic-set.test.ts` (sibling of the covered
  non-shaped test). Open with `.shapedAs({…})` covering a small table's required columns (e.g. `tCountry`
  code/name/region), assert the emitted `on conflict (…) do update set <real-col> = $n` maps the renamed keys to real
  columns, plus an `assertType<Exact>` on the result. Existing fixtures suffice.
- **Absence proof.** Matrix-wide, `shapedAs(...)` and `.onConflict*` are never chained in one statement;
  `ShapedInsertOnConflictSetsExpression` / `ShapedOnConflictDoUpdateDynamicSetFn` appear in **zero** test files. The
  only `shapedAs` uses are in `docs.insert`/`docs.update` (no on-conflict) and `errors.*-guards` (`as any`).

### §A2 · `const` / `optionalConst` trailing `adapter?: TypeAdapter` — the one untested adapter layer · LOW · `src/connections/AbstractConnection.ts:496-528` (`const`), `:530-562` (`optionalConst`)

The "TypeAdapter applied per layer" case-class has four arms; three are covered with an observable `[…]`-bracketing
adapter, the fourth is not:

| layer | covered? |
|---|---|
| column trailing adapter | ✅ `select.virtual-column-from-fragment` / `activityTagged` `[…]` |
| fragment trailing adapter | ✅ `virtualColumnFromFragment(…, bracketAdapter)` |
| executeFunction trailing adapter | ✅ `callProjectNameBracketed` (`exec.procedure-function.test.ts:237`) |
| **`const` / `optionalConst` trailing adapter** | ❌ **never invoked** |

- **Nature.** The trailing `adapter?` is a real public overload on every `const`/`optionalConst` signature; the
  runtime threads it into `SqlOperationConstValueSource(value, type, type, 'required', adapter)` (impl at
  AbstractConnection.ts:523-528 / 557-562). It does **not** change the return type — so this is a **value-distinction**
  (adapter transforms the read value), not a type-branch. It is in scope only by the same standard under which the
  three sibling adapter layers above are tested: a public typed overload whose value effect is real-DB-validatable.
- **Where to test.** `select.value-source.required-const.test.ts` / `…optional-const.test.ts`, with an inline bracket
  adapter (as `select.postgres-custom-placeholder-adapter.test.ts` already does — the domain `bracketAdapter` is
  module-private): `selectFromNoTable().selectOneColumn(conn.const('x','string', bracketAdapter)).executeSelectOne()`,
  mock-prime the raw value, assert the result is `[x]`. Portable.
- **Absence proof.** 1935 `const`/`optionalConst` calls across the matrix; **zero** pass a trailing adapter (only the
  signature appears, in `simplifiedDefinition.generated`).
- **Weighting.** A *value-distinction* on a distinct typed overload (the trailing-adapter signature), reached through
  a distinct `const` code path, real-DB-validatable — and the one adapter layer of four left untested. By the
  project's coverage standard (every reachable typed path, not every distinct observable output) this is a genuine
  gap, not optional.

### §A3 · complexProjections rule-2↔rule-3 boundary — nested object mixing an own-table required leaf with a left-join `originallyRequired` leaf · LOW · `src/complexProjections/resultWithOptionalsAs{Null,Undefined}.ts`

A nested object (and its aggregate-element form) that **mixes** an own-table *required* leaf with a left-join
*originallyRequired* leaf is a leaf-configuration **no test pins** — every covered projection test is either all-own-table
(rule-3) or all-same-left-join (rule-2), never the boundary between them.

- **Why a distinct path (not the degenerate I first called it).** The projector must *classify* this mixed input: it
  selects rule-3 (object stays required because of the own-table leaf) and **demotes** the left-join leaf
  (`projName?: string` default / `string | null` AsNull) — tsgo-confirmed for plain + aggregate-element, both
  projectors. That the *output shape* of the demoted leaf coincides with a demoted-optional leaf does **not** mean the
  path is covered: the rule-**selection** on a mixed input, and the **runtime value** on a join-miss (object present
  while the left-join leaf is absent/null), are both unpinned — exactly the §A1-class divergence (type advertises one
  classification, impl could do another).
- **Where to test.** `select.complex-projection.inner-rules.test.ts` (plain) + `select.aggregate-as-array.modifiers.test.ts`
  (element), over a left join that **can miss** — e.g. `tIssue.leftJoin(tAppUser on assigneeId)`, project
  `{ iid: tIssue.id /*required*/, assignee: { name: tUserLeft.fullName /*originallyRequired*/, … } }` — and assert, on
  an unassigned issue, that the object is present with the left-join leaf absent (`'name' in … === false`, default) /
  `null` (AsNull), plus `assertType<Exact>` on both projectors. Existing fixtures (`tIssue.assigneeId` is optional).

### §A4 · Compound `orderBy(valueSource)` / `orderBy(rawFragment)` / `orderByFromString*` overloads · LOW · `src/expressions/select.ts:107-115`

`CompoundedOrderByExecutableSelectExpression` declares its **own** order-by overload set, distinct from the non-compound
interface. Only the string-column arm (`orderBy('col')`) is exercised on compounds matrix-wide.

- **Why a distinct path (not the degenerate I first called it).** These are distinct typed entry points routed through
  the compound builder's order-by path (which can wrap into `select * from (<compound>) as o_1_ order by …`). That the
  emitted clause coincides with the non-compound case does **not** cover the compound *overload wiring*: a §A1-class
  bug where, say, `orderByFromString` on a compound isn't threaded into the wrapped ORDER BY would be invisible to the
  string-column test. The overload-selection is itself a compile-time contract the impl must separately honour.
- **Where to test.** `select.compound.test.ts` / `select.compound-extras.test.ts`, e.g.
  `union(...).orderByFromString('label desc')` and `union(...).orderBy(<valueSource>)` / `orderBy(<rawFragment>)` over
  existing `tProject`/`tIssue` fixtures; assert the emitted ORDER BY. No new cell/column.

## ❌ Refuted / degenerate (verified — do NOT chase)

> **Two former entries here (the rule-2↔rule-3 mixed leaf, and the compound order-by overloads) were PROMOTED to §A3
> and §A4** after recalibrating the degeneracy bar: *degenerate* means the same reachable **typed path / contract**,
> not merely the same observable output. A distinct reachable overload / interface / input-classification is a path to
> test even when its output coincides with a covered case — that is precisely where §A1's type-vs-impl bug hid. True
> degeneracy below = the **same** contract reached through a **shared** dispatcher with only a kind-string differing
> (the impl is generic over that kind, so a divergence can't break it without also breaking the tested representative).

- **Round-12 §A1–§A3 — all verified landed:** INSERT `dynamicSet()` zero-arg (`insert.conditional-sets.test.ts:735`);
  `UpdatableValues<T>` `assertType<Exact>` (`docs.advanced.utility-types.test.ts:382`); SELECT `dynamicOn().or()`
  (`select.join.test.ts:152/162`).
- **Re-refuted, consistent with rounds 10–12** (each re-checked from the types this round, not assumed): aggregate
  element rule-2 same-left-join twin (covered: `modifiers.test.ts:309` default / `:171` AsNull); string surface
  (full predicate const/VS-operand/IfValue fire+elide, all insensitive variants, every transform overload);
  customComparable-on-string brand (does not exist — customComparable has no string methods); numeric
  `nullIfValue(value-source)` + custom `power/minValue/maxValue` value-source-RHS (degenerate vs covered siblings);
  temporal custom-type getters (receiver-brand-invariant); uuid `is/isNot` (degenerate) and `notEqualsInsensitive`
  (does not exist); dynamic `between` (not a dynamic operator); descriptor↔VSM symmetry (already paired in
  `dynamic-condition.equivalence`); boolean from-model arm (`types.type-edges:58-61`); `returningOneColumn`,
  returning×customizeQuery, on-conflict×customizeQuery, `leftOuterJoin`, `fromRef` left-join.

## (B) Out-of-target (need a new cell/fixture or are contrived — correctly excluded)

MySQL-5 `UNSUPPORTED_QUERY`; `NO_PRIMARY_KEY_FOUND` (oldValues() is `never` on PK-less tables);
`MAPPED_SHAPED_COLUMN_NOT_IN_TABLE` / `UNKNOWN_DATA_TYPE` / `INVALID_SQL_FRAGMENT_RETURN_TYPE` (as-any/impossible
state); `MORE_THAN_ONE_ROW` / `ONLY_ONE_COLUMN_EXPECTED` (runtime guards in the excluded `queryRunners/` layer — not
type-branches); old-values in SET/WHERE (typer-blocked); depth-≥5 nested projection; per-driver marshalling;
column-factory × kind fan-out with no fixture column (degenerate value-type re-proofs); `createTableOrViewCustomization`
P1/P3/P4/P5 + higher-arity `subSelectUsing`/`dynamicBooleanExpressionUsing` (shared-dispatcher fan-out);
`Values.column` base-type kinds not instanced (degenerate leaf re-proofs); the `TableOrViewOf` `any`-guard arm.

---

## ⚡ Quick-win order

1. **§A1** Shaped ON CONFLICT update-sets — one test on `insert.on-conflict.dynamic-set.test.ts` (genuinely distinct
   type + observable shape-renamed emission; round 12 wrongly closed it — and it **carried the round's src bug**).
2. **§A3** complexProjections rule-2↔rule-3 mixed-leaf boundary — plain + element, both projectors, on a left join
   that can miss (`inner-rules` / `aggregate-as-array.modifiers`).
3. **§A4** Compound `orderBy(valueSource/rawFragment)` / `orderByFromString*` overloads — `select.compound(-extras)`.
4. **§A2** `const`/`optionalConst` trailing adapter — the one untested adapter layer (const value-source files).

## Convergence verdict

**The without-new-cells ceiling is reached, modulo FOUR LOW gaps** (revised up from two after recalibrating the
degeneracy bar to *distinct reachable typed path*, not *distinct observable output* — see the note in the Refuted
section). Ten of the twelve surfaces verified fully converged; the four genuine residuals, all closeable on the
existing `postgres/newest/pg` cell with existing fixtures, are:

- **§A1** Shaped ON CONFLICT update-sets — a real gap round 12 mis-closed; compile-verified reachable on PG; **this is
  the one whose test surfaced the round's `src/` bug** (type-vs-impl divergence in shape-key remapping, since fixed).
- **§A3** complexProjections rule-2↔rule-3 mixed-leaf boundary — distinct input-classification + join-miss runtime
  value, unpinned.
- **§A4** Compound `orderBy(valueSource/rawFragment)` / `orderByFromString*` overloads — distinct compound order-by
  wiring, only the string arm covered.
- **§A2** `const`/`optionalConst` trailing adapter — the one untested adapter layer (value-observable).

The §A1 bug is the cautionary lesson of the round: the gaps that look "borderline / same output as a covered case"
are exactly where a type-vs-impl divergence hides, because code coverage measures lines-executed, not whether the
type's advertised capability holds. That is why the bar is **every reachable typed path**, and why §A3/§A4 (which I
initially mis-filed as degenerate on an output-coincidence) belong in section A.

**Recommendation: ship §A1–§A4, then declare the without-new-cells coverage goal DONE.** Everything beyond these four
is either true degeneracy (the same contract through a shared dispatcher) or genuinely fixture-blocked — by definition
only reachable by adding cells/fixtures the project has deliberately chosen not to add. **This is the floor.**
