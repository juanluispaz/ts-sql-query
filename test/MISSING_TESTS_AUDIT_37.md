# MISSING_TESTS_AUDIT_37 — maximal, from-scratch, type-driven audit

> **Mandate (Round 37).** A *fresh, full* re-derivation of the whole typed
> surface — inheriting NO "covered / saturated / degenerate" verdict from any
> prior round. Dial: **MAXIMAL SATURATION, LIST > CLOSE.** Every reachable
> type-path with ANY observable surface (declared type, emitted SQL, or realized
> value) is LISTED at its tier, including the per-variant completeness tail prior
> rounds closed. The only OUT reasons are the four genuine ones (unconstructible
> / pure-phantom-no-observable / `src/queryRunners/` driver layer / a new matrix
> cell). Report length/organization is secondary to completeness.
>
> **Method.** 20 read-only discovery agents (16 per-surface + F-RECENT +
> F9-TYPEVAR + two seam critics + PARITY), ≤10 concurrent, each enumerating its
> full matrix against the CURRENT test tree. Coordinator (this file) verified
> every load-bearing claim itself (compile-repros, runtime-source-traces,
> wide-greps). All probes deleted; tree clean.
>
> **Matrix now.** 17 cells · 238 test files · 2737 tests/cell · 46 529 tests ·
> `tests:audit` clean. Reference cell `test/db/postgres/newest/pg/` (243 files) +
> `test/db/postgres/types.negative/` (8 files). Fixtures: `domain/connection.ts`
> (947 lines — 18 tables, 2 rich views, full executeFunction/fragment/sequence
> fan-out, adapters of every kind).

## Headline counts

- **Confirmed `src/` bugs: 0.** (Two candidates surfaced; one REFUTED as dead,
  one CONFIRMED low-severity error-message-only — see below.)
- **Surfaces returning SATURATED (genuinely 0 or only-T4-tail): 15 of 16** — the
  suite is at very high maturity. Named in the saturation table.
- **Genuine §A findings (existing fixtures, real distinct SQL/value): 17**,
  tiered T1–T4.
- **§B findings (need a fixture addition): 5** (+ the large per-factory-kind T4
  tail).
- **Negative-type locks surfaced separately (`types.negative/`): 5 clusters**
  (~30 `@ts-expect-error` assertions).
- **REFUTED (recorded so a future round does not re-chase): 4.**

The round's real value is a small set of **coverage-invisible emission/value
branches** (§A Tier-1/2) that execute on existing tests but whose distinguishing
output is never triggered, plus the freshly-changed surfaces' unlocked twins.

---

## 0. Bugs & candidate defects

### 0.1 — CD-1 (PARITY): `update.ts:532` stray `| NOldValuesFrom` — **REFUTED as a bug** (triply confirmed)

`ReturningOneColumnFnType`'s **sqlite** arm (`src/expressions/update.ts:531-532`)
carries a trailing `| NOldValuesFrom<TABLE[source]>` at the column-constraint
level (outside `ValueSourceOf<…>`) that both its object-form twin
(`update.ts:525`) and the DELETE analog (`delete.ts:188`) lack. PARITY flagged it
as a possible copy-artifact letting an old-values source through where a column
is expected.

**Verdict: DEAD / inert, not exploitable, not a test gap.** Three independent
confirmations:
1. **Compile-repro** (coordinator, on `sqlite/newest/better-sqlite3`):
   `tProject.oldValues()` fails to typecheck on a `SqliteConnection`
   (`@ts-expect-error` held) while `update(t)…returningOneColumn(tProject.name)`
   compiles normally — the stray union does not break the normal path and admits
   nothing extra.
2. **`Table.ts:58-64`**: `oldValues()` has overloads only for
   `this: OfDB<'sqlServer'|'mariaDB'|'noopDB'|'postgreSql'>` — **the sqlite
   overload is commented out (line 63)**. So no old-values proxy is constructible
   on sqlite at all.
3. **`sourceName.ts:66-77`** (F4-UPDDEL): `NOldValuesFrom<S>` resolves to a
   **template-literal string brand**, not a `ValueSource` object; a `column`
   argument is always a `ValueSource`, never assignable to a bare string brand →
   the stray union member matches no constructible argument. The boundary is
   already fenced at `sqlite/types.negative/update.test.ts:57-58`.

**No authorable test distinguishes current behavior** (the argument is
unconstructible today) → OUT as an audit item. **Correction from the maintainer:**
this is **not** dead code and must **not** be deleted — the `| NOldValuesFrom<…>`
member is **intentional forward-scaffolding** awaiting SQLite's pre/post (OLD/NEW)
column-reference feature (the sqlite `oldValues()` overload is commented out at
`Table.ts:63`, pending sqlite forum `2d49770b89`); it becomes live once that lands.
The only open item is a consistency call — the scaffolding sits only on the
one-column update arm, not the object-form (`update.ts:525`) or delete
(`delete.ts:188`) arms. Filed in `BUGS.md` as a LIMITATIONS-style pending item,
behavior-neutral. (My earlier "delete for symmetry" reading was wrong.)

### 0.2 — CD-2 (F6-DYN): `DynamicConditionBuilder.ts:93` stray-space error path — **CONFIRMED, low-severity, error-message-only**

