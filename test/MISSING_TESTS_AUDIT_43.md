# MISSING_TESTS_AUDIT_43 — type-driven missing-tests audit, Round 43

> **Mandate.** Total coverage of every reachable typed path *and every variant*
> (per [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md)). This report is an
> **exhaustive item-by-item implementation backlog**, not a thematic summary —
> every missing test is its own numbered line item with ID · tier · fixture ·
> exact assertion · the grep proving absence. Tier is a priority label on each
> item, never a device to collapse several tests into one line.

## Headline

- **Matrix at run:** 17 cells · 245 files · **3009 tests/cell** · symmetric · `tests:audit` 0 problems. `BUGS.md` clean at start and end.
- **Method:** 20 discovery agents (2 waves of 10, ≤10 concurrent), each re-derived its surface from scratch against the *current* files (no inherited "covered"/"saturated" verdict). Then coordinator-verified every load-bearing claim (compile-repro / mock emission-probe / real-DB `--docker` probe).
- **Confirmed `src/` bugs → `BUGS.md`:** **2** — A-1 (empty on-conflict update-set drops the whole clause) and C1 (compound `orderBy(rawFragment` embedding a value source`)` skips the wrap). Both surfaced as candidates-with-both-readings, **real-DB-probed and confirmed**, then **ruled bugs by the repo owner and filed to `BUGS.md`**. Characterization tests A1-T1/T1b and C1-T1 (Part II) carry `// TODO[BUG]` when written.
- **Saturation:** **18 of 20 surfaces returned fully saturated** (0 §A). The 2 with a residual (F2-COL, F2-VALVIEW) each have a single low-tier §A/§B item. The seams surfaced the round's whole marginal value (A-1, C1, SEL-A1) — exactly the mature-phase shape the runbook predicts.
- **Enumerated backlog below:** **~18 discrete tests** (T1–T4) + the enumerated CLOSE tails. A clean saturation round: a short, honest backlog, no manufactured gaps.

**A round closing with 0 confirmed bugs at this maturity is a success, not a shortfall** (runbook header + §9). The R41 projection-seam fix (`593a0a4f`) is verified sound *and* complete: the "bug lives in the residual of the prior fix" streak that ran R37–R41 is genuinely over.

---

## Part I — Bugs, candidates, limitations, and inert notes

### Confirmed `src/` bugs: 2 (A-1, C1 — filed to `BUGS.md` by owner ruling; detailed below).

No **baked-in** bug in the R42 backlog and no R41-fix residual. The F-RECENT baked-in-bug scan of all 18 R42-backlog files is **clean** — every just-added `assertType<Exact>` agrees with its `toEqual`/`toBe` value and inline SQL (no key the type marks required-but-omitted, no `null`-vs-`undefined` swap, no dropped-vs-kept container). The R41 fix residual is sound: `ForUseAsInlineAggregatedArrayValueFn`'s nullable branch uses the PLAIN `ResultObjectValuesProjectedAsNullable` (non-dropping, matching `__transformRootObject`), the `…ForAggregatedArray` shapes are consumed only by `aggregateAsArray`/`aggregateAsArrayDistinct` (the dropping runtime), and `__combineSubSelectUsing` copies `__projectOptionalValuesAsNullable` for all 8 compound ops. No consuming path is left type-vs-runtime-inconsistent.

### BUG-1 (A-1) — empty on-conflict update-set silently drops the entire `ON CONFLICT` clause → plain INSERT. **Filed to `BUGS.md` (owner ruling).**

- **Where:** `AbstractSqlBuilder._buildInsertOnConflictBeforeReturning` (`src/sqlBuilders/AbstractSqlBuilder.ts` ~:2162-2166): when `__onConflictUpdateSets` is present but resolves to **zero** columns, the method returns `''`, dropping the `on conflict (cols) do update set …` clause entirely.
- **Reachability (public, type-valid, undocumented):** `onConflictOn(cols).doUpdateDynamicSet({archivedAt:null}).ignoreAnySetWithNoValue()` (prunes the only value-less column → empty set) and `onConflictOn(cols).doUpdateSetIfValue({name: undefined})` (one-shot, only value filtered out). No builder guard throws, no `types.negative` forbids it.
- **Coordinator probe — CONFIRMED (mock emission + real-DB consequence):**
  - Mock: both forms emit `insert into project (organization_id, slug, name) values ($1, $2, $3)` (**no `on conflict`**); the control `doUpdateSetIfValue({name:'kept'})` emits `… on conflict (organization_id, slug) do update set name = $4`.
  - `--docker postgres/newest/pg`: seed a row, then the empty-set upsert on the same `(org, slug)` → **`THREW: 23505` (unique_violation)**. The composition silently flips runtime semantics from *never-throw-on-conflict* to *throws-on-conflict*.
