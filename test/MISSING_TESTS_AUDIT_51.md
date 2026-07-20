# MISSING_TESTS_AUDIT_51 — type-driven missing-tests audit (Round 51)

**Mandate.** Maximal-saturation, maximal-rigor, type-driven missing-tests audit of
ts-sql-query (type-safe SQL query builder for MariaDB/MySQL/Oracle/PostgreSQL/SQLite/
SQL Server). Method + standard per [`TYPE_AUDIT_RUNBOOK.md`](./TYPE_AUDIT_RUNBOOK.md):
enumerate every reachable typed path *and every variant*, classify COVERED / TO-WRITE
(T1–T4) / OUT; output-coincidence → T4 (does not close); OUT only when a distinction has
ZERO real-validatable SQL/params/value surface. Reference cell `postgres/newest/pg/`;
matrix symmetric (a gap in the reference cell is a gap everywhere).

**Pre-flight (§0.5).** N = 51. `tests:audit` → **17 cells · 247 files · 3951 tests/cell ·
67167 tests · whole matrix symmetric · 0 problems**. `tests:index` rebuilt (raised heap,
exit 0). `domain/connection.ts` re-read in full (1974 lines). `BUGS.md` **empty** (R50 bug
fixed). Only `src/` change since R50: `src/expressions/insert.ts` (1 line, pure type —
the R50 fix, commit `090b8a03`).

**Fan-out.** 20 discovery agents, ≤10 concurrent, all reported (none rate-limited). Every
load-bearing claim coordinator-verified below (§V) with compile-repro / mock-emission bake /
src read; all probes deleted; tree clean.

---

## HEADLINE

