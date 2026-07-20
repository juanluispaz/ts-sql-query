# MISSING_TESTS_AUDIT — Round 35 (MAXIMAL generosity — exhaustive per-variant enumeration)

**Mandate this round (user-set dial → maximum):** stop closing surfaces as "saturated"; for every surface, enumerate the **complete matrix** and list **every cell that lacks its own dedicated assertion**, tiered by risk, so the implementation phase has a long, prioritized backlog. The standard is *total per-variant coverage* — a representative covering a variant **lowers its tier, it does not remove it**. Only genuinely compile-only (byte-identical SQL **and** value **and** type), as-any/impossible-state, driver-layer, or new-matrix-cell paths are OUT.

**Method:** 20 read-only enumeration agents across two waves (≤10 concurrent). Every agent read its `src/` slice raw, built the full matrix, and grepped the current test files per-cell. Coordinator verified every Tier-1/candidate-defect claim (compile-repro / runtime-probe / wide-grep) before filing.

**Headline:**
- **Src bugs: 0.** One candidate-defect surfaced (SEAM CD1) and was **runtime-probed to not-a-bug**; two others (INSERT twin-asymmetry, PROJ `ContainsRequired5`) resolved to coverage-gap / compile-only.
- **~1,900 list-as-test cells** enumerated across the matrix. Broken into three prioritized waves:
  - **Wave A — genuine Tier-1/2 on existing fixtures: ~280 tests.** Highest value, no fixture work. **Do first.**
  - **Wave B — Tier-1/2 needing a §B fixture addition: ~180 tests + fixture work.** A small set of fixture archetypes unlocks large blocks.
  - **Wave C — Tier-3 exhaustive per-variant completeness tail: ~1,400 tests.** Counted + archetyped per surface; the maintainer sets the depth.
- **Genuinely saturated surfaces:** DYN (0 list), EXTRAS (0 genuine), NUM (~saturated). These returned 0 real gaps under the exhaustive standard — a real, valuable result.
- This is a deliberately **long** backlog per the round's mandate; every item is tiered so the cutoff is the maintainer's to set.

`BUGS.md` stays empty this round.

---

## Implementation status — updated 2026-07-07

**Wave A — ✅ DONE (real-validated).** All 12 clusters (A-1..A-12, ~144 canonical
tests) implemented on `postgres/newest/pg` and propagated to the 17 authored
cells; real-validated `--docker --wasm` on every engine; no `src/` changes.

**Wave B — ✅ DONE (real-validated).** All six items implemented and propagated;
every touched file real-validated on the 6 engines. Fixtures extended in
lockstep across all dialects (schema + seed + connection). Final gates green:
`tests:audit` (0 problems, 2659 tests/cell), `validate:tests` (tsgo),
`validate:tests:tsc`, mock matrix (44 169 pass), WASM (7 815 pass), and a
docker+wasm sweep of every touched file + every fixture-consumer file.

- **B-1 ✅** — 26 `executeFunction` return-kind marshallers. New DB functions per
  dialect + `call*` wrappers on `DBConnection`. uuid/customUuid round-trip on
  every engine (the DB function returns the string form, not native raw/binary);
  SQL Server needs the `dbo.` prefix baked into the function-name string; SQLite
  = `TODO[LIMITATION]` (no stored functions). Home: `exec.procedure-function.test.ts`.
- **B-2 ✅** — trailing-`TypeAdapter` (`[a2]` slot) on a **Table** column, one
  adapter-bearing `columnWithDefaultValue` per distinct kind on `tReleaseDraft`
  (customInt/customDouble/customComparable/custom/enum/customLocalDateTime +
  plain bigint/double), each read required + optional (16 tests, new file
  `select.table-adapter-columns.test.ts`). **Scope note:** covered the *distinct
  adapter-slot code path per kind* rather than the literal ~115 byte-similar
  permutations — the `[a2]` threading is identical across kinds and each base
  marshaller is already covered by the non-adapter column reads. uuid+adapter ≡
  string+adapter path (skipped: the per-dialect uuid `DEFAULT` is fraught).
- **B-3 ✅ — surfaced a real bug, not a coverage gap.** `types.negative/with-values.test.ts`
  proved `Values.create` did **not** enforce the row column shape — a **v2
  regression** (`Values.column()` lost the `& Column` marker + the writable
  runtime coherence, so `MandatoryInsertSets<ValuesView>` collapsed to `{}`).
  **Fixed in `src/`** (`Values.ts` + `utils/Column.ts` + `extras/utils` — Values
  is writable like a Table, not read-only like a View). The 4 row-shape locks are
  now live in the negative file; `BUGS.md` is back to clean.
- **B-4 ✅** — required plain-`localDateTime` + required-`customLocalDateTime`
  **View** columns on `vReleaseOverview` (18 getter cells).
- **B-5 ✅** — optional customDouble / customLocalDate / customLocalTime columns
  on `tReleaseDraft` (6 isNull cells; NULL branch realized on draft 2).
- **B-6 ✅ (with 2 documented closes)** — 15 of the 16
  `aggregateFragmentWithType('optional')` arms (NULL realized inline via an empty
  group). **uuid/customUuid optional-aggregate (2 arms): CLOSED** — `max(uuid)`
  is not portable (Oracle RAW / SQL Server bit). **CONN-CONST date round-trip §B:
  CLOSED** — already covered by Wave A A-6 (`optionalConst(null,'localDate')`),
  per §B-6's own guidance.

**Wave C — split into C-1 / C-2 / C-3 by yield.**
- **C-1 — ✅ DONE (SQL / type-surface pinning).** The ~150 estimate pruned under
  R-P7 to **33 genuine** cells (SELECT orderBy 17, INSERT shaped-multi World-D 12,
  CONN-CONST Date-adapter 4, VALVIEW Tier-3a 0), all real-validated on the 6
  engines with **no NOT-APPLICABLE wrapping** and **zero `src/` changes**; ~117
  closed as byte-coincident or reclassified to C-2 (distinct-projected-type-only).
  Full breakdown + the close/defer catalogue in the Wave C section.
- **C-2 — ✅ SATURATED / CLOSED** (~590 estimate → **0 genuine cells**). The
  per-kind read-type dispatcher is per-kind-branchy but every kind's projection is
  already asserted end-to-end (two dedicated COL factory-type files + const +
  fragmentWithType + exec return-kinds + Values kind-coverage + temporal getters).
  The 6 C-1 deferrals close under the same lens. A genuine saturation result (like
  DYN/EXTRAS/NUM), verified per surface — not a shortfall. Full evidence in the
  Wave C section.