- **Reading A (by-design):** an empty do-update-set cannot render valid `on conflict … do update set <nothing>`; degrading to a plain insert is a defensible elision (the library elides other empty clauses), and the user drove the set empty.
- **Reading B (defect):** the degradation is the riskiest available — a safer intent-preserving choice is `on conflict (cols) do nothing` (valid SQL, keeps the no-throw contract) or a build-time `TsSqlProcessingError`. Note the asymmetry: a plain UPDATE whose dynamic set empties throws `NO_COLUMN_SETS`, while the on-conflict do-update silently drops. The mock hides it completely — only the real-DB cell surfaces the conflict throw.
- **Ruling:** repo owner ruled this a **bug** → filed to `BUGS.md`. Fix direction (owner's call at fix time): degrade to `on conflict (cols) do nothing`, or throw at build time; the mock-invisible silent throw-on-conflict is the defect. Characterization tests A1-T1/T1b (Part II) carry `// TODO[BUG]` until fixed.

### BUG-2 (C1) — compound `orderBy(rawFragment` embedding a value source`)` bypasses the compound-order-by wrap → engine-rejected SQL. **Filed to `BUGS.md` (owner ruling).**

- **Where:** `AbstractSqlBuilder._needsCompoundExpressionOrderByWrap` (~:1341-1344) wraps a strict-engine compound in `select * from (…) as o_1_` only when `isValueSource(entry.expression)` is true. A `rawFragment` is not a value source, so it is never wrapped — even when the fragment **embeds** a no-table value source (`orderBy(conn.rawFragment\`${conn.const(1,'int')}\`)`).
- **Coordinator probe — CONFIRMED (mock emission + real-DB rejection):**
  - Mock: rawFragment+const → `select name as label from project union select title as label from issue order by $1` (**un-wrapped, bare param**); the control `orderBy(const(1,'int'))` → `select * from (…) as o_1_ order by $1` (**wrapped**).
  - `--docker postgres/newest/pg` (separate transactions): un-wrapped → **`REJECTED: 0A000`** (PostgreSQL `feature_not_supported` — *ORDER BY on a UNION result must be on one of the result columns*); wrapped control → **`ACCEPTED rows=8`**. So the asymmetry is real on PostgreSQL (and by the same SQL rule, Oracle / SQL Server), not just the SQL-Server-1008 case in `LIMITATIONS.md`.
- **Reading A (by-design / LIMITATION — leaning):** `rawFragment` is the opaque typeless escape hatch; the library cannot introspect it to know it carries a value source, and the *documented* uses (`order by 1` ordinal, `order by label` output-column-name) are valid inline. Embedding a bound param is the user going outside the contract — the same family as the existing `LIMITATIONS.md` entry *"SQL Server rejects a bare bind parameter as an ORDER BY term"* (payoff of closing it is low: ordering by a bare constant is a no-op sort).
- **Reading B (defect):** the `orderBy(const)` sibling wraps to make the semantically-identical term legal, but `orderBy(rawFragment-with-value-source)` does not — a compound-interface overload-subset asymmetry (runbook theme 6). The library could always-wrap rawFragment compound order-by terms (wrapping is safe for ordinals too), or detect an embedded value source.
- **Ruling:** repo owner ruled this a **bug** → filed to `BUGS.md`. Fix direction (owner's call at fix time): wrap the compound when the order-by term is a `rawFragment` (wrapping is safe for bare ordinals too), or detect a value source embedded in the fragment. This is the compound-order-by-wrap theme (runbook theme 6) resurfacing through the opaque rawFragment escape hatch — the existing fingerprint assumed the rawFragment arm always wraps. Characterization test C1-T1 (Part II) carries `// TODO[BUG]` until fixed.

### Limitations (by-design; NOT bugs, NOT filed to BUGS.md)

- **L-1 — custom-temporal CONST getter emits bare `extract(part from $1)`.** `conn.const(date,'customLocalDate','ReleaseDay').getMonth()` fires the `isConstValue()` cast arm, but `transformPlaceholder` casts only the plain `localDate|localTime|localDateTime` keywords; a custom typeName matches no case → bare `$1`, PG-rejected. This is the user's responsibility via `TypeAdapter.transformPlaceholder` (custom typeNames carry no built-in SQL type). Degenerate on every other dialect (the plain-const arm doesn't cast there either). **Same fingerprint as the R37 branded-twin limitation — no new failure mode.** (F1-TEMP.)

### Inert src-cleanliness notes (untestable; OUT — carried for the maintainer, not a gap)

- **N-1 — `update.ts:532` sqlite `ReturningOneColumnFnType` mis-brackets `| NOldValuesFrom<…>`** as a bare `NSource` union arm (vs nested inside `ValueSourceOf<…>` on the non-sqlite one-column overload; the sqlite *multi*-column sibling omits it entirely). Provably **inert**: a bare source-name brand is not assignable as a `column:` argument, and `oldValues()` is itself typed `never` on `SqliteConnection` (NOT-APPLICABLE), so no value source can be constructed to reach the arm. No compile-repro distinguishes the two spellings; no runtime effect. Cosmetic cleanup only — **this is the same inert quirk noted in prior rounds; independently re-derived and re-confirmed inert by PARITY.** (PARITY.)
- **N-2 — interface name `CompoundableCustomizableExecutableSelectExpressionWitoutWhere`** ("Witout" → "Without") misspelled consistently across 7 uses in `src/expressions/select.ts`. Compiles fine, zero functional impact. Cosmetic. (PARITY.)

### Doc-hygiene (report-only; not a test gap)

- **D-1 — stale `with-values` headers.** `with-values.test.ts:5-7` and `with-values.advanced.test.ts:28-30` (34 cells) still claim certain dialects block-comment/comment-out the Values body — **false since R40** (Values is LIVE in all 17 real cells; grep finds no commented bodies). Correct wording is in `with-values.join-and-subquery.test.ts:18-21`. Two-header comment cleanup, no test change. (F2-VALVIEW; flagged unapplied since R41.)

---

## Part II — The enumerated backlog (by surface)

Each item: **ID · Tier** — what to write · fixture · exact assertion · grep proving absence. `T1` = defect-adjacent / distinct runtime-branch. `T2` = distinct emission / seam composition. `T3` = per-variant completeness (often §B). `T4` = output-coincident fan-out.

### Surface MUT (mutation seam)

- **A1-T1 · T1** (characterization for CANDIDATE-1) — empty on-conflict update-set drops the clause. Fixture: `tProject` (existing unique index on `organization_id, slug`). Body: `insertInto(tProject).values({organizationId:1, slug:'mktg-site', name:'x'}).onConflictOn(tProject.organizationId, tProject.slug).doUpdateDynamicSet({archivedAt:null}).ignoreAnySetWithNoValue().executeInsert()`. Assert `ctx.lastSql === "insert into project (organization_id, slug, name) values ($1, $2, $3)"` (no `on conflict`), `ctx.mockNext(1)`; two-sided guard `if (ctx.realDbEnabled)` seed-and-expect the `23505` throw (or `return` if owner rules by-design). Grep proving absence: `grep -rn "doUpdateSetIfValue\|doUpdateDynamicSet" test/db/postgres/newest/pg/*.test.ts` — every hit keeps ≥1 column; none drives the set empty (verified: `insert.on-conflict.dynamic-set.test.ts`, `insert.on-conflict.set-when-helpers.test.ts:524-551` prune `archivedAt` but keep `name`).
- **A1-T1b · T1** — the one-shot form: `…onConflictOn(cols).doUpdateSetIfValue({name: undefined}).executeInsert()` → same plain-insert emission. Separate line item (distinct reaching overload: `doUpdateSetIfValue` one-shot vs `doUpdateDynamicSet…ignoreAnySetWithNoValue`).
- **MUT-A2a · T3** — `defaultValues().onConflictDoNothing()`. `defaultValues()` returns `CustomizableExecutableSimpleInsertOnConflict`, so on-conflict is reachable but never combined. Fixture: `tLedgerEntry` (autogen id). Assert `"insert into ledger_entry default values on conflict do nothing"` (+ real-DB id). Grep: `grep -rn "defaultValues()" test/db/postgres/newest/pg/*.test.ts` → only bare + `customizeQuery` (`customize-query.insert.test.ts:363`); never `+ onConflict`.
- **MUT-A2b · T3** — `defaultValues().returning({...})`. Assert the returning projection over a default-values insert. Grep: same as above; never `+ returning`.
- **MUT-A2c · T3** — `defaultValues().returningLastInsertedId().executeInsert()`. Assert `"insert into ledger_entry default values returning entry_no"` (+ real engine-assigned id via `tLedgerEntry`). Grep: same.

### Surface SEL (select / compound / CTE seam)

- **SEL-A1a · T3** — projection-only hook `customWindow` on a **compound ARM** (a plain select customized *before* `.union()`). Reachable: `select(...).customizeQuery({customWindow})` returns `CompoundableExecutableSelectExpression`, still exposes `.union()`. Emission is correct and non-dropping (`window w as (…)` on the first arm before the set operator, valid on PG). Fixture: existing tables. Assert `ctx.lastSql` shows the `window` clause on the un-parenthesized first arm. Grep: the only file pairing `customWindow` with a compound operator is `cte.recursive-union-variants.test.ts` (recursive *outer* select, not a compound member) — `grep -rn "customWindow" test/db/postgres/newest/pg` shows no compound-arm case.
- **SEL-A1b · T3** — `afterSelectKeyword` hook on a compound arm (distinct emission slot). Same reachability/fixture; assert the token lands on the un-parenthesized arm.
- **SEL-A1c · T3** — `beforeColumns` hook on a compound arm (distinct emission slot). Same.
- **C1-T1 · T1** (boundary/limitation test for CANDIDATE-2) — compound `orderBy(rawFragment` embedding `const`). Fixture: existing tables. Assert the current emission `"… union … order by $1"` (un-wrapped) as the pinned behavior; if the owner rules LIMITATION, mark `// TODO[LIMITATION]` with the real-DB rejection recipe (PG 0A000). Grep: `grep -rn "orderBy(ctx.conn.rawFragment" test/db/postgres/newest/pg/*.test.ts` → only bare-ordinal `rawFragment\`1\`` (`select.compound.test.ts:493,1018`); none embeds a value source.