> **STATUS — both defects are now FIXED; `BUGS.md` is empty again.** BUG 1 →
> `resultWithOptionalsAsUndefined.ts` (rungs 2–5, the `| undefined` union moved back
> **outside** `TransformOptionalProperties`, restoring v1's shape). BUG 2 →
> `AbstractSqlBuilder.ts` `_asDouble`/`_divide` now emit SQLite's `cast(… as real)` and the
> **SQLite overrides are deleted**, so the base is used by a real dialect — per the maintainer's
> rule *the base implementation must be used by at least one dialect* (§I.3-fix); emission
> byte-identical, zero snapshots moved. A third change rode along: `exactOptionalPropertyTypes`
> support (§I.2-fix). Gates: `tsc` + `tsgo` on `src/` = 0, matrix `validate:tests` = 0, 65182
> tests, `no-docker-examples` ok; ~513 files touched (3 in `src/`, ~2740 assertions re-baked).
> **Three of this report's own load-bearing claims were wrong** — and one of the fixing pass's
> was too. Corrected in §I.2-fix / §I.3-fix; **read those before trusting §VII.**

**2 confirmed defects FILED to `BUGS.md`** — both surfaced only after the maintainer
rejected the round's first (wrong) verdict and redirected the two candidates. The agent
fan-out plus the coordinator's own first pass concluded "0 bugs"; that conclusion was
**wrong on both counts**, and the corrections are the round's real value:

1. **Projection rules** — the default projector types a dropped optional leaf as a
   **present key** (`T | undefined`) whenever its containing object is optional (rules 1, 2
   and 4 — three of the four rules), because `TransformOptionalProperties` short-circuits.
   Contradicts the documented rules, the runtime, and the projector's own rule-3 behavior.
   My first pass dismissed this as "R49-ratified / benign" **without checking it against the
   norms** — the maintainer's "revisa las normas de proyección" is what surfaced it.
2. **Base dialect arithmetic** — `AbstractSqlBuilder._asDouble` emits
   `cast(<operand>as double presition)` (missing space **and** `presition`≠`precision`) and
   `_divide` repeats the typo. Prior rounds filed this OUT as "cosmetic/dormant" on the
   "all 6 dialects override it" reasoning — **the exact inverse error the R49 base-dialect
   rule exists to prevent**. My round didn't even reach it: I spent the arithmetic budget on
   the type-adapter interaction (noise) instead of the arithmetic emission itself.

The rest stands: (a) the R50 fix verified **complete + sound** three ways; (b) the +22 R50
backlog verified **baked-in-clean** (all 4 premise-corrected files); (c) **13/20 surfaces
re-confirmed saturated**; (d) a short, coordinator-probed §A completeness tail (5 items);
(e) operator precedence probed and **correct**.

**Process lesson for the next round.** Both defects were *reachable by the stated method and
were missed by it*. The failure mode was identical in both: **I accepted a prior verdict
instead of re-deriving it** — "R49 ratified the pick representation" and "R45/R46 closed the
typo as OUT" — which is precisely what the runbook's "inherit no verdict" rule forbids. A
"ratified"/"already tested"/"previously closed" label is not evidence; the norms and the
emission are.

---

## PART I — Bugs, candidates, and re-confirmed known non-bugs

### I.0 — R50 fix verification (insert.ts:125): COMPLETE + SOUND (3-way)

The R50 fix (`090b8a03`) changed the multi-row bare `onConflictDoNothing` at
`src/expressions/insert.ts:125` to route to `CustomizableExecutableMultipleInsertOnConflictOptional`
(dropping the unsound `executeInsertOne`). Verified by **F-RECENT**, **PARITY**, and the
coordinator independently:

- **(a) All six `doNothing` paths now route to `…OnConflictOptional`** — Simple bare `:94` /
  targeted `:103`, FromSelect bare `:63` / targeted `:72`, Multiple bare `:125` (the fix) /
  targeted `:134`. **No remaining non-optional outlier** anywhere in the on-conflict/returning
  family. The `doUpdate*` two-arm split (`…OnConflict` non-optional vs `…OnConflictOptional`,
  selected by whether `.where(...)` is applied) is correct-by-design, not an outlier.
- **(b) `returningLastInsertedId` genuinely unchanged on the Multiple bare path.**
  `ReturningMultipleLastInsertedIdType` (`:704-707`) and `ReturningMultipleLastInsertedIdOptionalType`
  (`:745-748`) are **byte-identical** — same 6-DB `OfDB` gate, same `[never]` guard, both
  resolve to `…ReturningLastInsertedId<…, AutogeneratedPrimaryKeyColumnsTypesOf<TABLE>[]>`. The
  changelog's "unchanged" claim holds. Correct contrast: the **Simple** optional alias adds
  `| null` (a suppressed single-row insert yields no id), but the **Multiple/FromSelect** array
  forms represent suppression by shrinking, so no `| null` is needed. The fix's only observable
  effect is `returning`/`returningOneColumn` → the `…Optional` fn-types (dropping `executeInsertOne`).
- **(c) Negative lock landed** at `postgres/types.negative/insert.test.ts:156-161` (multi-row
  `.values([...]).onConflictDoNothing().returning({...}).executeInsertOne()` `@ts-expect-error`,
  with a passing `.executeInsertNoneOrOne()` control), alongside the single-row lock `:146-151`.
- **(d) Positive runtime test present + propagated** to all 17 cells:
  `insert.returning.test.ts:285` (`…-execute-insert-many`) exercises the fixed path
  (`.values([...]).onConflictDoNothing().returning({id,name}).executeInsertMany()`) with
  `assertType<Exact<…, Array<{id:number;name:string}>>>` + value assertions.

### I.1 — Baked-in scan of the +22 R50 backlog: CLEAN (12 files, incl. all 4 premise-corrected)

Every just-added `assertType<Exact>` + `toEqual`/snapshot pair diffed for key-presence /
null-ness / container contradiction (type is ground truth). All clean. The four files whose
audit premise was **empirically corrected at R50 implementation** are each sound, with the
correction intact:

- **VALVIEW-1** (`with-values.kind-coverage.test.ts`): `$1 + (2)` **typed operand**
  (`const(40).add(fragmentWithType('int','required').sql`2`)`) — not the PG-42725-rejected bare
  `$1 + $2`. Required cell → `{id:number}`, optional cell → `{id?:number|undefined}`, both value 42. ✓
- **UD-3** (`update.returning.execute-shapes.test.ts`): the throw-inhabitant split is correct —
  present wrong-type `1.5` on int → `INVALID_VALUE_RECEIVED_FROM_DATABASE`; present-`null` on a
  required column → `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`. Both mock-only-guarded, SQL pinned. ✓
- **UD-4** (`update.allowing-no-where.test.ts`): the cross-join → **stable many:1** correction
  (`from(project).leftJoin(org)` correlated by `where project.id = issue.projectId`, documented as
  avoiding the Oracle ORA-30926 non-deterministic multi-match). Valid SQL, `number`, mock 4. ✓
- **SEL-4** (`customize-query.select.test.ts`): the **offset-requires-limit** correction
  (`.limit(10).offset(5)`); projection hooks `/* hint */ /* cols */ window …` render on the
  wrapping CTE select; inline-scalar → `root?:number`, aggregated-array → `tree:number[]`. ✓

The other 8 (CONN-1/2/3, PROJ-1/2, SEL-1/2, MUT-1/2, NUM-1, STR-1, UD-1/2, TEMP-1) + the
delete/select neg-locks are internally consistent (independently re-verified by F5-CONN,
F3-PROJ, F3-SELECT, F4-UPDDEL, F1-NUM, F1-STR, F1-TEMP).

### I.2 — **BUG 1 (FILED)** — the default projector types a dropped optional leaf as a PRESENT key whenever its container is optional

**Superseding the first (wrong) verdict below.** Derived from the norms, as the maintainer
directed. `projectionRules.ts:13-53` states for **every** rule that non-required leaves are
"marked as **optional**" (rule 1: "originallyRequired & optional are marked as optional";
rule 2 defers to rule 1; rules 3 and 4 likewise). The projector has exactly the machinery to
honour that — `TransformOptionalProperties` (`resultWithOptionalsAsUndefined.ts:215-219`)
converts a `T | undefined` value-union into an optional KEY and strips the union
(`OptionalMap` / `OptionalPropertiesOf`, `:221-224`, with `NonNullable<RESULT[P]>`). But its
guards short-circuit it:

```ts
type TransformOptionalProperties<RESULT> =
    null extends RESULT ? RESULT
    : undefined extends RESULT ? RESULT      // <-- bails out
    : ...
    : { [P in keyof OptionalMap<RESULT>]: ... NonNullable<RESULT[P]> }
```

Rules 1, 2 and 4 all mark the container OPTIONAL, so `ResultObjectValues2` returns
`{...} | undefined` (`:100`, `:107`, `:120`, `:130`, `:137`, `:150`, …) → `undefined extends
RESULT` is true → the transform returns `RESULT` untouched → the container's own optional
leaves **never** become optional keys. Only a rule-3 (required) container reaches the
transform. So:

| container | rule | transform | leaf type | runtime | verdict |
|---|---|---|---|---|---|
| required | 3 | runs | `?: T` | key dropped | ✅ consistent |
| optional | 1, 2, 4 | **bails** | `T \| undefined` (present key) | key dropped | ❌ **unsound** |

Under `exactOptionalPropertyTypes` (on in this repo) `k: T | undefined` means *the key must
exist*, while the default projector drops it. **Repro** (asserts both sides in one test):
`dynamic-condition.pick.test.ts:539-577` → `proj?: { …; archivedAt: Date | undefined }` +
`expect('archivedAt' in rows[0]!.proj!).toBe(false)`. **Contrast proving the inconsistency:**
every optional `col_matrix` arm projects `?: T` correctly (`select.column-factory-matrix.test.ts`)
— because its top-level container has a required `id` → rule 3 → transform runs.
`resultWithOptionalsAsNull.ts` is correct as-is (it deliberately keeps the key present as
`T | null`); only the default projector is affected. Filed to `BUGS.md`.

### I.2-fix — **BUG 1 FIXED** — and the diagnosis above was right while the prescribed remedy was wrong

**What it actually was: a v2-refactor regression, verifiable against `origin/v1`.** The report
frames the guards as if they had always been there. They had not. v1's
`src/utils/resultUtils.ts:130` reads:

```ts
type InnerResultObjectValues<COLUMNS> = FixPickableObjectWhereCouldBeNotPicked<
    ContainsRequiredInOptionalObject<COLUMNS> extends true ?
        FixOptionalProperties<{ … }> | undefined      // transform INSIDE, union OUTSIDE
    : …
```

and v1's `FixOptionalProperties` has **no** `null extends RESULT` / `undefined extends RESULT`
guards at all. The v2 rework moved the union *inside* the transform and added those two guards
to cope — and the guards are what disable it. So the fix is not new machinery, it is restoring
v1's shape: apply the transform to the bare object per rule branch and union `| undefined`
outside, in `ResultObjectValues2..5`. `ResultObjectValues` (level 1) and
`ResultObjectValuesForAggregatedArray` needed no change (their branches already pass bare
objects); `resultWithOptionalsAsNull.ts` untouched, as this report predicted.

**§VII.2's prescribed fix is a trap — do not use it.** It proposes
`undefined extends RESULT ? TransformOptionalProperties<NonNullable<RESULT>> | undefined`.
Measured: compile time **1.4 s → >400 s (≈300×)** on one file + `src/`, and it breaks 11
`src/examples/documentation/*.ts`. Two non-recursive variants (`Extract`/`NonNullable`, and a
distributive `RESULT extends null|undefined ? RESULT : {mapped}`) are fast but break the *same*
11 examples. Root cause: any fix that returns something other than `RESULT` **verbatim** changes
type identity under generics, and `getSubcompanies<FIELDS>` in the doc examples must prove
`expandTypeFromDynamicPickPaths(...)` ≡ `PickValuesPath<…, FIELDS|'id'>` without resolving
`FIELDS`. Moving the union out is the only variant that keeps the transform's *input* concrete,
so it resolves eagerly and the union is a plain one.

**The two guards must STAY, despite being dead after the fix.** Removing them (literal v1 parity)
→ 11 errors again. With them, `TransformOptionalProperties<X>` over a generic `X` stays a
*deferred* conditional — an opaque box that unifies by identity; without them
`undefined extends string` is a constant `false`, the alias eagerly expands to its mapped type,
and the generic comparison fails. v1 didn't need them (no `exactOptionalPropertyTypes`, no
`Expand`/`PickValuesPath` layer). Debt, but load-bearing today.

