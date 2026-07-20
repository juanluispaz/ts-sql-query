# Missing-tests audit — ROUND 17

**Method:** type-driven discovery per [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md).
16 parallel discovery agents (one per surface) raw-read `src/` types, built an
exhaustive enumeration matrix, re-derived coverage from the **current** test files
(inheriting no verdict). **New primary hunt this round: STRUCTURAL INTERFACE-PARITY**
— diff every shaped/optional/executable/allowing-no-where/compound twin against its
sibling for missing families / duplicated blocks / wrong `SHAPE`-vs-`undefined`
generics / param typos (the round-16 bug was *bigger* than its report: the shaped
on-conflict twin had a duplicated non-`When` block, a missing `*When` family, and a
typo — root commit `122458db`). The coordinator deduped, settled a cross-round
contradiction by source-read, and source/compile-verified the load-bearing claims.

**Mandate this round (user):** ultra-deep and **generous** — a large report is wanted;
err by excess; pursue total coverage.

**Pre-flight:** matrix = 17 cells, 204 files, **1704 tests/cell**, 28968 total,
`tests:audit` ✓ symmetric (up from 1681 at round 16 — the round-16 fix + tests
landed). Reference cell `postgres/newest/pg/`. BUGS.md empty / zero `TODO[BUG]`.
Domain fixtures unchanged since round 16 (the fix reused `tProject`/`tInvoice`).

> **Operational note:** the rate limiter again killed a handful of agents
> mid-run; surfaces were re-dispatched in small batches. No coverage lost — all 16
> surfaces have a complete report.

## Headline

**The structural-parity sweep — the round's marquee check — came back CLEAN: 0 twin
defects across insert/update/delete/select, and the round-16 fix is verified intact
by 6 independent agents. No `src/` bug this round.** That is itself the valuable
result: the copy-paste-prone surface that hid the round-16 bug now has no analogue.

The suite is **mature — 4 surfaces fully saturated** (F5-CONN, F1-CUSTOMNUM,
F1-TEMP, F6-DYN) and several more near. Being generous as asked, the residual is
still substantial (**~29 §A + ~10 §B**), and it clusters into a few coherent,
high-value themes — most importantly the **`*When` family on the on-conflict-set
nodes** (the exact round-16 surface, now structurally present but unexercised) and a
**deepened theme 9: an adapter-bearing column fed into *any* non-`equals` method of
its value-source type** (numeric ops / string transforms / `*IfValue` / combinators),
where the adapter provably propagates to the bound operand and/or the result leaf —
value-observable and mock-blind.

Counts: **PARITY DEFECTS 0 · BUG CANDIDATES 0 · §A ≈ 29 · §B ≈ 10 · 2 REFUTED ·
4 surfaces saturated.**

---

## Themes, ranked by risk tier

### Tier 1 — the round-16 surface, now a coverage hole (two-agent-confirmed)

**T1 — The `*When` family on the on-conflict-set nodes is untested on BOTH twins
(only `setWhen` is ever reached).** Confirmed independently by **F4-INSERT (A1)** and
**F8-META (A2)**. The non-`When` set family on `InsertOnConflictSetsExpression` is
fully covered in `insert.on-conflict.dynamic-set.test.ts` (setIfSet/setIfNotSet/
ignoreIf*/keepOnly/setIfHas*/disallow*), but the **entire `*When` octet+**
(`setIfValueWhen`, `setIfSetWhen`, `setIfSetIfValueWhen`, `setIfNotSetWhen`,
`setIfNotSetIfValueWhen`, `ignoreIfSetWhen`, `keepOnlyWhen`, `setIfHasValueWhen`,
`setIfHasValueIfValueWhen`, `setIfHasNoValueWhen`, `setIfHasNoValueIfValueWhen`,
`ignoreIfHasValueWhen`, `ignoreIfHasNoValueWhen`, `ignoreAnySetWithNoValueWhen`,
`disallowIf*When`, `disallowAnyOtherSetWhen`) is exercised on **neither**
`InsertOnConflictSetsExpression` nor `ShapedInsertOnConflictSetsExpression` — only
`setWhen` (the round-16 fix test). This is precisely the copy-paste-prone surface a
`SHAPE`-vs-`undefined` or missing-`& NEXT` regression would hide on. Pair each
`*When(true,…)`/`(false,…)` with its covered non-`When` equivalent (identical
SQL+params). Existing fixture `tProject`; lands on the `onConflictOn` dialects
(pg/sqlite) + bare form (mariadb/mysql/sqlite).

### Tier 1 — shaped twins' less-common families under-exercised vs the non-shaped sibling