### Surface COL (column factories)

- **COL-A1 · T3 (§B)** — `optionalVirtualColumnFromFragment` **custom-kind + trailing TypeAdapter** (the optional × custom-kind × `adapter2` slot triple), never constructed on any dialect. Nearest fixtures each miss one axis: `centsFromIdTagged` (required+custom+adapter), `centsFromIdOptional` (optional+custom, no adapter), `versionUpperTagged`/`tLedgerEntry.tag` (optional+adapter, PLAIN kind). Fixture to add (§B, no schema change — inline-computed): `centsFromIdOptionalTagged = this.optionalVirtualColumnFromFragment<number,'Cents'>('customInt','Cents', (f)=>f.sql\`${this.id} * 100\`, plusOffsetAdapter)` on `tIssueWorklog`. Assert `executeSelectOne` projecting it: present raw `100` → read `1100`, `assertType<Exact<…,{ cents?: number }>>` (optional projection + adapter read on a branded customInt). Grep proving absence: `grep -rn "optionalVirtualColumnFromFragment" test/db/*/domain/connection.ts` → per dialect only `activityUpper`/`versionUpperOptional` (plain, no adapter), `versionUpperTagged`/`tag` (plain, adapter), `centsFromIdOptional`×2 (custom, no adapter) — **zero** 4-arg custom-kind calls.

