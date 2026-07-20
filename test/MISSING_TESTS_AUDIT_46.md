# MISSING_TESTS_AUDIT_46 — maximal-saturation type-driven audit

**Mandate.** Round 46 at the MAXIMUM-SATURATION dial: enumerate every writable test the type surface
implies, including output-coincident T4 tails (only a cell with ZERO SQL/params/value surface is OUT).
Exhaustive item-by-item backlog, not a thematic summary.

**Method.** 20 read-only discovery agents (F-RECENT, PARITY, MUT-SEAM, SEL-SEAM, F1-EQCMP, F5-CONN,
F4-INSERT, F3-PROJ, F6-DYN, F1-STR, F4-UPDDEL, F3-SELECT, F1-NUM, F1-CUSTOMNUM, F1-TEMP, F1-BOOLIF,
F2-COL, F2-VALVIEW, F9-TYPEVAR, F7-EXTRAS), ≤10 concurrent, re-derived from the CURRENT files. Every
load-bearing claim coordinator-verified (Part V).

**Matrix at run:** `tests:audit` → 17 cells · 247 files · **3856 tests/cell** (65552 across the matrix),
fully symmetric (up from 3762 at R45 — R45's ~94-test/cell backlog landed). No new `src/` commit since
R45 (the three newest commits are test-only: the R45 backlog implementation).

**Headline.**
- **1 confirmed `src/` bug (FILED to BUGS.md):** the `projectingOptionalValuesAsNullable()` flag is dropped
  by an array-shape modifier chained after it — a residual of the FIX B fix (`6505628a`), through a clone
  path that fix did not patch. Coordinator-probed (type present-null, runtime drops the leaf).
- **R45's ~94-test backlog verified sound** — baked-in scan of all 16 touched files CLEAN (0 assertType-vs-value
  contradictions, 0 `TODO[BUG]`); the DROPPED items correctly out; the DEFERRED `delete.using(values)` landed.
- **18 of 20 surfaces returned fully saturated** on independent re-derivation. Genuinely-distinct core to-write
  beyond the bug: ~4 small items. T4 tail: a short one (the R45 backlog closed most tails).

---

## PART I — Bug, candidates, R45-verification, limitations, hygiene

### I.1 CONFIRMED `src/` BUG (FILED to BUGS.md) — PROJ-BUG-1 / SEL-SEAM-1 · T1

**Array-modifier after `projectingOptionalValuesAsNullable()` drops the present-null projection flag.**
`aggregateAsArray({…optional leaf…}).projectingOptionalValuesAsNullable().useEmptyArrayForNoValue()` (also
`.asOptionalNonEmptyArray()` / `.asRequiredInOptionalObject()`) types the element leaf as present-`null`
(`Date | null`) but at runtime **drops** it (`'archivedAt' in el === false`).
- **Root cause:** `projectingOptionalValuesAsNullable()` sets `__aggreagtedProjectingOptionalValuesAsNullable`
  on `this` (ValueSourceImpl.ts:2673/2295); the three modifiers `return new Aggregate…ValueSource(…)`
  (2650/2653/2656 on `AggregateValueAsArrayValueSource`, 2272/2275/2278 on `AggregateSelectValueSource`)
  **without copying the flag**. The typed surface (values.ts:982-991) makes projecting-then-modifier the only
  reachable order (modifier returns the plain `AggregatedArrayValueSource`, which lacks
  `projectingOptionalValuesAsNullable`) — so there is no correct-order workaround.
- **Residual of FIX B (`6505628a`):** that fix copied the flag in `DBColumnImpl.createColumnsFrom`/
  `createColumnsFromInnerObject` (148/204) but not in these value-source reconstruction clones — the exact
  "runtime flag propagated to one clone, silently absent on a sibling clone" corollary (runbook 1015-1026).
- **Scope:** 6 reconstruction methods (2 classes × 3 modifiers) = 6 type-paths; the `NullAggregate…` variants
  are exempt (array becomes literal null → element moot); the base copy sites (ValueSourceImpl.ts ≈134-157)
  also omit the flag and are flagged for the fix. PROBE-CONFIRMED (Part V). Filed with full fix scope.
- **Test artifact:** `PROJ-BUG-1` — a `projecting…().useEmptyArrayForNoValue()` chain asserting the null leaf
  present-`null`, carrying `// TODO[BUG]` until the flag is threaded through the six methods. Plus 5 sibling
  characterization tests (the other 2 modifiers × 2 families, minus the probed one) once fixed.