`processFilter` builds the recursion prefix as `prefix + ' .' + key` (a stray
**space before the dot**) when recursing into a **nested non-value-source
projection at depth ≥2**. The intended separator is `'.'` — proven by the
sibling `column + '.' + key` at line 142. Effect: the `path` field of a
`TsSqlProcessingError` (`DYNAMIC_CONDITION_UNKNOWN_COLUMN` /
`INVALID_FILTER` / `UNKNOWN_OPERATION`) thrown inside such a nested object reads
e.g. `"project .assignee"` instead of `"project.assignee"`.

- **No emitted SQL is affected** (column names come from the value sources, not
  the prefix). It only pollutes the public `errorReason.path` string.
- **Reachability** (coordinator source-read confirmed): requires a nested
  projection whose value at some key is itself an object of sub-columns (not a
  value source) at depth ≥2, then a deliberate error inside it. Existing tests
  (`nested-extension.test.ts` depth-3) recurse through value-source columns
  (hitting line 91, `processColumnFilter`), never line 93.
- **Both readings** per the divergence-≠-defect oracle: (a) a genuine typo (every
  other path separator is `.`; `path` is a documented public field); (b) tolerated
  loose error-path formatting (the surrounding lines are also terse — e.g.
  `prefix + key` at 82/88 with no separator). The space is objectively unintended,
  but its fix-worthiness is a maintainer call.
- **Recommendation:** file to `test/BUGS.md` **only if the maintainer deems it a
  bug**; regardless, add a **§A negative/error test** (T3): a depth-≥2 nested
  non-value-source projection with an unknown nested column, asserting the exact
  `errorReason.path` — which pins (and, after a fix, corrects) the malformed
  value. Currently the depth-≥2 error `path` is untested entirely.

### 0.3 — All other surfaces: 0 candidate defects

MUT-SEAM, SEL-SEAM, F4-INSERT, F4-UPDDEL, F1-NUM, F1-STR, F1-BOOLIF,
F1-CUSTOMNUM, F1-TEMP, F3-SELECT, F3-PROJ, F6-DYN, F7-EXTRAS each probed their
highest-risk compositions/emissions and found no wrong output. Notable
refutations of *hypothesised* defects (probe > trace):
- **F9-TYPEVAR #4** (optional `executeFunction` NULL for Date-marshalled kinds) —
  hypothesised a distinct null-marshalling code path; coordinator source-trace of
  `AbstractConnection.transformValueFromDB` (line 1147) shows a **type-agnostic
  null guard** (`if (value === null) return null`) **before** the type switch, so
  every kind short-circuits identically. The Date marshaller is never invoked with
  null → no bug; the string-null test already covers the mechanism. (Downgraded
  from T3 to T4-representative — see §3.)
- **Theme-7 custom-temporal getters** (F1-TEMP) — getter emission is
  operation-name-based, not leaf-based; plain vs custom temporal getters emit
  identical SQL, so no "distinct custom-SQL arm" exists for a defect to hide in.

---

## 1. §A findings — Tier 1/2 (distinct code-path / emission; coverage-invisible; highest value)

These are the round's crown: emission branches that **execute on existing tests
but whose distinguishing output is never triggered** because the test inputs
never carry the feature that flips the branch. Coverage is green through every
one. All §A (existing fixtures), all real-DB-validatable.

