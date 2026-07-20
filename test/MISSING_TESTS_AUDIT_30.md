# MISSING_TESTS_AUDIT_30

> Round 30 of the type-driven missing-tests audit (`test/TYPE_AUDIT_RUNBOOK.md` is the
> sole source of truth; this report is transient). Mandate: maximalist, **be generous
> even at length**. Narrow degeneracy bar (§4). Lead the mature phase with the parity
> sweep + the two seam critics + the freshly-changed-surface agent + the result-type
> agent; then the full ~16 per-surface agents, re-verifying prior "saturated" verdicts
> adversarially.

## Method

- **Pre-flight (§0.5):** N=30. `bun run tests:audit` → **17 cells, 234 files, 2363
  tests/cell, 40171 total — symmetric ✓** (up from 2331 in Round 29). `test/BUGS.md`
  empty. `tests:index` refreshed (260 files had changed). `git log` → the fresh
  surface is commit **`5a08f2cf`** (test-only, +20786 lines): the maintainer
  **implemented essentially all of Round 29's §A findings** (subSelectDistinctUsing
  arities, dynamicBooleanExpressionUsing 2–5, the bare-base-leaf Nullable family, the
  CD-2 count-wrap tail arms, a new `select.aggregate-as-array.element-projection-rules.test.ts`,
  MISSING_KEYS reopening, orderBy `'asc'`, returningOneColumn-nullable, extendShape→dynamicSet,
  DELETE-using nested returning, scalar-min-max assertType, selectOneColumn-optional-aggregate)
  **and added a new fixture table `tReleaseDraft`** (caller-provided int PK; `stage`
  optional `enum`, `channel` optional `custom`, `minVersion` optional `customComparable`).
  So the round's high-value targets became **(a) the tail arms the new tests/fixture
  left, (b) whether any newly-baked snapshot locked a latent bug, and (c) going DEEPER
  than Round 29 into surfaces it called saturated.**
- **21 discovery agents** in two waves (≤10 concurrent), READ-ONLY, inline reports.
- **Coordinator verification (§7):** every load-bearing claim resolved by me — a tsgo
  compile-repro for the marquee type bug, a mock runtime-probe + source read for the
  emission bug, my own operand-capturing wide-greps for absence. All probes deleted;
  **`git status --porcelain` clean** (only pre-existing untracked reports + the
  prior-round `M .gitignore` / `M TYPE_AUDIT_RUNBOOK.md`, plus this report + BUGS.md).

## Headline