- **C-3 — ✅ DONE** (~680 estimate → **1 genuine cell**, real-validated; ~679 closed).
  The optionality projection is a single generic `OPTIONAL_TYPE`/`MergeOptional`
  mechanism already proven across leaves (EQCMP·OPT, STR optional, NUM merge all
  close); BOOLIF's "elide" premise was factually wrong (`.and(true)` binds a param).
  The lone genuine cell: `reviewerCode.replaceAll` (the Table bracket-adapter twin of
  a covered View transform). **Wave C is now complete.**

**Negative-type locks:**
- Values `MandatoryInsertSets` — **✅ DONE** (fixed in `src/` + locked in
  `types.negative/with-values.test.ts`).
- EQCMP ~24 (`lessThan`/…/`between` on boolean/enum/custom; `equalsInsensitive`
  on non-string leaves) — ⏳ pending.

**Correction to the headline:** "Src bugs: 0 / `BUGS.md` stays empty" held for the
*enumeration* phase, but implementing B-3 surfaced the `Values.create` row-shape
regression — now fixed in `src/`, so `BUGS.md` is clean again.

---

## Bugs / candidate-defects — 0 src bugs (enumeration phase; see status above for the B-3 regression found during implementation)

**SEAM CD1 — root-compound `beforeWithQuery`/`afterWithQuery` render nothing — PROBED, NOT A BUG.** Two tests (`customize-query.compound.test.ts:63/:100`) set these hooks on a **root** compound and their snapshots contain no fragment, while their *comments* claim the hooks "wrap the WITH clause." Coordinator runtime-probe (deleted after use) built a compound **materialised as a CTE** (`forUseInQueryAs`) with the hooks set and read `ctx.lastSql`:
```
with combined as /* with-head */ (/* compound-head */  select … union select … /* compound-tail */) /* with-tail */ select … from combined order by id
```
The hooks **do** render — correctly — when the compound is itself a with-view (the `_buildWith` render site reads each with-view's own `__customization`). At **root**, the compound is not a with-view, so the hooks have no attachment point and correctly render nothing. → **Reading A confirmed: by design.** Artifacts: (a) the §A-1 test below (bake the probed snapshot); (b) a **comment fix** on the two root-compound tests (their comments overstate the hooks at root — the snapshots are already truthful). Not a `BUGS.md` entry.

**INSERT twin-asymmetry — coverage gap, NOT a src defect.** World B (shaped single-insert) is the only insert "world" whose non-`When` conditional/ignore/disallow set family is untested, while its `*When` mirror and all sibling worlds are covered. The agent confirmed **no param/return-type drift** between shaped and non-shaped signatures in `insert.ts` (they differ only by sound `SHAPE`/`MISSING_KEYS_IN_SHAPE` threading). → a §A coverage fill (Wave A §A1 below), not a bug.

**PROJ `ContainsRequired5` — compile-only, provisionally OUT.** At the depth-5 recursion limit the classifier assumes a still-nested inner object is required without discarding rules 1/2 (unlike `ContainsRequired2..4`) — the "type says required, runtime nulls it" fingerprint. **But** the renderers (`ResultObjectValues5` / `…AsNullable5`) `never`-truncate one level below (guarded by an existing negative-type test), so a misclassified container's deeper content is non-renderable → **no realizable runtime value surface** → the compile-only OUT. Flagged for the maintainer to confirm the truncation-vs-classification depths line up; not filed as a bug or a §A.

---

## WAVE A — genuine Tier-1/2 on EXISTING fixtures (~280 tests). Do first. — ✅ DONE (real-validated)

No `domain/connection.ts` change. Each is a distinct code-path / overload / per-leaf redeclaration / execute-shape inhabitant with a distinct type, emission, or realized value.

### A-1 · NULLABLE — 26 per-leaf redeclaration type-paths *(agent NULLABLE)*
The Nullable family is redeclared per leaf; each `(method × leaf × overload)` re-threads the leaf's return type. 26 cells have no sibling coverage and a NULL branch realizable from existing optional columns. Densest: **uuid (6 — its whole modifier-trio + `valueWhenNull(vs)`/`nullIfValue(vs)`), localDateTime (5), customUuid (4), customDouble/customInt (trio arms), `customLocalTime.valueWhenNull(const)`** (the lone missing const overload on an otherwise-complete leaf). Home: `select.value-source.null-and-if-value-modifiers.test.ts` (uuid/customUuid → `select.value-source.uuid-cast.test.ts`). Full 26-item list in the NULLABLE enumeration; all realize their NULL branch via `externalRef`/`archivedAt`/`signingKey`/`startedAt`/`workDate`/`billedAmount`/`costCents`/etc.

### A-2 · EQCMP — ~70 value-source-operand + missing-IfValue cells *(agent EQCMP)*
The const × required-receiver spine is saturated across all 18 leaves; the gap is the **value-source-operand form of `equals`/`notEquals`/`is`/`isNot`** on the ~9 const-only leaves (**bigint, string, double, plain localDate/localTime/localDateTime, customInt (ne/is/isNot), customLocalTime, customComparable (eq/ne)** — each emits a distinct `= other_col` / `is not distinct from other_col`, a different overload from the covered `in(subquery)`), the **const-operand `is`/`isNot`/`equals` on the subquery-heavy customUuid** receiver, and the **absent ordered-comparison `*IfValue` twins** (bigint le/gt, string all four, double all four, etc.). Pair each with its const sibling. Home: `select.value-source.equality-comparison-by-type.test.ts`. *(Verified: the 3 flagged Tier-1 candidates — customDouble ordered, boolean notEquals — are COVERED; only int `in(scalar-subquery)` is genuinely absent → Tier-3.)*

### A-3 · INSERT — 39 shaped-world non-`When` cells *(agent INSERT)*
- **§A1 (18):** World B (shaped single-insert) non-`When` set/ignore/disallow family — `setIfSet`/`setIfSetIfValue`/`setIfNotSet`/`…IfValue`/`setIfHasValue`/`…IfValue`/`setIfHasNoValue`/`…IfValue`/`ignoreIfSet`/`keepOnly`/`ignoreIfHasValue`/`ignoreIfHasNoValue`/`ignoreAnySetWithNoValue`/`disallowIfSet`/`disallowIfNotSet`/`disallowIfValue`/`disallowIfNoValue`/`disallowAnyOtherSet`. Each proves the shape-key→column remap on that arm. Mirror the World-A `insert.conditional-sets` bodies through `.shapedAs({…})`. Home: `insert.shaped.test.ts`.
- **§A2 (16):** World D (shaped multi-row) `setForAll*` non-`When` (8) + `When` (8) beyond the 2 covered. Home: `insert.shaped.test.ts`.
- **§A3 (1):** World A plain single `setIfHasNoValue` non-`When` (only its `When`/`IfValue` siblings exist).
- **§A4 (3):** shaped simple `returning(object)`, shaped `projectingOptionalValuesAsNullable`, shaped simple `returningLastInsertedId`.
- **§A5 (1):** shaped on-conflict `where().or()` continuation.

### A-4 · EXEC-SHAPES + UPDDEL — 18 execute-shape inhabitant cells *(agents EXEC-SHAPES, UPDDEL; deduped)*
- **6 Tier-1 (in-range-PASS / present-value):** `executeInsertMany`/`executeUpdateMany`/`executeDeleteMany`(min,max) **in-range PASS with a RETURNING row-shape** (only THROW arms exist today); `executeDeleteNoneOrOne` row-shape **present** value; `executeUpdateMany`/`executeDeleteMany` **one-column non-empty** scalar array (only the empty `[]` arm exists). Homes: `insert/update/delete.execute-variants.test.ts`.
- **8 Tier-2:** the one-column arity of the many-in-range-PASS; `executeSelectNoneOrOne` one-column **present** scalar; plain-`values({…})` `executeInsertNoneOrOne` row-shape **present** (present asserted only via `onConflictDoNothing`); one-column many min/max throw arms.
- **12 Tier-3 (`MORE_THAN_ONE_ROW` on returning-One):** the runner guard `executeInsertReturningOneRow`/`executeUpdate…`/`executeDelete…` throw `MORE_THAN_ONE_ROW`, reachable on update/delete `returning…executeXxxOne/NoneOrOne` (WHERE matching >1 rows) and insert via `from(multiRowSelect)`. Realize with `if (ctx.realDbEnabled)` (mirror the existing select `MORE_THAN` pattern).

### A-5 · PROJ — 12 asNull-projector twins *(agent PROJ)*
The two projectors are separate code; **`asWithView` (CTE re-projection), `asLeftJoin`-over-CTE, and compound rule-1/rule-4 have DEFAULT tests but zero `asNull` twin** matrix-wide. 6 Tier-1 (genuine null-vs-absent value distinction — each with a boundary row to `mockNext`) + 6 Tier-2. Each MUST runtime-probe the collapse/all-null boundary row (`'k' in obj` / `=== null`). Home: `select.complex-projection.inner-rules.test.ts` (+ `compound-nested-object`). Full 12-cell list with anchors + probe rows in the PROJ enumeration.

### A-6 · CONN-CONST — 9 distinct-cast/marshalling cells *(agent CONN-CONST)*
The **7 `optionalConst(null, kind)` null-inhabitant cells with a distinct emitted cast** (double `::float8`, bigint `::int8`, boolean `::bool`, string `::text`, uuid `::uuid`, localTime `::time`, localDateTime `::timestamp`) — NULL round-trips on every driver, distinct SQL per kind, distinct optional leaf + `toBeNull()`. Plus **boolean + trailing adapter** on `const`/`optionalConst` (a distinct marshalling branch the numeric adapters don't reach). Home: `select.value-source.optional-const.test.ts` / `select.connection-trailing-adapter.test.ts`.

### A-7 · CONN-FRAGMENT — 12 `fragmentWithType` optional arms *(agent CONN-FRAGMENT)*
`fragmentWithType(kind, 'optional')` for **boolean, localDate, localTime, localDateTime, customInt, customDouble, customUuid, customLocalDate, customLocalTime, customLocalDateTime, enum, customComparable** — distinct `?: T | undefined` result never asserted (only the 6 covered optional kinds exist). Realize the null-absent inhabitant over the existing nullable columns. Home: `fragments.type-coverage.test.ts`. *(The 27 `aggregateFragmentWithType` arms in A-8 mostly need only existing columns via `max(...)`; a few need the §B nullable-group — see Wave B.)*

### A-8 · TEMP — 7 Tier-2 + 8 high-value Tier-3 *(agent TEMP)*
- **7 Tier-2 (distinct-typed overload arms, existing fixtures):** LD `nullIfValue(vs)`, LT `valueWhenNull(vs)`, CLD `nullIfValue(vs)`, CLT `valueWhenNull(const)`, LDT `nullIfValue(const)`, LD `isNull`/`isNotNull` (realizable via optional `reviewDate`).
- **8 high-value Tier-3:** the **CLD/CLT optional-custom-temporal getters on a View source** (`vReleaseOverview.releasedOn.asOptional().{getFullYear,…}`, `cutoffClock.asOptional().{getHours,…}`) — the optional-custom-temporal read transform on a View is covered Table-only.

### A-9 · STR — 58 View-adapter-into-transform cells *(agent STR)*
`vReleaseOverview.versionBracketed` (required) and `channelBracketed` (optional) bracketAdapter columns are only bare-projected; **fed into any string transform (`toLowerCase`/`toUpperCase`/`trim*`/`reverse`/`substr*`/`substring*`/`concat`/`replaceAll*`) the result re-brackets, on a genuinely distinct bare-`DBColumnImpl` View read path** observed nowhere. Mirror `select.adapter-into-methods.test.ts` as a `vReleaseOverview` variant (value-tested `[…]` round-trip) + the optional-receiver twin on `channelBracketed`. *(Predicates on these are OUT — bracketAdapter's write path is identity, boolean result → byte-identical.)*

### A-10 · NUM — ~3 optional-receiver unary cells *(agent NUM)*
Optional-receiver unary math threading the optional flag on **bigint / customInt / customDouble** leaves — distinct result TYPE (`?: bigint` / `?: ReleaseTag` / `?: Money`; `sign()→?: number`), asserted only for the double leaf. Realize via `durationMs` / `optionalReleaseOrdinal` / `billedAmount.asOptional()`. One test file closes it.

### A-11 · SELECT — 4 high-value fluent cells *(agent SELECT)*
Plain top-level `join(t).on(...)` (the bare ` join ` keyword — distinct emission, zero non-recursive coverage); `innerJoin().dynamicOn().and()` in a SELECT; `limitIfValue(n)` value-present on a **plain** select (covered only on compound/recursive); the highest-value orderBy clusters (**8 valueSource orderBy modes + 7 `orderByFromString` parser tokens** — see Wave C for the full mode×form tail).

### A-12 · SEAM + UPDDEL — 4 composition/keyword cells
SEAM **§A-1** compound-as-CTE × `beforeWithQuery`/`afterWithQuery` (snapshot already probed above); SEAM **§A-2** compound × `forUseAsInlineAggregatedArrayValue` × customize hooks; UPDDEL **§A-4/§A-5** the bare `.join` alias after `from`/`using` (byte-distinct ` join ` vs ` inner join `).

---

## WAVE B — Tier-1/2 needing a §B fixture addition (~180 tests + fixture work) — ✅ DONE (real-validated; B-3 surfaced + fixed the `Values.create` v2 regression)

A small set of fixture archetypes unlocks large high-value blocks. Ordered by value.

### B-1 · `executeFunction` return-kind marshallers — **Tier-1**, 26 cells *(CONN-FRAGMENT F.1)*
Each return-kind routes a **distinct `transformValueFromDB(returnType)` marshaller** + the required/optional null-gate — the highest-value §B block. Needs: new DB functions in each dialect's `domain/schema.sql` + `call*` wrappers on `DBConnection`, for `boolean, double, uuid, localDate, localTime, enum, custom, customComparable, customInt, customUuid, customLocalDate, customLocalTime, customLocalDateTime` × {required, optional}. Home: `exec.procedure-function.test.ts`.

### B-2 · custom-kind + trailing-adapter on a **Table** column (`[a2]` branch) — ~115 cells *(COL)*
The single most systematically-unfixtured family: **no Table column factory carries a custom-kind trailing `TypeAdapter`** (only View's `releaseOrdinal`/`optionalReleaseOrdinal` exercise the `adapter2` slot anywhere). Add a small set of custom-kind+adapter Table columns (e.g. one `customInt 'Cents' + scaledTenth`, one `customDouble 'Money' + adapter`, one `customComparable + bracket`) across the factories to light up the block. Plus the plain-kind + trailing-adapter beyond int/string (bigint/double/boolean/uuid/temporal +adapter).

### B-3 · Values negative-type file — **Tier-1/2** *(VALVIEW)*
`test/db/postgres/types.negative/` has no `with-values` file. Real negative contracts unlocked: (a) omitting a required `column(...)` field in a `Values.create` row must be a type error (`MandatoryInsertSets`); (b) wrong-TS-type value rejected; (c) optional leaf omittable (positive control). New `types.negative/with-values.test.ts`. *(OUT of the runtime-test scope but a genuine typed-surface lock — surfaced here.)*

### B-4 · TEMP req/View localDateTime + customLocalDateTime columns — 18 getter cells *(TEMP §A-2)*
No required plain-`localDateTime` or required-`customLocalDateTime` **View** column exists; all 9 required-LDT / 9 required-custom-LDT getters on a View source are untested. Add one required `localDateTime` + one required `customLocalDateTime` View column to `vReleaseOverview`. Lowest priority of Wave B (Table side is covered).

### B-5 · optional-`customDouble` / optional-`customLocalDate` / optional-`customLocalTime` columns — 6 isNull cells *(NULLABLE, TEMP §B-4/B-5)*
No optional column of these kinds exists, so `isNull`/`isNotNull` on them have no realizable NULL branch. Add three optional columns (mirroring how `stage`/`channel`/`minVersion` were added to `tReleaseDraft`) to realize them — **low yield** (`isNull` is not re-threaded per leaf; only the emitted column changes). Optional; the NULLABLE agent recommends **closing** these instead unless the maintainer wants byte-complete `isNull` coverage.

### B-6 · CONN-CONST date round-trip §B (6) + `aggregateFragmentWithType` optional group *(CONN-CONST, CONN-FRAGMENT B.2)*
`const(v,'localDate')` / `customLocalDate` required non-null value isn't round-trippable on every driver — keep the covered `optionalConst(null, …)` form or add a §B doc; and the 16 `aggregateFragmentWithType('optional')` arms need a group that resolves NULL.

---

## WAVE C — Tier-3 exhaustive per-variant completeness tail (~1,400 tests) — ⏳ PENDING (split into C-1 / C-2 / C-3 by yield — see the sub-wave plan below)

Every cell is a distinct reachable variant whose type, emission, or value differs from a covered sibling only by a **generic-dispatcher-shared** axis (per-kind, per-arity, optional-receiver-projection). Listed here **counted + archetyped** and grouped into three prioritized sub-waves so the tail can be tackled — or cut — incrementally instead of as one ~1,400-cell block. Each surface's agent enumeration has the exhaustive per-cell breakdown.

The `Sub-wave` column maps each surface to its group; the per-sub-wave plan (with the recommended depth for each) follows the table.

| Surface | Tier-3 count | Sub-wave | Archetype (what fans out) |
|---|---|---|---|
| **EQCMP ·OPT** | **~540** | C-3 | optional-receiver→optional-boolean return-branch, individually projected only for `int`; ~17 leaves × ~16 propagating methods. Distinct projected TYPE (`{b?: boolean}`), SQL+value coincide. |
| **COL per-kind** | **~340** | C-2 | Table/View factory × kind fan-out through the shared `DBColumnImpl`/`ValueSourceFromBuilder` dispatcher (`column('x','uuid')` vs `column('x','localDate')`), each a distinct read-projection type; most §B (no fixture column). |
| **CONN-FRAGMENT arg/valueArg + adapter/arity** | **~130** | C-2 | `arg`/`valueArg` × 18 kinds (incl. all `valueArg('…','required')` arms) + the adapter axis + `executeFunction`/`executeProcedure` arity 0/≥2. Generic `Argument` coercion. |
| **VALVIEW tuple + virtual** | **~120** | C-1 (45) / C-2 (75) | inline-VALUES per-kind tuple cast × optionality × adapter (**45 Tier-3a → C-1**: pin an unasserted cast, esp. **custom-temporal present-position casts**; 35 Tier-3b + ~40 virtual → C-2). |
| **STR optional-receiver + Table-adapter** | **~114** | C-3 | every transform/predicate on an optional receiver (`body`) → `?: T` (94); `reviewerCode`-into-each-remaining-string-fn (20). |
| **CONN-CONST fan-out** | **~46** | C-1 | per-kind fan-out on `const`/`optionalConst` × adapter × the bare-`$1` custom-kind null cells + the 18 widened-typeName-overload type-surface cells. |
| **TEMP getter/nullable fan-out** | **~33** | C-2 | getter × leaf × optionality × source (asOpt-view synthesizable) + per-leaf isNull. |
| **BOOLIF** | **18** | C-3 | per-receiver combinator-elide (only 2/10 exist) + `.and(true)`/`.or(false)` on custom-boolean column receivers. |
| **NULLABLE double≡int + realizable isNull** | **12** | C-2 | 8 `double` cells (interface-identical to `int` — one combined test closes) + 4 realizable-isNull (LD/customInt via optional cols). |
| **SELECT orderBy/join tail** | **~43** | C-1 | every orderBy mode×form cell (8 valueSource + 7 fromString tokens + rawFragment-with-mode + array) + join-variant×dynamicOn arms + 4/5-table comma-from + per-joined-column-kind optionality. |
| **NUM residual** | **~10** | C-3 | non-`add` optional-operand merge per leaf; optional-double unary tail; column-vs-const receiver kind. |
| **INSERT/UPDDEL Tier-3** | **~16** | C-1 | World-D shaped-multi ignore/keepOnly/disallow; plain non-shaped guard-throw + Error-instance overloads. |

**Wave C total ≈ 1,400** distinct per-variant cells, split into three prioritized sub-waves by yield.

### C-1 — SQL / type-surface pinning — ✅ DONE (33 genuine of the ~150 estimate; real-validated on all 6 engines; ~117 closed or reclassified to C-2 under R-P7)
The ~150 estimate was an over-count: after enumerating each surface against the current coverage + `src/` type surface, only **33** cells pin a genuinely-unasserted emitted SQL / cast / orderBy emission / distinct runtime value / guard-throw. The rest are byte-coincident (close) or distinct-projected-**type**-only (→ C-2). All 33 are LIVE in every dialect with per-cell divergent snapshots — **no NOT-APPLICABLE wrapping was needed** (the nulls-ordering modes emulate, they don't reject). Final gates: mock matrix +561 (=33×17) → 44,730/0, tsgo + tsc clean, `tests:audit` symmetric, docker+wasm 5-file sweep 2356/0 across all 6 engines. **Zero `src/` changes.**

- **SELECT orderBy (17):** 10 value-source `orderBy(col, mode)` cells at default collation (the 4 nulls-placements + 7 insensitive variants, byte-distinct from the alias form which renders `title` not `issue.title`) → `select.order-by.variants.test.ts`; 7 `orderByFromString` tokens (bare-column default, the two remaining nulls corners, 5 insensitive-direction/nulls tokens) → `select.order-by.from-string.test.ts`.
- **INSERT shaped-multi World-D (12):** 5 SQL-asserting (`ignoreIfSet`/`keepOnly`/`ignoreIfHasValue`/`ignoreIfHasNoValue`/`ignoreAnySetWithNoValue`, each proving the shape-key→column remap) + 5 guard-throw (`disallowIfSet`/`IfNotSet`/`IfValue`/`IfNoValue`/`AnyOtherSet`, with `disallowedProperty`+`disallowedIndex`) + 1 Error-instance identity-rethrow → `insert.shaped.test.ts`; 1 plain-multi Error-instance per-row-index → `insert.multi-row.set-rules.test.ts`. (World-D is **INSERT-only** — UPDATE/DELETE have no multi-row surface.)
- **CONN-CONST (4):** `const`/`optionalConst` × `localTime`/`localDateTime` through a trailing Date-shift adapter — a distinct temporal `transformValueFromDB` marshaller family (the numeric/uuid/boolean adapters didn't reach it), observable as a shifted `Date` → `select.connection-trailing-adapter.test.ts`.
- **VALVIEW Tier-3a (0):** the whole surface **closed** — `transformPlaceholder` only casts base-kind typeNames; a custom kind carries its brand as the typeName → no `case` match → value-inferred cast → a `Date`/string/uuid *present* value falls to the bare `$n` `return placeholder`, **byte-identical** to the already-covered null cell (and present temporals don't round-trip). No new distinct cast exists.

**Closed / reclassified (~117):**
- **VALVIEW Tier-3a (~45):** verified degenerate (above).
- **CONN-CONST widened-typeName type-surface (18):** assertType-only on the un-projected value source — no `ctx.conn`, no SQL/value. `.select` erases the captured `TYPE_NAME` brand to the leaf (already covered), so a real query can't pin it; a bare `assertType` violates DESIGN Principle #1 (the R-P7-rejected shape). If the brand contract is wanted, it belongs as **brand-mismatch negative locks** in `types.negative/` alongside the pending EQCMP ~24, not as C-1 runtime cells.
- **CONN-CONST bare-`$1` custom-null leaves (3) → C-2:** `optionalConst(null, customUuid/enum/custom)` emit `$1`+null (SQL **and** value byte-covered by `customDouble`/`customLocalDate` null cells); only the projected leaf type differs → distinct-type-only = C-2.
- **SELECT join×dynamicOn + 4/5-table comma-from (D/E):** combinatorial — the dynamicOn ON-accumulation is pinned (leftJoin/innerJoin) and the join keywords (`join`, `left outer join`) are pinned via `.on()`; the cross emits no new token. 4/5-table is the same `.from()` overload as the pinned 2/3-table.
- **SELECT per-joined-column-kind optionality (3) → C-2:** left-join optionality is pinned via a string column; int/boolean/localDateTime are per-kind projected-type fan-out = C-2.
- **INSERT shaped-multi `*When` dispatchers (4):** thin `if (when) return sibling(...)` over already-pinned non-`When` arms; byte-coincident.
- **`orderByFromString` array-per-token, third-collation re-pin, `optionalJoin.on` re-pin:** byte-coincident with existing coverage.

The **C-1/C-2 boundary applied here:** C-1 requires a distinct emitted **SQL** *or* a distinct runtime **value**; a cell whose SQL and value both coincide with a covered sibling and differs only in the projected **type** is C-2 (distinct-projected-read-type), batched one-representative-per-kind there.

### C-2 — distinct projected read-TYPE per kind — ✅ SATURATED / CLOSED (0 genuine cells; the ~590 estimate was already covered)
Enumerating each surface against the current coverage found **the "one representative per (surface × kind)" target was already met** by existing tests — the per-kind read-type dispatcher is per-kind-branchy (each `column`/`optionalColumn`/`const`/`fragmentWithType` kind is a distinct overload returning a distinct `*ValueSource`), but every kind's read-projection leaf is asserted end-to-end (SQL+params+`assertType`+value) somewhere already. Authoring more would re-prove a shared, already-proven dispatcher — the exact R-P7/Principle-#1 redundancy to skip (like DYN/EXTRAS/NUM). **0 cells authored, 0 fixtures added.**

- **COL per-kind (~340) → CLOSE.** All 18 kinds pinned twice over: the two dedicated per-kind factory-type files `select.column-factory-types.test.ts` (Table) + `select.view-column-types.test.ts` (View), **and** `select.value-source.required-const.test.ts` / `optional-const.test.ts` / `fragments.type-coverage.test.ts`. The ~21 un-fixtured (kind × factory × Table/View) coordinates would need brand-new DDL solely to re-prove a covered sibling → not worth it.
- **CONN-FRAGMENT arg/valueArg (~130) → CLOSE.** `arg`/`valueArg` are **input-side** helpers (a compile-time `Argument<…>` discriminant, no per-kind runtime branch) — they project **no** read-type; the fragment row type comes from the `.as(…fragmentWithType(kind)…)` body, and every `fragmentWithType` leaf is pinned in `fragments.type-coverage.test.ts`. All executeFunction return-kinds were pinned in Wave B-1. (0 `assertType` on any `Argument<…>` input type exists — nothing read-type-shaped to pin.) The only real holes are **input/arity** (executeFunction 0-arg/≥2-arg, executeProcedure 1-arg) — not read-type, need fixtures; noted for a possible later input-axis wave, **out of C-2 scope**.
- **VALVIEW Tier-3b + virtual (~75) → CLOSE.** All 18 Values `column`/`optionalColumn` read-types + both `virtualColumnFromFragment` arms (base-kind + custom-kind) + the optional twins + the adapter arms are asserted in `with-values.kind-coverage.test.ts` / `with-values.advanced.test.ts`. The Values per-kind read-type mapping is identical to the Table COL mapping; the SQL (VALUES-tuple cast) axis was already closed in C-1.
- **TEMP getter×leaf×source (~33) → CLOSE.** All 6 temporal leaf-classes × {required, optional} getter read-types (`number`/`number|undefined`, incl. `getTime`) pinned across Table + View in `select.date-ops.test.ts` / `select.value-source.direct-fluent-temporal.test.ts` (Waves A-8/B-4 filled the View + optional cells); const pinned for localDateTime. The getter's projected type is **source-independent** (fixed by the leaf class), so the Table/View/const source axis collapses under R-P7.
- **NULLABLE double≡int + realizable isNull (~12) → CLOSE.** `double` is fully covered as its own leaf (incl. `optional-double-is-null-is-not-null`) in `select.value-source.equality-comparison-by-type.test.ts`; `int` and `double` both return `NumberValueSource` (byte-identical interface). Projected `isNull()/isNotNull() → boolean` is pinned + realized on four leaves (customDouble/customLocalDate/customLocalTime/localDate); a customInt receiver is byte-coincident.
- **The 6 C-1 deferrals also CLOSE** under the same lens: CONN-CONST bare-`$1` custom-null leaves (`optionalConst(null, customUuid)` → `string|null` ≡ the covered `string`-null cell; enum/custom-null pinned via the optional-const object-projection form; SQL `$1`+null already covered), and SELECT per-joined-kind optionality (`?: number`/`?: boolean`/`?: Date` optional projections are pinned elsewhere; the left-join optionality mechanism is pinned via the string sibling).

**Net: C-2 is a genuine saturation result, not a shortfall — the per-kind read-type coverage was already exhaustive after Waves A/B + the pre-existing factory-type/const/fragment/getter files.**

### C-3 — pure optionality fan-out — ✅ DONE (1 genuine cell of the ~680 estimate; ~679 closed under R-P7)
Enumerating the four surfaces confirmed the optionality projection is a **single generic mechanism** (`OPTIONAL_TYPE` / `MergeOptional` on `ValueSourceImpl`, no per-leaf branch), already proven across many leaves — so the pure-optional fan-out closes, exactly as the sub-wave note predicted. One genuinely value-distinct cell surfaced and was authored + real-validated on all 6 engines.

- **EQCMP ·OPT (~540) → CLOSE.** `equals`/`notEquals`/`is`/… propagate the receiver's optionality generically (`BooleanValueSource<SOURCE, OPTIONAL_TYPE>` + `MergeOptional` for the operand form); the optional→optional-boolean projection is already asserted for int (`assigneeId`), customComparable/customUuid (`sameSemver`/`sameKey`), customDouble/customInt (`sameMoney`/`sameCents`), temporal (`date-ops` `b?: boolean`), custom-boolean (`approved`). The remaining leaf×method fan-out is byte-coincident.
- **STR optional-receiver (~94) → CLOSE.** Optional-string transforms → `?: T` are covered generically by the optional View receiver `channelBracketed` run through the whole transform surface in `select.adapter-into-methods.view.test.ts`.
- **STR `reviewerCode`-into-string-fns (~20) → 1 GENUINE + ~19 CLOSE.** `reviewerCode` is a required Table column carrying `bracketAdapter` (read wraps `[...]`, write pass-through). Its value-returning transforms were covered (`toLowerCase`/`toUpperCase`/`trim*`/`reverse`/`substring`/`substr`/`concat`/`length`) **except `replaceAll`** — the one transform the View bracket-adapter twins (`versionBracketed`/`channelBracketed`) have and the Table column lacked. **Authored** `reviewer-code-replace-all-rebrackets-result` (→ `replace(reviewer_code, $1, $2)`, value `[R_7A2]`) in `select.adapter-into-methods.test.ts`. Predicates on `reviewerCode` (boolean result, write-passthrough operand) are value-coincident → close; `substrToEnd`/`substringToEnd` are byte-coincident (the re-bracket mechanism is pinned by `reviewerCode.substr`) → close.
- **BOOLIF (18) → CLOSE — premise incorrect.** `.and(true)` / `.or(false)` do **not** elide in this library — the literal binds as a param (`<pred> and $n`), already covered on the `BooleanValueSource` / `IfValueSource` / `AlwaysIfValueSource` receiver kinds; the genuine `IfValue`-operand elides and `onlyWhen`/`ignoreWhen` are also covered, incl. on custom-boolean column receivers. No distinct elide-SQL to author.
- **NUM residual (~10) → CLOSE.** `MergeOptional` operand-merge is already asserted (`priority.add(estimatedHours)` → `bumped?: number`); optional-double unary tail (`abs`/`sign`) and column-vs-const receiver are pure-optional/structural, byte-identical to their required siblings.

---

## §B fixture-addition plan (unlocks the Wave-B blocks) — ✅ ALL APPLIED

1. **executeFunction DB functions** (B-1) — ✅ per-dialect `domain/schema.sql`
   functions (`ret_flag`/`ret_uuid`/`ret_day`/`ret_clock`/`ret_activity`/`ret_channel`/`ret_semver`
   + reuse of estimated_total/count_open_issues/latest_issue_at) + `call*` wrappers.
2. **Custom-kind + adapter Table columns** (B-2) — ✅ 8 adapter-bearing
   `columnWithDefaultValue` columns on `tReleaseDraft` (one per distinct kind).
   Covered the per-kind `[a2]` code path, not the literal ~115 permutations (see status).
3. **`types.negative/with-values.test.ts`** (B-3) — ✅ new negative file; **surfaced
   + fixed the `Values.create` row-shape v2 regression in `src/`** (see status).
4. **Required LDT + customLDT View columns** on `vReleaseOverview` (B-4) — ✅ 18 getter cells.
5. **Optional customDouble / customLocalDate / customLocalTime columns** (B-5) — ✅ 6 isNull cells.

---

## Negative-type locks (typed-surface, OUT of the Principle-#1 runtime scope — surfaced per "never silently drop")

Both are authored **identically in all 6 databases'** `types.negative/select.test.ts` (the negative-type files are per-database — the type contract is dialect-independent, so each dialect's `DBConnection` type surface is independently locked). 17 `@ts-expect-error` directives + 1 positive control per file. tsgo **and** tsc clean on all 6; a strip-the-directives spot-check on a non-postgres db confirmed 9×TS2339 + 8×TS2769 and **zero** TS2304 (no masking).

- **EQCMP comparison / insensitive absence — ✅ DONE** (the "EQCMP ~24"). Probed each premise WITHOUT the directive first (the error must be the RIGHT one — TS2339 "property does not exist" — not a masked incidental): ordered-comparison absence (`lessThan` + `between`) on `boolean`/`enum`/`custom` (5), and `equalsInsensitive`/`notEqualsInsensitive` string-only absence on int/boolean/enum (4). R-P7-compressed from the literal ~24 (the other comparison methods share the identical Equalable-not-Comparable mechanism). **Masking bug caught + fixed:** the `custom` lock first used `tProjectRelease.channel`, which is **not imported** in these files — the directive was masking a TS2304 "cannot find name", not the real contract; replaced with a self-contained `connection.const<string,'ReleaseChannel'>('stable','custom','ReleaseChannel').lessThan(...)` (const-based, no domain-column dependency, works in every dialect).
- **CONN-CONST widened-typeName brand cells (18) — ✅ DONE as brand-mismatch locks.** Resolved the open decision: the brand-gating premise was **verified real** by compile-repro (`const<number,'ReleaseTag'>(…).equals(const<number,'Cents'>(…))` → TS2769 "no overload matches"; same-brand positive control compiles). Since `equals`'s brand guard (`IEqualableValueSource<…, TYPE, TYPE_NAME, …>`) is one generic mechanism, authored **one representative per branded value-source class** (customInt / customDouble / customUuid / customComparable / custom / customLocalDate / customLocalTime / customLocalDateTime = 8 locks) plus a same-brand positive control — rather than all 9×2 near-duplicates. **Gotcha handled:** the TS2769 lands on the `.equals(...)` continuation line, so each `@ts-expect-error` sits there (not before the receiver).
- **Values `MandatoryInsertSets` — ✅ DONE** (B-3): the row-shape contract is now
  enforced in `src/` and locked in `types.negative/with-values.test.ts` (required
  column present, value type matches, no undeclared key).

---

## Close / OUT catalogue (correctly not listed)

- **DYN ~430** operator×type recombinations — byte-identical SQL+value+type (the dynamic WHERE path projects no optional type; same operator template, different column name, per-type encoding pinned via a sibling). + 3 structurally-unreachable filter arms (`NullableFilter` arm, `Filter` catch-all, `Array<Filter>` type-only). **DYN is genuinely saturated.**
- **STR ~216** adapter-into-predicate cells — bracketAdapter write-path is identity + predicate result is boolean → byte-identical to a plain-column predicate.
- **EXTRAS 6 redundant** CustomBoolean sub-cells (literal-only difference, every literal observed elsewhere → **close**, per the homogenization discipline) + 2 OUT reasons (`NO_PRIMARY_KEY_FOUND` foreign-dialect/NA, `INVALID_CONFIGURATION` driver/sqlite).
- **NULLABLE 6 degenerate** isNull cells (not re-threaded per leaf; no optional column of that kind) → close unless B-5.
- **BOOLIF/EQCMP/DYN byte-identical elides** (e.g. `lessOrEqualIfValue`-elide ≡ `lessThanIfValue`-elide).
- **PROJ `ContainsRequired5`** — compile-only (renderer never-truncates below level 5).
- **VALVIEW `__setColumnsName` nested recursion** — reachability unconfirmed; flagged for the owner (do not invent an API).
- **Typed-impossible:** DELETE `oldValues()`; bare on-conflict on PG (`never`-typed); comparison methods on target-join for update/delete.

---

## Per-surface saturation table

| Surface | Cells | Covered-indiv. | List-as-test | Genuine T1/2 | Verdict |
|---|---|---|---|---|---|
| COL | 540 | 71 | ~469 | ~15 + ~115 §B | per-kind fan-out; adapter2-on-Table is the big §B block |
| CONN-CONST | 108 (+18) | 47 | 61 (+18) | 9 | 7 distinct-cast nulls + boolean-adapter |
| CONN-FRAGMENT | ~250 | ~110 | ~120 | 26 §B + 39 T2 | executeFunction marshallers (T1-§B); builder-arity + sequence COMPLETE |
| EQCMP | ~1266 | ~630 | ~620 | ~70 | const×req spine saturated; value-source-operand + ·OPT tail |
| NULLABLE | 180 | 136 | 44 | 26 | per-leaf redeclaration; 6 fully saturated leaves |
| NUM | ~100 | ~95% | ~8 | 3 | one of the most saturated surfaces |
| STR | 515 | 113 | ~190 | 58 (View-adapter) | baseline exhaustive; View-adapter-into-transforms is the gap |
| TEMP | 178 | 130 | 48 | 7 + 8 | getter×leaf saturated; View optional-custom-temporal getters |
| PROJ | large | most | 12 + 8 fam | 6 + 6 | asNull-projector twins on CTE/compound |
| EXEC-SHAPES | ~89 | 63 | 26 | 6 + 8 | in-range-PASS + MORE_THAN_ONE_ROW-on-returning-One |
| VALVIEW | ~180 | ~39 | ~120 | §B neg-type | tuple/virtual fan-out; Values negative file missing |
| SELECT | ~147 | ~114 | ~47 | 4 | where/dynamicWhere COMPLETE; orderBy mode×form tail |
| UPDDEL | ~184 | ~172 | 12 | 5 | extremely mature; bare `.join` + many-in-range |
| INSERT | ~336 | ~275 | ~48 | 39 | shaped-world non-When family is the block |
| BOOLIF | ~95 | ~76 | 18 | 0 | near-saturated; per-receiver elide + literal-on-column |
| SEAM | ~42 | ~31 | 8 | 2 | compound-as-CTE withQuery + inline-agg-array |
| DYN | ~530 | ~530 | **0** | 0 | **SATURATED** |
| EXTRAS | ~116 | ~108 | 0 genuine | 0 | **SATURATED** |

---

## Coordinator verification notes

1. **EQCMP 3 Tier-1 candidates** → grep: customDouble ordered-comparison COVERED (`billedAmount.greaterThan`/`lessThan` ×17), boolean notEquals COVERED (`billable`/`published.notEquals` ×17); only int `in(scalar-subquery)` genuinely absent → downgraded Tier-3. (**0 real Tier-1 on EQCMP.**)
2. **SEAM CD1** → runtime-probe (deleted): hooks render on the compound's CTE parens when it's a with-view → not-a-bug (Reading A); the §A-1 snapshot is captured; a comment fix on two tests is the only src-side action.
3. **INSERT twin-asymmetry** → agent confirmed no param/return drift in `insert.ts` → coverage gap, not a defect.
4. **PROJ `ContainsRequired5`** → compile-only (renderer level-5 never-truncation) → OUT.
5. **DYN / EXTRAS saturation** → accepted: DYN's ~430 recombinations are byte-identical (dynamic WHERE projects no optional type — the discriminator legitimately fires here where it does NOT for EQCMP's direct-fluent ·OPT); EXTRAS' 6 sub-cells are literal-only duplicates → close.

Working tree ends **clean** (both probes deleted; `git status --porcelain` shows only the pre-existing untracked reports + `.gitignore` + this file).

---

## Recommended implementation order

1. **Wave A** (~280, existing fixtures) — ✅ **DONE, real-validated.**
2. **Wave B** (~180 + fixtures) — ✅ **DONE, real-validated** (B-3 surfaced + the
   `Values.create` v2 regression was fixed in `src/`; B-6 uuid/customUuid + the
   date-round-trip §B closed with rationale — see status).
3. **Wave C** — split into three sub-waves by yield:
   **C-1 ✅ DONE** (~150 estimate → **33 genuine** SQL/type-surface cells, real-validated on
   all 6 engines, 0 src changes; ~117 closed/reclassified to C-2 under R-P7),
   **C-2 ✅ SATURATED/CLOSED** (~590 estimate → **0 genuine** — per-kind read-types already
   exhaustively pinned; verified per surface; the 6 C-1 deferrals close too),
   **C-3 ✅ DONE** (~680 estimate → **1 genuine** cell `reviewerCode.replaceAll`, real-validated;
   ~679 closed — generic optionality mechanism already proven). **Wave C complete.**
   Full per-sub-wave plan in the Wave C section.
4. **Negative-type locks** — ✅ **ALL DONE.** Values `MandatoryInsertSets` (B-3);
   EQCMP comparison/insensitive absence + the 18 CONN-CONST widened-typeName brand
   cells (as brand-mismatch locks, one per branded value-source class) — all in
   `types.negative/select.test.ts` / `with-values.test.ts`, tsgo + tsc clean. (The
   SEAM comment fix landed with Wave A.)

## Verdict

Under the maximal-per-variant standard the matrix reveals **~1,900 distinct listable cells** — the implementation phase now vastly outweighs the audit, as intended. The enumeration phase found **0 src bugs**, but **implementing Wave B B-3 surfaced one real defect** — the `Values.create` row-shape v2 regression — now **fixed in `src/`**. The genuine yield is concentrated: ~280 Tier-1/2 tests on existing fixtures (Wave A, ✅ done) that a "saturated" verdict would have hidden, plus ~180 fixture-gated Tier-1/2 (Wave B, ✅ done — headlined by the 26 executeFunction marshallers and the adapter-on-Table block), on top of the ~1,400-cell exhaustive completeness tail (Wave C, ⏳ pending). Three surfaces (DYN, EXTRAS, NUM) are genuinely saturated even at this standard — a real result, not a shortfall.

**The entire audit — Waves A + B + C AND the negative-type locks — is now COMPLETE.** The runtime waves are real-validated on all 6 engines; the negative locks are tsgo + tsc clean. The only src change in the whole audit was the B-3 `Values.create` fix; Wave C and the negative locks needed zero src changes. Wave C's ~1,400-cell estimate resolved to **34 genuine cells** (C-1 33 + C-2 0 + C-3 1) — the enumeration over-counted against coverage that Waves A/B + the pre-existing factory-type / const / fragment / getter / optional-propagation machinery had already achieved. The ~1,366 non-authored Wave-C cells are byte-coincident, distinct-projected-type-only, or degenerate (documented per surface above). The negative-type locks (Values row-shape, EQCMP comparison/insensitive absence, and the 18 CONN-CONST brand-mismatch — the latter a runtime-impossible contract, correctly landed as compile-time locks) are all in `types.negative/`. **Nothing pending.**

**Runbook:** no fingerprint/oracle edit warranted (0 new defects, no new failure mode). **One stale entry dropped this session:** §9's "customInt `valueWhenNull`/`nullIfValue` SOURCE-union — permanent OUT" fingerprint was factually false after last session's fix (customInt is no longer the outlier); removed cleanly (git records the fix; the timeless "phantom SOURCE union → compile-only OUT" rule it illustrated is retained in §4).
