# MISSING_TESTS_AUDIT_39 — type-driven missing-tests audit, round 39

**Mandate.** Maximal saturation of the typed surface, re-derived from scratch. This
report is written as an **exhaustive implementation backlog**, not a thematic
summary: every individual test the 20 discovery agents surfaced is enumerated with a
stable ID, its fixture, its assertion, and the grep that proves absence — including
the Tier-4 completeness fan-outs and the §C items that still carry a distinct type /
SQL / value surface. The intent is that implementing **all** of Part II drives the
suite to true saturation so future rounds surface nothing new. Only genuinely-OUT
items (compile-only with no runtime surface, `src/queryRunners/`, a new matrix cell,
pure phantom) are excluded — Part III lists them with the reason so they are not
re-chased.

**Method.** 20 read-only discovery agents (16 per-surface + F-RECENT + F9-TYPEVAR +
MUT-SEAM + SEL-SEAM + PARITY), ≤10 concurrent, inline; coordinator verification of
every load-bearing claim (tsgo compile-repro / mock runtime-probe / `--docker`).
Reference cell `postgres/newest/pg/`; matrix symmetric (17 cells, 244 files, 2790
tests/cell). Each Part-II item is a **canonical test in the reference cell that
propagates to all applicable cells** — so the real produced-test count is roughly
`(items × applicable cells)`.

**Headline counts.** 2 confirmed `src/` bugs · 2 candidates (both readings) ·
**~180 enumerated canonical tests** across Tiers 1–4 · 6 §B fixture additions ·
9/20 surfaces "saturated" at the theme level but still carrying an enumerated
Tier-4 tail below.

---

# PART I — Confirmed `src/` bugs + candidates

## BUG-1 — affix predicates with a literal `_` never match on SQL Server & Oracle
`_escapeLikeWildcard` maps a literal `_` → `[]` (EMPTY character class) instead of
`[_]` (`src/sqlBuilders/SqlServerSqlBuilder.ts`, `src/sqlBuilders/OracleSqlBuilder.ts`).
**Docker-confirmed both engines:** insert `email='a_b@probe.test'`, then
`tAppUser.email.startsWith('a_b').executeSelectMany()` → `[]` while a wildcard-free
control `startsWith('a')` matched both rows. Mock-invisible; the existing
`like-escape-literal` test locks the buggy `50[%][]x` param but its result assertion
is trivially satisfied. On Oracle the bracket approach is also inconsistent with the
`escape '\'` clause. → `BUGS.md`. Filed by **F1-STR**.

## BUG-2 — rule-2 left-join object with a `const` leaf kept on a miss, violating its declared-required type
On a join MISS a rule-2 nested object mixing a `connection.const()` no-table leaf
resolves `{ proj:{ tag:'rel' } }` (left-join leaf absent) while typed
`proj?: { name: string; tag: string }`. Type side ignores no-table leaves
(`projectionRules.ts`), runtime drop-gate does not (`AbstractQueryBuilder.ts`).
Control (pure rule-2) drops correctly. **Mock-confirmed.** → `BUGS.md`. Filed by
**F3-PROJ**.

## Candidate C1 (F-RECENT) — `and`/`or`-not-array INVALID_FILTER still carries the pre-fix `value:filter`/`path:prefix`
`DynamicConditionBuilder.ts` L50/L58 report the enclosing filter object as `value`
and bare `prefix` as `path` — the shape the R38 fix corrected at L96. (a) analogous
residual; (b) intentional (a conjunction is not a column). L39 is NOT analogous
(there `value:filter` is genuinely the offending value). Maintainer decision.

## Candidate C2 (PARITY) — `ignoreIfHasValue`/`ignoreIfHasNoValue` param type differs INSERT vs on-conflict/UPDATE
`OptionalColumnsForSetOf` vs `ColumnsForSetOf`. Leaning intentional (on-conflict set
mirrors UPDATE). Observable only as a negative-type rejection → OUT of Principle-#1
scope; if the maintainer wants it locked it is a `types.negative/` entry.

---

