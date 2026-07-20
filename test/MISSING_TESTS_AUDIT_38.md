# MISSING_TESTS_AUDIT_38 — maximal, from-scratch, type-driven audit

> **Mandate (Round 38).** Fresh, full re-derivation of the whole typed surface —
> inheriting NO "covered / saturated / degenerate" verdict from any prior round.
> Dial: **MAXIMAL SATURATION, LIST > CLOSE.** Every reachable type-path with ANY
> observable surface (declared type / emitted SQL / realized value) is LISTED at
> its tier. Only the four genuine OUT reasons remove a cell
> (unconstructible-no-runtime-surface / pure-phantom / `src/queryRunners/` /
> new matrix cell).
>
> **Method.** 20 read-only discovery agents (16 per-surface + F-RECENT +
> F9-TYPEVAR + two seam critics + PARITY), ≤10 concurrent, each re-enumerating its
> full matrix against the CURRENT tree. Coordinator (this file) verified every
> load-bearing claim itself — including a **`--docker postgres/newest/pg` runtime
> probe** that confirmed the round's headline bug. All probes deleted; tree clean.
>
> **Matrix now.** 17 cells · 244 test files · 2778 tests/cell · 47 226 tests ·
> `tests:audit` clean (up from 238/2737/46 529 at R37 — the R37 findings landed).
> Reference cell `test/db/postgres/newest/pg/` (249 files) + `types.negative/`.

## Headline