### I.2 CANDIDATES — both readings, classified

- **SEL-SEAM-2 · low-confidence, same root cause.** `valueSourceInitializationForInlineSelect`
  (ValueSourceImpl.ts ≈2486, and the base copy sites 134-157) rebuild an inline value source copying the
  sibling aggregate metadata but not the projecting flag → would bite
  `selectOneColumn(aggregateAsArray(...).projectingOptionalValuesAsNullable()).forUseAsInlineQueryValue()`.
  Reachability is exotic (a whole-table aggregate as the single scalar-subquery column). Folded into the
  BUGS.md fix scope; if the fixing agent's compile-repro shows it unreachable, it's OUT — otherwise it's part
  of the same one-line-per-site fix.
- **F3-RES-1 · low-confidence T4 (distinct path).** `AbstractQueryBuilder.ts:144` (the aggregate-of-aggregate
  recursion) reads the INNER column's flag — a distinct classification path from 81/162/223. Reached only by
  `aggregateAsArrayOfOneColumn(<an inline object-aggregate>.projectingOptionalValuesAsNullable())`. Needs a
  reachability compile-repro FIRST: the direct form (`json_agg(json_agg(…))`) is a nested aggregate engines
  reject (LIMITATION); only the inline form (`json_agg((select json_agg(…) …))`) is SQL-valid and reaches 144
  with the inner flag TRUE. If type-permitted → a T4 boundary-row test; else OUT.

### I.3 R45 backlog verification (F-RECENT baked-in scan + per-surface confirmation)

- **All 16 R45-touched files CLEAN** — no `assertType`/`toEqual`/snapshot contradiction; no `TODO[BUG]` marker
  matrix-wide; FIX B present-null/drop assertions symmetric across all 13 newest cells.
- **DROPPED items correctly out:** CN-1 (customInt float-modulo) absent; the FIX-A per-kind null-skip tests
  correctly use real-DB-default tables (`webhook_event`/`issue`/`organization`), NOT `col_matrix` (whose
  columns are `NOT NULL` with no DB default → a skip would violate not-null → not real-validatable);
  localDate-const echo documented.
- **DEFERRED items:** `delete.using(values)` (UD-T4-2) now LANDED; the §B sequence non-numeric kinds — see I.5.

### I.4 Known LIMITATIONS (by-design; OUT)

- **L-1 · custom-temporal CONST getter / arg / valueArg** — bare `extract(part from $1)` / raw-Date bind, no
  built-in cast; PG rejects → not real-validatable → OUT (F1-TEMP, F5-CONN re-confirmed).

### I.5 RECLASSIFIED — R45's deferred §B sequence kinds are DEGENERATE/OUT, not a backlog (F5-CONN)