# PART II — Exhaustive test backlog (implement all of this)

Legend: **T#** = tier (T1 code-path/bug-class · T2 distinct overload/emission/seam ·
T3 per-variant completeness · T4 output-coincident completeness fan-out, lowest
priority but LISTED per the "every variant" standard). Each item: *what · fixture ·
assertion · grep/why-absent*.

## A. Dynamic-condition structured errors (F-RECENT) — file: `dynamic-condition.errors.test.ts` / `.nested-extension.test.ts`
Extend the `reasonOf`/`pathOf`/`valueOf` helpers; add a `nameOf`/`ruleOf`.

- **DYN-ERR-1 · T2** — INVALID_FILTER column-value **Date** inhabitant (L96 Date arm): `withValues({ id: new Date('2020-01-01T00:00:00Z') } as any)` → `value` is the Date, `path='id'`. grep: no `{ id: new Date` in any `dynamic-condition*.test.ts`.
- **DYN-ERR-2 · T2** — INVALID_FILTER column-value Date at depth 2: `dynamicConditionFor(nestedFields).withValues({ project: { id: new Date(...) } } as any)` → `value`=Date, `path='project.id'`.
- **DYN-ERR-3 · T2** — INVALID_FILTER **and-not-array** `value` (L50): `withValues({ and: 'x' } as any)` → assert `value` = `{and:'x'}` (documents current behavior + locks C1 either way).
- **DYN-ERR-4 · T2** — INVALID_FILTER and-not-array `path` (L50): same → `path=''`.
- **DYN-ERR-5 · T2** — INVALID_FILTER **or-not-array** `value` (L58): `{ or: 'x' }` → `value`=`{or:'x'}`.
- **DYN-ERR-6 · T2** — INVALID_FILTER or-not-array `path` (L58): → `path=''`.
- **DYN-ERR-7 · T2** — INVALID_FILTER **top-level non-object** `value`+`path` (L39): `withValues('not-an-object' as any)` → `value='not-an-object'`, `path=''`.
- **DYN-ERR-8 · T2** — INVALID_FILTER **top-level Date** `value`+`path` (L39 Date arm): `withValues(new Date(...) as any)` → `value`=Date, `path=''`.
- **DYN-ERR-9 · T2** — UNKNOWN_OPERATION **`name`** field (L155): `{ id: { bogusOp: 1 } }` → `name='bogusOp'`. grep: no `.name).toBe` / `errorReason.name` in the dynamic-condition files.
- **DYN-ERR-10 · T2** — UNKNOWN_OPERATION `name` on the **aggregated-array** arm: `{ titles: { equals: 'x' } }` (agg col) → `name='equals'`.
- **DYN-ERR-11 · T2** — `processAdditionalColumnFilter` non-ValueSource arm (L210): object-of-rules extension whose leaf returns a non-value-source → assert `reason=INVALID_EXTENSION_RETURN_TYPE`, `path='id.idRules'`, `rule`. Entirely uncovered.
- **DYN-ERR-12 · T3** — `processAdditionalColumnFilter` non-boolean arm (L219): extend the existing message-only test to also assert structured `path='id.idRules'` + `rule`.
- **DYN-ERR-13 · T3** — pair DYN-ERR-9/10 with the direct-throw control (unknown op on a value-source column) to prove parity of the `name` field across the two throw sites.

## B. Direct-fluent equality/comparison (F1-EQCMP) — file: `select.value-source.equality-comparison-by-type.test.ts`
Distinct emission token + deterministic id-row set; all const-operand fills on existing fixtures.