The standing rule "the SHAPED surface is always a gap even when happy-path SQL
resembles non-shaped" — and the round-16 lesson — make these high-value.

**T2a — shaped INSERT on-conflict (F4-INSERT A2-A5, F8-META A1/A3/A4):**
- shaped on-conflict set-family beyond `setWhen` (`setIfSet`/`setIfNotSet`/`ignoreIf*`/`keepOnly`/`disallow*`/the composed-gate `*IfValue` setters) — untested on the shaped twin (F4-INSERT A2 / F8-META A1).
- `extendShape` on the shaped on-conflict set node (F4-INSERT A3).
- bare-path (`onConflictDoUpdateDynamicSet`) `*When` continuation on mariadb/mysql/sqlite (F4-INSERT A4).
- from-select on-conflict `doUpdateSetIfValue` / `doUpdateDynamicSet` arms + chained set helpers (F4-INSERT A5).
- shaped × on-conflict × returning × customizeQuery 4-way (F8-META A3); shaped on-conflict `dynamicWhere()` (F8-META A4).

**T2b — shaped UPDATE / DELETE (F4-UPDDEL A1-A6, A8):**
- **A1 (strongest)** — the `disallow*` guard family on a SHAPE-carrying builder: the guards take the **real** column (`ColumnsForSetOf`) while the set family takes the **renamed** key (`ColumnsForSetOfWithShape`) — a distinct, untested type interaction; zero `shapedAs(...)…disallow*` chains anywhere.
- A2 shaped-allowing-no-where `*When`; A3 shaped composed-gate `*IfValue` setters; A4 shaped value-gated `ignoreIfHasValue`/`ignoreIfHasNoValue`; A5 shaped `*When` ignore/value-gate arms; A6 `extendShape` on the allowing-no-where shaped opener (executable-preserving); A8 delete `returningOneColumn` adapter/virtual-column read (the update side has it, delete doesn't).

### Tier 1 — NEW (deepened theme 9): adapter column fed into a non-`equals` method

Across four leaf agents independently: an **adapter-bearing column is exercised only
via `.equals` / bare projection**, never fed into the *other* methods of its
value-source type — yet the adapter provably propagates to the bound operand and/or
the result leaf (`_appendValue` threads the column `typeAdapter`; a transform-result
leaf inherits `transformValueFromDB`). Value-observable, mock-blind → `--docker`.

- **F1-NUM A1** — `tProjectReview.score` / `tInvoice.invoiceNo` (int + `scaledTenthAdapter`) never receive a numeric method. `score.add(5)` projected: the bound `5` scales to `50` (write) **and** the computed result is `÷10` (read). Strong.
- **F1-STR A1/A2** — `tProjectReview.reviewerCode` (`bracketAdapter`) never receives a string method/predicate, in any clause. `reviewerCode.startsWith('R-')` / `.toUpperCase()` (result leaf should still bracket) — incl. outside the top-level WHERE (join-`on`, subquery, having).
- **F1-BOOLIF A1** — `*IfValue` predicates with a custom-boolean column as the **receiver** (`published.equalsIfValue(true)` → `(published = 't') = $1`; `invoiced.isIfValue(true)`) — the remap ∩ elision composition; zero coverage; per-dialect boolean-emulation risk.
- **F1-EQCMP C1** — numeric custom-boolean `invoiced` predicate-wrap + value-operand outside the top-level WHERE (the one combination not shadowed by the string-custom-boolean `.on()` coverage). Medium-low.

> **Docker note (`feedback_docker_validate_delegated_custom_type_tests` + `project_docker_validation_gotchas`):** all of T3 (and the F2-COL §B adapter cluster) are custom-type/adapter operand/marshalling assertions — `--docker` spot-check PG + mssql + oracle (+ the `t/f`,`Y/N`,`1/0` adapter shapes for F1-BOOLIF A1).

### Tier 2 — distinct overloads / impl-branches / remapper recursion

**T4 — Complex-projection remapper recursion into nested objects (F3-PROJ):** A1 `ColumnsForAlias` nested-object recursion (`tableAlias.ts` — the **one rule-family branch with zero coverage**); A3 compound (UNION/…) re-projecting an *optional/left-join/rule-1/rule-4* nested object; A4 depth-3 nested-object **exact** shape under both projectors (currently only `Extends`-loose); B1 (§B-scaffold) aggregate-element whose property is itself a nested object.

**T5 — `createSqlOperation1ofOverloadedNumber` impl-branch arms (F1-NUM A2/A3):** int-receiver **double-promotion** via a non-int value-source RHS (result carried as `double`, not `int`); int-receiver **fractional-const** arm (`Number.isInteger` false → `'double','double'`). Both type-legal, untested, distinct return-branch.

**T6 — Values-vs-View coverage asymmetry (F2-VALVIEW A1/A2):** no-arg `forUseInLeftJoin()` on a Values (View tests both arms; Values only the aliased one); `.as()`/`forUseInLeftJoinAs()` cloning a Values that carries a **virtual column** (the `__setColumnsName` `isValueSource` `continue` branch; a Values↔View divergence — View doesn't re-walk on clone).

**T7 — SELECT minor (F3-SELECT A1):** `where()`/`dynamicWhere()` reachable **after** `limit()`/`offset()` on the select-before-where chain — distinct overloads (`Limit/Offset…WithoutWhere.where`), compile-verified reachable, zero positive tests.

### Tier 3 / §B — the adapter-overload axis on column factories (F2-COL)

A coherent 9-item cluster, all one axis: **the trailing-`TypeAdapter` (and custom-typed
4-arg) overload on factories where only the no-adapter form is fixtured** — `autogeneratedPrimaryKey`
(B-1), `autogeneratedPrimaryKeyBySequence` bigint + adapter (B-1/B-2), `columnWithDefaultValue`
non-boolean adapter (B-3, write-path + DB DEFAULT → `--docker`), `optionalColumnWithDefaultValue`
adapter (B-4), `computedColumn`/`optionalComputedColumn` adapter + custom-typed (B-5/B-6),
**View `column`/`optionalColumn` per-column adapter** (B-7 — a *separate read-path* from Table,
View returns the bare `DBColumnImpl`), View virtual-column adapter (B-8), Table optional-virtual-column
adapter (B-9). Each needs a fixture column; most realistic: B-1 (bigint sequence-PK), B-3/B-4, B-7.

---

## Per-surface results & saturation

| Agent | Parity | §A | §B | Verdict |
|---|---|---|---|---|
| F4-INSERT | clean | 5 | — | shaped/`*When` on-conflict cluster (T1/T2a) |
| F4-UPDDEL | clean | 7 | — | shaped-twin families (T2b); A1 disallow×shape interaction |
| F8-META (parity+seam) | **clean (full sweep)** | 4 | — | corroborates T1/T2a; round-16 fix verified intact |
| F1-NUM | clean | 3 | — | adapter-into-numeric (A1) + 2 impl-branch arms |
| F1-STR | clean | 2 | — | adapter-into-string (reviewerCode) |
| F1-BOOLIF | clean | 1(+2) | — | `*IfValue` on custom-boolean receiver |
| F1-EQCMP | clean | 0 | — | SATURATED in-WHERE grid (+1 §C borderline) |
| F3-PROJ | clean | 4 | 1 | remapper recursion (ColumnsForAlias A1) |
| F2-COL | clean | 0 | 9 | adapter-overload axis (incl. View adapter read-path) |
| F2-VALVIEW | clean | 2 | — | Values↔View coverage asymmetry |
| F3-SELECT | **clean (full sweep)** | 1 | (B1-3 neg, OUT) | where-after-limit/offset |
| F5-CONN | clean | 0 | 0 | **SATURATED** |
| F1-CUSTOMNUM | clean | 0 | 0 | **SATURATED** (round-16 modulo twins landed) |
| F1-TEMP | clean | 0 | 0 | **SATURATED** |
| F6-DYN | clean | 0 | 0 | **SATURATED** (descriptor↔VSM parity holds) |
| F7-EXTRAS | clean | 0* | 0 | near-sat (*its 2 §A REFUTED — see below) |
| **TOTAL** | **0 defects** | **~29** | **~10** | **4 saturated** |

## Coordinator verification notes

1. **Cross-ROUND contradiction settled (F7-EXTRAS round 17 vs round 16) → REFUTED.**
   Round 17 claimed `MORE_THAN_ONE_ROW` / `ONLY_ONE_COLUMN_EXPECTED` reachable via
   `ctx.mockNext(≥2 rows)`. Source read of [MockQueryRunner.ts:107](src/queryRunners/MockQueryRunner.ts#L107):
   `executeSelectOneRow` accepts only "null/undefined/a plain object" — an array throws
   `INVALID_MOCKED_VALUE`; the mock **returns the already-reduced single row** and never
   runs the `>1 row`/`>1 column` reduction (that lives in the real-driver `AbstractQueryRunner`).
   So these are **driver-layer, not mock-reachable** → OUT of scope (confirmed: zero tests
   assert them). Round 16 was right.
2. **F4-INSERT C1 (shaped-from-select) → intentional boundary, not a defect.** Source read:
   `ShapedInsertExpression` ([insert.ts:622-632](src/expressions/insert.ts#L622)) has **no
   `from(select)`**; `InsertExpression` ([insert.ts:619](src/expressions/insert.ts#L619)) does.
   `shapedAs` renames a *values object*'s keys — meaningless for an insert-from-`select`. So
   shaped-from-select is unreachable by design and the `SHAPE`-only-`undefined` instantiation
   is correct. F4-INSERT A6 → OUT.
3. **Structural-parity sweep verified clean by 6 agents** (F4-INSERT, F4-UPDDEL, F8-META,
   F5-CONN, F2-COL, F3-SELECT) — the round-16 shaped-`*When` fix holds; no missing family /
   duplicated block / wrong generic / typo anywhere in insert/update/delete/select twins.
4. **No bug candidates.** Every compile-repro an agent ran (F3-SELECT where-after-limit,
   the numeric/projection reachability checks) confirmed *reachable-and-correct*, i.e.
   missing-test paths, not type-vs-impl defects. All repros deleted; tree clean.

## Refuted / OUT (so the next round doesn't re-chase)

- **F7-EXTRAS A1/A2** (`MORE_THAN_ONE_ROW`, `ONLY_ONE_COLUMN_EXPECTED`) — REFUTED, driver-layer, not mock-reachable (note #1).
- **F4-INSERT A6** (shaped-from-select on-conflict) — OUT, intentionally unreachable (note #2).
- **F3-SELECT B1-B3** (per-dialect `never`-boundary negatives: `intersectAll`/`exceptAll`/`minusAll` on sqlServer; `recursiveUnion`/`recursiveUnionOn` on oracle/sqlServer; `startWith`/`connectBy`/`connectByNoCycle` on non-Oracle) — `types.negative/` only; OUT of the standing scope, but a real asymmetry if the owner opts to widen into negatives.
- **F6-DYN `TerminalValueObject → never`** from-model arm — pure type-only, no value surface; OUT (negative at most).

## §B fixture / scaffold plan

| ID | Add | For |
|---|---|---|
| F2-COL B-1 | a bigint (or branded customInt) `autogeneratedPrimaryKeyBySequence` table | sequence-PK value-type fan-out |
| F2-COL B-3/B-4 | a `columnWithDefaultValue` / `optionalColumnWithDefaultValue` with a **non-boolean** adapter + DB DEFAULT | default×adapter write-path (`--docker`) |
| F2-COL B-5/B-6 | a `computedColumn`/`optionalComputedColumn` with an adapter and a custom-typed (4-arg) form | computed read-path adapter + brand |
| F2-COL B-7/B-8/B-9 | a **View** column + a virtual column carrying an adapter (Table optional-virtual too) | View adapter read-path (separate from Table) |
| F3-PROJ B1 | (scaffold only) an `aggregateAsArray({ …, header: { … } })` element with a nested object | aggregate-element → inner-object projector arm |

## Recommended implementation order

1. **T1** — the on-conflict `*When` family on both twins (highest value; the repaired round-16 surface). Pair each with its non-`When` equivalent.
2. **T2a/T2b** — shaped on-conflict / shaped-update less-common families (start with F4-UPDDEL A1 disallow×shape, F4-INSERT A2 shaped set-family, F8-META A3 4-way).
3. **T3** — adapter-into-non-equals-method (F1-NUM A1, F1-STR A1/A2, F1-BOOLIF A1; `--docker` PG/mssql/oracle).
4. **T4** — F3-PROJ A1 (`ColumnsForAlias`, the zero-coverage branch) + A3/A4 (compile-repro the exact shapes first, per F3-PROJ).
5. **T5/T6/T7** — numeric impl-branch arms, Values↔View asymmetry, where-after-limit.
6. **§B** — the F2-COL adapter-overload fixture cluster + F3-PROJ B1.

## Verdict

The round did its marquee job: the **structural-parity sweep is clean** — the round-16
shaped-`*When` defect is fully fixed with **no analogue** anywhere in the four builder
files, verified by six independent agents, and **no new `src/` bug** surfaced. On a
**mature suite (4 surfaces saturated, several near)**, the generous residual is real and
well-shaped: the **on-conflict `*When` family** (the exact repaired surface, structurally
present but unexercised on both twins — Tier 1, two-agent-confirmed), the **shaped twins'
less-common method families**, the **deepened theme 9** (adapter column into any
non-`equals` method, value-observable + mock-blind), the **projection remapper recursion**
(`ColumnsForAlias` zero-coverage), and the **column-factory adapter-overload axis**. Two
findings were coordinator-refuted (driver-layer error reasons; shaped-from-select) so the
next round won't re-chase them. Bar held high; saturated surfaces reported as saturated,
borderline items flagged as such — nothing inflated to fill the "be generous" ask.