**Rode along — `exactOptionalPropertyTypes` support (this round's method missed it too).** The
mapped type's `true extends OptionalMap<RESULT> ? RESULT[P] : NonNullable<RESULT[P]>` is not
dead code: for an **all-optional** object `OptionalMap<RESULT>` is a *weak type*, which a
primitive **is** assignable to → `true` → `NonNullable` is skipped → `k?: T | undefined`; an
object with any mandatory key → `false` → `k?: T`. An accidental "is this all-optional?" test
that changes a property's nullability based on whether it has required siblings. In v1 (flag off)
both branches are the **same type**, so it was a no-op and invisible; only v2 makes the
distinction real — and inventing it. Removed, on four aligned norms: the runtime
(`__transformRootObject:88` / `__transformProjectedObject:288` only ever do
`result[prop] = transformed` or nothing — `result[prop] = undefined` does not exist), v1, the docs
(`complex-projections.md` uses `k?: T` throughout, zero `| undefined`), and the flag's purpose.

**A prior round had baked the accident AND invented a rule for it.**
`select.aggregation.test.ts` (`sum-priority`) asserted `{ totalPriority?: number | undefined }`
under the comment *"The library surfaces this as `key?: T | undefined`, distinct from the plain
`key?: T` shape produced for scalar inline subqueries."* That rule does not exist: the
subquery-shapes tests use `{ id: tIssue.id, projName: … }` — **with a mandatory `id`**. Same
optional leaf, different shape, purely because of the sibling. Comment rewritten. This is the
§VIII lesson in miniature: a test asserting current behaviour is not evidence, and a *comment
explaining* it can be a rationalisation of a bug.

**Sweep (as §VII.2 predicted, but wider):** 2740 assertions / 473 files / 28 test-file basenames
across all 6 DBs — not just `dynamic-condition.pick.*` + `select.complex-projection.*` (the
`exactOptionalPropertyTypes` half also reaches `aggregation`, `fragments.*`,
`select.value-source.*`, `with-values.*`). The `'k' in obj` probes passed unchanged throughout,
exactly as predicted.

### I.2-superseded — the first pass's (WRONG) reasoning, kept so the error isn't repeated

**F-RECENT** flagged (LOW confidence, both readings): in `dynamic-condition.pick.test.ts`
(`pick/rule-2-left-join-leaf-inside-picked-object-default`, :539-577), a picked optional
left-join leaf is typed **present-key** `archivedAt: Date | undefined` (not `archivedAt?:`),
yet the default projector **drops the key** at runtime — the test itself asserts
`'archivedAt' in rows[0].proj === false` right beside the `assertType`.

**Resolution — settled, not a bug, not re-filed.** This is the **R49-ratified** representation
of the `PickWitOthersAsOptionals` projector (dropped-optional pick leaves are typed
present-`| undefined`, not `?:`). It is **observationally benign** — property access
`proj.archivedAt` reads `undefined` whether the key is present-undefined or absent; only `in` /
`Object.keys` differ. Two projection-focused agents examined it independently: F-RECENT rated it
LOW-confidence-pre-existing, and **F3-PROJ deemed the same tests sound** (compile-repro +
`'k' in obj`/`===null` probes). Not introduced by R50. Documented here so R52 does not re-chase
it; **not** a `BUGS.md` entry.

### I.3 — **BUG 2 (FILED)** — base dialect `_asDouble` / `_divide` emit invalid SQL (`presition` typo + missing space)

Found only after the maintainer redirected the arithmetic question away from the
type-adapter interaction ("lo importante es que la aritmética se esté haciendo bien … y la
prioridad de los operadores"). `src/sqlBuilders/AbstractSqlBuilder.ts`:

- **`_asDouble` (`:2989-2991`)** — two defects on one line:
  ```ts
  return 'cast(' + this._appendSql(valueSource, params, false) + 'as double presition)'
  //                                                            ^ missing space   ^ typo
  ```
  → `cast(priorityas double presition)`. Operand glued to `as`, and `presition` ≠ `precision`.
- **`_divide` (`:3254-3255`)** — `presition` twice (spaces correct).

`AbstractSqlBuilder` is the **designated base dialect** (SQLite-shaped, expanded by
PostgreSQL with minimal overrides) → a broken base is a real defect even though all six
dialects override both; the wall-to-wall overrides are the design-debt symptom.
`NoopDBSqlBuilder` inherits it and `NoopDBConnection.ts` ships. SQLite's overrides show what
the base should be: `_divide` → `cast(x as real) / cast(y as real)` (`SqliteSqlBuilder:285-287`),
`_asDouble` → `cast(x as real)` (`:288-290`) — fixing the base SQLite-shaped should make
those overrides removable (the `_likeEscape` remedy shape). Filed to `BUGS.md`.

### I.3-fix — **BUG 2 FIXED** — SQLite-shaped, per the maintainer's base-dialect rule

Fixed as **`cast(<value> as real)`** in the base + **the SQLite overrides deleted** — the
SQLite-shaped arm this report recommends (§VII.1's first option), which is now the only one
consistent with the maintainer's stated design:

> **The base dialect's implementation must be used by at least one dialect.** The base is
> modelled on **SQLite as the starting dialect, extended with PostgreSQL** — that union *is* the
> base dialect, chosen as the coherent common shape across the databases.

That rule is what settles it, and it is worth adding to `TYPE_AUDIT_RUNBOOK.md` beside the R49
base-dialect rule: **a base implementation no dialect uses is dead by construction and will rot** —
which is exactly how `presition` survived three rounds. After the fix the base is exercised by all
6 SQLite connectors (~36 assertions/cell across `select.numeric-ops`, `select.value-source.casts`,
`…trig`, `…custom-numeric`, `…numeric-operand-coverage`, `…column-vs-column`,
`…null-and-if-value-modifiers`), so it can no longer rot unnoticed.

**Emission is byte-identical** — base and the deleted SQLite override differed *only* in the type
name (verified mechanically), so SQLite emits exactly what it emitted before, now via the base:
65182 tests green, **zero snapshot churn**. The other five dialects keep their genuinely different
spellings (PG `::float`, Oracle/SQL Server `cast(… as float)`, MySQL/MariaDB `… * 1.0`).

**One premise of §I.3 is still false, and it matters for how this is filed:** "`NoopDBSqlBuilder`
inherits it and `NoopDBConnection.ts` **ships**" — `NoopDBConnection` is **not in the `exports`
map** (54 entries; `NoopQueryRunner` / `ConsoleLogNoopQueryRunner` are public, the connection is
not), is absent from `src/index.ts`, and is referenced by nothing in `src/` / `test/` / `docs/`. So
the "it ships" urgency was never real — but the defect was, and the base-dialect rule above is the
reason, not NoopDB.

**Coordinator error recorded (mine, in the fixing pass):** I first landed the *minimal*
`double precision` arm and wrote here that the SQLite-shaped arm rested on false premises, inferring
"the base is standard-SQL-shaped" from `_valueWhenNull` → `coalesce` (SQLite overrides to `ifnull`),
`_currentDate` → `current_date`, and `_likeEscape = ''` matching PG/MySQL. That inference was
reasonable from the code and **wrong about the intent** — and it produced a base implementation
**no dialect uses**, i.e. it re-created the very condition that let the bug rot, while my own
analysis had already observed "the base is a default that never hits" without drawing the
conclusion. The maintainer supplied the missing rule. Same lesson as §VIII, one level up:
**the norms are not always in the code — some live only in the maintainer's design intent, and an
inference from surrounding code is a hypothesis, not a norm.**

**Why three rounds missed it:** `MISSING_TESTS_AUDIT_45.md:129` called it "cosmetic typo …
all 6 real dialects OVERRIDE both"; `_46.md:181` closed it "dormant … (NoopDBSqlBuilder
only) — **OUT**". That is exactly the inverse error the R49 base-dialect rule was written to
prevent — and R51 (with the rule in the runbook) still didn't re-open it, because the
arithmetic budget went to the adapter interaction instead of the emission itself.

**Operator precedence — PROBED, CORRECT** (the maintainer's second concern). Plain `priority`
column, no adapter: `(priority + $1) * $2` · `(priority * $3) + $4` · `priority + (priority * $5)` ·
`priority - (priority - $6)` · `priority + $7 + $8` · `priority * $9 * $10` ·
`(priority::float / $11::float) + $12` · `(priority - $13) * $14`. Conservative
(over-parenthesizes `b`) but never wrong; associative chains correctly unparenthesized;
the load-bearing `a - (b - c)` right-operand parenthesis is present.

### I.3b — Candidate B (adapter × non-additive arithmetic) — NOT the defect; the maintainer has descoped it

Maintainer ruling: type adapters will change and several obscure behaviours will be removed;
what matters is that the arithmetic is right **absent adapter noise** (→ BUG 2) and that
operator precedence is well established (→ probed, correct). The adapter-threading analysis
below is retained only as the record of a **distraction that consumed the arithmetic budget
and hid BUG 2**. NUM-A1 (Part II) should be treated as low-value / deferred pending the
adapter rework, not as a pin worth baking now.

<details original heading — adapter column into non-additive arithmetic></details>

**F1-NUM** flagged pin-vs-bug: an adapter-bearing numeric column fed into `divide` / `power` /
`logn` / `roundn` / `atan2` / `sign` threads the receiver's `TypeAdapter` onto the **operand**
and **result**. Coordinator **baked** it (probe > trace), reference cell:

```
select score::float / $1::float as dv, score + $2 as av, score * $3 as mv, sign(score) as sv
    from project_review where id = $4
params [20, 50, 20, 1]      rows [{ dv: 42.5, av: 90, mv: 1700, sv: 0.1 }]
```

(`score` = `column('score','int', scaledTenthAdapter)`, write ×10 / read ÷10.) So
`score.divide(2)` binds operand **20** (=2×10) and reads the result **÷10**; `score.multiply(2)`
→ operand 20, `1700`; `score.sign()` → `0.1`. Source: `ValueSourceImpl.ts:685-691` (and siblings)
pass `getTypeAdapter2(this, value)` — the receiver's adapter (`:2027-2035`) — uniformly.

**Resolution — by-design, not a bug (§7.1 cross-agent reconciliation).** **F1-CUSTOMNUM**
independently found the *same uniform mechanism* is **already tested and accepted**:
`customdouble-adapter-column-through-multiply` pins `shiftedAmount.multiply(2)` → operand
`2→-998` (plusOffsetAdapter write −1000) + result `+1000`; `adapter-column-through-non-add-arithmetic`
pins `releaseOrdinal.subtract/multiply`. The library applies the receiver's adapter to the
operand + result of **every** numeric op, uniformly. For a linear ×k adapter this is transparent
under add/subtract but mathematically surprising under multiply/divide/power/sign; for an affine
(+c) adapter even add is surprising. **Whether the arithmetic is "meaningful" is the adapter
author's domain** (analogous to the branded-typeName-emission LIMITATION — the library cannot
know the adapter's algebra). Since the maintainer has already pinned this mechanism for
`shiftedAmount.multiply`, `score.divide`/`power`/`sign` is the *same accepted behavior*, merely
**untested for those methods on a plain-int adapter column** → a §A completeness gap (NUM-A1,
below), **not** a `BUGS.md` entry.

**Surfaced for maintainer awareness only:** `score.divide(2) = 4.25` (not 42.5) is a silent
10×-off footgun for the legitimate fixed-point pattern. If the maintainer wishes to treat
"value-transform adapter × non-additive arithmetic" as a documented `LIMITATIONS.md` boundary
(rather than accept-as-is), that is a maintainer call — the audit does not fix `src/` and does
not file it as a defect, because the mechanism is uniform and already test-ratified for multiply.

### I.4 — Re-confirmed known non-bugs (present, NOT re-filed)

- **CAND-A** — `src/expressions/update.ts:532`: sqlite branch of `ReturningOneColumnFnType` has a
  stray `| NOldValuesFrom<…>` **outside** `ValueSourceOf` (vs the non-sqlite branch `:530` where it
  sits inside). Vestigial; no value/SQL surface. (PARITY §B-2 style; F4-UPDDEL.)
- **CAND-F** — `src/expressions/values.ts:253`: `isIfValue` carries `OPTIONAL_TYPE` while its
  null-safe sibling `is` (`:254`) pins `'required'` — over-widening in the **safe** direction, no
  value/SQL surface. (F6-DYN, F1-BOOLIF.)
- **Code-note** — `AbstractSqlBuilder._extractAdditionalRequiredTablesForUpdate` (~2410): dead
  `froms.length < 0` comparison (should be `<= 0`); benign, no observable effect.
- ~~**Pick `T | undefined` present-key** (I.2) … by-design~~ — **WRONG, and this line is the error
  itself**: it was BUG 1, a v2 regression, now fixed (§I.2-fix). Left visible on purpose — "re-confirmed
  present, by-design" is exactly what an inherited verdict looks like from the inside.
- **Adapter-arithmetic threading** (I.3) — re-confirmed present, by-design (maintainer-descoped, §I.3b).

### I.5 — Doc-hygiene note (not a test gap)

**F5-CONN** flagged a maintainer comment in `select.connection-trailing-adapter.test.ts` (~:1029)
claiming boolean was omitted from the aggregate-adapter fan-out because there is "no portable
`max()` aggregate" — empirically inaccurate: the already-baked no-adapter body `count(*) > 0` is
portable on all 6 dialects (see CONN-A1). Optional cleanup if CONN-A1 lands.

---

## PART II — §A backlog (existing fixtures; each coordinator-probed)

All five are **low-tier completeness** items (no T1/T2 risk surfaced this round). Each names its
fixture, exact assertion, grep proving absence, and its coordinator verification.

### Surface F4-UPDDEL

- **DEL-1 · T2 · `executeDeleteOne` one-column value-gates (INVALID_VALUE + MANDATORY_VALUE).**
  The DELETE twin of the just-landed UPDATE pair (UD-3). `DeleteQueryBuilder.executeDeleteOne`
  (lines ~112-124) has the structurally identical one-column path
  (`if (value===undefined) throw NO_RESULT; return __transformValueFromDB(vs, value)`), so
  `transformValueFromDB` can throw the same two reasons, but no DELETE test exercises them.
  - **Test A (INVALID):** `if (ctx.realDbEnabled) return; ctx.mockNext(1.5);`
    `deleteFrom(tIssue).where(tIssue.id.equals(1)).returningOneColumn(tIssue.priority).executeDeleteOne()`
    → `reasonOf(caught) === 'INVALID_VALUE_RECEIVED_FROM_DATABASE'`; SQL
    `delete from issue where id = $1 returning priority as result`, params `[1]`.
  - **Test B (MANDATORY):** `ctx.mockNext(null)` + `returningOneColumn(tIssue.status)` →
    `'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE'`; SQL `… returning status as result`, params `[1]`.
  - **Fixture:** extend `delete.returning.execute-shapes.test.ts` (add the `reasonOf` helper +
    `TsSqlError` import, mirroring `update.returning.execute-shapes.test.ts`). Columns `tIssue.priority`
    (int), `tIssue.status` (string). Mock-only (both early-return on `realDbEnabled`).
  - **Grep (absent):** `grep -rl 'INVALID_VALUE_RECEIVED_FROM_DATABASE\|MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE' test/db --include='delete*.test.ts'` → 0.
  - **Coordinator-verified:** emission CONFIRMED — `delete.returning.execute-shapes.test.ts` already
    bakes `delete from issue where id = $1 returning status as result` (lines 80/139/158), so the
    one-column DELETE-returning emission is established; only the two throw inhabitants are new.
  - **Propagation:** DELETE-RETURNING is `NOT-APPLICABLE` in mysql/mysql2 cells — mirror the existing
    NOT-APPLICABLE commenting in `delete.returning.execute-shapes.test.ts`.

### Surface F3-SELECT

- **SEL-JOIN-COUNT-1 · T2 · `executeSelectPage` count fast-path over a JOINed select (emitted-SQL gap).**
  `SelectQueryBuilder.__buildSelectCount` wraps the count in a `result_for_count` CTE only when
  `__distinct || __groupBy.length>0 || __customization` (or recursive/compound). A **plain JOINed**
  select takes the else-branch fast-path and emits an **unwrapped** `select count(*) from a <join> b
  on … where …`. No test anywhere asserts a count query that keeps a table JOIN without a wrap
  (every existing count assertion is join-free / recursive-wrap / compound-wrap / distinct-groupBy-wrap).
  - **Fixture:** `docs.select-page.test.ts` (alongside the plain-filtered fast-path sibling) or
    `select.execute-count.test.ts`.
    `selectFrom(tProject).innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id)).where(tProject.id.greaterThan(0)).select({id:tProject.id,title:tIssue.title}).orderBy('id').limit(10).offset(0).executeSelectPage()`.
  - **Exact assertion (BAKED by coordinator):** `ctx.history[0].sql` =
    `select project.id as id, issue.title as title from project inner join issue on issue.project_id = project.id where project.id > $1 order by id limit $2 offset $3`;
    **load-bearing** `ctx.history[1].sql` =
    `select count(*) from project inner join issue on issue.project_id = project.id where project.id > $1`
    (retains JOIN + WHERE, drops paging, **no `result_for_count` wrap**); plus
    `assertType<Exact<typeof page, { data: Array<{id:number;title:string}>, count: number }>>`.
  - **Grep (absent):** `grep -rnE 'select count\(\*\) from [a-z_]+ (inner join|join|left join|left outer join)' test/db/` → empty.
  - **Tier note:** medium-wide; propagates cleanly to all 6 dialects (no ORDER BY in the count query, so
    SqlServer's `offset 0 rows` injection does not apply). Optional second arm: a `leftJoin` variant
    (same emission path, diverges on the count **value** since unmatched left rows inflate the count).

### Surface F4-INSERT

- **INS-A1 · T3 · multi-row bare `onConflictDoNothing()` → `returningOneColumn(col)` → `executeInsertMany()`.**
  The one-column arity twin of the object-shape path covered at `insert.returning.test.ts:285`.
  Distinct fn-type/composable (`ReturningOneColumnOptionalFnType` → `ComposableCustomizableExecutableInsertOptional`
  → `ExecutableInsertReturningOptional.executeInsertMany`); grep-absent (`.values([` + `onConflictDoNothing`
  + `returningOneColumn` = 0 hits).
  - **Fixture:** drop next to `insert.returning.test.ts:285`. `ctx.mockNext(['A','B'])`;
    `insertInto(tOrganization).values([{name:'A',plan:'free'},{name:'B',plan:'pro'}]).onConflictDoNothing().returningOneColumn(tOrganization.name).executeInsertMany()`.
  - **Exact assertion (BAKED by coordinator):** SQL
    `insert into organization (name, plan) values ($1, $2), ($3, $4) on conflict do nothing returning name as result`,
    params `['A','free','B','pro']`; `assertType<Exact<typeof names, string[]>>`;
    value `['A','B']` (or `[]` when both rows conflict).

### Surface F1-NUM

- **NUM-A1 · T3 · adapter-bearing numeric column into a non-`add` `SqlOperation1` method
  (`divide`/`power`/`logn`/`roundn`/`atan2`) + the derived-math result leaf (`sign`).**
  Distinct code path from the `add`-covered dispatcher (`createSqlOperation1ofOverloadedNumber`):
  these build `SqlOperation1ValueSource` directly with `getTypeAdapter2(this, value)`, threading the
  receiver's adapter onto operand + result. By-design (I.3), same mechanism as the tested
  `shiftedAmount.multiply` / `releaseOrdinal.subtract`, but untested for these methods on a plain-int
  adapter column.
  - **Fixture:** `select.adapter-into-methods.test.ts` (alongside `score.add(5)`), `tProjectReview.score`
    (int, scaledTenthAdapter). Value-validatable representative = `divide` (power overflows — not value-safe).
  - **Exact assertion (BAKED by coordinator):** `select({dv: tProjectReview.score.divide(2)})` where id=1
    → SQL `… score::float / $1::float as dv …`, **params `[20, …]`** (the ×10-scaled divisor is the
    load-bearing pin), `assertType<Exact<…{dv:number}>>`; mock raw `{dv:425}` reads ÷10 → **42.5**.
  - **Note:** pin the by-design behavior (consistent with the ratified `shiftedAmount.multiply` pin).
    Do **not** implement if the maintainer rules I.3's footgun a LIMITATION instead — in that case the
    test becomes a `// TODO[LIMITATION]` marker, not a live pin.
  - **Grep (absent):** `grep -rnE "(score|invoiceNo|scaledCost)\.(power|logn|roundn|atan2|divide)\(" test/db/` → 0.

### Surface F5-CONN

- **CONN-A1 · T3 (borderline) · `aggregateFragmentWithType('boolean', 'required'|'optional', adapter)`.**
  The lone uncovered (kind × aggregate-builder × adapter-slot) cell; every other kind has an adapter
  arm, boolean has only the two no-adapter arms (`fragments.type-coverage.test.ts:182/:211`). The
  fragmentWithType boolean+adapter twin (CONN-1) is covered; this is its aggregate sibling.
  - **Fixture:** inline `negateBoolAdapter` (already local to `fragments.type-coverage.test.ts`) + `tIssue`.
  - **Exact assertion:** `ctx.mockNext({any:true})`;
    `select({any: aggregateFragmentWithType('boolean','required', negateBoolAdapter).sql`count(*) > 0`})`
    → SQL `select count(*) > 0 as "any" from issue`, `assertType<Exact<{any:boolean}>>`, value `false`
    (count(*)>0 = true → negate → false). +optional sibling (**CONN-A1b**, T4 — NULL-through over an
    empty group).
  - **Note:** borderline R-P7 (the adapter2 slot + the boolean marshaller are each individually
    covered), but genuine-by-distinct-value and parallel to the R50 CONN-1/2/3 completeness seed. A
    defensible +2-test cap OR an explicit R-P7 close — maintainer's call. Body `count(*) > 0` is
    portable (not the "no portable boolean max()" the stale comment in I.5 claims).

---

## PART III — OUT (named, so not re-chased)

- **SEL-A-1 (negative-type, not §A per §5)** — compound `customizeQuery` narrower-type lock. The
  compound `CompoundedCustomizableExecutableSelect.customizeQuery` takes the narrower
  `CompoundSelectCustomization` (select.ts:94), which excludes the 5 SELECT-only hooks
  (`afterSelectKeyword`/`beforeColumns`/`customWindow`/`beforeOrderByItems`/`afterOrderByItems`);
  the positive compound-customization surface is saturated (`customize-query.compound.test.ts`) but no
  **negative-type** test locks that those hooks are rejected on a compound `customizeQuery`. It guards a
  concrete silent-drop path (widening the param to `SelectCustomization` would let 3 of them compile and
  drop at runtime — the compound branch has no top-level SELECT to host them). **Valid guard, but a
  `types.negative/` lock → OUT of §A scope** (negative-type territory, §5). Optional: add to
  `postgres/types.negative/select.test.ts` (one `@ts-expect-error` per hook). Emission premise
  (3 hooks have no compound render site) is a HYPOTHESIS from reading `AbstractSqlBuilder.ts:812-876` —
  confirm the `@ts-expect-error` placements compile-fail under tsgo before baking. Accuracy note: only
  `afterSelectKeyword`/`beforeColumns`/`customWindow` are true silent-drops; the two order-by hooks
  would actually render if permitted (the compound emission reads them via `_buildSelectOrderBy`).
- **TEMP-A-1 (negative-type, not §A)** — `getTime()` absence not locked on the custom-branded
  temporal twins (`tProjectRelease.releasedOn.getTime()` / `cutoffTime.getTime()`). TEMP-1 locks the
  plain leaves; the custom twins lock only the date/time partition. Marginal (the getTime partition is
  already caught by the plain-leaf locks). A 2-line `@ts-expect-error` in `types.negative/select.test.ts` →
  OUT of §A scope; R-P7-marginal.
- **Pure compile-only / mechanism-redundant closes:** F9-TYPEVAR (left-join-through-operator at top
  level = same `?: T` as covered; SameOuterJoin operator-merged element leaf = value-boundary-free
  type-lock; asInt/asDouble brand-erase not type-reachable; scalar-subquery-into-operator redundant).
  F2-VALVIEW value-source-cell candidates (null-producing / non-int / column-ref — value-agnostic
  `_appendSql` branch / not type-reachable). F7-EXTRAS `fromRef` left-join overload (type-locked +
  runtime-identity). F1-STR const-string-receiver (generic dispatcher, representative tested).
- **Standing OUT boundaries (unchanged):** L-1 custom-temporal const/arg getter bare `extract`
  LIMITATION; §B sequence non-numeric; brand-only PK read; `double.modulo` float% PG-reject; bigint /
  customInt / customDouble extended-math typed-never (negative-locked); `SQL_*` / `INTERNAL` /
  impossible-state = `src/queryRunners/` layer; non-existent APIs (split/splitRequired/
  executeSelectCount / crossJoin / fullOuterJoin / rightJoin / lock-clause family / compound groupBy·having /
  selectFromModel; ForcedTypeAdapter → real ForceTypeCast).

---

## PART IV — Per-surface saturation table

| Surface | §A (actionable) | Verdict |
|---|---|---|
| F-RECENT (R50 fix + backlog) | 0 | fix complete+sound; +22 baked-in clean |
| PARITY (twin-parity) | 0 | saturated; fix confirmed; 2 §C non-defects |
| MUT-SEAM | 0 | saturated; onConflictOnConstraint.where = sound type-boundary |
| SEL-SEAM | 0 (SEL-A-1 = neg-type, OUT) | saturated |
| F9-TYPEVAR | 0 | saturated |
| F1-EQCMP | 0 | saturated |
| F6-DYN | 0 | saturated (CAND-F present) |
| F3-PROJ | 0 | saturated; pick §B corroborated sound |
| F7-EXTRAS | 0 | saturated (6/6 Row/ShapedAs locks; 72/72 reasons) |
| F1-STR | 0 | saturated (LIKE refactor not regressed) |
| F2-VALVIEW | 0 | saturated (VALVIEW-1 sound) |
| F1-BOOLIF | 0 | saturated (CAND-F present) |
| F1-TEMP | 0 (TEMP-A-1 = neg-type, OUT) | saturated (L-1 present) |
| F2-COL | 0 | saturated (17 col_matrix ×21 tests symmetric) |
| F1-CUSTOMNUM | 0 | saturated (brand keep/erase complete) |
| **F4-UPDDEL** | **1 (DEL-1)** | 1 asymmetric twin gap; CAND-A present |
| **F3-SELECT** | **1 (SEL-JOIN-COUNT-1)** | 1 emission gap |
| **F4-INSERT** | **1 (INS-A1)** | 1 arity twin gap |
| **F1-NUM** | **1 (NUM-A1)** | 1 by-design completeness gap |
| **F5-CONN** | **1 (CONN-A1)** | 1 borderline kind×agg×adapter cell |

**13/20 surfaces fully saturated (§A=0).** 5 surfaces carry one low-tier §A each. Confirmed
defects: ~~**0**~~ — **this table predates the corrections and is the "0 bugs" verdict §VIII
retracts**. The real count is **3** (BUG 1 + BUG 2 + the `exactOptionalPropertyTypes` guard,
§I.2-fix), all three surfaced by the maintainer and none by the fan-out — so the per-surface
verdicts below should be read as "nothing further found by the method". Note F3-PROJ and F1-NUM
are recorded "saturated" while BUG 1 and the guard accident sat inside their surfaces.

---

## PART V — Coordinator verification notes (what I checked, how it resolved)

- **R50 fix twin-parity** — direct read of `insert.ts:47-138` + `:700-758`: all 6 doNothing→Optional
  confirmed; `ReturningMultipleLastInsertedId(Optional)?Type` byte-identical (`:704`≡`:745`),
  independently confirmed by PARITY and F-RECENT.
- **Pick §B (I.2)** — read the exact test (`dynamic-condition.pick.test.ts:539-577`): type present-key
  `Date | undefined` vs runtime `'archivedAt' in proj === false`. Cross-checked: R49-ratified
  (memory), F3-PROJ deems sound. → ~~settled, not re-filed~~ **WRONG — this was BUG 1** (§I.2, fixed
  §I.2-fix). Note what this entry actually verified: that the type and the runtime **contradict each
  other** — and then closed on two appeals to authority ("R49-ratified", "F3-PROJ deems sound") without
  asking which of the two was right. The contradiction *was* the evidence.
- **NUM-A1 / Candidate B (I.3)** — **baked** on the mock: `score.divide(2)` → `score::float / $1::float`,
  param `20`, raw 425 → 42.5; `score.multiply(2)` → param 20, 1700; `score.sign()` → 0.1. Reconciled
  against F1-CUSTOMNUM's already-tested `shiftedAmount.multiply` (operand −998) / `releaseOrdinal.subtract`
  → uniform, ratified mechanism → by-design, not a bug.
- **SEL-JOIN-COUNT-1** — **baked**: count query = `select count(*) from project inner join issue on
  issue.project_id = project.id where project.id > $1` (unwrapped, keeps join+where). Confirmed distinct
  from every existing count assertion.
- **INS-A1** — **baked**: `insert into organization (name, plan) values ($1, $2), ($3, $4) on conflict
  do nothing returning name as result`, params `['A','free','B','pro']`, value `['A','B']`.
- **DEL-1** — emission confirmed via existing `delete.returning.execute-shapes.test.ts` (`returning
  <col> as result` baked); the two throw inhabitants are the only new surface.
- **MUT-SEAM onConflictOnConstraint.where** — traced: `.where()` is type-unreachable after a bare named
  constraint (returns bare `NEXT`, no `OnConflictOnColumnWhere` intersection), so the `INTERNAL 'Illegal
  state'` throw is dead via the typed API. Sound boundary, not a defect.
- **CAND-A / CAND-F / froms.length<0** — re-confirmed present, no value/SQL surface.
- All probes (`zzz-probe-numadapter.test.ts`, `zzz-probe-emissions.test.ts`) deleted;
  `git status --porcelain` clean except the pre-existing R41 `M` on `.gitignore` +
  `TYPE_AUDIT_RUNBOOK.md` (not reverted) and the untracked prior-round `MISSING_TESTS_AUDIT_*.md`.

---

## PART VI — §B fixture-addition plan

**None required for the §A items** (DEL-1, SEL-JOIN-COUNT-1, INS-A1, NUM-A1, CONN-A1 all use existing
fixtures/columns). F5-CONN's §B slices (sequence `double`/`customDouble` + adapter; `arg`/`valueArg`
over `customLocalDate`/`customLocalTime`/`customLocalDateTime`) are all **R-P7-closeable**
distinct-type-only (kind-agnostic construction; bound-value marshalling covered by the column/const
paths) — not recommended.

---

## PART VII — Recommended implementation order

1. ~~**BUG 2** (base dialect `_asDouble` / `_divide`)~~ — **DONE** (§I.3-fix), and this item's
   **first** option was the right one: base → `cast(… as real)`, SQLite overrides **deleted** (the
   `_likeEscape` remedy shape, as predicted). Per the maintainer's rule — *the base implementation
   must be used by at least one dialect; the base is SQLite ∪ PostgreSQL* — the minimal `precision`
   arm is **wrong**, because it leaves the base used by nobody. Emission byte-identical, zero
   snapshots moved, and the base is now covered by the 6 SQLite connectors.
2. ~~**BUG 1** (projector present-key)~~ — **DONE** (§I.2-fix), but **not** the way this item
   prescribes: "`TransformOptionalProperties` must distribute rather than bail" is a **300× compile-time
   trap that also breaks 11 doc examples** (measured). The fix restores v1's shape — union *outside* the
   transform in `ResultObjectValues2..5` — and **keeps** the two guards (removing them re-breaks the
   same 11 examples). `resultWithOptionalsAsNull` stayed as-is, as predicted; the sweep was 2740
   assertions / 473 files / 28 basenames (wider than "`dynamic-condition.pick.*` +
   `select.complex-projection.*`", because the `exactOptionalPropertyTypes` half reaches
   `aggregation` / `fragments.*` / `select.value-source.*` / `with-values.*`); the `'k' in obj` probes
   passed unchanged, as predicted.
3. **DEL-1** (T2) — the one asymmetric twin gap (DELETE value-gates mirroring the just-landed UD-3); +2 tests.
4. **SEL-JOIN-COUNT-1** (T2) — the one emission gap (count fast-path over a join); 1 test, medium-wide propagation.
5. **INS-A1** (T3) — one-column arity twin; 1 test.
6. **CONN-A1 (+A1b)** (T3) — boolean aggregate+adapter completeness cap; +2 tests (or R-P7-close).
7. **NUM-A1** — **deferred** pending the type-adapter rework (I.3b); do not bake a pin of behaviour that
   is scheduled to change.
8. **Optional negative-type guards (OUT of §A):** SEL-A-1 (compound customizeQuery), TEMP-A-1 (getTime
   custom twins).
9. **Optional doc-hygiene:** correct the stale "no portable boolean `max()`" comment (I.5).

Maintainer decision remaining: ~~BUG 2's base shape~~ — **settled by the maintainer**: SQLite-shaped
(`as real`) in the base, SQLite overrides **deleted**, per *the base implementation must be used by at
least one dialect* (§I.3-fix). CONN-A1 — bank the +2 completeness cap or R-P7-close? **Still open.**

**New for R52 (found while fixing, not by this round's method):** the v2 rework also dropped v1's
`FixPickableObjectWhereCouldBeNotPicked` (`{ } extends RESULT ? RESULT | undefined : RESULT` —
"if all properties can be omitted in a select picked, the object can be absent as well"), which v1
wrapped around **every** rung, plus its `…ProjectedAsNullable` twin. `grep -rn "CouldBeNotPicked\|{ } extends RESULT" src/`
→ empty. The runtime does implement the semantics (`__transformProjectedObject` → `if (!keepObject)
return undefined`), so a rule-3 container whose required leaves are all un-picked would be typed
required while the runtime can drop it. **Not reproduced** — found by diffing `origin/v1`, not by a
failing test, and the rules may already cover it via `ContainsRequired` on the picked columns. Not
filed to `BUGS.md` (that file takes reproducible issues only). Confirm reachability with a picked
select before touching it.

---

## PART VIII — Verdict (honest)

**2 confirmed defects — and the round's method failed to find either of them.** That is the honest
headline. The 20-agent fan-out plus my own coordinator pass produced a confident "0 bugs, 13/20
saturated" report. Both defects were then surfaced by the maintainer rejecting that verdict and
pointing at two things I had not actually checked: *the projection norms* and *the arithmetic emission
absent adapter noise*.

**The failure mode was the same in both, and it is the one the runbook explicitly forbids: I inherited a
verdict instead of re-deriving it.**

- **BUG 1**: I closed the pick present-key candidate on "R49 ratified this representation" + "F3-PROJ
  says the tests are sound". Neither is evidence about *correctness* — R49 merely **pinned observed
  behaviour**, and a test asserting the current type is exactly what a baked-in bug looks like. Reading
  `projectionRules.ts` — nine lines of normative text — settles it in minutes: the norms say "marked as
  **optional**" for every rule, and the projector demonstrably fails to deliver that whenever the
  container is optional.
- **BUG 2**: I never examined the arithmetic emission at all. I spent the whole numeric budget on the
  adapter-threading interaction — which the maintainer has now descoped as noise scheduled for removal —
  and the actual defect sat two lines away in the base dialect, already documented in two prior reports
  as "cosmetic/dormant/OUT". The R49 base-dialect rule that overturns exactly that classification is in
  the runbook, written there by me, and I still didn't apply it.

Consequently the "13/20 saturated" and "0 bugs" claims elsewhere in this report should be read with
appropriate discount: they mean *nothing further was found by the method*, not *nothing further exists*.

What does stand, and is independently corroborated: the R50 fix is complete + sound (three-way,
including the byte-identical `returningLastInsertedId` aliases); the +22 backlog is baked-in-clean
across all 12 files including the 4 premise-corrected ones; operator precedence is probed correct; and
the §A tail (DEL-1, SEL-JOIN-COUNT-1, INS-A1, CONN-A1) is real, emission-baked, and low-tier.

**For R52:** the two highest-value moves are (a) re-open every prior-round "cosmetic / dormant / OUT /
ratified / already tested" verdict and re-derive it against the **norms and the emission** — the
inherit-no-verdict rule is not decoration, it is where both of this round's bugs were hiding; and (b) when
a surface has a normative spec in `src/` (projection rules, dialect config), audit **against the spec**,
not against what the tests currently assert.

### VIII-fix — outcome, and what the fixing pass added to the lesson list

Both defects are fixed (§I.2-fix, §I.3-fix). The diagnoses held. The two prescribed remedies split:
**§VII.1's (SQLite-shaped base) was right and I wrongly rejected it; §VII.2's (distributing transform)
was a 300× compile-time trap and I wrongly trusted it enough to try it first.** Neither verdict came
from reading — both came from measuring and compiling. So:

- **A diagnosis and its remedy are separate claims, and this report verified only the first.** Every §V
  entry backs a claim about *what is broken*; not one backs the *fix* proposed in §VII. Those
  prescriptions read with the same confidence as the findings and had none of the evidence — and it
  cut both ways: one was a trap, one was correct, and **the report gave no way to tell them apart**.
  A `**Where**` line is triage; a remedy is a hypothesis until compiled.
- **The norms rule (b) has a companion: prefer the norm carried in `git`.** Rule (b) sent me to
  `projectionRules.ts`, which was right and found the bug. But the *shape of the fix*, the fact that it
  is a **regression** rather than an original defect, that the guards are load-bearing, and the whole
  `exactOptionalPropertyTypes` half were all only visible in `origin/v1` — a normative source no round
  has consulted. When a subsystem has been reworked, **diff it against the branch it was reworked from**
  before designing anything.
- **The third finding is the indictment.** The `exactOptionalPropertyTypes` guard accident was not on
  any agent's list, is not in this report, and was surfaced by the maintainer — *for the third time in
  one round*. And a prior round had not merely baked it, it had **invented a rule to explain it**
  ("distinct from the plain `key?: T` shape produced for scalar inline subqueries"). §VIII already says
  a test asserting current behaviour is not evidence; the sharper form is: **a comment that explains why
  the current behaviour is correct is the strongest available signal that nobody re-derived it.**
- **Not every norm is written down — and inferring one from the surrounding code is a hypothesis, not a
  norm.** BUG 2's fix needed a rule that exists in no file: *the base implementation must be used by at
  least one dialect; the base is SQLite ∪ PostgreSQL*. Absent it, I inferred "the base is
  standard-SQL-shaped" from `coalesce` / `current_date` / `_likeEscape = ''` — defensible from the code,
  wrong about the intent — and shipped a base **no dialect uses**, re-creating the exact condition that
  let `presition` rot for three rounds. My own analysis had already noted "the base is a default that
  never hits" and stopped short of the conclusion. **When a fix must choose between shapes, the choice
  is design intent: ask, don't infer.** The rule is now recorded in §I.3-fix and belongs in
  `TYPE_AUDIT_RUNBOOK.md` beside the R49 base-dialect rule — R49 says a broken base is a real bug; this
  says why: *an unused base is dead by construction and will rot.*

Honest scoreboard for the round: **3 defects, 0 found by the method, 3 surfaced by the maintainer** —
plus 2 remedy errors in the fixing pass (trusting §VII.2's trap, rejecting §VII.1's correct shape),
both caught by the maintainer as well.