- **EQ-1 · T3** — customDouble `lessOrEqual`: `billedAmount.lessOrEqual(50)` → `<= $1`, rows `[{id:2}]`.
- **EQ-2 · T3** — customDouble `greaterOrEqual`: `billedAmount.greaterOrEqual(200)` → rows `[{id:1},{id:3}]`.
- **EQ-3 · T3** — string `notBetween`: `title.notBetween('a','m')` → `not between $1 and $2`.
- **EQ-4 · T3** — string `in([...])`: `title.in(['Fix login','Refactor'])` → `in ($1,$2)` (the ONLY leaf with zero membership coverage).
- **EQ-5 · T3** — string `inN`: `title.inN('Fix login')` → `in ($1)`.
- **EQ-6 · T3** — string `notIn([...])`: `title.notIn([...])` → `not in (...)`.
- **EQ-7 · T3** — localDateTime `lessThan`: `createdAt.lessThan(new Date(Date.UTC(...)))` → `< $1`.
- **EQ-8 · T3** — localDateTime `greaterThan`: `createdAt.greaterThan(dt)` → `> $1`.
- **EQ-9 · T3** — customLocalDateTime `lessOrEqual`: `signedOffAt.lessOrEqual(dt)` → `<= $1`, rows `[{id:1}]`.
- **EQ-10 · T3** — localDateTime ordered comparison with a **value-source operand** (no `localDateTime-ordered-value-source-operand` test exists): `createdAt.lessThan(otherLocalDateTimeCol)`.
- **EQ-11 · T3** — customLocalDateTime `lessOrEqual` **value-source operand** (only `<`/`>` covered for that operand kind).
- **EQ-12..EQ-21 · T4** — `notInN` per-leaf (variadic sibling of `notIn`, identical `not in (...)` SQL but per-leaf param encoding): `bigint, double, customInt, customDouble, string, customUuid, localDate, localTime, localDateTime, customLocalDateTime` (10 items).
- **EQ-22..EQ-24 · T4** — `inN` per-leaf: `customUuid, customComparable, localTime` (3 items).

## C. Temporal getters (F1-TEMP) — file: `select.value-source.const-temporal-getters.test.ts`
Column-receiver arm is 100% covered; these fill the const-cast (`$N::type`) arm + chained modifiers.

- **TEMP-1 · T3** — const `localTime.getMilliseconds()` → `extract(millisecond from $N::time)::integer % 1000`.
- **TEMP-2 · T3** — const `localDateTime.getDate()` → `extract(day from $N::timestamp)`.
- **TEMP-3 · T3** — const `localDateTime.getDay()`.
- **TEMP-4 · T3** — const `localDateTime.getMinutes()`.
- **TEMP-5 · T3** — const `localDateTime.getSeconds()` → `...::integer`.
- **TEMP-6 · T3** — const `localDateTime.getMilliseconds()` → `...::integer % 1000`.
- **TEMP-7 · T3** — chained getter after `valueWhenNull`: `workDate.valueWhenNull(d).getMonth()` → `extract(month from coalesce(work_date,$1)) - 1` (proves the modifier returns the temporal leaf).
- **TEMP-8 · T3** — chained getter after `nullIfValue`: `workDate.nullIfValue(d).getMonth()`.
- **TEMP-9 · T3** — chained getter after `asRequiredInOptionalObject`: `reviewDate.asRequiredInOptionalObject().getMonth()`.
- **TEMP-10 · T3** — chained getter after `onlyWhenOrNull`: `startedAt.onlyWhenOrNull(true).getHours()`.
- **TEMP-11 · T3** — chained getter after `ignoreWhenAsNull`: `startedAt.ignoreWhenAsNull(false).getHours()`.
- **TEMP-12 · T4** — same chained-modifier getters on the **customLocalDateTime** leaf (`signedOffAt.valueWhenNull(d).getFullYear()`), one per modifier where distinct.

## D. Connection API (F5-CONN) — files: `fragments.*`, `sequence.*`
- **CONN-1 · T3 (§B-fixture)** — `valueArg('bigint')` req+opt: add a `bigintValueEq` fragment over `tIssueWorklog.durationMs`; assert `duration_ms = $1` + bound bigint param.
- **CONN-2..CONN-16 · T4** — `sequence(<kind>)` per still-unfixtured value kind (identical `nextval`/`currval` SQL, distinct type-adapter marshalling): `double, string, uuid, boolean, localDate, localTime, localDateTime, enum, custom, customComparable, customUuid, customDouble, customLocalDate, customLocalTime, customLocalDateTime` (15 items; mock-only for the non-numeric kinds — a DB sequence is numeric, so mark them mock-asserted).
- **CONN-17 · T4** — `valueArg('uuid')` (runtime-identical to string but distinct typeName; `arg('uuid')` is covered via `coalesceUuid`, the valueArg twin is not).
- **CONN-18..CONN-22 · T4** — `rawFragment` at arities 3,4,5,6,7 (variadic `__params` forwarder; only 0–2 covered).
- **CONN-23..CONN-25 · T4** — `createTableOrViewCustomization` at P3,P4,P5 (variadic `...params`; P0/P1/P2 covered).

