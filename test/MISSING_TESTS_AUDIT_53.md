# MISSING_TESTS_AUDIT_53 — type-driven missing-tests audit (Round 53)

**Family:** TYPE_AUDIT (missing-tests). Runbook: [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md).
**Matrix:** 17 cells / 249 files / **4049 tests per cell** (symmetric — `tests:audit` green).
**Method:** maximal-saturation dial, **pruned roster** per the R52 scoping decision (§6 / R52 Part IV-b).
10 discovery agents in 2 waves (≤6 concurrent, post-OOM discipline) + coordinator verification
owning every `--docker`/probe serially. Reference cell `test/db/postgres/newest/pg/`.

## Headline

- **1 confirmed `src` defect → [`BUGS.md`](./BUGS.md): C1** — SQL Server `replaceAll` /
  `replaceAllInsensitive` on a `uuid.asString()` receiver emit `<uniqueidentifier> collate <name>`,
  which T-SQL rejects (*"Expression type uniqueidentifier is invalid for COLLATE clause"*).
  **Docker-confirmed on real SQL Server.** This is the sibling the `523a2673` uuid-string fix
  left out (it wrapped every string *function* but not the two `collate`-forcing `replace` branches).
- **1 candidate REFUTED by probe: C2** — `equalsInsensitive`/`likeInsensitive` on a `uuid.asString()`
  emit `lower(external_ref)` (bare `uniqueidentifier`). Traced as a suspected reject; **real SQL Server
  ACCEPTS `lower(<uniqueidentifier>)`** (implicit conversion for a string-function argument). Not a bug.
  (probe > trace: the fine distinction — function-arg implicit-convert works, `COLLATE` on a uuid does
  not — is invisible without the engine.)
- **The two `523a2673` fixes are otherwise COMPLETE and CORRECT.** The Oracle temporal-RETURNING fix
  was docker-verified: **RETURNING marshals identically to SELECT** for the previously-untested DATE
  branch (localDate → `DB_TYPE_DATE`) *and* the TIMESTAMP branch. The SqlServer uuid fix covers every
  string *function* it targeted; only the two `collate` branches (C1) were missed.
- **The R52 backlog (+54 → 4049) landed clean.** Baked-in scan found **0** type-vs-value contradictions;
  the two Tier-1 clusters (RET DML-returning `k?:T`; MM minmax both-optional poison CASE) are correct
  across all dialects. Both R52 doc-hygiene items (LIMITATIONS:111 aggregate note; custom-numeric header)
  were already fixed by the maintainer.
- **Every KEEP surface re-verified SATURATED** post-implementation (collation/config, temporal getters,
  string ops, aggregate, deep projector, result-type/value algebra). The pruned EXCLUDE roster held
  (`523a2673` touched no EXCLUDE trigger).
- **Round §A tail: coverage-only completeness** (all real-validatable, none blocking): SqlServer uuid
  string-method fan-out; Oracle temporal×RETURNING×mutation fan-out; INSERT `returningOneColumn`
  value-gate twins; `.collate()` as a compound ORDER BY term; a scalar-aggregate-in-nested-object seam;
  the adapter-through-recursive-CTE round-trip (probed green).

Verdict up front: **1 real bug (C1), 0 false positives filed, target essentially reached** — see Part VIII.

---

## Part I — verification of the two `523a2673` fixes, the +54 backlog, and the clusters

