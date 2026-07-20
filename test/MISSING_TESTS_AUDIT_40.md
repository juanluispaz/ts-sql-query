# MISSING_TESTS_AUDIT_40 — type-driven missing-tests audit, round 40

**Mandate.** Maximal saturation of the typed surface, re-derived from scratch after the
R39 backlog (+116 tests/cell) and the R39 bug-fixes landed. Report is an **exhaustive
item-by-item backlog**, not a thematic summary (runbook §8). Only genuinely-OUT items
(compile-only, `src/queryRunners/`, new cell, dead/unreachable code) are excluded — Part
III names them with the reason.

**Method.** 20 read-only discovery agents (16 surfaces + F-RECENT + F9-TYPEVAR + MUT-SEAM
+ SEL-SEAM + PARITY), ≤10 concurrent, inline; coordinator verification of every
load-bearing claim (tsgo compile-repro / mock runtime-probe / `--docker`). Matrix at run:
**17 cells, 245 files, 2906 tests/cell** (a few later commits grew it to ~250/2939), symmetric.
Sole new `src/` commit since R39: `1034bbec` (the BUG-1 + BUG-2 fixes) — its positive arm
was the F-RECENT target.

**Headline.** **1 confirmed `src/` bug** (BUG-3, a type-vs-runtime soundness divergence found
at the SELECT seam and confirmed by adjudicating a cross-agent contradiction). **13 of 20
surfaces returned fully SATURATED**; the R39 backlog is verified landed and held. The
remaining §A tail is small and bounded (escape behavioral completeness, three rule-2-fix
edge cases, a customInt symmetry cell, a Values sibling-virtual, an insert recombination
family). **Answer to "have we reached total saturation?": very nearly — one real bug + a
short behavioral/edge tail remain; the bug proves the seams still pay at extreme maturity.**

---

# PART I — Confirmed `src/` bug (→ BUGS.md, TODO[BUG])

## BUG-3 — nullable-projected inline aggregated array: declared element absent, runtime present-null
`.select({… optional leaf …}).projectingOptionalValuesAsNullable().forUseAsInlineAggregatedArrayValue()`
declares its element with the optional leaf **absent** (`{ id; archived?: Date }`) but the runtime
(`SelectQueryBuilder.ts:641` calls `result.projectingOptionalValuesAsNullable()` when the flag is set)
produces it **present-null** (`{ id: 1, archived: null }`). The type's `projectingOptionalValuesAsNullable`
changes only the RESULT param, leaving COLUMNS unchanged, and `forUseAsInlineAggregatedArrayValue` derives
its element from COLUMNS — so the type ignores the flag the runtime honors. **Coordinator-confirmed:**
mock-probe → `'archived' in el === true`, `el.archived === null`; tsgo compile-repro → `{ archived: Date | null }`
fails, `{ archived?: Date }` compiles. **Resolves the SEL-SEAM vs F9-TYPEVAR contradiction** (SEL-SEAM
Reading B was correct; F9-TYPEVAR analyzed the reverse, non-callable order). Surfaced by **SEL-SEAM**.
Fix direction is the maintainer's call (thread the flag into the element type, or drop the `:641` branch).

---

# PART II — Exhaustive test backlog (implement all of this)

Legend **T#**: T1 code-path/bug-class · T2 distinct overload/emission/seam · T3 per-variant completeness ·
T4 output-coincident completeness fan-out (lowest priority, enumerated). Each item: what · fixture · assertion · grep.

## A. The BUG-3 test — file: `select.aggregate-as-array-inline-wrapped.test.ts` (or `select.compound-nested-object.test.ts`)
- **AGG-1 · T1 (TODO[BUG])** — `.select({ id: tProject.id, archived: tProject.archivedAt }).projectingOptionalValuesAsNullable().forUseAsInlineAggregatedArrayValue()` in an outer select; mock an element with `archived: null`; assert the SOUND expectation (element `{ id; archived: Date | null }`, `el.archived === null` present) so it FAILS until the type is fixed. Carries `// TODO[BUG]`. grep: no `projectingOptionalValuesAsNullable` within a chain feeding `forUseAsInlineAggregatedArrayValue` anywhere (0 matrix-wide).