A live SQL sequence's `nextval()` returns an INTEGER; the emitted SQL is identical for every value-kind, only
the read marshaller differs. Per-kind disposition: string/uuid/temporal/customUuid/customLocal* **throw**
`INVALID_VALUE_RECEIVED_FROM_DATABASE` on the integer a sequence yields → not real-validatable → OUT;
enum/custom/customComparable are `default: return value` pass-through (distinct-TYPE-only, R-P7 closes) → OUT;
`boolean` is borderline (`false` reachable only in mock). **R45's deferral was correct; these are OUT, not a
§B fixture backlog.** (Supersedes the R45 report's §B sequence recommendation.)

### I.6 Inert / dormant-code (OUT, no test possible)

- **N-1 · cosmetic typo `as double presition`** (F1-NUM) — `AbstractSqlBuilder._asDouble` (~2980), `_divide`
  (~3245); all 6 dialects override → reachable only via `NoopDBSqlBuilder`, not a matrix cell → OUT.

### I.7 Doc-hygiene (unapplied; report-only, not gaps)

- **D-1 · stale headers** — `with-values.test.ts:5-7` / `with-values.advanced.test.ts:28-30` ("run live on every
  cell" boilerplate, references the whole matrix). Still unfixed since R40 (F2-VALVIEW).
- **D-3 · imprecise comment** — `insert.shaped.test.ts:96-99` claims a defaulted-non-nullable shaped key
  "carries no `undefined` … an `undefined` would be caught by the shape's key type"; the sibling test `:2234`
  shows `undefined` IS accepted and skips (the animated union adds `| undefined`). Correct the parenthetical
  (F4-INSERT).
- **D-4 · overstated comment** — sqlserver `select.adapter-into-methods.test.ts:1453/1513/1573` "the literal
  backslash is itself escaped in the bound param" is copied from pg; T-SQL LIKE doesn't escape `\` (the param is
  un-escaped; the assertion is correct) (F1-STR).
- **D-5 · broken src-ref** — `with-values.advanced.test.ts:212-213` (matrix-wide) has a scrubbed src reference
  leaving a dangling `/` + orphan line-range `128-133` — the exact stale `file:line` pattern the comment-hygiene
  rule forbids (F2-VALVIEW). Fold into the D-1 cleanup pass.

---

## PART II — Enumerated backlog by surface (maximal dial)

Tiers: T1 bug/distinct-code-path · T2 distinct overload/seam · T3 per-variant completeness · T4
output-coincident fan-out.

### II.A  Projection / FIX B seam (SEL-SEAM, F3-PROJ)
- `PROJ-BUG-1 · T1 · §A` — `aggregateAsArray(...).projectingOptionalValuesAsNullable().useEmptyArrayForNoValue()`
  present-null characterization (the bug; `// TODO[BUG]` until fixed). [I.1]
- `PROJ-BUG-1b..1f · T1 · §A` — the other 5 modifier×family variants (`asOptionalNonEmptyArray`,
  `asRequiredInOptionalObject` × Family 1; all 3 × Family 2 via `forUseAsInlineAggregatedArrayValue`), once fixed.
- `F3-RES-1 · T4 · reachability-first` — `aggregateAsArrayOfOneColumn(<inline object-aggregate>.projecting…())`
  reaching `AbstractQueryBuilder:144` (inner-flag). Compile-repro reachability BEFORE authoring. [I.2]

### II.B  MUT-SEAM — empty-degrade completeness tail (all output-coincident, 0 defects)
- `MUT-2 · T4` — empty-degrade + `returningOneColumn(col)` × {executeInsertNoneOrOne→null, One→NO_RESULT, Many→[]}.
- `MUT-4 · T4` — empty-degrade + shaped + trailing `returning`.
- `MUT-5 · T4` — on-constraint empty-degrade + returning.
- `MUT-6 · T3` — empty-degrade + conflict-TARGET where (partial-index predicate) → target-where SURVIVES the
  degrade (emitted before `do nothing`), distinct from MUT-3's do-update-where drop.
- `MUT-7 · T4` — the new col-matrix-adapter columns (vColMatrixAdapter / tColMatrixVirtualAdapter) fed into a
  mutation `returning` (seam already proven by `delete.returning-adapter.test.ts`; completeness fan-out).
- `MUT-8 · T4` — FIX-A shaped `setIfValue` null-skip (defaulted-non-nullable) composed with on-conflict / returning.

### II.C  F1-EQCMP
- `EQ-T4-1 · T4` — `boolean.equals(value-source)` (the one genuine unbaked cell; output-coincident with the
  covered boolean `notEquals(VS)`; closes literal 18/18).
- `EQ-OUT · OUT` — the `int`-family VS variants (equals/is/isNot/… via a value-source operand): representative-covered
  numeric duplicates (byte-identical `NumberValueSource` emission to bigint/double, both full-membership) — OUT by
  the file's own family-representative principle.

### II.D  F4-UPDDEL
- `UD-R1 · T4` — UPDATE `.from(values(...))` — type-permitted (compile-repro'd: the `from` bound rejects a
  non-table, accepts a Values source); the missing symmetric twin of the covered `delete.using(values)`. Emits
  `with orgs(...) as (values …) update project set … from orgs where …`. Land in `update.from.variants.test.ts`.

### II.E  F3-SELECT
- `SEL-T4-1 · T4` — the `*WithoutSelect` clause-before-select overloads (`select`/`selectOneColumn`/`selectCountAll`
  re-declared on `DynamicHavingExpressionWithoutSelect` / `DynamicWhereSelectExpressionWithoutSelect`, select.ts:323-334),
  reached via `groupBy(vs).having(cond).select(…)` / `.where(cond).select(…)`. Emit SQL identical to the covered
  select-first twins. One T4 one-liner class.

### II.F  F1-CUSTOMNUM / F1-NUM / F1-TEMP / F1-STR / F1-BOOLIF / F2-COL / F2-VALVIEW / F5-CONN / F6-DYN / F7-EXTRAS / F9-TYPEVAR
- **Saturated — 0 genuine residual.** Each re-derived to fully COVERED against the current files (the R45 backlog
  closed their tails). The only sub-residuals are degenerate/output-coincident and enumerated in Part III OUT
  (F1-STR negated/insensitive/ifValue affix-escape adapter variants; F1-BOOLIF literal-swap cb-receiver grid;
  F1-NUM sqrt-on-double-required + fractional-const operands; F2-COL brand-only PK tails; F6-DYN string-descriptor
  ops + expandType nullable overloads; F1-TEMP bare-column direct getters).

---

## PART III — OUT (genuinely unwritable; named so they are not re-chased)

- **Sequence non-numeric value-kinds** — throw-on-real-DB (string/uuid/temporal/customUuid/customLocal*) or
  distinct-type-only (enum/custom/customComparable, R-P7); `boolean` mock-only. [I.5]
- **F2-COL brand-only PK tails** (~130) — `primaryKey`/`autogeneratedPrimaryKey`/`autogeneratedPrimaryKeyBySequence`
  non-comparable/non-int kinds: the factory brand is erased on projection, read SQL+value+leaf-type byte-identical
  to `column`×kind → compile-only → OUT.
- **L-1 custom-temporal const getter / arg / valueArg** — uncastable bare `extract`, PG-rejects → OUT. [I.4]
- **F1-CUSTOMNUM casts + double-only methods on custom leaves** — commented-out + negative-locked → OUT.
- **F1-NUM bigint typed-never methods (21)** — negative-locked (`types.negative/select.test.ts:340-391`, COMPLETE) → OUT.
- **F9-TYPEVAR compile-only brand keep/erase** (literal-union brands, byte-identical value) → OUT.
- **F1-STR / F1-BOOLIF / F6-DYN output-coincident tails** — negated/insensitive/ifValue affix-escape adapter
  variants; cb-receiver literal-swap grid; string-descriptor ops (type-identical to inline); expandType nullable
  overloads (static-return-type only) → OUT/T4-close per R-P7.
- **F7-EXTRAS driver-layer error reasons** incl. `INVALID_MOCKED_VALUE` (thrower in `src/queryRunners/MockQueryRunner`,
  not builder-reachable, not a type-path) — OUT.
- **F4-INSERT bare no-target on-conflict on pg** (typed-never, negative-locked; runs live on mysql/mariadb/sqlite);
  **defaultValues() × on-conflict** (typed-never) — OUT.
- **N-1 dormant `as double presition` typo** (NoopDBSqlBuilder only) — OUT.

---

## PART IV — Per-surface table

| Surface | Bug | Core (T1-T3) | T4 | OUT | Verdict |
|---|---|---|---|---|---|
| SEL-SEAM / F3-PROJ | **1** (PROJ-BUG-1) | 1 (+5 post-fix) | 1 (F3-RES-1) | — | bug filed; else saturated |
| F-RECENT (baked-in scan) | 0 | 0 | 0 | — | 16 files CLEAN |
| PARITY | 0 | 0 | 0 | — | twins symmetric |
| MUT-SEAM | 0 | 1 (MUT-6) | 5 | — | MUT-1/3 landed |
| F1-EQCMP | 0 | 0 | 1 (bool.equals VS) | int-VS | saturated |
| F5-CONN | 0 | 0 | 0 | seq kinds | saturated (§B reclassified OUT) |
| F4-INSERT | 0 | 0 | 0 | several | saturated |
| F6-DYN | 0 | 0 | 0 | R1/R2 | saturated |
| F1-STR | 0 | 0 | 0 | affix tail | saturated |
| F4-UPDDEL | 0 | 0 | 1 (UD-R1) | — | saturated |
| F3-SELECT | 0 | 0 | 1 (*WithoutSelect) | forUpdate | saturated |
| F1-NUM | 0 | 0 | 0 | 21 neg-lock | saturated |
| F1-CUSTOMNUM | 0 | 0 | 0 | many | saturated |
| F1-TEMP | 0 | 0 | 0 | L-1 | saturated |
| F1-BOOLIF | 0 | 0 | 0 | literal-swap | saturated |
| F2-COL | 0 | 0 | 0 | ~130 brand | output-complete |
| F2-VALVIEW | 0 | 0 | 0 | 1 | saturated |
| F9-TYPEVAR | 0 | 0 | 0 | compile-only | saturated |
| F7-EXTRAS | 0 | 0 | 0 | driver reasons | saturated |
| **Total** | **1** | **~2** | **~9** | — | mature; 1 real bug |

---

## PART V — Coordinator verification

- **PROJ-BUG-1 — compile-repro + runtime boundary-row probe.** Wrote a throwaway `*.test.ts` with a control
  (terminal `projectingOptionalValuesAsNullable()`) and a candidate (`+.useEmptyArrayForNoValue()`), each with
  `assertType<Exact<…, archivedAt: Date | null>>` and a null-`archivedAt` boundary element. `npm run validate:tests`
  → no error (both typecheck; the present-null `Exact` type holds). `npm run tests -- '<probe>'` → **control**
  `{inKey: true, val: null}` (present-null, correct); **candidate** `{inKey: false, val: undefined}` (DROPPED). ⟹
  type promises present-null, runtime drops → confirmed soundness bug (compile-repro alone insufficient per oracle
  1015-1026; the runtime probe settled it). Probe deleted; tree clean.
- **Complete clone-site inventory** — grepped every `new Aggregate…ValueSource(…)` and every `__aggregatedArrayColumns`
  copy site, cross-referenced against the flag-copy sites, to hand the fixing agent the full scope (6 reconstruction
  methods + the base copy sites; the `Null*` variants exempt). Avoids a repeat of FIX B's partial fix.
- **UD-R1 reachability** — compile-repro (self-contained, cleaned up): `update(...).from(orgsValues)` typechecks; the
  negative control `from(number)` is rejected (bound is real, not `any`) → UD-R1 is a genuine T4.
- **F3-PROJ pick×aggregate** — resolved COVERED (`select.aggregate-as-array.propagation.test.ts:165`), not a gap.
- **Baked-in scans** — F-RECENT (16 files) + per-surface: every `assertType` agrees with its `toEqual`/snapshot; CLEAN.
- **Cross-agent:** F3-PROJ (projection-rule paths, all covered) and SEL-SEAM (value-source reconstruction path, the
  bug) audited DIFFERENT clone paths — no contradiction; direct src reading + the probe settled the bug.

---

## PART VI — §B fixture-addition plan

Effectively none. UD-R1 uses inline `values(...)` (no fixture). Everything else reuses existing fixtures. The R45
backlog already added the col-matrix-adapter fixtures (`vColMatrixAdapter`, `tColMatrixVirtualAdapter`,
`vColMatrixVirtualAdapter`). The previously-"§B" sequence non-numeric kinds are reclassified OUT (I.5).

## PART VII — Recommended implementation order

1. **Fix PROJ-BUG-1** (owner/fixing agent — NOT from a test PR): thread the flag through the six reconstruction
   methods (+ audit the base copy sites); then land PROJ-BUG-1a..1f characterization tests and remove `// TODO[BUG]`.
2. **MUT-6** (target-where survives degrade — T3, distinct emission) + **UD-R1** (update.from(values), symmetric twin).
3. **T4 tails in slices** — MUT-2/4/5/7/8, EQ-T4-1 (boolean.equals VS), SEL-T4-1 (*WithoutSelect), F3-RES-1
   (after its reachability compile-repro).
4. **Doc-hygiene** — D-1 stale headers, D-3/D-4/D-5 comment fixes (one cleanup pass).

## PART VIII — Verdict

A mature round that earned its keep: **1 confirmed `src/` bug** — the `projectingOptionalValuesAsNullable()` flag
dropped by an array-shape modifier, a clean residual of the FIX B fix through a clone path that fix didn't patch,
probe-confirmed (type present-null, runtime drops) and filed with a complete fix scope so it isn't patched partially
again. It reproduces the effort's recurring lesson — *a shared-flag fix must be walked across every consuming clone*
(runbook 1015-1026), which is exactly why the maximalist seam-critic pass keeps paying off after the per-surface
matrices saturate. R45's ~94-test backlog is verified sound (16 files CLEAN, DROPPED items correctly out). Beyond
the bug, 18/20 surfaces are saturated; the residual is ~2 genuinely-distinct cells + a short T4 tail (the R45 backlog
closed most tails) + 4 cosmetic doc-hygiene items. One R45 recommendation is corrected: the deferred §B sequence
non-numeric kinds are degenerate/OUT, not a fixture backlog.

**Runbook: NO CHANGE.** The bug matches the existing "shared-shape fix must be probed on each consuming path"
corollary (1015-1026) exactly — a textbook instance, no new fingerprint. No load-bearing rule refined by the user
this session.