### T1-1 — String affix predicate with a CONST operand containing `%` / `_` / `\` (the literal wildcard-escape branch) — F1-STR
- **Src:** `AbstractSqlBuilder._escapeLikeWildcard` (2887-2896), string arm. Every
  existing affix test either hits the value-source arm (triple-`replace`, covered
  by `like-escape.test.ts`) **or passes a wildcard-FREE literal** through the
  string arm, where the three `.replace()` calls are no-ops. The escape of
  `\`→`\\`, `%`→`\%`, `_`→`\_` in the bound param is **never observed**.
- **Per-dialect divergent** (mock-visible, no docker needed): pg/sqlite
  `%`→`\%`; mysql/maria `\`→`\\\\`; sqlserver/oracle bracket-escaping
  (`%`→`[%]`, `_`→`[]`, `[`→`[[]`). `contains('50%')` binds `'50\%'` on pg but
  `'50[%]'` on mssql.
- **Coordinator-verified ABSENT:** wide-grep of all 17 cells — 0 affix predicates
  fed a `%`/`_`-containing literal; 0 `\%`/`[%]` escaped params in any snapshot
  (the only `%`-carrying params are raw `like` patterns, which are un-escaped by
  design).
- **Affected (all take the string arm on a const):** `startsWith`/`notStartsWith`/
  `endsWith`/`notEndsWith`/`contains`/`notContains` + their 6 `*Insensitive`
  twins + all 12 `*IfValue`/`*InsensitiveIfValue` twins. `like`/`likeInsensitive`
  are NOT affected (raw pattern).
- **Test (§A, fixtures `tAppUser.email`/`tIssue.title`):** a
  `select.where.like-escape-literal.test.ts` sibling of `like-escape.test.ts`,
  asserting the escaped bound param — `email.contains('50%_x')` → pg param
  `'50\%\_x'`, mssql `'50[%][]x'` — one column-required receiver representative
  suffices, then the `not`/`Insensitive` twins.

### T1-2 — Getter on a CONST temporal receiver (the `isConstValue()` cast arm) — F1-TEMP
- **Src:** `PostgreSqlSqlBuilder._appendSqlForDatePartArgument` (466-471): two arms
  — `isConstValue()` → `forceTypeCast=true` → `extract(<part> from $1::date|::time|::timestamp)`; else → no cast. Every existing getter test uses a **column**
  receiver (the no-cast arm). The const-cast arm exists precisely so PG doesn't
  reject an untyped `$1` inside `extract(...)`.
- **Coordinator-verified ABSENT:** wide-grep all 17 cells — 0 `extract(… from
  $N::…)`. (`date-ops.unix-formats.test.ts` is a sqlite-only NOT-APPLICABLE file,
  a different override.)
- **Load-bearing (near-T1):** a silent regression breaks const-temporal getters
  with no test to catch it.
- **Test (§A, no fixture):** `conn.const(new Date(Date.UTC(2024,0,15)),
  'localDate').getMonth()` → `extract(month from $1::date) - 1`;
  `…'localTime').getHours()` → `extract(hour from $1::time)`;
  `…'localDateTime').getTime()` (+ the 9-getter set). Add to `select.date-ops.test.ts`
  (or a new `select.value-source.const-temporal-getters.test.ts`).

### T2-1 — `A or (B and C)` right-operand parenthesisation branch of `_or` — F1-BOOLIF
- **Src:** `AbstractSqlBuilder._or` (3098), the `op2 === '_and'` branch wraps the
  RIGHT operand of an OR when it is an AND: `A or (B and C)`. Its three sibling
  precedence branches ARE pinned (`(A or B) and C`, `A and (B or C)`,
  `(A and B) or C`); this one is not.
- **Coordinator-verified ABSENT:** 0 user-facing `.or(….and(…))` across all
  cells; the only `or (X and Y)` snapshots are SqlServer's *internal* `_is`
  emulation, not a user combinator.
- **Test (§A, `tIssue`):** in `select.value-source.boolean-chain.test.ts`,
  `status.equals('open').or(priority.greaterThan(1).and(priority.lessThan(3)))`
  → `… where status = $1 or (priority > $2 and priority < $3) …`. Distinct SQL,
  real-DB-validatable.

### T2-2 — Boolean read from a NUMERIC STRING (`'1'`/`'0'`) — F-RECENT (commit 78bb0539)
- **Src:** `AbstractConnection.transformValueFromDB` now returns `!!(+value)` for a
  numeric-string boolean (regex `/^(-?\d+)$/`). It is on the **shared** connection
  path (not oracle-only) and **mock-observable** via the `fromDbValue`/`fromDbReason`
  helpers.
- **Coordinator-verified ABSENT:** adjacent arms pinned in
  `marshalling.transform-validation.test.ts` (`boolean-from-number` :177,
  `boolean-invalid-throws` :182 — a *non-numeric* string still throws), but the
  new numeric-string branch has no test (grep empty).
- **Test (§A, same file/pattern, mock-only):** `fromDbValue(bool,'1')→true`;
  `fromDbValue(bool,'0')→false`; boundary `fromDbValue(bool,'-5')→true`
  (leading-minus accepted by the regex); `fromDbReason(bool,'1.5')→INVALID…`
  (decimal still rejected). Optional docker-only oracle VALUE test on a real
  numeric-boolean column as a secondary.

**Why these four are Tier-1/2, not tail:** each is a distinct emitted-string /
realized-value that *no snapshot pins*, on a branch that runs today with a benign
input. This is the exact "output-coincidence masks real risk" vein (§9); the fix
is to feed the triggering input (a wildcard char, a const receiver, a nested-AND
under OR, a numeric-string).

---

## 2. §A findings — Tier 2/3 (distinct overloads / emission / value; regression-locks on freshly-changed surface)

### T2-3 — CustomInt arithmetic `SOURCE | VALUE[source]` cross-table tracking is UNLOCKED — F-RECENT LIST-1 / F1-CUSTOMNUM T3 (two agents converge)
- **Src (coordinator-verified via `git show 8d4585c2 -- src/expressions/values.ts`):**
  commit 8d4585c2 widened `CustomIntValueSource` `minValue`/`maxValue`/`add`/
  `subtract`/`modulo` from `<SOURCE, …>` to `<SOURCE | VALUE[typeof source], …>`
  (the same table-tracking fix class as `valueWhenNull`/`nullIfValue`, which got
  the full neg-lock in 9125b88f). These 5 arithmetic siblings have **only
  self-operand runtime tests** (`numeric-operand-coverage.test.ts:73-76`, same
  column → the source-union collapses to `SOURCE`, never exercising the added
  `VALUE[source]`).
- **Coordinator-verified ABSENT:** no cross-table arithmetic neg-lock in
  `types.negative/` (grep empty).
- **Tests (§A, fixtures `costCents` + `.as('worklog2')`):**
  - **positive control (runtime):** `costCents.add(worklog2.costCents)` with
    `worklog2` joined → SQL `cost_cents + <alias>.cost_cents`, value round-trips;
  - **neg-lock (`types.negative/select.test.ts`, mirroring :265):**
    `costCents.add(worklog2.costCents)` selected without `worklog2` in FROM →
    `@ts-expect-error operand from a table not in the FROM`; one representative
    lowers the tier — the full T4 tail is all 5 methods.

### T2-4 — CustomDouble source-union neg-lock is ENTIRELY absent — F1-CUSTOMNUM T2
- CustomDouble `valueWhenNull`/`nullIfValue` (and the arithmetic siblings) already
  carry `SOURCE | VALUE[source]` in src, but `types.negative/select.test.ts:249-273`
  locks the union **only for CustomInt**; its comment even *asserts* "like
  CustomDouble / Bigint / Number" without a CustomDouble lock. CustomDouble
  source-tracking is wholly unlocked.
- **Test (neg-lock, fixture `billedAmount` + `.as('worklog2')`):** a symmetric
  `billedAmount.valueWhenNull(worklog2.billedAmount)` with `worklog2` not in FROM
  → `@ts-expect-error`. The strongest of the source-union locks (a whole leaf's
  tracking is unguarded).

### T2-5 — Two custom-kind-marshal-then-adapter WRITE bindings — F2-COL §A-1
- `select.table-adapter-columns.test.ts` pins READ+asOptional for all 11
  `tReleaseDraft` adapter columns; `update.custom-columns.test.ts:208` pins WRITE
  only for `shiftedStamp`/`shiftedCount`. Two write values are genuinely
  un-observed anywhere:
  - `scaledCost` (customInt 'Cents' + scaledTenthAdapter): `.set({scaledCost:1})`
    binds `10` — the customInt-marshal-then-×10 write is observed on no customInt
    (scaledTenth-write is pinned only on plain int);
  - `shiftedAmount` (customDouble 'Money' + plusOffsetAdapter):
    `.set({shiftedAmount:5})` binds `-995` — plusOffset-write is pinned only on
    plain int (`entryNo`).
- **Test (§A):** add both to `update.custom-columns.test.ts`, asserting the bound
  param.

### T3-1 — Compound `orderBy` value-source + raw-fragment overloads — PARITY L1
- **Coordinator-verified:** the compound interface
  (`CompoundedOrderByExecutableSelectExpression`, `select.ts:108-110`) declares
  `orderBy(valueSource)` / `orderBy(rawFragment)` overloads distinct from the
  non-compound ones; `select.compound*.test.ts` exercises **only** the string form
  (`.orderBy('label', …)`).
- **Test (§A):** `union(a,b).orderBy(<ValueSource>)` and
  `union(a,b).orderBy(rawFragment)` asserting the wrapped `select * from (…) order
  by <expr>` SQL. ~2 cells.

### T3-2 — Recursive select projecting a NESTED OBJECT (dot-alias through anchor + recursion) — SEL-SEAM G1
- Every recursive test projects flat columns. A recursive `select({ id, header:{
  num, title } })` must reproduce the `"header.num"`/`"header.title"` dot-aliases
  in **both** the anchor and the recursive member (distinct emission), and the
  nested object must survive the recursion (distinct projected type).
- **Test (§A, `tIssue`):** `recursiveUnionAllOn(...)` projecting a nested object
  → `executeSelectMany`, `assertType<Exact<…{header:{num;title}}…>>` + value.

### T3-3 — Plain-select rule-2 object DROPPED (key ABSENT) on a real left-join MISS, DEFAULT projector — F3-PROJ (oracle-driven)
- Applying the "type-self-consistency ≠ runtime-soundness" oracle: the type
  `proj?: {…}` is pinned everywhere, but the **plain × default(`asUndefined`) ×
  rule-2 miss → key-absent** runtime is asserted only via `toEqual` (blind to
  present-`undefined`). The three sibling quadrants have the explicit check
  (as-nullable plain miss→`null` at `inner-rules:2440`; default **aggregate**
  miss→absent with `expect('iss' in …).toBe(false)` at `element-projection-rules:738`).
- **Test (§A):** `selectFrom(tProject).leftJoin(tIssueLeft)…select({pid,
  iss:{id,title}})`, project 4 has no issue, `expect('iss' in row).toBe(false)`.
  A *missing assertion*, not a wrong one (no src defect).

### T3-4/T3-5 — Projector grid outer-rule-4 × inner-rule-1 (4×1) and × inner-rule-2 (4×2) — F3-PROJ
- The `matrix-*` grid in `inner-rules.test.ts` deliberately spans outer ∈ {1,2,3};
  outer-rule-4 (all-optional container via an optional own scalar) holding a
  rule-1 (reqInOptObj) or rule-2 (same-left-join) inner is absent, both projectors.
- **Test (§A, `tIssue` optional scalar + gated/left-joined inner):**
  `matrix-rule-4-outer-rule-{1,2}-inner-{default,as-nullable}` — 4 tests.

### T3-6..T3-8 — Optionality-algebra NULL inhabitants unrealized — F9-TYPEVAR
All §A (existing fixtures `estimatedHours`/`durationMs`/`billable`-NULL-on-worklog-2):
- **T3-6:** `optional × optional → optional` cell entirely unexercised (no query
  composes two optional operands, present or null) — e.g.
  `estimatedHours.add(estimatedHours)` present + both-null twins.
- **T3-7:** merged-optional **BOOLEAN 3-valued** null (`TRUE AND NULL = NULL →
  flag absent`) never realized — `activity.equals('coding').and(billable)` only
  realizes `flag=true`; `mockNext({id:2,flag:null})`, `expect('flag' in row)`
  false (and `null` under `projectingOptionalValuesAsNullable`).
- **T3-8:** direct value-source merge-optional binary-op NULL inhabitant
  (`priority.add(estimatedHours)` with `estimatedHours` NULL → absent) — realized
  today only through the fragment/`nullIfValue`/aggregate/left-join paths, never a
  plain `col.add(optionalCol)`.

### T3-9..T3-11 — Values builder-position hoists — F2-VALVIEW
All §A (existing fixtures):
- **T3-9:** `projectingOptionalValuesAsNullable()` over `selectFrom(Values)` with
  an optional Values column → leaf reads back `null` (distinct value+type; grep
  confirms zero Values-importing files use it).
- **T3-10:** Values as an **INSERT … FROM SELECT** source →
  `WITH v AS (VALUES…) INSERT … SELECT … FROM v` (WITH hoist through
  `InsertQueryBuilder` — only the update-FROM/inline/compound hoist paths are
  pinned).
- **T3-11:** Values as a **DELETE … USING** source →
  `WITH v AS (VALUES…) DELETE … USING v WHERE …` (WITH hoist through
  `DeleteQueryBuilder`).

### T3-12 — Plain-double-receiver Nullable const forms — F1-NUM T3
- `estimatedHours.valueWhenNull(0)` (optional→required flip) / `.nullIfValue(0)`
  — 0 hits matrix-wide (only int/bigint/customDouble pin these). Distinct realized
  value (the optional→required flip). §A, `select.value-source.numeric-operand-coverage.test.ts`.

---

## 3. §A / §B findings — Tier 3/4 completeness tail (LISTED per the dial, not closed)

The dial requires the per-variant tail be **enumerated with counts**, not
dropped. Each item below is dominated by a tested representative (which LOWERS
its tier) but is a distinct reachable path; the maintainer sets the cutoff.

### 3.1 — §B fixture-needs (distinct type/value, but no fixture column exists)

| ID | Finding | Src | Fixture to add | Tier |
|---|---|---|---|---|
| **B-1** | `arg`/`valueArg` over the 7 temporal/custom-fractional keywords (`localDate`/`localTime`/`localDateTime`/`customDouble`/`customLocalDate`/`customLocalTime`/`customLocalDateTime`) — **14 arms** (arg + valueArg), grep-confirmed absent across all 17 cells. Each is a distinct `Argument<KIND>` overload marshalling a distinct bound value (a `Date` through `arg('localTime')` binds `'HH:MM:SS'`). | `AbstractConnection.arg`/`valueArg` | one fragment field per kind, e.g. `dateEq = buildFragmentWithArgsIfValue(this.arg('localDate','optional'), this.valueArg('localDate','optional'))` | T3 |
| **B-2** | `buildFragmentWithMaybeOptionalArgs` runtime `undefined` inhabitant realized only at arities 1/2/3 (additive bodies); arities 4/5 pin the optional *type* but their `coalesce` bodies never return NULL. | `fragment.ts` | an additive null-propagating 4-/5-ary optional fixture | T4 |
| **B-3** | `createTableOrViewCustomization` applied to a **View** — every call site wraps a Table; grep confirms no `withSqlHint`/`withMinIdFilter` on `vProjectOverview`/`vReleaseOverview`. | `AbstractConnection` | `withSqlHint(vProjectOverview, …)` | T4 |
| **B-4** | `UNSUPPORTED_QUERY` (MySqlSqlBuilder:186,190 — recursive CTE / Values view under **MySQL compatibility mode**) — genuinely builder-reachable, unpinned anywhere. | `MySqlSqlBuilder` | a compatibility-mode MySQL connection fixture + a recursive/values query. **Scope caveat:** version-band emission, deprioritized by the audit-scope rule; outside the reference cell. | T3 |
| **B-5** | `UNKNOWN_DATA_TYPE` (SqliteSqlBuilder:52,55 — temporal-format fallback) — defensive/as-any, borderline OUT. | `SqliteSqlBuilder` | (borderline; likely OUT) | T4 |

### 3.2 — §B per-factory KIND fan-out (distinct-type-only; F2-COL §B-1..§B-6)

Every `(factory × kind)` cell with **no fixture column**, each representative-covered
(kind-agnostic `DBColumnImpl`/same-kind marshalling) → distinct-**type**-only.
Prior rounds closed these; LISTED here with counts per the dial:

- **§B-1** `primaryKey` kind tail — **~15** (all kinds but string/int/int+adapter).
- **§B-2** `autogeneratedPrimaryKey` kind tail — **~7** (uuid/string/double/boolean/
  temporal/custom*; a uuid-autogen-PK returning a generated uuid is the one
  arguably-distinct → borderline T3-§B).
- **§B-3** `autogeneratedPrimaryKeyBySequence` kind tail — **~16** (all but int).
- **§B-4** `computedColumn`/`optionalComputedColumn` kind tail — **~17 each** (only
  string fixtured ±bracket).
- **§B-5** `virtualColumnFromFragment`/`optionalVirtualColumnFromFragment` kind
  tail — **~17 each** (only string ±bracket; the non-string fragment arms are
  covered independently in `fragments.type-coverage.test.ts`).
- **§B-6** View `column` required-kind tail — **~8** (boolean/bigint/double/uuid/
  enum/custom/customDouble/customUuid appear only as View `optionalColumn` or not
  at all; required-vs-optional is a distinct read leaf type with identical SQL).

### 3.3 — §A T4 representative-lowered tail (existing fixtures; emission/value identical to a tested representative)

- **F4-INSERT** — the `(set-variant × column-kind)` cross-product: **~2,100 cells**.
  Structural finding (coordinator-endorsed): set-variant staging is **decoupled**
  from column-kind marshalling — the gate `_isValue` (`AbstractSqlBuilder:244`) is
  kind/adapter/brand-blind; marshalling happens uniformly at emit. So
  `setIfValue({score:8.5})` emits byte-identical SQL/params to `set({score:8.5})`.
  The cross-product produces no distinct SQL/param/value/**type** → T4-degenerate
  (would CLOSE under the distinct-SQL-or-value discriminator); listed with count.
- **F4-INSERT** — multi-row `values([...])` of non-CustomBool custom kinds (~18);
  per-kind RETURNING value on the INSERT path (~14). T4 representative.
- **F4-UPDDEL** — `set({col: default()})` on an **optional**-with-default column
  (distinct `InputTypeOfOptionalColumnAllowing.| Default` arm vs the required-default
  arm; SQL identical `set … = default` → distinct-type-only, leans CLOSE);
  `Default` sentinel RHS in a conditional setter (`setIfValue({createdAt:
  default()})` keeps the default because `_isValue(Default)=true` — thin behavioral,
  low value); raw-fragment / scalar-subquery SET RHS; plain `dynamicSet()` 0-arg
  incremental. ~5 items.
- **F1-EQCMP** — base-generic method absences per leaf (emission-identical): bigint
  `isIfValue`/`isNotIfValue`/`notEqualsIfValue`/`notInIfValue`/`notInN`; string
  `inN`/`notInN`; uuid `isIfValue`/`inIfValue`/the four ordered `*IfValue`; plain
  localDateTime `greaterThan`/`lessThan`(+IfValue); plain localDate/localTime
  `*IfValue` family; customDouble `lessOrEqual`/`greaterOrEqual`(+IfValue);
  value-source-operand `equals`/`is` twins on uuid/customDouble (same
  `method(IValueSource)` overload already exercised by a subquery operand →
  degenerate). Each emission-identical to a tested representative.
- **F1-NUM** — double-receiver value-source column-RHS for `power`/`logn`/`roundn`/
  `atan2`/`minValue`/`maxValue` (~6); unused numeric fixtures `minutes` (0 hits),
  `avgRating` (0 hits), `shiftedRating`-arith. T4.
- **F1-STR** — subquery operand into ~30 string value-source overloads (same
  value-source arm as a column → degenerate); insensitive predicates on an OPTIONAL
  receiver (18, distinct-type-only); sensitive affix predicate projected as a
  required boolean leaf (~7).
- **F1-BOOLIF** — string-adapter `equalsIfValue` remap∩elision on
  verified/published/approved (3; only numeric `invoiced` pins the cross);
  `(A or B) and (C or D)` both-sides parenthesised (1); `onlyWhen`/`ignoreWhen` on
  a derived (non-column) predicate (2).
- **F1-CUSTOMNUM** — `scaledCost` through an arithmetic op (multiplicative-adapter
  result leaf vs the additive plusOffset already pinned); between/notBetween on a
  custom receiver with an optional operand; `isNull`/`isNotNull` on customInt;
  notBetween value-source-RHS shapes on customInt. ~4, representative.
- **F1-TEMP** — getter on a non-const function-result temporal receiver
  (`currentDateTime().getFullYear()`) — same no-cast else-arm as a column (~1).
- **F2-VALVIEW** — ~9 Values kinds (required customDouble; optional
  boolean/bigint/double/uuid read-absent; etc.) + ~9 View kinds (enum/custom/
  customDouble/customUuid/required-plain boolean/bigint/double/uuid) — each reads
  identically to its covered Table/Values twin (kind-string-driven marshalling).
- **PARITY** — L3 groupBy-before-where `forUseAsInline*Value` (~1-2); L4 shaped
  multi-row `disallowIfNoValue<COLUMNS>` narrowing (~1).
- **SEL-SEAM** — G2 plain-select `projectingOptionalValuesAsNullable()` +
  `executeSelectPage()`; G3 nullable after `intersect`/`except`/`minus`(+All)
  (union representative); G4 compound + `orderBy` consumed via `forUseAsInline*`;
  G5 `recursiveUnion` (dedup) routing; G6 `ContainsRequired5` depth-5+ limit;
  G7 compound + nested-object + page; G8 compound + nullable + CTE/inline; G9
  Values × nested/nullable/customizeQuery. 8 items, representative-lowered.
- **F3-PROJ** — sole-required-inner makes wrapper required (symmetry with the
  sole-optional family; already exercised by `inner-rules:2104`); 3×3 rule grid
  (redundant with depth-3-exact). ~4.
- **F5-CONN** — L4 sequence over non-integer value kinds (a DB sequence yields
  integers; identical `nextval()`, only adapter differs → recommend OUT/degenerate).

---

## 4. Negative-type locks (surfaced separately — `types.negative/`, OUT of Principle-#1 §A scope but worth pinning)

1. **CustomInt arithmetic source-union** (T2-3) — a cross-table-operand
   `@ts-expect-error` per method (representative: `add`; T4 tail all 5).
2. **CustomDouble source-union** (T2-4) — the entirely-unlocked leaf; strongest.
3. **BigintValueSource deliberately-omitted methods** (F1-NUM T1) — ~12
   `@ts-expect-error` (`viewCount.multiply(2n)/.divide/.power/.sqrt/.exp/.ln/
   .log10/.cbrt/.atan2/.logn/.roundn/.sin`); nothing currently asserts the
   compiler rejects them (an uncommented method would go uncaught).
4. **Cross-leaf operand-type enforcement** (F1-NUM T2) — ~7 `@ts-expect-error`
   (`viewCount.add(1)`, `priority.add(1n)`, `viewCount.add(priority)`, reverse).
5. **`defaultValues().onConflict*` rejection** (PARITY NL-1) — `insertInto(t)
   .defaultValues().onConflictDoNothing()`/`.onConflictOn(...)` must be rejected
   (PG accepts `INSERT … DEFAULT VALUES ON CONFLICT` but the lib deliberately
   omits on-conflict off `defaultValues()`); lock against silent widening in
   `types.negative/insert.test.ts`.

---

## 5. REFUTED (recorded so a future round does not re-chase)

- **CD-1** (`update.ts:532` `| NOldValuesFrom` on the sqlite one-column returning
  arm) — **not a bug and not dead code**: it is intentional forward-scaffolding
  awaiting SQLite's OLD/NEW column-reference feature (unconstructible today because
  `Table.oldValues()` has no sqlite overload — commented at `Table.ts:63`). Do NOT
  delete. See §0.1; not filed to `BUGS.md`.
- **PARITY L2** (compound `offsetIfValue`/`limitIfValue` untested) — COVERED at
  `select.compound.test.ts:558` (value arm) and `:821` (null-elision arm).
- **F9-TYPEVAR #4** (Date-marshalled optional `executeFunction` null as a distinct
  code path) — the null guard precedes the type switch in
  `transformValueFromDB` → identical for all kinds; string-null already covers it.
  Downgraded to T4-representative (still listable, not T3).
- **F1-EQCMP `uuid.notEqualsInsensitive` as a fluent method** — no such fluent
  method exists; commit 8d4585c2 added `notEqualsInsensitive?` to the
  `CustomUuidFilter` **dynamic-condition** type; uuid uses `.asString()`; covered
  at `dynamic-condition.equivalence.test.ts:1494/1525`.
- **Hallucinated APIs the discovery briefs named but src lacks** (agents correctly
  refused to enumerate): `isTrue`/`isFalse`/`not` (only `negate`);
  `betweenIfValue`/`notBetweenIfValue`; `smaller`/`larger`; `distinctOn`;
  `substr`/`substring`/`replaceAll` on CustomInt (String-only);
  `limit(valueSource)`/`offset(valueSource)` (not public); `position`/`pad*`/`trunc`.

---

## 6. Saturation table (per surface)

| Surface (agent) | Verdict | Genuine §A/§B | Candidate defects |
|---|---|---|---|
| Mutation seam (MUT-SEAM) | **SATURATED** | 0 | 0 |
| Twin-interface parity (PARITY) | SATURATED (§A arms only) | L1 (T3), L3/L4 (T4); NL-1 lock | CD-1 → **refuted** |
| Select/CTE/recursive/projection seam (SEL-SEAM) | **SATURATED** | G1 (T3); G2-G9 (T4) | 0 |
| Recently-changed src (F-RECENT) | 2 §A | LIST-1 (T2), LIST-2 (T2) | 0 |
| Result-type/value algebra (F9-TYPEVAR) | Near-saturated | 3 (T3) + T4 | 0 |
| Equality/comparison ×leaf (F1-EQCMP) | **SATURATED** | 0 (T4 tail) | 0 |
| Connection API (F5-CONN) | Near-saturated | B-1 (T3), B-2/B-3/L4 (T4) | 0 |
| Column factories (F2-COL) | Near-saturated | §A-1 ×2 (T3); §B-1..6 tail | 0 |
| CustomInt/CustomDouble (F1-CUSTOMNUM) | **SATURATED** | source-union locks (T2/T3) | 0 |
| Temporal (F1-TEMP) | **SATURATED** | T1-2 const-getter (T2) | 0 |
| Number/Bigint (F1-NUM) | Near-saturated | T3-12 + neg-locks (T1/T2) | 0 |
| String (F1-STR) | **SATURATED** | T1-1 wildcard-escape (T1) | 0 |
| Boolean/IfValue (F1-BOOLIF) | **SATURATED** | T2-1 `A or (B and C)` | 0 |
| Values + View source (F2-VALVIEW) | Near-saturated | T3-9/10/11 + T4 | 0 |
| Select fluent (F3-SELECT) | **SATURATED** | 0 (T4 ×3) | 0 |
| Complex projections (F3-PROJ) | Near-saturated | T3-3/4/5 (oracle+grid) | 0 |
| Dynamic condition (F6-DYN) | **SATURATED** | 0 (T4 ×4) | CD-2 (low-sev, error-path) |
| Insert set-variant×kind (F4-INSERT) | **SATURATED** | 0 (T4 ~2,100) | 0 |
| Update/Delete (F4-UPDDEL) | **SATURATED** | 0 (T4 ×5) | 0 |
| Extras/adapter/errors (F7-EXTRAS) | **SATURATED** | B-4 (T3), B-5 (T4) | 0 |

## 7. Coordinator verification notes (what was resolved by hand)

- **CD-1** — compile-repro on `sqlite/newest/better-sqlite3` (deleted) +
  `Table.ts:58-64` overload read + `sourceName.ts` brand resolution: dead union.
- **CD-2** — source-read `DynamicConditionBuilder.ts:70-155`: stray `' .'` at 93
  confirmed vs `'.'` at 142; error-path-only, depth-≥2 reachability.
- **F9-TYPEVAR #4** — source-trace `AbstractConnection.transformValueFromDB:1147`:
  type-agnostic null guard precedes the switch → no distinct code path (a runtime
  probe was attempted but hit the harness lifecycle; the source-trace is decisive).
- **CustomInt/CustomDouble source-union** — `git show 8d4585c2 -- src/expressions/
  values.ts` confirmed the widening on 5 CustomInt arithmetic methods; grep
  confirmed no cross-table neg-lock.
- **F1-STR T1-1 / F1-TEMP T1-2 / F1-BOOLIF T2-1 / F-RECENT T2-2** — wide-greps
  confirmed ABSENT (0 wildcard-literal affix params, 0 `extract(… from $N::…)`,
  0 user `.or(.and())`, 0 numeric-string boolean).
- **F5-CONN L1 (B-1)** — grep confirmed 0 arg/valueArg over the 7 keywords.
- **PARITY L2** — grep found it COVERED (`select.compound.test.ts:558/821`) →
  refuted.
- All probes deleted; `git status --porcelain` shows only the pre-existing
  untracked `MISSING_TESTS_AUDIT_*.md` files (+ the pre-existing `.gitignore`
  modification). Tree clean.

## 8. Recommended implementation order

1. **Tier-1/2 coverage-invisible §A (highest value, cheap):** T1-1 (string
   wildcard-escape), T1-2 (const temporal getter), T2-1 (`A or (B and C)`),
   T2-2 (boolean numeric-string). Each is one small test / fixture-free.
2. **Freshly-changed-surface locks:** T2-3 (CustomInt arithmetic source-union
   positive + neg-lock), T2-4 (CustomDouble source-union neg-lock), T2-5 (F2-COL
   scaledCost/shiftedAmount write), plus the F1-NUM neg-lock clusters (§4.3/4.4).
3. **Oracle/algebra §A (existing fixtures):** T3-3 (plain rule-2 miss→absent
   `in`-check), T3-6/7/8 (optionality-algebra null inhabitants), T3-4/5 (rule-4
   grid), T3-9/10/11 (Values hoists), T3-2 (recursive nested object), T3-1
   (compound value-source/raw-fragment orderBy), T3-12 (double Nullable const).
4. **CD-2 error-path negative test** (+ maintainer's bug/cosmetic call).
5. **§B fixtures** (B-1 arg/valueArg temporal is the substantive one; B-2/B-3;
   B-4 only if a MySQL-compat fixture is wanted).
6. **T4 completeness tail** (§3.2/§3.3) — the maintainer sets the cutoff; the
   ~2,100-cell insert cross-product and the ~90-cell per-factory-kind fan-out are
   distinct-type/degenerate and would CLOSE under the distinct-SQL-or-value
   discriminator, listed here for the ledger.

## 9. Verdict

The suite is at **very high maturity**: 15 of 16 surfaces returned SATURATED (or
only-T4-tail), and the two seam critics + the twin-parity sweep — the mature-phase
bug veins — surfaced **zero confirmed src bugs** (one dead-union false positive,
cleanly refuted by three methods; one low-severity error-path typo, both readings
presented). This is the expected shape of a mature round (§9 of the runbook: "a
whole round can validly close with zero confirmed bugs").

The genuine value is a compact, high-signal §A set: **four coverage-invisible
Tier-1/2 emission/value branches** (wildcard-escape, const temporal getter,
`A or (B and C)`, numeric-string boolean) that run today with benign inputs and
whose distinguishing output no snapshot pins — exactly the "output-coincidence
masks real risk" vein — plus the **freshly-changed surfaces' unlocked twins**
(CustomInt/CustomDouble source-union, F2-COL adapter writes) and a set of
**oracle-driven optionality/projection null-inhabitant** realizations. The
exhaustive Tier-4 tail (per-factory-kind fan-out, the ~2,100-cell insert
cross-product, per-leaf emission-identical variants) is listed in full with
counts per the maximal-saturation dial; nearly all of it is distinct-type-only or
degenerate and would close under the distinct-SQL-or-value discriminator — the
maintainer sets that cutoff.