## B. LIKE-escape behavioral completeness (F1-STR + F-RECENT, consolidated) — file: `select.where.like-escape-match.test.ts` (extend; use the `withRollback` seed pattern the file already uses)
The literal-escape path is validated on all engines (R39's match test); these are the untested arms of the same fix. All real-DB/native (docker + native-SQLite validate on a plain run).
- **ESC-1 · T2** — **column-operand** affix match: seed Row A `{email:'za_cz@x', fullName:'a_c'}` + decoy Row B `{email:'zabcz@x', fullName:'a_c'}`; `where(email.contains(fullName))` → matches ONLY Row A. Exercises the `else`-branch `replace(replace(replace(col,…)))` escaping — the arm Oracle now routes through base backslash + `escape '\'`; **highest value on Oracle + SQL Server** (unvalidated on any engine). grep: no `like-escape.test.ts`/match test uses a column needle with `withRollback`.
- **ESC-2 · T2** — **backslash (`\`) literal** match: seed email containing a literal `\`, needle `\`; assert only that row. Validates the metachar the fix touched (base `\`→`\\`; mysql/mariadb quadruple `\\\\`; Oracle `escape '\'`). grep: no backslash needle in any match test.
- **ESC-3 · T2** — **bracket (`[`) literal** match (SQL Server): seed email with literal `[cd]`, needle `[cd]`; assert only the literal row (unescaped `[cd]` is a char-class matching a decoy). The sibling of BUG-1's `_`→`[_]` fix. grep: no `[`-class needle with `withRollback`.
- **ESC-4 · T3** — **endsWith** positive match with a metachar needle (distinct `'%' || needle` affix). Any cell.
- **ESC-5 · T4** — the `not*` / `*Insensitive` / `*IfValue` affix twins positive match (one representative each; shared escape arm).

## C. Rule-2-fix edge cases (F3-PROJ + F-RECENT, consolidated) — file: `select.complex-projection.mixed-rules.test.ts`
The BUG-2 fix (`1034bbec`) added a no-table-leaf skip + a `firstRequiredTables` reassignment; these are the edges its new branch creates. All default + nullable projector, MISS-row value+key-presence probed.
- **PROJ-1 · T2 (STRONG)** — **const-FIRST** leaf order: `iss: { tag: conn.const('rel','string'), title: tIssueLeft.title }` on a join miss → default `'iss' in row === false` (dropped); nullable `iss === null`. The direct regression guard for the order-independence the fix's own comment claims; every existing const test is const-LAST. Distinct SQL (column order). grep: all 4 object-leaf const uses are the SECOND property.
- **PROJ-2 · T2** — **all-const** nested object: `tags: { a: conn.const('x','string'), b: conn.const('y','string') }` → type `tags: { a: string; b: string }` (required, never dropped — every leaf size-0, `alwaysSameRequiredTablesSize` stays undefined). Exercises the rule-2 onlyOuterJoin guard's size-0 path. grep: no nested projection object with only-const leaves anywhere.
- **PROJ-3 · T2** — **two-different-left-joins + const** → rule-3 promotion: `obj: { issTitle: tIssueLeft.title, assigneeName: tUserLeft.fullName, tag: conn.const('rel','string') }`; the const ('required') flips rule-4→rule-3 so on a FULL miss the container SURVIVES carrying only the const (default `'obj' in row === true`, `'issTitle' in obj === false`; nullable `obj: { issTitle: null, assigneeName: null, tag: 'rel' }`). grep: no test mixes ≥2 forUseInLeftJoin + a const.

## D. EQCMP symmetry (F1-EQCMP) — file: `select.value-source.equality-comparison-by-type.test.ts`
- **EQ-1 · T3** — `isNull()` / `isNotNull()` on the **customInt** leaf (the single asymmetric cell — all 17 other leaves have both; customInt has neither). Optional-receiver sub-cell `vReleaseOverview.optionalReleaseOrdinal.isNull()`/`.isNotNull()` (real NULL branch, value-validatable); required-receiver `tIssueWorklog.costCents.isNull()` → `[]`. Low-novelty (leaf-agnostic `<col> is null`) but completes the matrix. grep: `(costCents|scaledCost|releaseOrdinal|optionalReleaseOrdinal).(isNull|isNotNull)\(` → 0.

## E. Values sibling-referencing virtual (F2-VALVIEW) — file: `with-values.advanced.test.ts` / `with-values.left-join-clone.test.ts`
Coordinator mock-probe confirmed this renders correctly (`with vprobe(id) as (values ($1::int4)) select id as id, id * 2 as doubled from vprobe`) — clean §A, no bug.
- **VV-1 · T2** — a `Values.virtualColumnFromFragment` interpolating a SIBLING Values column: `doubled = this.virtualColumnFromFragment('int', f => f.sql\`${this.id} * 2\`)`; assert emission `id * 2 as doubled` + value. Distinct from the View side because a Values column's name is assigned at `Values.create` time (not field-init). grep: `virtualColumnFromFragment` in `with-values.*` with `${this.` → 0 matrix-wide.
- **VV-2 · T3** — the VV-1 virtual then CLONED via `.as(alias)` / `forUseInLeftJoinAs(alias)`: assert the sibling reference re-qualifies under the alias (`upper(pp.id)` / `pp.id * 2`), the join-ambiguity case (existing clone+virtual test uses a bare literal, never a column reference).

## F. Result-type value-realization (F9-TYPEVAR) — file: `select.value-source.uuid-cast.test.ts` / `null-handling.test.ts`
- **TV-1 · T3 (narrow)** — `valueWhenNull(<optional operand>)` null inhabitant REALIZED: `tIssue.externalRef.valueWhenNull(tIssue.externalRef.asOptional())` on issue 3 (seed `external_ref` NULL) → `coalesce(null,null)=null`; assert `Exact<…, string | null>` + `expect(ref).toBeNull()` (scalar) and the object-projector twin `'ref' in row === false`. Every existing `valueWhenNull(optional…)` test mocks the PRESENT value; the still-optional coalesce's null is type-asserted but never runtime-realized. grep: `valueWhenNull.*asOptional` → 3 hits, all present-value.

## G. Insert on-conflict-on-constraint recombination (F4-INSERT) — file: `insert.on-conflict.test.ts` (PG-family; NA mirrors elsewhere)
Distinct emitted SQL, recombination of covered fragments (recommend implement to close the surface; the maximal "distinct-SQL-string ⇒ cell" reading).
- **INS-1 · T4** — `onConflictOnConstraint(name).doUpdateSet({…}).returningLastInsertedId()` → `… on conflict on constraint X do update set … returning id` (non-null).
- **INS-2 · T4** — `onConflictOnConstraint(name).doNothing().returningLastInsertedId()` → `… do nothing returning id` (nullable `T|null`).
- **INS-3 · T4** — `onConflictOnConstraint(name).doUpdateSet({…}).where(cond)[.and/.or]` → `… do update set … where cond`.

---

# PART III — Genuinely OUT (considered, do NOT write — with reason)

- **`AbstractSqlBuilder._startsWithInsensitive` / `_notStartsWithInsensitive` swapped-arg** (`_escapeLikeWildcard(value, params, …)` vs the correct `(params, value, …)`, ~line 2766): a real src inconsistency, but **dead code** — all 6 dialects override these two methods, so no matrix cell can reach the base. Not a coverage gap; an **out-of-scope src-cleanup note** for the maintainer (future-proofs a hypothetical new dialect inheriting the base). Cannot be a Principle-#1 test.
- **`optionalComputedColumn` sets `__writable=true` before `__asOptionalComputedColumn`** (vs `computedColumn`): kind-invariant internal-flag inconsistency, not observable through the public surface (both excluded from `WritableColumnKeys` identically). OUT.
- **Custom-temporal `arg`/`valueArg` + const custom-temporal getter (CTP)**: by-design limitation (custom placeholder cast is the user's `transformPlaceholder` responsibility; domain has no override). Not a src bug; a §B fixture only if the maintainer adds a domain `transformPlaceholder`. Confirmed still unfixtured.
- **`sequence` over 15 non-numeric kinds; `rawFragment` arity 4/6; factory×kind cross-product**: byte-identical through the shared dispatcher / DB sequences are numeric → mock-only / distinct-type-only. R39 closed these; re-confirmed.
- **bigint `multiply`/`divide`/… ; ordering ops on boolean/enum/custom ; `equalsInsensitive` on non-string**: typed-never → negative-type territory.
- **Driver-layer `TsSqlErrorReason`** (`SQL_*`, transaction-runner, `INVALID_MOCKED_VALUE`, `ONLY_ONE_COLUMN_EXPECTED`), **`UNSUPPORTED_QUERY`** (needs a `compatibilityVersion<8M` cell), **`UNKNOWN_DATA_TYPE`** (as-any-only): `src/queryRunners/` / impossible-state / no-new-cell.
- **Non-existent APIs** (grep-confirmed absent): `connection.values` (use `Values.create`), `selectFromModel`, `newValues()`.

---

# PART IV — Per-surface saturation table

| Agent | Verdict | Enumerated §A items | Notes |
|---|---|---|---|
| SEL-SEAM | **BUG** | AGG-1 | BUG-3 (nullable-aggregate divergence), coordinator-confirmed |
| F1-STR | tail | ESC-1..5 | behavioral escape completeness (residual of the BUG-1 fix) |
| F-RECENT | tail | (ESC-1..5, PROJ-1..3 — overlap) | fix-positive-arm; baked-in-bug scan CLEAN; C1 = dead-code OUT |
| F3-PROJ | tail | PROJ-1..3 | rule-2-fix edges; baked-in-bug scan CLEAN |
| F1-EQCMP | tail | EQ-1 | customInt isNull/isNotNull (single asymmetric cell) |
| F2-VALVIEW | tail | VV-1, VV-2 | Values sibling-virtual (renders correctly — clean §A) |
| F9-TYPEVAR | tail | TV-1 | valueWhenNull(optional) null inhabitant (narrow) |
| F4-INSERT | tail | INS-1..3 | onConflictOnConstraint recombination (T4) |
| F2-COL | **SATURATED** | 0 | factory×kind orthogonal closure re-confirmed |
| MUT-SEAM | **SATURATED** | 0 | composition + inhabitant grid; 4 near-candidates have working twins |
| F5-CONN | **SATURATED** | 0 | R39 CONN items landed; CTP by-design |
| PARITY | **SATURATED** | 0 | ~19 twin families symmetric; C-1 degenerate |
| F1-NUM | **SATURATED** | 0 | modulo emission-per-operand all arms |
| F4-UPDDEL | **SATURATED** | 0 | full matrix; symmetric ×17 |
| F1-CUSTOMNUM | **SATURATED** | 0 | brand keep/erase + CNUM cross-table landed |
| F1-BOOLIF | **SATURATED** | 0 | masked branches + 28 *IfValue pairs |
| F1-TEMP | **SATURATED** | 0 | const-getter completeness landed; const-custom by-design |
| F3-SELECT | **SATURATED** | 0 | SEL-1/SEL-2 landed; per-overload + inhabitant grid |
| F6-DYN | **SATURATED** | 0 | operator×type×path; all 13 DYN-ERR items landed |
| F7-EXTRAS | **SATURATED** | 0 | 35 builder-reachable reasons + adapters + extras/* |

**13/20 fully SATURATED · 1 confirmed bug · ~16 enumerated §A items (mostly T2/T3) + 3 T4.**

# PART V — Coordinator verification notes

- **BUG-3 (SEL-1)** — settled a cross-agent contradiction (SEL-SEAM "divergence" vs F9-TYPEVAR "refuted") by direct src read + two probes: mock-probe → runtime present-null (`{id:1,archived:null}`); tsgo compile-repro → declared element `{ archived?: Date }` (absent). Divergence confirmed. Both probes deleted.
- **VV-1 (Values sibling-virtual)** — mock-probe → renders `id * 2 as doubled` correctly, no throw. Clean §A (not a bug). Probe deleted.
- **ESC-1 (Oracle column-operand escape)** — `--docker` probe was INCONCLUSIVE: the wildcard-free control (`contains('probe')`) also matched `[]`, i.e. the raw inserts didn't persist without the `withRollback` seed pattern. So no bug is confirmed OR denied; classified §A behavioral (the literal path is already engine-validated via the R39 match test using `withRollback`; the column-operand uses the same escape helper). Probe deleted.
- **Baked-in-bug scan** (F-RECENT + F3-PROJ) — 0 found: every R39-added test's `expected` is consistent with its `assertType`.
- **F-RECENT C1** — src-read confirmed the swapped-arg + confirmed all 6 dialects override → unreachable/dead → OUT (§III).
- Tree clean; index rebuilt with the 12 GB heap flag (the OOM gotcha now in the runbook).

# PART VI — Recommended implementation order
1. **BUG-3**: file+mark AGG-1 (`// TODO[BUG]`).
2. **T2**: ESC-1..3 (escape behavioral — Oracle/SQL Server highest value, use `withRollback`), PROJ-1..3 (rule-2 edges), VV-1.
3. **T3**: EQ-1, ESC-4, VV-2, TV-1.
4. **T4**: ESC-5, INS-1..3.

# PART VII — Verdict
Near-total saturation. The R39 backlog landed and held (all items verified covered across 13 saturated
surfaces). R40's value is **one real type-vs-runtime soundness bug (BUG-3)** — found at the SELECT seam and
confirmed only by adjudicating a cross-agent contradiction, exactly the mature-phase failure mode the runbook
predicts — plus a short, fully-enumerated §A tail (escape behavioral completeness, three rule-2-fix edges, a
customInt symmetry cell, a Values sibling-virtual, an insert recombination family). Implementing all of Part II
(and fixing BUG-3) closes the reachable typed surface. We have not *quite* reached total saturation; this backlog
is what remains.