### Surface VALVIEW (Values / inline VALUES)

- **VV-A1a · T3** — a `Values` source fed into a WHERE `in (select …)` predicate. Every existing Values-subquery test uses the SELECT-clause scalar (`forUseAsInlineQueryValue`) or the derived-table (`forUseInQueryAs`); the WITH-hoist into a WHERE `in (select …)` is unasserted. Fixture: reuse `VProjectCode` (in `with-values.join-and-subquery.test.ts`). Body: `selectFrom(tProject).where(tProject.id.in(conn.selectFrom(codes).selectOneColumn(codes.projectId))).select({...})`. Assert the `with projectCode(...) as (values (…)) select … where id in (select … from projectCode)` snapshot + real-DB match. Grep: `grep -rn "\.in(ctx.conn.selectFrom" test/db/**/with-values*.test.ts` → none.
- **VV-A1b · T4** — the `exists(selectFrom(values)…)` sibling of VV-A1a (same WITH-hoist class, distinct predicate position). Enumerated per §8; lower priority than the `in` form.

### Surface BOOLIF (boolean / custom-boolean)

- **BOOL-B1a · T2** — `isNull()` on a **custom-boolean** receiver. Emits the distinct wrapped-remap shape `(approved = 'A') is null` (vs plain `billable is null`), real-DB-value-validatable. Fixture: `tIssueWorklog.approved` (approvedAdapter 'A'/'R', nullable). Assert `where (approved = 'A') is null`, matches the stored-NULL row only. Grep: `grep -rn "approved.isNull\|published.isNull\|verified.isNull\|invoiced.isNull" test/db` → none.
- **BOOL-B1b · T2** — `isNotNull()` on a custom-boolean receiver → `(approved = 'A') is not null`, matches the non-NULL rows. Same fixture; distinct emission.
- **BOOL-B1c · T4** — numeric-adapter twin: `tIssueWorklog.invoiced.isNull()` → `(invoiced = 1) is null` (the numeric `CustomBooleanTypeAdapter` overload's `is null` shape). Distinct from the string-adapter shape.
- **BOOL-B1d · T4** — `invoiced.isNotNull()` → `(invoiced = 1) is not null`.

### Surface NUM (numeric)

- **NUM-A1 · T4** (marginal) — int-receiver fractional-literal → `double` promotion, observed by chaining into a float-handling op: `select({ m: tIssue.priority.add(2.5).modulo(2) })` → `mod((priority + $1)::numeric, ($2)::numeric)`, params `[2.5, 2]`, value `(2+2.5) mod 2 = 0.5`, type `number` (distinct from the covered `add(2).modulo(2)` int path and the direct `modulo(2.5)`). Grep: `grep -rnE "priority\.(add|subtract|multiply)\([0-9]+\.[0-9]" test/db/postgres/newest/pg` → empty. **Closeable under strict R-P7** (the un-chained fractional literal is degenerate; only the one-hop propagation is distinct) — author only if the owner wants the promotion pinned for non-modulo operators.

**Backlog total: ~18 discrete tests** (2 candidate-characterization T1 + 3 compound-arm-hook T3 + 3 defaultValues-composition T3 + 1 §B fixture-backed T3 + 2 Values-subquery T3/T4 + 4 custom-boolean-`isNull` T2/T4 + 1 marginal NUM T4 + the 2 candidate boundary tests).

---

## Part III — OUT / CLOSE (each with its reason; enumerated so the next round does not re-chase)

### CLOSE — degenerate / output-coincident (representative tested)

- **EQCMP direct-fluent `*IfValue` tail (~96 method×leaf cells) — CLOSE (R-P7).** `*IfValue` is a single un-redeclared Equalable/Comparable base method; its skip-when-null dispatcher is leaf-independent (pinned on int + string), the FIRE-half per-leaf marshalling is pinned by the non-IfValue sibling + `if-value-marshalled`, and the dynamic dispatcher covers `*IfValue` per operator×type. Enumerated one line per method×leaf by F1-EQCMP (bigint: `notEqualsIfValue`/`isIfValue`/`isNotIfValue`/`notInIfValue`; customInt/customDouble: the 9 non-`equalsIfValue`; string/uuid/boolean/temporal families likewise — full list in the F1-EQCMP enumeration). A direct `bigintCol.notEqualsIfValue(x)` exercises zero new type-path or runtime.
- **EQCMP col-vs-col value-source overloads — CLOSE.** `col.equals(otherCol)`/`col.in(scalarSubquery)` are the same `method(IValueSource)` overload already exercised per leaf; col-vs-col is degenerate where a subquery/column operand is tested.
- **DYN `string`/`uuid` × {lessThan, greaterThan, lessOrEqual, greaterOrEqual} — CLOSE.** `StringFilter extends ComparableFilter<string>`; emits `col <op> $n` identical to the pinned int/date comparable path. (F6-DYN.)
- **DYN `CustomUuidFilter` affix tail** (`notStartsWith`/`endsWith`/`notEndsWith`/`likeInsensitive`/… beyond the pinned equals/contains/startsWith/insensitive) — structurally identical to `StringFilter` + the customUuid `asString()` rewrite (both proven). CLOSE.
- **DYN `INullableValueSource → NullableFilter` arm — CLOSE (unreachable).** Every scalar value source is ≥ `IEqualableValueSource`; a pure type-completeness fallback no real filterable column reaches.
- **DYN `IAggregatedArrayValueSource` `Array<Filter>` half — CLOSE.** The `{}` half is pinned (no-op); any real operator throws `UNKNOWN_OPERATION`, so the array half has no emitting behavior.
- **STR wildcard-match cross-products** (`%`×`startsWith`, `_`×`startsWithInsensitive`, …) — CLOSE. The char-escape (`_escapeLikeWildcard`) and the affix wrapping are each independently real-DB match-validated for every wildcard char (`%`/`_`/`\`/`[`); the un-asserted combination reaches no distinct src branch. (F1-STR.)
- **F3-SELECT compound `executeSelectOne`/`NoneOrOne` NO_RESULT & MORE_THAN_ONE_ROW throws — CLOSE.** The throw lives in the inherited `AbstractSelect.executeSelectOne`, byte-identical to the plain-select tests already covering it; only `__asSelectData` (the SQL) differs and that SQL is pinned by `compound-execute-select-one`. (F3-SELECT B-1/B-2.)
- **F3-SELECT `subSelectUsing(ForUseInLeftJoin correlated arg)` — CLOSE.** The impl assigns `__subSelectUsing = tables` regardless of member kind; a left-join correlated table emits no different SQL. (F3-SELECT B-3.)
- **F3-PROJ `aggregateAsArrayDistinct` dropping element-top rules (rule-1/rule-2/rule-4) — CLOSE.** Differs only in SQL (`json_agg(distinct …)`, separately pinned); projection runtime + result type identical to non-distinct `aggregateAsArray`, whose drops are boundary-probed. Plus the few default twins of nullable-only inline/compound tests (same runtime path proven by a sibling default) and picking×aggregate (picked all-optional columns collapse to the covered rule-4). (F3-PROJ §B.)
- **F5-CONN 5 degenerate classes** — const/optionalConst plain-slot adapter for string/localDate (same plain branch as int/uuid); the `adapter2` slot for custom kinds beyond the tested representative (identical custom branch); min/max/sum/average over the remaining comparable/numeric leaves (one dispatcher, kind-string only); `isolationLevel(level,'read only')` (same `[level,accessMode]` pack as the tested `'read write'`); executeFunction/executeProcedure param arity (spread array, not a typed overload). (F5-CONN §C.)
- **F2-COL View custom-kind virtual + adapter (required & optional) — CLOSE.** `Table.virtualColumnFromFragment` and `View.virtualColumnFromFragment` bodies are byte-identical (no `__asColumn` divergence), so the View twins coincide with the Table cell (COL-A1 covers the one distinct arm). (F2-COL §C.)
- **F1-CUSTOMNUM** — `asOptional`/`asRequiredInOptionalObject`/`onlyWhenOrNull`/`ignoreWhenAsNull` brand-keep (optionality marker only, byte-identical SQL+value); `roundn` branded-leaf variants (same value/SQL); `sign()` erase-distinction itself (SQL+value identical regardless of brand — a test exists anyway). All compile-only brand distinctions; the operations are value-covered on marshalled leaves. (F1-CUSTOMNUM §C.)

### OUT — no runtime/SQL/value surface, driver-layer, impossible-state, or new-cell

- **F4-INSERT B-1/B-2 — `returningLastInsertedId` single/multi adapter-transform HAPPY arm.** The `if(typeAdapter) transformValueFromDB(...)` on the last-inserted-id executor is value-marshalling on the runner layer (same `executeInsert` shape differing only by column adapter), not a distinct overload/interface/shaped-twin/execute-shape → out of the typed-surface audit scope. (Adjacent read-path adapter+rowIndex marshalling is covered by `marshalling.transform-validation`.)
- **F9-TYPEVAR OUT×3 (compile-only):** `asInt()`/`asBigint()` on an int (NoopValueSource, byte-identical SQL, no runtime bigint) — type-locked in `casts`; `opt×req` operand ordering (`MergeOptional` = same optionality/emission/inhabitant as the covered `req×opt`); `requiredInOptionalObject`/`originallyRequired` at the flat scalar level (project `?:T` identically to `optional`; the only `Exact` distinction is via `MergeOptional`, which IS covered).
- **F1-NUM N/A:** bigint `multiply`/`divide`/`power`/trig (typed `never`, no `bigdouble`); `asInt`/`asDouble`/`asBigint` on bigint/customInt receivers (NumberValueSource-only).
- **F7-EXTRAS OUT** — compile-only type aliases (`Insertable*`/`Updatable*`/`*ShapedAs`/`ColumnKeys`/`InferSourceFrom`/…, exercised via the builders they annotate → negative-type territory); error reasons that are driver-layer (`ONLY_ONE_COLUMN_EXPECTED`, `OUT_PARAMS_NOT_SUPPORTED`, `INVALID_MOCKED_VALUE`, the `SQL_*`/`TRANSACTION_ERROR` mappings), connector-layer (`UNSUPPORTED_DATABASE`, `LOW_LEVEL_TRANSACTION_NOT_SUPPORTED`), impossible-state (`TsSqlInternalErrorReason`×11, `UNKNOWN`, `UNKNOWN_DATA_TYPE`), or need a `compatibilityVersion < 8_000_000` cell that doesn't exist (`UNSUPPORTED_QUERY` — round-38 boundary, no new cells).
- **Negative-type surface (all correct, present in `types.negative/`):** absent customInt/customDouble methods, cross-brand `equals` rejection, `disallowIfNoValueWhen` returning `MISSING_KEYS` unchanged (the *When oracle — correct-by-design under `when===false`, re-confirmed by PARITY and F4-UPDDEL), level-5 projection depth → `never`, dynamic-condition negative locks.
- **Inert / cosmetic:** N-1 (`update.ts:532`), N-2 (`Witout` typo) — Part I.

---

## Part IV — Per-surface saturation table

| Agent | §A | §B | Candidate/Bug | Verdict |
|---|---|---|---|---|
| F-RECENT (baked-in + R41-fix) | 0 | 0 | 0 | Baked-in CLEAN; R41 fix SOUND |
| PARITY (twin sweep) | 0 | 0 | 0 (N-1/N-2 inert) | Saturated |
| MUT-SEAM | 3 (MUT-A2a/b/c) | 0 | **A-1** | Seam-saturated + 1 candidate |
| SEL-SEAM | 3 (SEL-A1a/b/c) | 0 | **C1** | Seam-saturated + 1 candidate |
| F1-EQCMP | 0 | 0 | 0 | Saturated (T4 `*IfValue` tail → CLOSE) |
| F5-CONN | 0 | 0 | 0 | Clean saturation |
| F4-INSERT | 0 | 0 | 0 | Saturated |
| F3-PROJ | 0 | 0 | 0 | Saturated (0 src suspicions) |
| F3-SELECT | 0 | 0 | 0 | Saturated |
| F6-DYN | 0 | 0 | 0 | Saturated |
| F4-UPDDEL | 0 | 0 | 0 | Saturated |
| F9-TYPEVAR | 0 | 0 | 0 | Saturated (3 OUT compile-only) |
| F1-TEMP | 0 | 0 | 0 (L-1 limitation) | Saturated |
| F2-COL | 1 (COL-A1) | 1 | 0 | Near-saturated (1 §B fixture) |
| F2-VALVIEW | 2 (VV-A1a/b) | 0 | 0 | Near-saturated + D-1 doc-cleanup |
| F1-NUM | 1 (NUM-A1, marginal) | 0 | 0 | Saturated |
| F1-CUSTOMNUM | 0 | 0 | 0 | Saturated |
| F1-STR | 0 | 0 | 0 | Saturated |
| F1-BOOLIF | 4 (BOOL-B1a-d) | 0 | 0 | Saturated + custom-bool `isNull` tail |
| F7-EXTRAS | 0 | 0 | 0 | Saturated |

**18/20 surfaces fully saturated (0 §A).** No surface is "saturated with a long §C list" (the mis-file tell); the §C/CLOSE tails are enumerated above.

---

## Part V — Coordinator verification notes

- **F-RECENT (baked-in + R41 fix):** independently re-read the 18 R42 files and the two fix src locations; every `assertType`+`toEqual` pair self-consistent; `…ForAggregatedArray` consumed only by the dropping runtime; flag copied for all 8 compound ops. No probe needed (no contradiction).
- **A-1 (MUT-SEAM):** mock emission-probe confirmed both empty-set forms drop the clause (plain insert) vs the one-column control; `--docker postgres/newest/pg` confirmed the real-DB consequence (`THREW: 23505`). Probe file written and deleted; tree clean.
- **C1 (SEL-SEAM):** mock emission-probe confirmed un-wrapped `order by $1` vs the wrapped const control; `--docker postgres/newest/pg` (separate transactions to avoid the aborted-tx cascade that contaminated the first run) confirmed un-wrapped → `0A000` rejection, wrapped control → accepted (8 rows). Probe file written and deleted; tree clean.
- **PARITY N-1:** confirmed inert by construction (source-name brand not assignable as a column arg; `oldValues()` is `never` on SqliteConnection) — no compile-repro can distinguish the spellings; no test derives. Matches the prior-round src-cleanliness note.
- **No cross-agent contradictions this round.** F3-PROJ, SEL-SEAM, and F-RECENT independently agreed the R41 projection seam is sound and boundary-probed; MUT-SEAM's initial "MORE_THAN_ONE_ROW parity gap" suspicion was self-retracted (covered in `update/delete.execute-variants`). No §7.1 adjudication required.

---

## Part VI — §B fixture-addition plan

- **For COL-A1** (the only §B fixture): add on `tIssueWorklog` (shared `domain/connection.ts`, propagates to all cells; no schema change — virtual columns are inline-computed):
  ```ts
  centsFromIdOptionalTagged = this.optionalVirtualColumnFromFragment<number, 'Cents'>(
      'customInt', 'Cents', (fragment) => fragment.sql`${this.id} * 100`, plusOffsetAdapter)
  ```
  Closes the optional × custom-kind × `adapter2`-slot triple. A View twin (`vReleaseOverview`) would be §C (byte-identical impl), not needed.
- All other backlog items use **existing** fixtures (tProject, tLedgerEntry, tIssueWorklog.approved/invoiced, tIssue, VProjectCode). No other fixture additions required.

---

## Part VII — Recommended implementation order

1. **Adjudicate the 2 candidates** (repo owner): A-1 (elide / `do nothing` / throw) and C1 (bug → wrap rawFragment compound order-by, or LIMITATION → document). Their characterization tests (A1-T1/T1b, C1-T1) land regardless of the ruling and lock current behavior.
2. **T1/T2** — A1-T1/T1b, C1-T1, BOOL-B1a/B1b (custom-boolean `isNull`/`isNotNull` distinct emission).
3. **T3** — SEL-A1a/b/c (compound-arm projection hooks), MUT-A2a/b/c (defaultValues + on-conflict/returning), COL-A1 (+ the §B fixture), VV-A1a (Values-in-subquery).
4. **T4** — BOOL-B1c/B1d (numeric custom-boolean twin), VV-A1b (Values-exists), NUM-A1 (chained fractional promotion — optional).
5. **Doc cleanup** — D-1 (two stale `with-values` headers). Cosmetic src (optional): N-2 (`Witout` typo), N-1 (`update.ts:532`).
6. **CLOSE tail** — enumerated in Part III; no action, listed so Round 44 does not re-discover them.

---

## Part VIII — Verdict

**Round 43 surfaced 2 real-DB-confirmed `src/` bugs (A-1, C1 — filed to `BUGS.md` by owner ruling) plus a short honest §A/§B backlog (~18 tests) against a 3009-tests/cell matrix.** 18 of 20 surfaces returned fully saturated on an independent from-scratch re-derivation; the whole marginal value lived in the two seam critics (A-1 from MUT-SEAM, C1 + SEL-A1 from SEL-SEAM) and the custom-kind/custom-boolean read tails (COL-A1, BOOL-B1) — exactly the mature-phase shape the runbook predicts (per-surface matrices saturate; the marginal bug moves to the seams).

Most importantly, the R41 projection-seam fix (`593a0a4f`) is verified **sound and complete**: the baked-in scan of its 44-test backlog is clean, every consuming path of the retyped shape/copied flag is type-vs-runtime-consistent, and the five-round "bug lives in the residual of the prior fix" streak (R37–R41) is genuinely ended. Neither candidate this round descends from that lineage — A-1 is an on-conflict-emission elision, C1 is a compound-order-by-wrap escape-hatch edge; both are pre-existing, neither is a fix residual.

**Runbook: one refinement warranted (not yet applied).** Now that C1 is a confirmed defect, the Timelessness discipline (case b) supports **refining the existing theme-6 fingerprint** — it currently states the compound `orderBy` string/ordinal/**rawFragment** arms wrap while `orderBy(valueSource)` did not; C1 shows the rawFragment arm does **not** wrap and, worse, an opaque `rawFragment` can smuggle a value source past the `isValueSource()`-keyed wrap gate. A-1 optionally adds a small new fingerprint (a value-gated/dynamic clause pruned to empty can collapse the *whole* enclosing clause instead of degrading to a no-op form — mock-invisible, real-DB-only). These edits are held pending owner sign-off because the runbook already carries uncommitted R41 additions (baked-in-bug §0.5 paragraph + the shared-result-type corollary), which remain in the working tree untouched.