## E. §B custom-temporal placeholder (F5-CONN §B / F1-TEMP §B-1) — needs a fixture, see Part IV
- **CTP-1..CTP-6 · T2 (§B)** — `arg`/`valueArg` over `customLocalDate` / `customLocalTime` / `customLocalDateTime` (6 items) — require a custom-aware `transformPlaceholder` on the domain `DBConnection`.
- **CTP-7 · T2 (§B)** — const custom-temporal getter `const(d,'customLocalDate','ReleaseDay').getMonth()` real-DB-validatable once CTP fixture lands. (By-design limitation until then — see Part IV.)

## F. Insert on-conflict (F4-INSERT / MUT-SEAM) — files: `insert.on-conflict.*`, `customize-query.insert.test.ts`
- **INS-1 · T2** — `onConflictOn(cols).where(pred).doNothing()` (PG/SQLite): `... on conflict (organization_id, slug) where archived_at is null do nothing`. grep: `on conflict … where … do nothing` → 0 matrix-wide (the `do update` counterpart has 51).
- **INS-2 · T2** — `onConflictOn(cols).dynamicWhere(...).doNothing()` (PG/SQLite).
- **INS-3 · T2** — `insert…from(select).onConflictOn(cols).where(pred).doNothing()` (PG/SQLite).
- **INS-4 · T2** — `onConflictOnConstraint(name).doUpdateSet(...).returningOneColumn(...)` (PG-family): `on conflict on constraint <name> do update set … returning …`.
- **INS-5 · T2** — `onConflictOnConstraint(name).doUpdateSet(...).returning({...})` (PG-family).
- **INS-6 · T2** — `onConflictOnConstraint(name).doNothing().returning({...}).executeInsertNoneOrOne()` (the optional/None arm, PG-family).
- **INS-7 · T2** — `onConflictOnConstraint(name).doUpdateSet(...).customizeQuery({ afterInsertKeyword })` (PG-family).

## G. Select fluent + compound seams (F3-SELECT / SEL-SEAM) — files: `marshalling.transform-validation.test.ts`, `select.one-column-and-count.test.ts`, `select.compound.test.ts`
- **SEL-1 · T2** — `executeSelectMany` per-row MANDATORY error carries `rowIndex` + `columnPath`: `mockNext([{title:'ok'},{title:null}])` → `rowIndex=1`, `columnPath='title'` (mock-only; `columnPath` asserted nowhere in the suite).
- **SEL-2 · T2** — optional one-column `executeSelectMany` null-element array: `selectOneColumn(tIssue.body).executeSelectMany()` → `Array<string|null>` containing `null` (real-DB via seeded null body).
- **SEL-3 · T2** — compound insensitive-order-by **wrap × limit/offset**: `union(...).orderBy('label','asc insensitive').limit(2).offset(2)` → `select * from (…) as o_1_ order by lower(label) asc limit $ offset $` + a real 2-row slice.
- **SEL-4 · T2** — compound value-source order-by wrap × limit: `union(...).orderBy('label').orderBy(const(1,'int')).limit(2)` → `… as o_1_ order by label, $ limit $`.
- **SEL-5 · T2** — compound wrap × `executeSelectPage` (wrap on the data query + `result_for_count` on the count query).
- **SEL-6 · T3** — compound **arm** parenthesised by its own `customizeQuery({beforeOrderByItems})` hook: `selectFrom(t).select({...}).customizeQuery({beforeOrderByItems: frag}).union(other)` → `(select … order by <frag>) union …`.
- **SEL-7 · T3** — grouped `forUseAsInlineAggregatedArrayValue` select carrying **both** `groupBy` and `orderBy` (the ordering rides inside the `(select … group by … order by …) as a_1_` derived table).