`523a2673` ("Fix some uuid string management in sql server, fix localDate/localTime/localDateTime
column back through RETURNING") is the **only** `src` change since R52 (HEAD `3b10a89c`). It touched
`src/sqlBuilders/SqlServerSqlBuilder.ts`, `src/sqlBuilders/OracleSqlBuilder.ts`,
`src/queryRunners/OracleDBQueryRunner.ts`. (`d61c5c43` = the R52 backlog +54, test-only;
`3e268558` = collation-test consolidation + `runners.ts` infra, test-only.)

### I.1 — SqlServer uuid-string fix: COMPLETE except the two `collate` branches (C1)

The fix added `_toLowerCase`/`_toUpperCase`/`_reverse` overrides and routed `_length` (both `len(...)`
forms) through `_appendSqlMaybeUuid`. Enumerating **every** `StringValueSource` method reachable on
`uuid.asString()` (`__uuidString`):

- **uuid-converted / safe** (via `_appendSqlMaybeUuid` or an explicit uuid arm): trim/trimLeft/trimRight,
  toLowerCase/toUpperCase, reverse, length, substr/substring/substrToEnd/substringToEnd, concat/concatIfValue
  (both operands), stringConcat/stringConcatDistinct (`string_agg`), valueWhenNull (both operands).
- **safe WITHOUT convert** (`uniqueidentifier LIKE`/`=` valid on T-SQL — proven by the insensitive-affix
  uuid arm emitting bare `receiver like pattern`, and **docker-confirmed** — see C2): the sensitive affix
  predicates (startsWith/endsWith/contains/like/notLike), the six `*Insensitive` affix predicates
  (explicit `_isUuid` arm), `equalsInsensitive`/`notEqualsInsensitive`/`likeInsensitive`/`notLikeInsensitive`
  (→ `lower(<uuid>)`, **accepted** by SQL Server), nullIfValue (`nullif` comparison).
- **NOT safe → C1 (confirmed bug):** `replaceAll` (default `replaceCollation` branch →
  `replace(external_ref collate Latin1_General_BIN2, …) collate DATABASE_DEFAULT`) and
  `replaceAllInsensitive` (its `collate` branch, latent — fires only when `insensitiveCollation` is set).
  Neither converts the uuid receiver before applying `collate`. **Docker probe (real SQL Server):**
  `replace(external_ref collate Latin1_General_BIN2, @0 collate …, @1) collate DATABASE_DEFAULT`
  → `SQL_UNKNOWN: Expression type uniqueidentifier is invalid for COLLATE clause.` The
  `replaceAllInsensitive` **default** (unset `insensitiveCollation`) branch `replace(external_ref, @0, @1)`
  **succeeds** (returns the uuid) — so `replace(<uuid>, …)` implicitly converts fine; the defect is
  **only** the `COLLATE`-on-uniqueidentifier clause. → filed as **C1** in `BUGS.md`.

### I.2 — Oracle temporal-RETURNING fix: COMPLETE and CORRECT (docker-verified)

Trace (confirmed by reading): `addOutParam` has **two** callsites, both in `OracleSqlBuilder` (the
`__idColumn` returningLastInsertedId path and the object/scalar `_buildQueryReturning` path), and **each
immediately calls `_registerOutBindColumnType`**; `OracleDBQueryRunner.resolveOutBindTypes` maps all six
temporal kinds (localDate/customLocalDate → `DB_TYPE_DATE`; localTime/customLocalTime/localDateTime/
customLocalDateTime → `DB_TYPE_TIMESTAMP`). All RETURNING shapes (object / scalar `returningOneColumn` /
idColumn) and all mutations (INSERT incl. multi-row + on-conflict; UPDATE; DELETE) funnel through it.

**Probe (real Oracle) — the fix's contract is "RETURNING == SELECT":** inserted `review_date` (localDate,
the previously-untested DATE branch) + `review_time` (localTime) with RETURNING, then SELECT-ed the same
row. Result: `date_returning_matches_select: true`, `time_returning_matches_select: true`. The DATE branch
marshals correctly (returns a `Date`, no `INVALID_VALUE`). The commit's un-commented tests only covered
localDateTime object-RETURNING on INSERT+UPDATE, and they assert only `toBeInstanceOf(Date)` (never the
value), so the DATE branch was genuinely unexercised — but it works. All §A below (Part II.2) are
coverage-only.