- **2 confirmed `src/` defects** (both filed to `BUGS.md`; the definitive one added to
  the §9 ledger as the 16th, the second as a 17th with a docker-verify note):
  1. **16th bug (definitive, compile-repro'd):** `buildFragmentWithMaybeOptionalArgs`
     types an **optional result as `'required'`** when a plain-value arg is immediately
     followed by an optional value-source arg — a mis-bracketed non-distributive helper
     drops the arg's optionality. Unsound.
  2. **Empty-batch `values([])` on the RETURNING execute-shapes** dispatches an empty SQL
     string (real-DB error): the short-circuit `executeInsert` has is missing on
     `executeInsertMany`/`One`/`NoneOrOne`. Source+mock-confirmed; real-DB-manifesting.
- **~12 clean §A tests** (existing cells + existing fixtures), concentrated on the new
  fixture's write-side, the aggregate-element scalar/collapse boundaries, and one
  compound seam.
- **1 §B** (a `withCompatibilityVersion` mysql helper for the MySQL<8 `UNSUPPORTED_QUERY`
  throws — a re-confirmed carry-over).
- **13 surfaces re-verified saturated (0/0)** adversarially.
- No newly-baked snapshot locked a wrong behavior (F-RECENT latent-bug pass: clean).

---

## Confirmed bugs (filed to `BUGS.md`)

### BUG-1 (16th ledger entry) — `buildFragmentWithMaybeOptionalArgs` drops arg optionality in the `[…, plainValue, valueSource, …]` pattern

`src/expressions/fragment.ts:{436,447,456,467,475,484,492}`. In the `FragmentFunctionMaybeOptional3/4/5`
overload where arg *N* is a plain value and arg *N+1* is a value source, the merged optional type is
`MergeOptionalUnion<… | OptionalTypeOfValue<T_plain | T_source[typeof optionalType]> …>`. `OptionalTypeOfValue`
is **non-distributive** (`values.ts:59-63`, tests only `null`/`undefined extends`), so the nested `OptionalType`
literal `'optional'` is discarded → an **optional** value-source arg there yields a **`'required'`** result.
Correct siblings write `OptionalTypeOfValue<T_plain> | T_source[typeof optionalType]`.

**Coordinator compile-repro (tsgo, isolated `@ts-expect-error` key-omission, existing `coalesce3` fixture):**

| call | overload | result | verdict |
|---|---|---|---|
| `coalesce3(name, 'b', body)` — `[src, value, src-OPT]` | :436 | `{ r: string }` **required** | **BUG** (an optional arg is present) |
| `coalesce3(name, body, 'b')` — `[src, src-OPT, value]` | :433 | `{ r?: string }` optional | correct (mirror) |
| `coalesce3(name, 'b', slug)` — `[src, value, src-req]` | :436 | `{ r: string }` required | correct (control) |

Two calls with one optional arg each yield different optionality → the `:436`-family mis-bracket is isolated.
**Unsound**: the `MaybeOptional` contract is "optional iff any arg optional"; a fragment body that propagates a
null from that arg (arithmetic, etc.) returns `null` at runtime while TS promises non-null. **Fix**: the one-token
re-bracket at all 7 sites. Found by the **parity sweep going one level deeper than Round 29** — into the *body*
of a generated overload family, not a `TN`-position (where Round 28's CD-1 lived). Coverage was green because
every `coalesce3` call in the matrix is all-plain-args (`coalesce3('a', undefined, 'c')`) — no baked snapshot,
and the positive test is blocked by the bug.

*Coordinator note (recorded in the runbook §9):* multiple `assertType<Exact>` in one function scope produced
**cascading TS2344s that misattributed** (I first mis-read the manifestation twice); the `@ts-expect-error`
key-omission technique in isolated functions is the authoritative discriminator for optionality.

### BUG-2 (17th ledger entry, docker-verify recommended) — empty `values([])` not short-circuited on the RETURNING execute-shapes

`src/queryBuilders/InsertQueryBuilder.ts`. `executeInsert` guards the empty batch (`:67` → resolve `[]`/`0`
without touching the runner), but `executeInsertMany` (`:264`), `executeInsertOne` (`:228`),
`executeInsertNoneOrOne` (`:192`) have **no** guard; `_buildInsertMultiple` (`AbstractSqlBuilder.ts:1421`)
returns **`''`** for an empty batch, so they dispatch an empty SQL string to the runner.
**Coordinator mock-probe:** `insertInto(tProject).values([]).executeInsert()` → `history.length===0`
(short-circuits); `insertInto(tProject).values([]).returning({id}).executeInsertMany()` → `history.length===1`
(reaches the runner). Mock returns `[]` (SQL never executed) → **mock-blind**; a real driver rejects the empty
query (universal, not a dialect assumption). Source-confirmed mechanism; recommend a `--docker` PG spot-check to
make airtight. **Fix**: mirror `executeInsert`'s empty-multiple short-circuit on the three returning shapes.

---

## §A — in scope, existing cells + existing fixtures (tiered)

### Tier 1 — genuine holes / soundness-adjacent (existing fixtures)

**A-1. The value-source overloads of `valueWhenNull`/`nullIfValue` + `asRequiredInOptionalObject`/`onlyWhenOrNull`/`ignoreWhenAsNull` on the bare-base enum/custom/customComparable leaves.**
The `tReleaseDraft`/existing tests implemented the Nullable family on these leaves but **only 3 of 6**
methods (literal `valueWhenNull`/`nullIfValue`, `asOptional`, `isNull`). Reached by **no other leaf**
(every other value type redeclares the family on its own subinterface), brand-preserving:
- **A-1a (F-RECENT):** the **value-source** overload of `valueWhenNull`/`nullIfValue` — `col.valueWhenNull(<optional source>)`
  stays optional (returns `VALUE[optionalType]`) and emits `coalesce(x, <col>)`, distinct from the tested literal
  overload (forces `'required'`, emits `coalesce(x, $p)`). `values.ts:275/277` (Equalable → enum/custom),
  `:311/313` (Comparable → customComparable). Reachable on `channel`/`version` (custom/customComparable) directly;
  enum via a self-reference (`stage.valueWhenNull(stage)`) or the §B-1 fixture.
- **A-1b (F1-EQCMP):** `asRequiredInOptionalObject` / `onlyWhenOrNull` / `ignoreWhenAsNull` on the bare Equalable
  (`values.ts:279-281`) + Comparable (`:315-317`) — untested for enum/custom/customComparable (coordinator wide-grep:
  the three methods appear only on string/number/bigint/customInt/customDouble/boolean receivers). `onlyWhenOrNull(false)`
  / `ignoreWhenAsNull(true)` emit a **valueType-derived typed null** (`null::<pgtype> as <alias>`), so the enum/custom
  casts differ and are real-DB-validatable (not merely a brand assertion). Add to
  `select.value-source.null-and-if-value-modifiers.test.ts` on `activity`/`channel`/`version`.

**A-2. `aggregateAsArrayOfOneColumn(<optional column>)` — the per-element NULL strip is executed but never value-asserted** (F9-TYPEVAR A1 + F3-PROJ A1, converged).
Typed `Array<T>` (optionality stripped, `AbstractConnection.ts:1137`); `json_agg(optional_col)` emits JSON `null`
per NULL row, and the type is honored **only** because the JS projector drops null/undefined elements
(`AbstractQueryBuilder.ts:151-157`). The one mocked-null test (`value-type-coverage` `…optional-local-date-time…`)
asserts only `isArray`/`length`; the double/uuid variants `UPDATE` the nulls away. Boundary: group an optional column
with mixed NULL/non-NULL, `mockNext([[v, null, w]])`, assert the array **excludes** the null (length shrinks). SOUND;
lock also that the scalar form exposes **no** `projectingOptionalValuesAsNullable` variant. **A-2b (F9-TYPEVAR A2, fold in):**
same test on `vReleaseOverview.optionalReleaseOrdinal` proves the per-element adapter (+1000) AND the `ReleaseTag`
newtype element type on the scalar-aggregate path (both proven only for the object form today).

**A-3. Aggregate element-top pure rule-4 all-optional element → whole element dropped, both projectors** (F3-PROJ A2).
`aggregateAsArray({ opt: {allOptionalLeaves} })` where every leaf of an element is null → the element is dropped
(`AbstractQueryBuilder.ts:263-274`), and under `projectingOptionalValuesAsNullable()` it is **still dropped** (the
nullable branch sets `result[prop]=null` but never sets `keepObject`). The new file's rule-4 test never has an all-null
element. Assert the drop (`items.length`) under both projectors. SOUND, unasserted.

**A-4. Aggregate rule-2 left-joined inner object realized via an actual join MISS** (F-RECENT A-3 + F3-PROJ A3, converged).
The new file's two rule-2 tests join every element to project 1 (never miss); the type pins `proj?`/`proj:{}|null`
(dropped/null only on miss) but no row realizes it. Add an aggregate whose rule-2 left-join misses for ≥1 element →
assert `proj` absent (default) / `null` (nullable).

**A-5. `tReleaseDraft` WRITE-side is completely untested** (F4-INSERT A1/A2, MUT-SEAM A-1, F4-UPDDEL A1/A2, converged).
The new table appears in exactly one SELECT file. Distinct, real-validatable write/return paths no other fixture reaches:
- **INSERT** setting the optional `enum`/`custom`/`customComparable` columns to a value / to `null` / omitted — the
  provided-int-PK-with-omittable-optional-custom-rest insertable shape (existing provided-PK tables have no optional
  columns), and the NULL-write path for these bare-base kinds (only int/boolean null-on-insert is covered today).
- **UPDATE/DELETE `returningOneColumn(<optional column>)`** → `TYPE | null` — **every** existing update/delete
  `returningOneColumn` target is a REQUIRED column, so the optional-column single-column result type (and its **branded**
  enum/custom form) is unexercised (`update.ts:528-533`, `delete.ts:184-189`).
- **Object-form RETURNING of an optional BRANDED column** on update/delete (`{ stage?: ReleaseStage }` / under
  `projectingOptionalValuesAsNullable()` `{ stage: ReleaseStage | null }`) — the only optional-projection returning today
  is unbranded `string`; worth confirming the brand survives (F4-UPDDEL A2, a type-vs-impl probe).
- **onConflictOn(tReleaseDraft.id).doUpdateSet({stage/channel/minVersion})** — DO UPDATE of optional custom-kind columns.

**A-6. Top-level optional BRANDED literal-union column under `projectingOptionalValuesAsNullable()`** (F9-TYPEVAR A3).
`.select({ channel: tReleaseDraft.channel }).projectingOptionalValuesAsNullable()` → `{ channel: ReleaseChannel | null }`
(brand preserved through `| null`). Two independently-covered facts never composed: top-level optional under the nullable
projector is covered only for plain `string`; branded optional leaves only under the default projector. Coordinator grep:
`ReleaseChannel | null` / `ReleaseStage | null` absent matrix-wide. Existing `tReleaseDraft` fixture.

### Tier 2 — distinct overloads / compositions (existing fixtures)

**A-7. `distinct` composed into a compound arm** (SEL-SEAM A-1). `selectDistinctFrom(t).select({…}).unionAll(<plain>)`
emits `select distinct … union all …`; the `distinct` keyword **survives** in the composed output
(`AbstractSqlBuilder.ts:938-940`) but is asserted in **zero** cells (coordinator grep: no `select distinct` inside any
`union|intersect|except|minus`). Use `unionAll` (not `union`) so the left-arm distinct is value-observable in the multiset.
Drop≠defect: clause survives → clean §A, not a boundary.

**A-8. `distinct` × clause-internal `customizeQuery` hooks on a direct (non-page) select** (SEL-SEAM A-2). The
`afterSelectKeyword`-before-`distinct` ordering (`select /* hint */ distinct /* cols */ …`) is asserted nowhere — the only
distinct+customize test is the page path with `beforeQuery`/`afterQuery` only.

### Tier 3 — completeness nits / borderline (existing fixtures)

- **A-9 (F3-SELECT).** `orderBy(<aggregate value-source>)` — e.g. `.groupBy('status').orderBy(conn.count(tIssue.id),'desc')`
  → `order by count(id) desc`; the `NSourceAllowingAggregate` order-by type-branch is a distinct emitted-SQL shape absent
  matrix-wide, though generic-render (both halves tested separately). Optional belt-and-suspenders.
- **A-10 (SEL-SEAM A-3).** Compound `orderBy(valueSource | rawFragment, <explicit mode>)` — the string overload tests all
  12 modes, the value-source/rawFragment overloads only unmoded. Degenerate-leaning.
- **A-11 (F3-PROJ A4).** Compound with asymmetric-but-compatible arm optionality (optional seed column, required other-arm
  value) — `ColumnsForCompound`/`OptionalTypeRequiredOrAny` on asymmetric arms. Low priority (generic remap).
- **A-12 (F4-INSERT A3).** Optional enum/custom/customComparable SET to a *value* on insert — write marshalling identical to
  the required siblings; the least load-bearing slice of A-5's INSERT item.

---

## §B — in scope, needs a fixture addition

**B-1 (F7-EXTRAS, MySQL-dialect, carry-over from Round 6/29).** The two builder-reachable, compat-gated
`UNSUPPORTED_QUERY` throws in `MySqlSqlBuilder.ts:186` (recursive CTE) and `:190` (`values()` in FROM) under
`compatibilityVersion < 8_000_000` are asserted **nowhere** (the matrix's sole mysql cell runs at
`+Infinity`). Needs a `withCompatibilityVersion(5_007_000)` helper in `test/db/mysql/runners.ts`'s
`decorateMySqlContext` (mirroring `withInsensitiveCollation`; the ctor already threads the arg), then a
`config.mysql5-compatibility.test.ts` asserting `reason === 'UNSUPPORTED_QUERY'` for both constructs + a positive
contrast. MySQL-only (the API type-checks identically on every dialect, so no `types.negative` counterpart).

**Optional §B (F1-EQCMP):** a second `enum` column sharing typeName `'ReleaseStage'` would let A-1a's enum
value-source overload be tested *cross-column* rather than via a self-reference — marginal; A-1a closes without it.

---

## Coordinator verification notes (what I checked myself)

| Claim | Method | Verdict |
|---|---|---|
| Fragment MaybeOptional `[src,val,src-OPT]` types required | tsgo compile-repro (isolated `@ts-expect-error`) | **CONFIRMED bug** — mirror optional, control required, bug-case required |
| Empty `values([]).returning().executeInsertMany()` dispatches empty SQL | mock probe (`history.length`) + source read (guard asymmetry + `_buildInsertMultiple`→`''`) | **CONFIRMED mechanism** (mock-blind; real-DB-manifesting) |
| Nullable-family value-source/modifier arms absent on enum/custom/customComparable | operand-capturing wide-grep | **Confirmed absent** (control receivers present) |
| `distinct × compound` emits `select distinct … union …`, untested | src read + grep (drop≠defect: keyword survives) | **Confirmed §A**, no bug |
| aggregate scalar/rule-4/rule-2 collapse behaviors | F9+F3 src read of `AbstractQueryBuilder.ts` strip/drop branches | **SOUND** → §A coverage, no bug |
| ContainsRequired5 depth-5 cap `:true` | F3-PROJ src read | unsound only **below the `never`-render floor** → unusable → OUT |
| optional bare-base leaves in dynamic conditions | F6-DYN src read of FilterTypeOf/MapValueSourceToFilter | **degenerate** (optionality erased: no optionality slot; `any` OPT param) |
| optional-receiver comparison methods on bare-base leaves | F-RECENT/F1-EQCMP src read | **degenerate** (`OPTIONAL_TYPE` is a type param, same declaration; brand-free Boolean result) |
| variadic type-param wiring (9 families) | PARITY position-by-position diff | **clean** (CD-1 fix present; the new bug is in a body, not a position) |

## Refuted / closed-on-sight (so the next round doesn't re-chase)

- **Optional-receiver Equalable/Comparable methods on enum/custom/customComparable** (the round's seeded
  hypothesis) — **degenerate**, not §A: these are single base declarations parameterized on `OPTIONAL_TYPE`
  returning a **brand-free** `BooleanValueSource`; optional-propagation is generically covered, and dynamic-filter
  optionality is erased. Only the **Nullable family** (brand-preserving redeclarations) is the real hole (A-1).
- **`ContainsRequired5` depth-5 cap** — a real type-vs-runtime imprecision in principle, but it fires one level
  *below* the `never`-render floor, so the mis-classified ancestor is already `never`-poisoned/unusable → OUT.
- **Compound optionality merge** (compound reuses the seed's RESULT; constrains the other arm via
  `OptionalTypeRequiredOrAny`) — **SOUND**, no test owed.
- **`extendShape`'s `isColumn(value)` guard** (`InsertQueryBuilder.ts:380`) — dead code via the typed surface
  (shape values are column-name strings, never value sources) → OUT, not filed.
- **customInt `valueWhenNull<VALUE>`/`nullIfValue<VALUE>` SOURCE-union asymmetry** (`values.ts:603/605`) — closed on
  sight (phantom, permanent `types.negative` territory).
- **`update.ts:532` sqlite `| NOldValuesFrom`** — closed on sight (inert type-text).
- No newly-baked `5a08f2cf` snapshot locked a wrong behavior (F-RECENT latent-bug pass, incl. the CD-2 count-CTE's
  now-useless inner `order by`/`window` — valid & harmless in a CTE, not a defect).

## Per-surface saturation summary

| Agent | §A/§B/bug | Note |
|---|---|---|
| **PARITY** | **1 bug** | 16th defect (MaybeOptional overload body); variadic wiring re-diffed clean |
| **MUT-SEAM** | **1 bug** + A-5 | empty-`values` returning-shapes; tReleaseDraft write-side |
| **F-RECENT** | A-1a, A-4 | tail arms of `5a08f2cf`; latent-snapshot pass clean; refuted optional-receiver hypotheses |
| **SEL-SEAM** | A-7, A-8, A-10 | distinct×compound the primary; recursive/CTE/compound seams saturated |
| **F9-TYPEVAR** | A-2, A-2b, A-6 | scalar-aggregate null-strip; branded-union nullable projector; 0 soundness bugs |
| **F1-EQCMP** | A-1b, §B(opt) | Nullable modifier trio on bare-base leaves; comparison methods degenerate |
| **F3-PROJ** | A-2, A-3, A-4, A-11 | aggregate collapse boundaries; depth-5 cap OUT; compound SOUND |
| **F4-INSERT** | A-5 (INSERT) | on-conflict/shaped/from-select re-verified saturated |
| **F4-UPDDEL** | A-5 (UPD/DEL) | method-family saturated; tReleaseDraft returning the gap |
| **F3-SELECT** | A-9 | core select saturated; orderBy(aggregate) the borderline residual |
| **F7-EXTRAS** | §B-1 | extras/adapters/errors/config saturated except MySQL<8 |
| **F5-CONN** | — | **SATURATED (0/0)** re-verified adversarially |
| **F1-STR / F1-TEMP / F1-CUSTOMNUM / F1-NUM / F1-BOOLIF / F2-COL / F2-VALVIEW / F6-DYN** | — | **SATURATED (0/0)** each, re-verified |

## Recommended implementation order

1. **BUG-1** (fragment optionality) — one-token re-bracket at 7 sites + a positive test on `coalesce3` with an
   optional 3rd source arg (currently blocked). Highest value: an unsound public typing.
2. **BUG-2** (empty-`values` returning shapes) — mirror the `executeInsert` guard; docker-verify.
3. **A-1** (Nullable value-source + modifier arms on bare-base leaves) — closes the last of the theme-1 hole the
   `tReleaseDraft` work half-filled.
4. **A-5** (tReleaseDraft write-side) — one new insert file + update/delete returning cases.
5. **A-2 / A-3 / A-4** (aggregate scalar-null-strip, rule-4 all-null drop, rule-2 real miss) — lock the
   probed-sound aggregate boundaries.
6. **A-6, A-7, A-8** — branded-union nullable projector; distinct×compound; distinct×afterSelectKeyword.
7. **§B-1** (MySQL<8 helper) and Tier-3 nits (A-9…A-12) as completeness fill.

## Verdict

A **strong round despite a heavily-implemented baseline**: the maintainer had just closed all of Round 29's §A,
yet going one level deeper than the prior parity sweep surfaced a genuine **unsound type bug** (BUG-1) in the
fragment MaybeOptional overload *bodies* — invisible to a `TN`-position diff and to the all-plain-args fixtures —
and the mutation seam surfaced a **real-DB emission bug** (BUG-2) on the untested sibling of a guarded path.
Thirteen surfaces re-verified saturated, the new `tReleaseDraft` fixture opened a clean write-side §A cluster, and
the new aggregate-projection file left three probeable (and probed-sound) collapse boundaries. Nothing was
manufactured; the seeded optional-receiver hypotheses were correctly refuted as degenerate. The two bugs are the
round's headline; the §A tail (≈12 tests) is real, cheap, and on existing fixtures.