## H. Values / View source dispatch (F2-VALVIEW) — file: `with-values.join-and-subquery.test.ts`
- **VV-1 · T2** — a `Values` source fed to `forUseInQueryAs('sub')`: `with <name>(...) as (values …)` hoisted above `select … from (select … from <name>) as sub`.
- **VV-2 · T3** — a `View` source fed to `forUseInQueryAs('sub')` (the derived-table WITH-hoist position never asserted with a View source).
- **VV-3 · T4** — required-raw-read of `vReleaseOverview.publishStampPlain` (plain localDateTime) as a direct `{ x: view.publishStampPlain }` Date projection (currently only via fluent getters).
- **VV-4 · T4** — required-raw-read of `vReleaseOverview.publishStamp` (customLocalDateTime) as a direct Date projection.

## I. Complex-projection miss-row boundaries (F3-PROJ) — file: `select.complex-projection.mixed-rules.test.ts`
- **PROJ-1 · T1 (BUG-2, TODO[BUG])** — rule-2 const-leaf object, **MISS** row, default projector: `mockNext({iid:1,'proj.name':null,'proj.tag':'rel'})` → assert the sound expectation (`proj` dropped) so it FAILS and marks the bug.
- **PROJ-2 · T1 (BUG-2, TODO[BUG])** — same, `projectingOptionalValuesAsNullable()`.
- **PROJ-3 · T2** — rule-3 required-container (own-required + left-join leaf) MISS, default: `mockNext({iid:1,'mix.ownId':1,'mix.projName':null})` → `'mix' in row`, `'projName' in row.mix === false`.
- **PROJ-4 · T2** — same, nullable projector → `row.mix.projName === null`.
- **PROJ-5 · T2** — rule-4 two-different-left-joins **full miss**, default: both null → `'obj' in row === false`.
- **PROJ-6 · T2** — same, nullable → `obj: null`.
- **PROJ-7 · T2** — rule-4 two-different-left-joins **partial miss**, default: one null one present → `obj` present as `{projName:'x'}`, `'orgName' in row.obj === false` (exercises source-set discrimination, the strongest of the four).
- **PROJ-8 · T2** — same, nullable projector.
- **PROJ-9 · T3** — rule-1 three-optionality-kinds object: demoted originally-required left-join leaf **miss** while the rule-1 container is present (absent, default).
- **PROJ-10 · T3** — same, nullable (leaf null while container present).

