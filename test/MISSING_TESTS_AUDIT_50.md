# MISSING_TESTS_AUDIT_50 — type-driven missing-tests audit (Round 50)

**Mandate.** Maximal-saturation, type-driven, multi-agent audit of the `test/` matrix against the
`src/` type surface. Standard: total coverage of every reachable typed path *and every variant*;
output-coincidence → Tier-4, not closed; OUT only when a distinction has ZERO real-validatable
SQL/params/value surface. Re-derived from CURRENT files; no verdict inherited.

**Method.** Pre-flight (§0.5) + 20 read-only discovery agents (≤10 concurrent, all reported) +
coordinator verification (compile-repro + mock emission/boundary-row probe + direct read). Reference
cell `test/db/postgres/newest/pg/`; matrix symmetric.

**Headline counts.**
- Matrix: **17 cells · 247 files · 3929 tests/cell** (`tests:audit` ✓ symmetric). Up from 3900 — R49 backlog (+29) landed.
- **Both R49 fixes (commit `16e764ee`) verified COMPLETE & SOUND** (recursive-hooks re-home + the big LIKE-emission refactor); R49 backlog baked-in scan **CLEAN**.
- **1 confirmed `src/` bug (compile-repro'd, maintainer-ruled DEFECT → FILED to `BUGS.md`):** §B-1 — `insert.ts:125` Multiple-insert bare `onConflictDoNothing` typed NON-optional (exposes `executeInsertOne`) while every other `doNothing` path drops it. `doNothing` can suppress every row → 0 returned → `executeInsertOne` leads the caller to a runtime error the type didn't warn about. Fix: `:125` → the Optional variant.
- **3 candidate defects PROBED and REFUTED** (probe > trace): SEL-SEAM offset-only (SqlServer injects `order by 1`), MUT-SEAM oldValues×left-join (emission valid, rule-2 drop correct), the LIKE refactor's per-dialect emission (snapshot-preserving + native-validated).
- **Surfaces returning §A=0 (saturated/closed):** F1-EQCMP, F6-DYN, F4-INSERT, F9-TYPEVAR, F1-NUM, F1-CUSTOMNUM, F1-BOOLIF, F2-COL, F7-EXTRAS (+ F1-TEMP/F1-STR positive-saturated).

---

## Part I — Bugs, candidates, fix-verification

### I.0 — Verification of the two R49 fixes (commit `16e764ee`) — both COMPLETE & SOUND

**Recursive-hooks fix (`SelectQueryBuilder.ts` +31).** The ordering/paging `forUseInQueryAs` now
re-homes `afterSelectKeyword`/`beforeColumns`/`customWindow` onto the wrapping CTE
(`customize-recursive-select-projection-only-hooks-render-in-wrapping-cte-with-ordering`, all 17
cells, snapshot + assertType + value consistent). The no-ordering NOT-APPLICABLE boundary is
preserved (recursive member IS the CTE → hooks dropped). The inline consumers never went through the
re-homing and never regressed (they carry the whole `__recursiveSelect`). (F-RECENT)

**LIKE-emission refactor (−179 across 6 builders + `AbstractSqlBuilder` + `SqlBuilder` interface).**
New model: `_likeEscape` config field (default `''`; SQLite/Oracle set `" escape '\'"`), appended to
every affix expression; `_escapeLikeWildcard` signature reconciled to `(value, params, …)` matching
the render-helper convention (the exact fix the R49 F1-STR bug recommended); SQLite/Oracle LIKE
overrides REMOVED (route through the base). **Snapshot-preserving everywhere except the deliberately-
updated Oracle+SQLite insensitive-collation-configured branch** (collate re-parenthesized:
`(:0 collate X) escape '\'` → `:0 collate X escape '\'`). Four agents (F1-STR, F6-DYN, PARITY,
F-RECENT) independently confirmed: dialect-paired (dynamic == direct via `toBe(refSql)`), re-baked with
the correct per-dialect escape suffix, twin-parity clean (no missing/stale override, no arg-swap
survived, all call-sites use the new order, interface consistent), and the previously-dead base
arg-swap is now LIVE-and-correct (SQLite/Oracle reach the base, native-runner-validated). **The one
residual real-DB item: the Oracle `collate X escape '\'` ordering** (SQLite native-validated green;
COLLATE binds tighter than LIKE ⇒ very likely sound) — flag for `--docker oracle`.

**Baked-in scan of the R49 +29 backlog (F-RECENT) — CLEAN.** Both real-DB catches correctly resolved:
NUM-1 (`sqlserver` float%int → `// TODO[LIMITATION]`-commented, bigint twin live); PROJ-6
(json_build_object uncast const → inline literal fragment `'rel'`). PROJ-1..8, CONN-1..6, ROWLOCK-1..3,
MUT-1/2, SEL-2, UD-1/2 all internally consistent (assertType ⇔ toEqual ⇔ key-presence).

### I.1 — BUG (maintainer-ruled DEFECT → FILED to `BUGS.md`) — §B-1: Multiple-insert bare `onConflictDoNothing` is typed NON-optional

> **Ruling:** the maintainer confirmed it is a bug — an instruction (`onConflictDoNothing`) that
> can return no rows must not offer `executeInsertOne` (which demands exactly one), because that
> leads the caller straight to a runtime error. Fix `:125` → `CustomizableExecutableMultipleInsertOnConflictOptional`
> (matching `:134`) + the negative-type lock below. Detail retained.


**Where.** `src/expressions/insert.ts:125` — `CustomizableExecutableMultipleInsert.onConflictDoNothing`
routes to `CustomizableExecutableMultipleInsertOnConflict` (the **non-optional** target →
`ExecutableInsertReturning` which **exposes `executeInsertOne`**).

**The asymmetry (coordinator compile-repro CONFIRMED).** Every twin routes bare/targeted `doNothing`
to the **Optional** executor (which drops `executeInsertOne`): Simple bare `onConflictDoNothing`
(`:94`), FromSelect bare (`:63`), and — decisively — the Multiple builder's OWN targeted
`.onConflictOn(cols).doNothing()` (`:134`). Runtime is identical (both `onConflictDoNothing()` and
`doNothing()` just set `this.__onConflictDoNothing = true`). Compile-repro (deleted, tree clean):
- `insertInto(t).values([…]).onConflictDoNothing().returning({…}).executeInsertOne()` — **COMPILES** (the outlier).
- `insertInto(t).values([…]).onConflictOn(col).doNothing().returning({…}).executeInsertOne()` — **`@ts-expect-error` satisfied** (correctly absent).
- `insertInto(t).values({…}).onConflictDoNothing().returning({…}).executeInsertOne()` (Simple) — **`@ts-expect-error` satisfied** (correctly absent).

**Both readings.**
- *Defect:* on a `doNothing` insert rows can be suppressed (0 returned), so `executeInsertOne` (requires
  exactly one row) does not fit — which is why the library drops it on the other 3 `doNothing` paths.
  The Multiple bare is the only path that keeps it, with identical runtime. The twin-parity fingerprint
  (§9) that found R48's BUG-1 and R49's base-dialect bug: a twin with wrong optionality. Inverse-guard
  is safe (making it Optional only removes `executeInsertOne`, which no sound program can rely on after a
  suppressible multi-row `doNothing`). Fix: `:125` NEXT arg → `CustomizableExecutableMultipleInsertOnConflictOptional`.
- *Not-a-defect:* `executeInsertOne` on a multi-row insert is already "throws unless exactly one row"
  (type-permitted on a plain multi-row insert too); one could argue the Multiple bare is intentionally
  no more restrictive than a plain multi-row insert. Under this reading the 3 twins are the ones being
  extra-strict.

**Adjudication: presented for the maintainer's ruling** (like the R49 candidates). The evidence leans
DEFECT — runtime-identical to the targeted twin, 3 twins agree, inverse-guard safe — but whether the
`doNothing` paths *should* uniformly drop `executeInsertOne` is a library-design call. If ruled a bug:
`BUGS.md` entry + `src` fix + the §A-lock (below) locking `executeInsertOne` absent on the Multiple bare
`doNothing` path (mirroring the targeted-twin negative test). `returningLastInsertedId` is unaffected
(both Multiple variants return the same array type).

### I.2 — Candidate defects PROBED and REFUTED (probe > trace)

- **SEL-SEAM offset-only recursive `forUseInQueryAs` on SqlServer** — hypothesised to emit `offset`
  without `ORDER BY` (SqlServer rejects). **REFUTED:** the builder auto-injects `order by 1`
  (`tree as (select … from recursive_select_1 order by 1 offset @1 rows)`) — valid SqlServer. Not a
  defect; the composition is a §A coverage item (SEL-A/offset arm).
- **MUT-SEAM `oldValues()` × `UPDATE…FROM.leftJoin(miss)` × rule-2 in the synthetic `_old_`-subquery
  cells** — hypothesised drop/mis-emit of the aliased left-join column. **REFUTED** (probed in pg/oldest):
  emits valid SQL — `from (select _old_.*, app_user.full_name as app_user__full_name from project as
  _old_, issue left join app_user on … for no key update of _old_) as _old_ … returning …
  _old_.app_user__full_name as "obj.assignee"` — and the rule-2 nested object correctly DROPS on the
  miss (`'obj' in row === false`), no throw. Not a defect; a §A coverage gap (= F4-UPDDEL A-2).

### I.3 — Type-only owner candidates re-confirmed PRESENT (not bugs)
- **CAND-A** (`update.ts:532` sqlite `returningOneColumn` stray `| NOldValuesFrom` outside `ValueSourceOf`) — vestigial/inert (`oldValues()` is `never` on `SqliteConnection`; the arm is a source-name phantom no `ValueSource` inhabits). Re-confirmed by PARITY §B-2 + F4-UPDDEL §C. Owner-optional cleanup: delete the arm. No runtime/value surface.
- **CAND-F** (`values.ts:253` `isIfValue` propagates `OPTIONAL_TYPE` while `is`/`isNot`/`isNotIfValue` force `'required'`) — over-widening in the SAFE direction, no projectable value surface. Re-confirmed by F1-BOOLIF §C. Not a bug.
- **Code note** (MUT-SEAM §C): `AbstractSqlBuilder._extractAdditionalRequiredTablesForUpdate` (~2410) guards `froms.length < 0` / `joins.length < 0` — a dead comparison (should be `<= 0`); benign (arrays are always non-empty when reached). Owner-optional one-line cleanup.

---

## Part II — Enumerated §A backlog (by surface)

### §CONN — F5-CONN (fragmentWithType adapter fan-out, symmetric residual of R49's aggregate fan-out)
- **CONN-1 · T4** — `fragmentWithType('boolean','required'|'optional', adapter).sql\`${boolCol}\`` (boolNegate over `tIssueWorklog.billable`). The only `fragmentWithType` kind whose no-adapter arm is covered but adapter arm is absent.
- **CONN-2 · T4** — `fragmentWithType('localDate', …, adapter).sql\`${tIssueWorklog.workDate}\`` (shiftHour; real-validatable via a column read — stronger than the aggregate-localDate twin which is mock-only).
- **CONN-3 · T4** — `fragmentWithType('customLocalDate','ReleaseDay', …, adapter).sql\`${tProjectRelease.releasedOn}\`` (adapter2 slot).

### §UD — F4-UPDDEL
- **UD-1 · negative-type (owner-optional)** — DELETE execute-shape RETURNING-requirement lock absent. pg `types.negative/update.test.ts:73` locks `executeUpdateNoneOrOne/One/Many` off a bare update; `delete.ts` makes the identical distinction but `types.negative/delete.test.ts` has NO equivalent. Add 3 `@ts-expect-error` (bare `deleteFrom(t).where(…).executeDeleteNoneOrOne()`/`One()`/`Many()`) + positive control.
- **UD-2 · T3** — `oldValues() × UPDATE…FROM(LEFT/LEFT-OUTER join)` (the left-join limb beyond R49 MUT-1's inner-join; = MUT-SEAM's refuted-as-defect coverage). 2 shapes (plain + `projectingOptionalValuesAsNullable`), most valuable in the synthetic `_old_`-subquery cells (pg/oldest/mariadb/mysql/sqlserver). Emission probe-confirmed valid.
- **UD-3 · T4 (mock-only throw)** — MANDATORY_VALUE / INVALID_VALUE inhabitant on the mutation RETURNING grid. Probe-confirmed reachable: `update(t)…returningOneColumn(reqCol).executeUpdateOne()` with a present-null required value throws `INVALID_VALUE_RECEIVED_FROM_DATABASE` (a missing key → `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`); neither realized on update/delete returning today. Throw-test (mock-only exempt).
- **UD-4 · T4** — allowing-no-where × (using/from)-then-LEFT-join limb (inner-join limb covered).

### §SEL — F3-SELECT + SEL-SEAM + F-RECENT (recursive ordering/paging × hooks)
- **SEL-1 · T2 (negative-type)** — `NotSubselectUsing` execute-guard lock absent. A `subSelectUsing(t)`-scoped select carries a table in REQUIRED, so `.executeSelectMany()`/`One`/`NoneOrOne`/`Page` on it must NOT compile (the reason those 4 are split from `query()`/`params()`), but no `@ts-expect-error` locks it. Add the negative lock + positive control (plain `selectFrom(…)` still executes).
- **SEL-2 · T4** — selectPage fast-path `count(*) … where …` over a FILTERED plain select (WHERE retained, ORDER BY/LIMIT/OFFSET dropped) — every WHERE-carrying page-count snapshot is a CTE-wrap; the plain filtered `count(*)` form is unasserted.
- **SEL-3..8 · T4** — recursive `forUseInQueryAs` ordering/paging × the 3 projection-only hooks: limit-only, offset-only (SqlServer auto-injects `order by 1` — probe-confirmed valid), orderBy+limit-together (only orderBy-only tested). Plus the recursive INLINE consumers: `forUseAsInlineQueryValue` scalar + customWindow + ordering; `forUseAsInlineAggregatedArrayValue` + customWindow (± ordering); recursive ONE-COLUMN + ordering + inline-aggregated-array (the historical INTERNAL-throw seam — no throw expected, highest-interest probe). All emission-only, correct-by-construction (both readings agree).

### §PROJ — F3-PROJ (pick × nullable × rule twins)
- **PROJ-1 · T3** — `dynamic-condition.pick.test.ts` rule-1-gate-leaf-inside-picked-object twin under `projectingOptionalValuesAsNullable()` (the `-default` at :453 landed alone). Predicted `Array<{ id; meta: { gate; assigneeId: number|null } | null }>`; boundary: gate-miss → `meta === null` (present-null; `-default` DROPS the key). Coordinator boundary-row probe before baking.
- **PROJ-2 · T3** — same for the rule-2-left-join-leaf-inside-picked-object twin (:495). Predicted `proj: {…}|null`; join-miss → `proj === null`.

### §VALVIEW — F2-VALVIEW
- **VALVIEW-1 · T2** — a no-table-required ValueSource as a `Values.create` row *cell* (`{ id: conn.const(40,'int').add(2) }`). Type-permitted (`InputTypeOfColumn` value-source arm), runtime-supported (`_buildWithValues`→`_appendValue` `hasToSql`), never asserted on the `_buildWithValues` emission site (distinct from the covered `insert()` site). Distinct-SQL (`values ($1 + $2, …)`), real-validatable. 2 arms (required-cell, optional-cell). `Default` is NOT a valid Values cell (don't extend the lock).

### §TEMP — F1-TEMP (getter-availability negative locks)
- **TEMP-1 · T4 (negative-type, owner-optional)** — 6 `@ts-expect-error` locking per-leaf getter NON-existence (`workDate.getHours()`/`.getTime()`, `startedAt.getFullYear()`/`.getTime()`, `releasedOn.getHours()`, `cutoffTime.getFullYear()`). The positive getter split is pinned; the absence is not (an in-style precedent exists at `types.negative/select.test.ts:139`). Borderline R-P7 (compile-only) but locks non-existence no positive test can.

### §STR — F1-STR
- **STR-1 · T4** — insensitive-affix × value-source(column) operand × collation-SET intersection (the `if (collation)` truthy branch with a column needle) — the two constituents are each covered, their product isn't. Distinct per-dialect SQL. Low-yield (mechanical product of two proven branches); `--docker` for oracle/mysql/mariadb/pg/sqlserver, native for sqlite.

### §NUM — F1-NUM
- **NUM-1 · T4** — `double.asBigint()` chained into a bigint op (the bigint mirror of R49's NUM-1; `asBigint()` is only ever projected, never chained). Near-degenerate.

### §MUT — MUT-SEAM (low-risk seams, no probe)
- **MUT-1 · T4** — `onConflictOnConstraint(frag).doUpdateSet(…).where(updatePred)` (constraint-target upsert + DO-UPDATE partial WHERE; shared where-routing, low risk).
- **MUT-2 · T4** — `shapedAs(…) SET × returning({ nested sub-object })` (returning orthogonal to the shaped SET map).

---

## Part III — OUT (named)
- LIKE base arg-swap → **FIXED** in the R49 refactor (reconciled to `(value, params)`); no longer a candidate.
- CAND-A / CAND-F / the `froms.length < 0` dead comparison — type-only / benign, no runtime/value surface (owner cleanups).
- bigint float-only/cast methods — typed-never, negative-locked. `double.modulo`/int fractional-const — engine LIMITATION. `customInt` commented math / `modulo(2.5)` — typed-never / INVALID_VALUE.
- L-1 custom-temporal const/arg getter bare `extract` — LIMITATION. Brand-only PK/autogen read — brand-only. `split`/`splitRequired`/`executeSelectCount`/compound `groupBy`/`having`/`selectFromModel` — non-existent APIs. Phantom `ForcedTypeAdapter`/`insertReturningMultipleColumnsForSequence` (real: `ForceTypeCast`). PROJ depth-5 recursion limit — type-unobservable.
- SQL_*/INTERNAL/impossible-state error reasons — driver / queryRunners layer.
- Oracle `orderingSiblingsOnly()` on a recursive union (SEL-SEAM B2) — likely typed-never (needs `connectBy`); Oracle probe to confirm typed-never vs mis-emit.

---

## Part IV — Per-surface saturation table

| Agent | §A | verdict |
|---|---|---|
| F-RECENT | 3 (SEL-A1/2/3, low) | both R49 fixes SOUND; baked-in CLEAN; 0 bug |
| F1-STR (LIKE) | 1 (STR-1, low) | LIKE refactor exhaustively propagated; 0 bug |
| PARITY | 1 (SEL-1-lock) | **§B-1 candidate bug** (insert.ts:125); LIKE twin-parity clean; extras 22/22 |
| MUT-SEAM | 2 (MUT-1/2) + UD-2 | A-1 candidate defect REFUTED (emission valid); 0 bug |
| SEL-SEAM | 6 (SEL-3..8) | recursive-hooks neighborhood well-covered; B1/B2 → §A/flag; 0 bug |
| F9-TYPEVAR | 0 | **CLOSED** |
| F1-EQCMP | 0 | **SATURATED** (~500 paths) |
| F6-DYN | 0 | **SATURATED**; D-1 confirmed cleaned |
| F5-CONN | 3 (CONN-1/2/3 T4) | 0 bug |
| F4-INSERT | 0 | **SATURATED** (never-boundaries all handled) |
| F4-UPDDEL | 4 (UD-1..4) | 0 bug |
| F3-PROJ | 2 (PROJ-1/2 T3) | PROJ-1..8 re-derived; 0 bug |
| F3-SELECT | 2 (SEL-1/2) | NotSubselectUsing lock; 0 bug |
| F1-NUM | 1 (NUM-1 T4) | **CLOSED** |
| F1-CUSTOMNUM | 0 | **CLOSED** |
| F1-TEMP | 1 (TEMP-1 neg, T4) | positive SATURATED |
| F1-BOOLIF | 0 | **SATURATED**; CAND-F present |
| F2-COL | 0 | **CLOSED** |
| F2-VALVIEW | 1 (VALVIEW-1 T2) | D-VALVIEW cleaned; 0 bug |
| F7-EXTRAS | 0 | **SATURATED**; extras 22/22 |

---

## Part V — Coordinator verification notes (probes, all deleted; tree clean)
- **§B-1 (insert.ts:125):** compile-repro — Multiple bare `onConflictDoNothing().returning().executeInsertOne()` COMPILES; the targeted-twin and Simple-bare-twin `@ts-expect-error` on `executeInsertOne` are both SATISFIED. Twin asymmetry CONFIRMED, runtime-identical, inverse-guard safe.
- **SEL-SEAM offset-only (SqlServer):** mock emission — `tree as (select … order by 1 offset @1 rows)` (auto-injected `order by 1`). REFUTED as defect.
- **MUT-SEAM A-1 (pg/oldest):** mock emission + boundary — valid synthetic `_old_` subquery with `issue left join app_user`, `app_user.full_name as app_user__full_name`, rule-2 object drops on miss (`'obj' in row === false`), no throw. REFUTED as defect.
- **PROBE-1 (update returning):** mock — `returningOneColumn(reqCol).executeUpdateOne()` on present-null throws `INVALID_VALUE_RECEIVED_FROM_DATABASE`. Reachable (UD-3).
- **`tests:audit`:** 17 cells / 247 files / 3929 tests-per-cell, symmetric.
- **Flagged for implementation `--docker`:** Oracle `collate X escape '\'` ordering (very likely sound; SQLite twin native-validated); Oracle `orderingSiblingsOnly()` on recursive union (confirm typed-never).

---

## Part VI — §B fixtures
None required — every §A item uses existing `domain/connection.ts` fixtures (VALVIEW-1 uses `conn.const(...)`).

## Part VII — Recommended implementation order
1. **§B-1 ruling** (maintainer) — if bug: `src` fix + `BUGS.md` + the SEL-1-style negative lock. If intentional: a comment.
2. **VALVIEW-1** (T2 distinct-SQL) + **SEL-1 / UD-1 / TEMP-1** negative locks (cheap, lock real boundaries).
3. **CONN-1/2/3** (T4 adapter fan-out) + **PROJ-1/2** (pick×nullable, boundary-probe first) + **UD-2/UD-4** (left-join limbs).
4. **SEL-3..8** (recursive ordering/paging × hooks, emission), **UD-3** (throw-test), **STR-1 / NUM-1 / MUT-1/2** (T4 tails).
5. Owner cleanups: CAND-A, `froms.length < 0`. `--docker` spot-checks: Oracle collate, Oracle orderingSiblingsOnly.

## Part VIII — Verdict
A mature round. **Both R49 fixes verified complete and sound** — notably the large LIKE-emission
refactor (which also correctly implemented the R49 F1-STR fix by reconciling `_escapeLikeWildcard`'s
signature to the library convention) is exhaustively propagated and dialect-paired, confirmed by four
independent agents. **One confirmed type-vs-impl inconsistency for the maintainer to rule** — §B-1
(`insert.ts:125` Multiple bare `onConflictDoNothing` wrongly non-optional; runtime-identical to its
targeted twin, 3 twins agree, compile-repro'd). **Three candidate defects were probed and refuted**
(probe > trace: SqlServer offset auto-injects `order by 1`; the oldValues×left-join synthetic subquery
emits valid SQL and drops correctly; the LIKE refactor is snapshot-preserving + native-validated). The
rest is an enumerated completeness backlog (adapter fan-out, negative-type locks, recursive
ordering/paging × hook compositions, a Values value-source cell, pick×nullable twins). 9 of 20 surfaces
returned §A=0. The surface is at or near total saturation; the residual is completeness plus one
maintainer ruling.