> **Observation (out of scope, noted for the maintainer / a future SEMANTIC_AUDIT):** on the Oracle cell a
> `localDate` inserted at UTC-midnight reads back as `…T10:00:00Z` on **both** RETURNING *and* SELECT
> (identical) — a pre-existing Oracle-session-tz representation of a date-only value, **not introduced by
> this fix** and preserving date-only semantics (the localDate getters ignore the time component). Flagged
> only because it means a value-shift would slip past the existing `instanceof Date`-only assertions.

### I.3 — Baked-in scan of the +54 (commit `d61c5c43`) — 0 contradictions

Diffed every freshly-added test's `assertType<Exact>` against its `toEqual`/`toMatchInlineSnapshot`/`'k' in obj`
across all 16 KEEP-surface files (+ SqlServer/Oracle spot-checks). **No type-vs-value contradiction anywhere.**

- **RET cluster — correct across all dialects.** DML-RETURNING with a nested optional container holding an
  optional leaf types `{ id: number; meta?: { archivedAt?: Date } }` — optional KEY `?:` on both container
  and leaf, no present-key `| undefined`, no spurious `| null`; boundary rows assert `'meta' in row` +
  `'archivedAt' in meta` correctly (verified in pg, mssql, oracledb insert/update/delete).
- **MM cluster — correct incl. dialect divergence.** Both-optional minValue/maxValue emits
  `case when a is null or b is null then null else greatest/least(a,b) end` (PG + SqlServer) and types the
  result `mn?: number`; single-guard and both-required forms consistent; **Oracle correctly emits bare
  `greatest/least`** (native NULL propagation) — internally consistent.