## J. String masked-branch escaping (F1-STR) — file: `select.where.like-escape-literal.test.ts`
- **STR-1 · T1** — literal-escape sub-branch fed `\` and `[`: `email.contains('a\\b[c')` → per-dialect params (pg/sqlite `a\\b[c`; **mysql/mariadb `a\\\\b[c`** — the quadruple-backslash override, ZERO coverage; oracle/sqlserver `a\b[[]c`). grep: no backslash/bracket literal in any affix-predicate test.
- **STR-2 · T1 (BUG-1, TODO[BUG])** — positive-match test: insert a row with a literal `_` in `email`, assert `startsWith`/`contains` MATCHES it (fails on SQL Server/Oracle until the `_`→`[_]` fix; carry `// TODO[BUG]`).
- **STR-3 · T3** — the same `\`/`[` literal-escape fed to `startsWith` and `endsWith` (beyond the canonical `contains`), one per predicate, to prove the shared escape fires on each affix arm.
- **STR-4 · T4** — insensitive affix predicates fed a wildcard literal (`startsWithInsensitive('50%_x')`, … the 5 not-yet-covered insensitive affixes).
- **STR-5 · T4** — `*IfValue` affix predicates fed a wildcard literal (the affix IfValue twins beyond the covered `containsIfValue('50%_x')`).

## K. Custom-numeric cross-table emission (F1-CUSTOMNUM) — file: `select.value-source.numeric-operand-coverage.test.ts`
Distinct qualified emission (`coalesce(t1.x, t2.x)`) vs the covered same-column `coalesce(x,x)`; the value-side is compile-only-locked but the EMISSION is distinct.

- **CNUM-1 · T4** — customInt `valueWhenNull` cross-table operand: join `worklog2`, `costCents.valueWhenNull(worklog2.costCents)` → `coalesce(issue_worklog.cost_cents, worklog2.cost_cents)` + value.
- **CNUM-2 · T4** — customInt `nullIfValue` cross-table: → `nullif(...)`.
- **CNUM-3 · T4** — customDouble `valueWhenNull` cross-table (`billedAmount`).
- **CNUM-4 · T4** — customDouble `nullIfValue` cross-table.

## L. Update disallow Error-overload (F4-UPDDEL) — file: `update.shaped-disallow.test.ts`
- **UPD-1..UPD-4 · T4** — the `Error`-instance runtime arm of the 4 disallow methods not yet exercised with an Error object (only `disallowIfValue` is): `disallowIfSet`, `disallowIfNotSet`, `disallowIfNoValue`, `disallowAnyOtherSet` each passed an `Error` instance → `expect(caught).toBe(sentinel)` (rethrow-as-is). Byte-identical shared branch but distinct declared overload per method.

## M. Column-factory completeness fan-out (F2-COL) — files: various `select.*` / `insert.*`
The factory-flag axis and the kind-marshalling axis are each covered; the cross-product is byte-identical through `DBColumnImpl`. Listed per the "every variant" standard as **lowest-priority regression-locks** (each adds a fixture column + one assertion; no NEW coverage, so optional — but enumerated so a future round does not re-surface them):

- **COL-FAN · T4** — for each factory in `{columnWithDefaultValue, optionalColumnWithDefaultValue, primaryKey, virtualColumnFromFragment, optionalVirtualColumnFromFragment}` × each kind not yet paired with it (`uuid, bigint, double, boolean, localDate, localTime, localDateTime, enum, custom, customComparable, customUuid, customDouble, customLocalDate, customLocalTime, customLocalDateTime`), a fixture column + a read/emission assertion. Bound this fan-out explicitly if implemented (≈ 5 factories × ~10 uncovered kinds ≈ 50 potential columns) — recommend implementing only where a kind is NOT already read through some factory (most reduce to zero new coverage; the implementer should skip a combo whose (SQL, value, type) matches an existing test and record the count skipped).

## N. Numeric direct-call completeness (F1-NUM) — file: `select.numeric-ops.test.ts`
- **NUM-1..NUM-5 · T4** — direct `intCol.ceil()/floor()/round()/logn(k)/roundn(k)` without a `.divide()`/`.power()` prefix (same wrapper + result type as the covered prefixed forms; distinct call site, identical SQL). One per method.
- **NUM-6 · OUT** — `intCol.add/subtract/multiply/minValue/maxValue(fractional-literal)`: byte-identical bare-`$N` emission to the integer-literal form (only `modulo`/`divide` cast, both covered) → do NOT write (see Part III).

---

# PART III — Genuinely OUT (considered, do NOT write — with reason)

- **Compile-only source-tracking** (9125b88f / 8d4585c2 `SOURCE|VALUE` on valueWhenNull/nullIfValue/add/…): the value-side is locked in `types.negative/select.test.ts`; the fix's changelog says SQL/values unchanged. Only the CNUM-1..4 *emission* is worth writing (Part II.K); the type-side is negative-territory.
- **Brand keep/erase pure locks** with byte-identical SQL+value (non-union brands): negative-type only. Union brands (enum/customComparable) already covered.
- **`ignoreIfHasValue` param-type divergence (C2)**: negative-type rejection only.
- **`NumberValueSource.add/…(fractional-literal)`** (NUM-6): byte-identical emission.
- **Driver-layer `TsSqlErrorReason`**: all `SQL_*`, transaction-runner reasons, `ONLY_ONE_COLUMN_EXPECTED`, `OUT_PARAMS_NOT_SUPPORTED`, `INVALID_MOCKED_VALUE`, `UNSUPPORTED_DATABASE`, and as-any-only INTERNAL subtypes — `src/queryRunners/` / impossible state.
- **`UNSUPPORTED_QUERY`** builder arm: needs `compatibilityVersion < 8_000_000`, no such matrix cell ("no new cells").
- **Non-existent APIs** (do not attempt — grep-confirmed absent in `src/`): `newValues()`, `asOptionalNonNull`, `split()` projection, `selectFromModel`, `onConflictDoNothing(cols)` (use `onConflictOn(cols).doNothing()`), `protectedColumnsForInsertOrUpdate`.
- **`sequence` date/uuid/bool kinds** (CONN-2..16): real-DB sequences are numeric — those kinds are mock-only (listed in Part II as T4 but flagged mock-asserted; do not attempt a real-DB value assertion).

# PART IV — §B fixture-addition plan

1. **Custom-aware `transformPlaceholder` on the domain `DBConnection`** (unblocks CTP-1..7). Override `transformPlaceholder` to cast the custom-temporal typeNames (`ReleaseDay`→date, `CutoffClock`→time, `SignOffStamp`/`PublishStamp`→timestamp) analogously to `baseTypeForCustom`. Then add the 6 `arg`/`valueArg` custom-temporal fragment fixtures + the const-getter test. **Note:** by-design limitation today (the placeholder cast is the user's responsibility); the MECHANISM is already covered three ways (per-column adapter, `ForceTypeCast`, connection-level `DefaultTypeAdapter`) — so this is optional/limitation-flavored, but if implemented it converts CTP-1..7 from mock-only to real-DB-validatable.
2. **`bigintValueEq` fragment** over `tIssueWorklog.durationMs` (unblocks CONN-1).
3. **A left-join-miss-friendly `tProjectRelease`/`tOrganization` chain** already exists for PROJ-1..10 (no new fixture).
4. Any COL-FAN columns actually implemented require their DB column in `domain/schema.sql` + `seed.sql` per dialect (see `project_domain_extension_gotchas`); recommend a single new "kind-sampler" table rather than rippling existing tables.

# PART V — Per-surface saturation table

| Agent | Theme verdict | Enumerated tests (Part II) | §B |
|---|---|---|---|
| F-RECENT | tail | DYN-ERR-1..13 (13) | 0 |
| F1-EQCMP | tail | EQ-1..24 (24) | 0 |
| F1-TEMP | tail | TEMP-1..12 (12) | 1 (CTP-7) |
| F5-CONN | tail | CONN-1..25, CTP-1..6 (31) | 6 |
| F4-INSERT + MUT-SEAM | tail | INS-1..7 (7) | 0 |
| F3-SELECT + SEL-SEAM | tail | SEL-1..7 (7) | 0 |
| F2-VALVIEW | tail | VV-1..4 (4) | 0 |
| F3-PROJ | **BUG** + tail | PROJ-1..10 (10) | 0 |
| F1-STR | **BUG** + tail | STR-1..5 (5) | 0 |
| F1-CUSTOMNUM | "saturated" + T4 tail | CNUM-1..4 (4) | 0 |
| F4-UPDDEL | "saturated" + T4 tail | UPD-1..4 (4) | 0 |
| F2-COL | "saturated" + T4 fan-out | COL-FAN (bounded ≈50) | per-column |
| F1-NUM | "saturated" + T4 tail | NUM-1..5 (5) | 0 |
| PARITY / F6-DYN / F1-BOOLIF / F9-TYPEVAR / F7-EXTRAS | SATURATED | 0 (verified — see §6) | 0 |

**~180 canonical items × applicable cells** = the produced-test count. The five
truly-saturated surfaces (PARITY, F6-DYN, F1-BOOLIF, F9-TYPEVAR, F7-EXTRAS) yielded
no enumerable tail with a runtime surface — their §C were all compile-only or
already-covered (documented in §6 REFUTED below), so they are correctly empty here.

# PART VI — Coordinator verification notes

- **BUG-1** — docker probes into the sqlserver + oracle newest cells; both returned `matched:[]` for the literal-underscore predicate while a wildcard-free control matched both inserted rows. Probes deleted; tree clean.
- **BUG-2** — mock probe in pg comparing the const-leaf object vs a pure rule-2 control on a MISS; candidate kept `{tag:'rel'}` (name absent), control dropped. Probe deleted.
- **C1** — confirmed by direct read of `DynamicConditionBuilder.ts` L50/L58/L96.
- **Non-existent APIs** — grep-confirmed absent (`newValues`, `asOptionalNonNull`, `split`, `selectFromModel`, `onConflictDoNothing(cols)`, `protectedColumnsForInsertOrUpdate`).
- **Saturation spot-checks** — F2-COL outer-product argument, F1-NUM modulo emission, F1-BOOLIF masked branches each re-run through the §4/§7-item-5 discriminator.
- **Env** — `tests:index` OOMs at the default ~4 GB heap on node 26; rebuilt with `NODE_OPTIONS=--max-old-space-size=12288`.

# PART VII — REFUTED (covered — evidence, so no re-chase)

- baseTypeForCustom VALUES round-trip (F2-VALVIEW) — value-asserted in `with-values.advanced`/`.kind-coverage`.
- 78bb0539 Oracle boolean-from-numeric-string (F-RECENT) — `marshalling.transform-validation`.
- `fromRef` left-join overload (F7-EXTRAS) — `types.type-edges`.
- Full brand keep/erase runtime surface (F9-TYPEVAR, F1-CUSTOMNUM) — `select.brand-through-structure` + `brand-survival-*`.
- Optionality algebra opt×opt / req×opt / left-join-through-operator (F9-TYPEVAR) — `select.value-source.optionality-algebra`.
- Every builder-reachable `TsSqlErrorReason`, TypeAdapter hook, `extras/*` symbol, PG config flag (F7-EXTRAS) — enumerated covered.
- The dynamic operator×type grid, both descriptor + VSM paths, IfValue elision twins, pick/orderBy-from-model, extension error paths (F6-DYN) — `dynamic-condition.equivalence` (~40 dispatches) + siblings.
- `_or`/`_and` parenthesising arms, `_negate`, neutral-reduction, custom-boolean combinators, all 28 `*IfValue` elision pairs (F1-BOOLIF).
- ~30 structural twin pairs, all repaired-twin families runtime-exercised (PARITY).

# PART VIII — Recommended implementation order

1. **Bugs first**: file+mark PROJ-1/2 and STR-2 (`// TODO[BUG]`), so the suite records BUG-1/BUG-2.
2. **T1 non-bug**: STR-1 (masked-branch escape; the mysql quadruple-backslash arm is entirely unvalidated).
3. **T2**: DYN-ERR-1..13, INS-1..7, SEL-1..7, VV-1..2, PROJ-3..8, CTP-1..6 (with the §B fixture).
4. **T3**: EQ-1..11, TEMP-1..11, VV-3..4, PROJ-9..10, SEL-6..7.
5. **T4 completeness tail** (churn, lowest priority, but implement to reach saturation): EQ-12..24, TEMP-12, CONN-2..25, CNUM-1..4, UPD-1..4, NUM-1..5, then the bounded COL-FAN (skipping any combo whose (SQL,value,type) matches an existing test, and recording the skip count).

# PART IX — Verdict

A high-maturity round that still paid: 2 verified `src/` defects (one docker-confirmed
on two engines, one mock-confirmed soundness violation) plus an **exhaustive backlog of
~180 canonical tests** spanning Tiers 1–4. The tail is intentionally not collapsed into
themes — implementing all of Part II (plus the §B fixtures in Part IV) is designed to
exhaust the reachable typed surface so subsequent audit rounds surface only genuinely-new
src changes, not residual completeness. Genuinely-OUT items are enumerated in Part III
with reasons so they are never re-chased.