Round 37's implementation **held**: 15+ surfaces re-confirmed SATURATED under a
fresh re-derivation, and every R37 §A finding was verified now COVERED (spot-checks
in §6). Despite that maturity, the maximalist sweep surfaced **1 confirmed `src/`
defect** (BUG-2) plus a docker-confirmed emission divergence (custom-temporal const
getters) that the maintainer **classified as a by-design limitation** (custom
placeholders are the user's responsibility — see §0.1), and a compact, high-quality
§A residual.

- **Confirmed `src/` bugs: 1** (BUG-2, filed to `test/BUGS.md`; coverage-invisible).
- **Reclassified as a by-design limitation: 1** (BUG-1 → custom-type placeholder
  casting is the user's `transformPlaceholder` responsibility; §0.1, §4).
- **Genuine §A findings (existing fixtures / drivable): ~9**, tiered T2–T3, + the
  exhaustive T4 tail.
- **Negative-type locks surfaced: 3** (CustomInt absent-float, CustomDouble
  absent-casts, Values `OpaqueValues` constructor lock).

---

## 0. Confirmed defects & the reclassified emission divergence

### BUG-1 — const custom-temporal getters emit an uncast placeholder on PostgreSQL → **RECLASSIFIED: by-design LIMITATION (custom placeholders are the user's `transformPlaceholder` responsibility)**

**Discovered by F1-TEMP; docker-confirmed by the coordinator; then classified by the
maintainer as NOT a bug.**
- **Emission (mock probe):** `const(d,'localDate').getMonth()` →
  `extract(month from $1::date) - 1` (cast); `const(d,'customLocalDate','ReleaseDay')
  .getMonth()` → `extract(month from $1) - 1` (**bare, no cast**).
- **Runtime (`--docker postgres/newest/pg` probe):** the plain-control test resolves;
  the custom-candidate test fails — PostgreSQL rejects the bare untyped `$1` at prepare
  time.
- **Mechanism:** `PostgreSqlConnection.transformPlaceholder`'s cast switch keys on the
  type name; a custom receiver passes its **brand** typeName (`'ReleaseDay'`), which
  matches no base-name case → `return placeholder` (uncast).
- **Maintainer's classification (authoritative):** this is a **current LIMITATION, not
  a bug.** Custom types carry no built-in SQL type, so casting a custom placeholder is
  the **user's responsibility** — the user writes the corresponding `transformPlaceholder`
  logic in their own `DBConnection` (mapping their custom typeNames to the right cast).
  The library does not auto-derive it. Same family/root cause as the documented
  `arg`/`valueArg` custom-temporal boundary (§4).
- **Consequence for the suite (NOT a `src/` change):** the finding is a **§B fixture
  gap** — the domain `DBConnection` overrides `transformValueFromDB`/`ToDB` (via
  `baseTypeForCustom`) but **not** `transformPlaceholder`, so it doesn't model the user
  responsibility. To cover const custom-temporal getters (and the arg/valueArg
  custom-temporal marshalling), add a `transformPlaceholder` override to the domain
  `DBConnection` that casts the custom typeNames — turning the fixture into a complete
  user example. Otherwise it stays a documented boundary. **Removed from `BUGS.md`.**

### BUG-2 — Dynamic-condition INVALID_FILTER `errorReason.path` is the parent, not the offending column (message/path mismatch) [confirmed `src/` defect, filed to `BUGS.md`]

**Discovered by F6-DYN and F-RECENT independently (two-agent convergence); confirmed by source read.**
- **`DynamicConditionBuilder.ts:96`** (column-value-not-object INVALID_FILTER)
  uses `path: prefix` (parent scope) while its **message** names the full column via
  `joinPath(prefix, key)`. The structurally-identical `UNKNOWN_COLUMN` sibling at
  line 90 uses `joinPath(prefix, key)` for **both**. The `5bea04f7` `joinPath` fix
  updated line 96's message but not its `path` — an incomplete application.
- **Reproduction:** `dynamicConditionFor(nestedFields).withValues({ project: { id: 5 } }
  as any)` throws `errorReason.path === 'project'` while the message reads
  `"project.id"`; at depth 1 `path === ''` vs message `"id"`.
- The scope-level INVALID_FILTER throws at lines 39/50/58 (bad top-level filter,
  `and`/`or`-not-array) correctly keep `path: prefix` (not column-specific) — only
  line 96 is inconsistent.
- **No cell asserts the INVALID_FILTER `path` at any depth** (existing tests check
  `.reason` only), so it went unnoticed. Low-severity (error-metadata only, no SQL
  impact); same class as the CD-2 path bug the maintainer just fixed in `5bea04f7`.
  Both readings in BUGS.md.

---

## 1. §A findings — Tier 2 (distinct SQL/value; genuine gaps on existing fixtures)

- **A-1 [SEL-SEAM R3b] — compound (union/set-op) projecting a NESTED OBJECT +
  `executeSelectPage`.** Distinct emission: `CompoundSelectQueryBuilder.__buildSelectCount`
  wraps the compound as `with result_for_count as (select … "obj.a","obj.b" … union …)
  select count(*) …` — the **dot-aliased nested columns must appear inside the
  count-wrap CTE**, and `data` rows reconstruct the nested object. The pieces exist
  separately (`select.compound.execute-page.test.ts` = compound+page **flat**;
  `select.compound-nested-object.test.ts` = compound+nested via `executeSelectMany`)
  but never crossed. Fixture: `tIssue`.
- **A-2 [F-RECENT §A-5] — UPDATE empty `dynamicSet()` + min bound → MINIMUM_ROWS_NOT_REACHED.**
  `07edb90f` restructured `UpdateQueryBuilder` so the no-sets branch assigns
  `result=createResolvedPromise(0)` and **falls through to the min/max guard**
  (previously early-returned 0). The **INSERT** side is covered
  (`errors.insert-guards.test.ts` empty+min); the **UPDATE** twin is a clean omission
  (`update.execute-variants.test.ts:204-262` exercise empty `dynamicSet()` with **no**
  bound). Test: `update(tIssue).dynamicSet().where(...).executeUpdate(1)` → throws;
  + `…returning({...}).executeUpdateMany(1)`. Mirror of the three insert `empty-values-*-with-min`.
- **A-3 [F-RECENT §A-1 / F6-DYN R1] — INVALID_FILTER `errorReason.path` at depth ≥2**
  (pins BUG-2). A nested column-value-not-object test asserting the current `path`
  (`'project'`) + the message, plus a depth-1 control (`path === ''`). Closes the one
  unpinned reason×depth cell and forces the BUG-2 adjudication. §A (fixture:
  `dynamicConditionFor` nested model).
- **A-4 [F1-NUM A-1] — bigint cross-table (self-join) value-source operand.** The
  bigint `add/subtract/modulo/minValue/maxValue` overloads widen to
  `SOURCE | VALUE[typeof source]`, but every runtime test uses the SAME column
  (`viewCount.add(viewCount)` — collapses the union). The customInt twin
  (`numeric-operand-coverage.test.ts:512`, `costCents.add(worklog2.costCents)` via
  `tIssueWorklog.as('worklog2')`) exists; the bigint twin does not. Test:
  `tIssue.as('issue2')`, `viewCount.add(issue2.viewCount)` → `issue.view_count +
  issue2.view_count`. Distinct SQL (join + qualified cols).
- **A-5 [F7-EXTRAS] — `UNSUPPORTED_QUERY` on MySQL/MariaDB compatibility mode.**
  `MySqlSqlBuilder.ts:186,190` throws when `compatibilityVersion < 8_000_000` and a
  query uses a recursive CTE or a Values-view in FROM. **Drivable with no new
  fixture** — the `DBConnection(runner, compatibilityVersion?)` constructor already
  exists (`mysql/domain/connection.ts:86`, `mariadb/…:86`): `new DBConnection(runner,
  5_007_000)` + a recursive-CTE / Values-view-in-FROM select → assert
  `UNSUPPORTED_QUERY`. Zero behavioral assertions exist anywhere. In `mysql/newest/mysql*`
  + `mariadb/newest/mariadb` (2 cells — outside the pg reference cell, so §B by scope
  though no fixture is needed).

---

## 2. §A findings — Tier 3 (distinct type/value; neg-locks; per-variant completeness)

- **A-6 [F-RECENT §A-2] — INVALID_EXTENSION_RETURN_TYPE `errorReason.path` at depth ≥2**
  (both the filter site and the column-rule site; pinned only at depth 1 today).
  The `joinPath` fix newly makes these correct (`'project.broken'` / `'project.id'`);
  the depth-≥2 arm is unverified. §A.
- **A-7 [F3-PROJ] — plain-select 4×4 projector cell (outer rule-4 all-optional-with-own-scalar
  + inner rule-4 all-optional), both projectors.** The last constructible grid diagonal.
  Novel runtime boundary (oracle): a row with `own` non-null but every inner leaf null →
  outer PRESENT, inner-r4 collapsed → `inner` key ABSENT (default) / `null` (as-null);
  a fully-null row → `outer` absent/null. Needs `expect('inner' in row.outer!).toBe(false)`
  + `expect('outer' in row).toBe(false)`. §A (existing left-join fixtures).
- **A-8 [F1-CUSTOMNUM T2] — CustomInt "absent float-only methods" negative lock.**
  `BigintValueSource` has a full absent-method `@ts-expect-error` block
  (`types.negative/select.test.ts:334-357`); CustomInt's commented-out set
  (`exp/ln/log10/sqrt/cbrt` + 7 trig + `power/logn/roundn/divide/atan2`) has **no**
  analogous lock on a `Cents`/`ReleaseTag` receiver — an accidental un-comment would go
  uncaught. Mirror the Bigint block (~12 directives; **not** `multiply`, which is active
  on CustomInt). No representative substitute.
- **A-9 [F1-CUSTOMNUM T3] — CustomDouble "absent casts" negative lock.**
  `asInt`/`asDouble`/`asBigint` are `NumberValueSource`-only and commented out on
  CustomDouble (`values.ts:619-621`); no lock asserts `money.asInt()` etc. absent
  (3 directives on a `Money` receiver).
- **A-10 [F1-CUSTOMNUM T3] — CustomDouble source-union positive control.** The
  CustomDouble cross-table neg-locks (`types.negative/select.test.ts:313-326`) have no
  positive counterpart, whereas CustomInt has both a compile control and a runtime
  cross-table test. Add `billedAmount.add(worklog2.billedAmount)` (joined) or the inline
  compile-positive. Pairing-completeness (representative-covered on pure emission).
- **A-11 [F2-VALVIEW T3] — `Values` direct-construction (`OpaqueValues`) negative lock.**
  `new VProjectPatch('projectPatch', [ {…} ])` must be rejected by the
  `OpaqueValues`/`[dontCallConstructor]` brand (`src/Values.ts:275,289`) — the safety
  mechanism forcing `Values.create` as the sole entry point. Grep finds **zero**
  references anywhere; the `Values.create` surface is exhaustively locked but the
  constructor-bypass lock is untested. One `@ts-expect-error` in
  `types.negative/with-values.test.ts`.

---

## 3. §A / §B — Tier 4 exhaustive completeness tail (LISTED per the dial, representative-lowered)

Each is dominated by a tested representative (which LOWERS its tier); the maintainer
sets the cutoff. Enumerated with counts:

- **F-RECENT §A-3/§A-4** — UNKNOWN_OPERATION `path` at depth 2 (depth-3 pinned);
  `processAdditionalColumnFilter` error `path` value never asserted (message-only). T4.
- **F3-PROJ** — aggregate-element 4×4 twin (T4); plain 3×3 rule cell (T4, representative).
- **F1-BOOLIF** — both-sides-parenthesised precedence: `(A or B) and (C or D)` and
  `(A and B) or (C and D)` (each side-paren arm hit in isolation; the both-sides snapshot
  is distinct-SQL but no new src branch). 2 snapshots. + `noValueBoolean()` as OR-RHS (1).
- **F2-COL** — 3 micro-§A T4 WRITE bindings (`shiftedRating`/`shiftedReleaseDay`/
  `shiftedCutoff`, transform proven on siblings) + the **~452 §B per-factory-kind coords**
  (per-factory kind fan-out, all distinct-type-only / representative-lowered — counts in
  the F2-COL detail: primaryKey ~15, autogenPK ~7, autogenPKBySequence ~16,
  computedColumn/virtual ~17 each × Table+View, View required-kind ~8).
- **F4-INSERT** — the ~2,100-cell (set-variant × column-kind) cross-product,
  **T4-degenerate** via a confirmed DOUBLE decoupling (staging ⊥ marshalling: `_isValue`
  is kind/adapter/brand-blind; adapter-apply ⊥ value-type render: `_transformParamToDB`'s
  `_columnType` is unused). Plus T4 §A adapter-write on temporal/bigint/double
  (shiftedStamp/shiftedCount insert-write never exercised) + §B multi-row over custom-kind.
- **F4-UPDDEL** — 2 T4 (Default sentinel as RHS of a conditional setter `setIfValue({col:
  default()})`; raw-fragment / scalar-subquery as SET RHS). Both lean CLOSE.
- **MUT-SEAM** — 4 T4 (do-nothing+returningLastId+min count-0; do-nothing+executeInsertOne→NO_RESULT;
  UPDATE JOIN×customizeQuery; DELETE JOIN×customizeQuery).
- **F5-CONN** — L3 `buildFragmentWithMaybeOptionalArgs` undefined-inhabitant at arity 4/5
  (arity-3 proves the arity-independent fold); IfValue skip-branch at arity 4/5.
- **SEL-SEAM** — R3a (plain nested + page, T3), R1 (projectingOptionalValuesAsNullable +
  executeSelectPage, T3), and the G-tail (nullable after intersect/except/minus [degenerate];
  ContainsRequired5 depth-5+; compound+orderBy inline; Values × nested/customizeQuery;
  recursiveUnion-dedup left-join-optional-nested).
- **F3-SELECT** — 4 equivalence-covered arms (`selectFromNoTable().where`; empty `dynamicOn()`;
  empty `groupBy()`/`orderByFromStringArray([])`; one-column `orderBy('result')`).
- **F6-DYN** — R2-R8 (notIn:[] empty collapse; is/isNot:null/undefined explicit; nested
  extension path depth ≥2; UNKNOWN_OPERATION depth-2).
- **F1-NUM / F1-STR / F1-EQCMP / F1-CUSTOMNUM / F1-TEMP / F2-VALVIEW** — the per-leaf
  emission-identical / distinct-type-only tails (double transcendentals & unary on plain
  double; subquery-operand into string methods; insensitive-on-optional-receiver;
  col-vs-col on shared generics; const-optional temporal getters; View kinds
  enum/custom/customDouble/customUuid; Values degenerate variants). All representative.

---

## 4. Documented existing limitation re-surfaced (not a new bug — same family as BUG-1)

**F5-CONN** re-discovered that `arg`/`valueArg` over `customLocalDate`/`customLocalTime`/
`customLocalDateTime` bind the **raw Date** without routing through the connection's
`baseTypeForCustom` marshalling (unlike const/column) → the bound value does not
round-trip on real engines. This is **already documented** in
`fragments.with-args.temporal.test.ts:11-16` as intentionally-not-covered ("Covering them
would require a src-side marshalling change") — not a new finding. It shares BUG-1's root
cause **and the same maintainer classification: custom-type placeholder/marshalling is the
user's responsibility** (their `DBConnection.transformPlaceholder` / `TypeAdapter`), not a
library gap. Both are **§B**: the domain `DBConnection` could add a custom-type
`transformPlaceholder` (and marshalling) to model the user side and cover const
custom-temporal getters + arg/valueArg custom-temporal at once; otherwise both remain
documented boundaries. A mock-only test would be degenerate.

## 5. REFUTED / known (recorded so a future round does not re-chase)

- **CD-1** (`update.ts:532` `| NOldValuesFrom` on the sqlite one-column returning arm) —
  re-surfaced by PARITY, correctly classified **OUT** (inert, unconstructible). It is
  **intentional forward-scaffolding awaiting SQLite's OLD/NEW feature** (per the
  maintainer, R37) — **not dead code, do not delete**. Not re-filed.
- The R37 §A findings (wildcard-escape, const-plain-temporal getter, `A or (B and C)`,
  boolean-numeric-string, source-union locks, projector OYSTER/4×1/4×2, Values hoists,
  recursive nested-object) — all verified **now COVERED** (§6).

## 6. Coordinator verification notes

- **BUG-1** — mock probe confirmed the emission asymmetry (`extract(month from $1)` vs
  `…$1::date`); **`--docker postgres/newest/pg --test-name-pattern`** confirmed PG
  rejects the custom form while the plain control resolves. Probes deleted.
- **BUG-2** — source read of `DynamicConditionBuilder.ts:39/50/58/90/96`: line 96's
  `path: prefix` vs message `joinPath(prefix,key)`, inconsistent with the sibling
  UNKNOWN_COLUMN at line 90.
- **F5-CONN custom-temporal** — read `fragments.with-args.temporal.test.ts:11-16`
  (already documented) + `_transformParamToDB` (`AbstractSqlBuilder.ts:543-548`); not in
  LIMITATIONS.md.
- **R37 landed** — verified new files `cte.recursive-nested-object.test.ts`,
  `select.value-source.const-temporal-getters.test.ts`, `select.where.like-escape-literal.test.ts`,
  `with-values.builder-position-hoists.test.ts`, `select.value-source.optionality-algebra.test.ts`;
  `types.negative/select.test.ts` grew 46→70 `@ts-expect-error` (source-union / bigint-omitted
  / cross-leaf locks).
- **`5bea04f7`** — the R37 CD-2 (error-path stray space) fix; `joinPath` helper; shipped
  `dynamic-condition.errors.test.ts` depth-2/3 path tests. Verified; BUG-2 is its residual.
- Tree clean — `git status --porcelain` shows only `BUGS.md` + `MISSING_TESTS_AUDIT_38.md`
  (+ the runbook fingerprint edit, + pre-existing untracked audit files & `.gitignore`).

## 7. Saturation table (per surface)

| Surface | Verdict | Genuine §A/§B | Defects |
|---|---|---|---|
| Mutation seam (MUT-SEAM) | **SATURATED** | 0 (T4 ×4) | 0 |
| Twin-interface parity (PARITY) | **SATURATED** | 0 | CD-1 → known scaffolding (OUT) |
| Select/CTE/recursive/projection seam (SEL-SEAM) | **SATURATED** | R3b (T2), R3a/R1 (T3), G-tail (T4) | 0 |
| Recently-changed src (F-RECENT) | 7/9 covered | §A-5 (T2), §A-1 (T2, →BUG-2), §A-2 (T3), §A-3/4 (T4) | BUG-2 |
| Result-type/value algebra (F9-TYPEVAR) | **SATURATED** | 0 | 0 |
| Equality/comparison ×leaf (F1-EQCMP) | **SATURATED** | 0 (T4) | 0 |
| Connection API (F5-CONN) | **SATURATED** | L3 (T4) | custom-temporal limitation (documented) |
| Column factories (F2-COL) | **SATURATED** | 3 micro-§A (T4); ~452 §B (T4) | 0 |
| CustomInt/CustomDouble (F1-CUSTOMNUM) | **SATURATED** | A-8/A-9/A-10 (T2/T3 neg-locks) | 0 |
| Temporal (F1-TEMP) | getter grid SATURATED | §B (custom-`transformPlaceholder` fixture) | BUG-1 → by-design limitation (user responsibility) |
| Number/Bigint (F1-NUM) | **SATURATED** | A-4 bigint cross-table (T2) | 0 |
| String (F1-STR) | **SATURATED** | 0 (T4) | 0 |
| Boolean/IfValue (F1-BOOLIF) | **SATURATED** | both-sides-paren (T4) | 0 |
| Values + View source (F2-VALVIEW) | **SATURATED** | A-11 OpaqueValues lock (T3) | 0 |
| Select fluent (F3-SELECT) | **SATURATED** | 0 (T4 ×4) | 0 |
| Complex projections (F3-PROJ) | **SATURATED** | A-7 4×4 (T3); element-4×4/3×3 (T4) | 0 |
| Dynamic condition (F6-DYN) | **SATURATED** | R1 (T3, →BUG-2); R2-R8 (T4) | BUG-2 |
| Insert set-variant×kind (F4-INSERT) | **SATURATED** | 0 (T4 ~2,100 degenerate) | 0 |
| Update/Delete (F4-UPDDEL) | **SATURATED** | 0 (T4 ×2) | 0 |
| Extras/adapter/errors (F7-EXTRAS) | **SATURATED** | A-5 UNSUPPORTED_QUERY (T2, non-pg) | 0 |

## 8. Recommended implementation order

1. **Fix BUG-2** (BUGS.md): INVALID_FILTER path — one-token `path: joinPath(prefix,key)`
   at `DynamicConditionBuilder.ts:96` (or make the message match). **BUG-1 is a
   by-design limitation** (custom placeholder = user's `transformPlaceholder`); if the
   suite wants to cover const custom-temporal getters + arg/valueArg custom-temporal,
   add a custom-type `transformPlaceholder` override to the domain `DBConnection` (§B,
   shared with the F5-CONN limitation) — not a `src/` change.
2. **Tier-2 §A (distinct SQL/value):** A-1 (compound nested + page), A-2 (UPDATE empty-set
   + min), A-3 (INVALID_FILTER path pin — pairs with BUG-2), A-4 (bigint cross-table),
   A-5 (UNSUPPORTED_QUERY, mysql/mariadb).
3. **Tier-3 §A + neg-locks:** A-6 (extension path depth ≥2), A-7 (projector 4×4),
   A-8/A-9 (CustomInt/CustomDouble absent-method locks), A-10 (CustomDouble positive
   control), A-11 (OpaqueValues lock).
4. **Tier-4 completeness tail** (§3) — maintainer sets the cutoff; the ~2,100-cell insert
   cross-product and the ~452 per-factory-kind coords are degenerate/distinct-type-only.

## 9. Verdict

A **convergence round that still paid its way.** R37's implementation held across the
board — 15+ surfaces re-confirmed SATURATED under a fresh, verdict-free re-derivation,
and every R37 §A finding was verified now covered. The maximalist bar surfaced **1 real
`src/` defect** — an **error-metadata inconsistency** (INVALID_FILTER path, BUG-2, an
incomplete application of the very fix R37 produced) — plus a **docker-confirmed emission
divergence** on PostgreSQL (const custom-temporal getters emit a bare uncast placeholder)
that the maintainer classified as a **by-design limitation**: custom-type placeholder
casting is the user's `transformPlaceholder` responsibility, so the finding is a **§B
fixture gap** (the domain `DBConnection` doesn't model that user responsibility), not a
library bug. The §A residual is small and high-quality (compound-nested page, UPDATE
empty-set guard, bigint cross-table, projector 4×4, three neg-locks, UNSUPPORTED_QUERY),
and the exhaustive T4 tail is listed in full with counts. This is exactly what the method
is for: at high maturity the marginal finding has moved to the **branded/custom twin of a
base-type-keyed path** (a limitation the mock hides and only a `--docker` probe surfaces)
and the **residual of the prior round's own fix** — both invisible to coverage, both
caught by re-deriving the typed surface and *probing* (not reasoning about) the emission.