- **Doc-hygiene nit (maintainer's call, NOT a test/code change):** the 4 Oracle MM tests carry narration
  comments inherited verbatim from the PG version that still describe a poison CASE Oracle correctly omits.
  Comment-only self-containment nit (per the repo's "comments describe own cell" guidance).

### I.4 — R52 doc-hygiene: both items already resolved by the maintainer

- `LIMITATIONS.md:111` now correctly states aggregates **are** flagged (`NAggregate` brand survives `.add()`,
  "no brand-drop residual") — the stale "aggregates not flagged" text is gone.
- `custom-numeric.test.ts` header now says Meters/Ratio/Score **are** marshalled via `baseTypeForCustom`.

### I.5 — Re-confirmed type-only NON-bugs (NOT re-filed)

- **CAND-A** — `update.ts:532` sqlite stray `| NOldValuesFrom` outside `ValueSourceOf` — present, benign.
- **CAND-F** — `values.ts:253` `isIfValue` safe over-widen.
- **`disallowIfNoValueWhen` MISSING_KEYS divergence** — correct-by-design (`*When` sound under `when===false`).
- **`extendShape` on the shaped on-conflict node drops `& NEXT`** (`insert.ts:826`) — **by-design**: every
  `extendShape` in `insert.ts` returns a de-executed state on purpose (the conflict node achieves it by
  dropping `& NEXT` since on-conflict update-columns track no `MISSING_KEYS`). New addition to the
  don't-re-file list (a negative-type lock is offered as PARITY-53-A below).
- **SEL-SEAM C-1** (`beforeWithQuery`/`afterWithQuery` no-op on a directly-executed plain/compound select)
  — **CLOSED as a covered NOT-APPLICABLE boundary** (pinned on both sides:
  `customize-query.select.test.ts:933`, `customize-query.compound.test.ts:487`).
- **aggregate-of-aggregate rejection** — premise refuted: `sum(sum(x))` legitimately type-checks (the inner
  aggregate's `SOURCE | NAggregate` is a valid `NSource`); nothing to lock.

---

## Part II — the enumerated §A backlog (by surface; each item real-validatable)

All items are coverage-only (no defect); every emission/engine claim below was coordinator-probed or
grep-verified absent.

### II.1 — SqlServer `uuid.asString()` string-method fan-out (cell `sqlserver/newest/mssql`)

The fix un-wrapped `uuid-as-string-string-methods` (covers length/upper/lower). These siblings each convert
the uuid receiver (safe) but are asserted nowhere — grep-verified 0 occurrences in `test/db/sqlserver`:

- **STR-UUID-1 · T3** — `externalRef.asString().reverse()` → `reverse(convert(nvarchar(36), external_ref))`.
- **STR-UUID-2 · T3** — `.trimLeft()` → `ltrim(convert(nvarchar(36), external_ref))`.
- **STR-UUID-3 · T3** — `.trimRight()` → `rtrim(convert(nvarchar(36), external_ref))`.
- **STR-UUID-4 · T3** — `.substr(...)` (distinct override: negative-start `left(right(…))`).
- **STR-UUID-5 · T3** — `.substrToEnd(...)` (distinct override).
- **STR-UUID-6 · T3** — `.substringToEnd(...)` (distinct override).
- **STR-UUID-7 · T2 (blocked on C1)** — `.replaceAll('a','b')` on a uuid — becomes real-validatable
  (`replace(convert(nvarchar(36), external_ref) collate …, …)`) **once C1 is fixed**; until then it is the
  bug reproduction (`// TODO[BUG]`).
- **STR-UUID-8 · T2 (blocked on C1)** — `.replaceAllInsensitive('a','b')` on a uuid, same.

### II.2 — Oracle temporal × RETURNING × mutation (cell `oracle/newest/oracledb`)

The fix's DATE branch + custom kinds + DELETE + scalar `returningOneColumn` are untested end-to-end (all
**probed/traced green** — coverage-only). The commit covered only localDateTime object-RETURNING on
INSERT+UPDATE. Fixtures: `tIssueWorklog.workDate`(localDate)/`startedAt`(localTime),
`tProjectReview.reviewDate`(localDate)/`reviewTime`(localTime), `tProjectRelease.releasedOn`(customLocalDate)/
`cutoffTime`(customLocalTime)/`signedOffAt`+`publishedAt`(customLocalDateTime), `tProject.archivedAt`(localDateTime).

- **RET-ORA-1..5 · T3** — INSERT object RETURNING of: localDate (A1), localTime (A2 — TIMESTAMP-as-TIME,
  round-trip probed OK), customLocalDate (A3), customLocalTime (A4), customLocalDateTime (A5).
- **RET-ORA-6..10 · T3** — UPDATE object RETURNING of the same five kinds.
- **RET-ORA-11..16 · T3** — DELETE object RETURNING (currently **zero** temporal coverage): localDateTime,
  localDate, localTime, customLocalDate, customLocalTime, customLocalDateTime.
- **RET-ORA-17..19 · T3** — scalar `returningOneColumn(<temporalCol>)` returning a **real** (non-null) value,
  for INSERT / UPDATE / DELETE (the existing scalar test returns null, which marshals regardless).
  *(Coordinator note: A1–A16 may be consolidated into one all-6-kinds object per mutation; listed
  separately per the enumerated-backlog mandate. Priority: the DATE branch (localDate/customLocalDate) and
  the whole DELETE row — neither is exercised today.)*

### II.3 — INSERT `returningOneColumn` value-gate twins (mutation seam)

- **INS-1a · T2** — `ctx.mockNext(1.5); insertInto(t).values(...).returningOneColumn(<required-int col>).executeInsertOne()`
  → `INVALID_VALUE_RECEIVED_FROM_DATABASE`.
- **INS-1b · T2** — `ctx.mockNext(null); …returningOneColumn(<required col>)…executeInsertOne()` →
  `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`.
  Both are the exact structural twins UPDATE and DELETE already carry
  (`update.returning.execute-shapes.test.ts`, `delete.returning.execute-shapes.test.ts`); INSERT lacks both.
  Mock-only by construction (like the twins). Home: `insert.execute-variants.test.ts`.

### II.4 — `.collate()` clause-position (collation surface)

- **COLL-53-A · T2** — `.collate("name")` as an ORDER BY term of a **compound** (UNION/INTERSECT/EXCEPT)
  query. Distinct compound-orderBy emission path (the same path behind the round-43 wrap bug): probes
  `order by <expr> collate <name>` vs alias-referencing/wrapping. grep-confirmed absent. One canonical test,
  propagated.

### II.5 — scalar aggregate nested in a plain object of a grouped select (aggregate × projection seam)

- **AGG-53-A · T3 (marginal)** — `.select({ projectId, stats: { total: conn.count(id), hi: conn.max(assigneeId) } }).groupBy('projectId')`
  → dotted-alias scalar-aggregate emission `count(id) as "stats.total"` (distinct from `json_build_object`
  and from the inline sub-select aggregate); required `count` keeps `stats` (rule-3), optional `max` → `hi?`.
  A pure composition of two saturated axes (no new code branch) — coordinator's discretion; a default+nullable pair.

### II.6 — adapter column round-trip through a recursive CTE (select seam)

- **SEL-53-A · T2 (probed GREEN)** — a value-transforming adapter column read out of a `recursiveUnion*`
  result. **Docker/native probe (better-sqlite3):** `score` (scaledTenthAdapter, DB 850) read out of a
  recursive CTE returns **85** — the adapter survives the two `createColumnsFrom` rebuild hops. The lone
  adapter × special-builder composition with no pin; coverage-only.

### II.7 — negative-type lock for the by-design `extendShape` de-execution (parity)

- **PARITY-53-A · T3 (types.negative)** — a `@ts-expect-error` that
  `…doUpdateDynamicSet(…).extendShape({…}).executeInsert()` (bare, no intervening `set`/`where`) is a type
  error. Pins the intentional de-execution against a future "fix" that re-adds `& NEXT`. Low priority.

---

## Part III — OUT / refuted / §C (degenerate, listed)

**Refuted candidates (evidence recorded so they are not re-chased):**

- **C2** — `equalsInsensitive`/`likeInsensitive`/`notEqualsInsensitive`/`notLikeInsensitive` on
  `uuid.asString()` → `lower(external_ref)` (bare uniqueidentifier). **Docker-refuted:** real SQL Server
  accepts `lower(<uniqueidentifier>)` (the 34 `uuid-*-string-family` tests pass under `--docker
  sqlserver/newest/mssql`). Not a bug; the baked snapshots (`dynamic-condition.equivalence.test.ts:4693`)
  are correct.
- **SEL-53-A defect reading** — refuted (adapter survives the recursive CTE; see II.6). Kept as a green §A.
- **Oracle DATE-branch incompleteness** — refuted (RETURNING == SELECT; see I.2). §A is coverage-only.

**§C / OUT (type-only or no distinct surface):**

- `.collate()` in HAVING / join-ON / inside an aggregate — the identical `(col collate "name")` fragment
  already covered in WHERE/operand/projection; new clause plumbing, no new collate branch → **close as
  redundant** unless an exhaustive position sweep is wanted for its own sake.
- `selectOneColumn(leftJoinedCol)` bare scalar; default-projector MISS for an operator-derived left-join
  leaf; flat-level `requiredInOptionalObject×required` / `originallyRequired×optional` merges — all
  output-coincident with a tested representative (byte-identical SQL + value) → type-only, OUT.
- `replaceAllInsensitiveFunction` (SQLite) SET arm — user-registered UDF, doc-only boundary (intentional).
- aggregate-of-aggregate rejection — no compile rejection exists to lock (runtime DB error, not modeled).

---

## Part IV — per-surface saturation table

| Surface (this round's roster) | Result |
|---|---|
| F-RECENT baked-in scan (+54) | 0 contradictions; RET + MM correct |
| SqlServer uuid-string (src-changed) | **C1 bug** + 8 §A (STR-UUID-1..8) |
| Oracle temporal-RETURNING (src-changed) | fix correct; 19 §A (RET-ORA-1..19, coverage-only) |
| PARITY (permanent) | 0 bugs; 1 §A (PARITY-53-A, negative-type) |
| SEL-SEAM (permanent) | C-1 closed; 1 §A (SEL-53-A, probed green) |
| MUT-SEAM (permanent) | saturated; 2 §A (INS-1a/b) |
| F9-TYPEVAR (permanent) | saturated; 0 §A (1 deferred → F-PROJ / §B) |
| COLL + CONFIG (KEEP re-verify) | knobs saturated; 1 §A (COLL-53-A) |
| AGG + PROJ (KEEP re-verify) | saturated; 1 §A (AGG-53-A, marginal) |
| TEMP + STR non-uuid (KEEP re-verify) | **saturated, 0 residual** |

---

## Part IV-b — EXCLUDE / KEEP / permanent roster (updated for R54)

Pruned fan-out gated on `src` change (§6). `523a2673` touched only SqlServer/Oracle SqlBuilders +
OracleDBQueryRunner — **no EXCLUDE trigger**, so all seven stayed excluded this round (confirmed).

**EXCLUDE (still 0 unique §A; re-arm only if the `src` path changes in pre-flight `git log`):**
`F5-CONN` (`src/connections/*`), `F1-BOOLIF` (`values.ts` bool/if-value + `_and`/`_or`/`_negate`),
`F1-EQCMP` (`values.ts` base method interfaces), `F2-COLVAL` (`Table.ts`/`View.ts`/`Values.ts`),
`F6-DYN` (`src/dynamic/*` + `dynamicConditionUsingFilters.ts`), `F3-SELECT` (`select.ts`/`SelectQueryBuilder.ts`),
`F1-CUSTOMNUM` base (`values.ts` CustomInt/CustomDouble).

**MOVE TO EXCLUDE for R54 (re-verified saturated this round, no src change):** `F-COLL`+`F-CONFIG`
(`src/expressions/values.ts` `.collate`/`replaceAll*` + `*SqlBuilder` collation emission + `ConnectionConfiguration`),
`F-AGG` (`values.ts` aggregate methods + `NAggregate` brand), `F-PROJ-NEW` (`src/complexProjections/*`),
`F1-TEMP` (`values.ts` temporal getters), `TEMP+STR non-uuid` (`values.ts` StringValueSource + emission).
Only their one-line residual §A above remains open; once implemented they carry no live surface.

**KEEP for R54 (open residual, re-verify implemented):** `F1-STR` **uuid arm** — re-arm because `523a2673`
+ the C1 fix touch `SqlServerSqlBuilder` uuid handling; verify STR-UUID-1..8 + the C1 fix land + the
`replaceAll`/`replaceAllInsensitive`-on-uuid tests flip from `// TODO[BUG]` to green. `F1-TEMP` **Oracle-RETURNING
arm** — re-arm (the fix's `OracleSqlBuilder`/`OracleDBQueryRunner` RETURNING path); verify RET-ORA-1..19 land.

**PERMANENT (never excluded):** PARITY, SEL-SEAM, MUT-SEAM, F9-TYPEVAR, and the recently-changed-src agent.

---

## Part V — coordinator verification (the probes, with exact results)

Every load-bearing emission/engine claim was resolved by the coordinator; all probes deleted, tree clean.

1. **C2 (refute) — `--docker sqlserver/newest/mssql --test-name-pattern 'uuid-(dynamic|inline)-string-family'`:**
   34 tests **passed** on real SQL Server → `lower(<uniqueidentifier>)` and `<uuid> = <str>` are valid. C2 refuted.
2. **C1 (confirm) — probe test `externalRef.asString().replaceAll('a','b')` / `.replaceAllInsensitive(...)`
   under `--docker sqlserver`:** `replaceAll` → `replace(external_ref collate Latin1_General_BIN2, …) collate
   DATABASE_DEFAULT` → **`Expression type uniqueidentifier is invalid for COLLATE clause`**;
   `replaceAllInsensitive` (default) → `replace(external_ref, @0, @1)` → **succeeds** (returns the uuid).
   C1 confirmed, scoped to the `collate` branches. Probe deleted.
3. **Oracle DATE-branch (confirm fix) — probe `insertInto(tProjectReview).returning({d: reviewDate, t: reviewTime})`
   then SELECT, under `--docker oracle`:** `date_returning_matches_select: true`,
   `time_returning_matches_select: true`; `d` marshals as a `Date`. Fix correct. Probe deleted.
4. **SEL-53-A (refute defect) — native probe `score` through `recursiveUnion` on `better-sqlite3`:**
   DB 850 → result **85** (adapter preserved). Green. Probe deleted.
5. **Baked-in scan / saturation / reachability** — grep + direct file reads (no index rebuild during fan-out,
   per the OOM lesson).

---

## Part VI — §B fixture additions

- **F9-53-A (deferred)** — the only item needing a fixture: an operator-produced `optional` leaf that
  should flip a nested same-outer-join object from projector rule-2 to rule-4 (demoting the sibling
  `alias.reqCol.add(1)` leaf to optional too — `{ idPlus: number }` vs `{ idPlus?: number; combo?: number }`).
  Needs a left-joined fixture table exposing **both** a required and an optional column combined via an
  operator, and a compile-repro to confirm the rule flip before baking. F-PROJ / seam territory; carry to R54.

No other §A needs a fixture — every item above closes on existing cells + existing `domain/connection.ts`.

---

## Part VII — recommended implementation order

1. **Fix C1** in `src/sqlBuilders/SqlServerSqlBuilder.ts` (route the uuid receiver through the
   convert-to-nvarchar(36) form **before** applying `collate` in both `_replaceAll` and `_replaceAllInsensitive`
   collate branches), then flip STR-UUID-7/8 from `// TODO[BUG]` to green. *(Fixing agent's job; not this audit.)*
2. **T2** — INS-1a/b (INSERT value-gate twins); COLL-53-A (compound-orderBy collate); SEL-53-A (adapter×recursive CTE).
3. **T3** — the SqlServer uuid string-method fan-out (STR-UUID-1..6); the Oracle temporal×RETURNING fan-out
   (RET-ORA-1..19); AGG-53-A; PARITY-53-A negative-type lock.
4. **§B** — F9-53-A after adding the left-joined required+optional fixture (confirm the rule flip first).
5. Optional doc-hygiene — the 4 stale Oracle MM narration comments (maintainer's call).

---

## Part VIII — verdict (honest)

**One real `src` defect (C1), zero false positives filed, and the pruned roster held.** C1 is a textbook
instance of the "a fix per-method that left a sibling out" fingerprint — `523a2673` wrapped every uuid
string *function* but missed the two `replace … collate` branches, and the discriminator (a string function
implicitly converts a uniqueidentifier, but `COLLATE` cannot apply to one) was only visible on the engine.
Probe > trace earned its keep twice: it **refuted** C2 (a plausible `lower(<uuid>)` reject that SQL Server
actually accepts) and **confirmed** the Oracle DATE-branch (RETURNING == SELECT) rather than guessing.

**Are we at total coverage?** Effectively yes. The R52 +54 landed clean and both Tier-1 clusters are
correct; every KEEP surface re-verified saturated; the four permanent seams found no defect of their own
(their value this round was the re-verification + corroborating the src-changed clusters). The §A tail is
pure completeness fan-out (SqlServer uuid siblings, Oracle temporal×RETURNING, one collate position, two
seam pins) — all real-validatable, none surfacing a defect. **After C1 is fixed and the residual §A above
lands, the KEEP list collapses into EXCLUDE (Part IV-b), and R54's fan-out reduces to the permanent
agents + whatever `src` changes next** — the runbook's definition of target reached. The remaining marginal
work is the F9-53-A rule-flip (needs a fixture) and completeness tails, not new risk surface.
