# Semantic audit — round 2

Per [`SEMANTIC_AUDIT_RUNBOOK.md`](./SEMANTIC_AUDIT_RUNBOOK.md). Transient — not kept in the repo.

**Why round 2**: round 1 landed 12 fixes across 16 `src/` files. This round targets the
surfaces round 1 did **not** sweep, plus its own fixes. Three discovery agents:

1. **Lens 1** (declared `__valueType` vs emitted SQL) over `ValueSourceImpl` — planned in round 1's
   Wave 1, never run.
2. **Drift lens** over the **numeric / math / comparison / boolean** surface — round 1's drift
   agents only covered date/time and string.
3. **Adversarial** review of round 1's own 16-file diff — the runbook's *"probe the interaction,
   not just the fix"* applied to us.

**Result**: **4 confirmed new defects + 1 confirmed runtime-throw**, all probed against real engines.
**The highest-priority one is a regression round 1 itself introduced.** 3 base/limitation notes, and
a solid block of refutations (including the whole round-1 diff cleared as a pure refactor).
Two agents **independently** found the same `power` defect. No `src/` touched.

Engines: MySQL 9.7.1 (romantic_tesla) · MariaDB 12.3.2 (vigilant_davinci) · PostgreSQL 18.4
(modest_wilson) · SQL Server 2025 CU6 (great_euler) · Oracle 26ai (objective_almeida) · SQLite.

**A pattern worth stating up front**: three of the four confirmed defects are **SQL Server type
fidelity**. `POWER` and `ISNULL` both return their *first argument's* type, and `LEN` has its own
trailing-blank rule. When a fix or a method feeds SQL Server an int/short/narrow first operand, the
result silently takes that type. Treat "does SQL Server keep the first-arg type here?" as a
standing question, not three separate bugs.

---

## Decisions (maintainer-ruled) — all resolved

Filed in `BUGS.md` (#2–#5) and `LIMITATIONS.md` (#1). A guiding principle the author set during
this round governs the two SQL Server null-coalescing choices: **always prefer what the database
natively provides over any opt-in; an opt-in is the last resort, only when the engine offers no
other way.**

| # | Item | Ruling |
|---|---|---|
| 1 | `len(x + '.') - 1` under-reports by 1 for a max-length string | **`LIMITATIONS.md` + build an opt-out.** The default keeps the sentinel (breaks only at the *exact* maximum length — one precise extreme, not a range; the `cast(x as varchar(max))` fix was rejected as too heavy for the common path). **Add a `usePlatformDependentLength` connection flag** — see the design below. |
| 2 | `power(int, …)` truncates/overflows on SQL Server | **Fix.** `_power` override casting the base to float, mirroring the existing `_cbrtRadicand`. Normal usage (root of an int column), silently wrong across a range. |
| 3 | `valueWhenNull` truncates a wider/longer fallback on SQL Server (`isnull`) | **Fix — `isnull`→`coalesce`** (native, widens; preferred over opt-in per the principle). `coalesce` double-evaluates the receiver (a column — free); accepted. |
| 4 | `minValue`/`maxValue` ignore a NULL operand on PG and SQL Server | **Fix — normalize PG and SQL Server to poison**, matching the declared type + the other four + `concat`. See the design below. |
| 5 | `intCol.valueWhenNull(doubleCol)` throws in the marshaller | **Fix.** Promote the declared type to `double` when the operand is `double`, like `minValue`/`maxValue` already do. Same method as #3; handle together. |

### #1 — the opt-out to build (`usePlatformDependentLength`)

The default stays `len(<x> + '.') - 1` (JS-faithful, the max-length edge documented in
`LIMITATIONS.md`). Add a connection flag that lets a user trade it for SQL Server's native `len(x)`,
modelled exactly on the existing `usePlatformDependentRound`:

- **Surface**: add `usePlatformDependentLength?: boolean` to `ConnectionConfiguration`
  (`src/utils/ConnectionConfiguration.ts`, next to `usePlatformDependentRound` / `concatFunction`),
  and declare `protected usePlatformDependentLength: boolean = false` with JSDoc on
  `SqlServerConnection` (SQL Server is the only dialect with the sentinel, so the flag lives only
  there, unlike `usePlatformDependentRound` which spans several connections).
- **Emission**: in `SqlServerSqlBuilder._length`, branch on
  `this._connectionConfiguration.usePlatformDependentLength` — when set, emit a bare
  `len(<x>)`; otherwise keep the sentinel `len(<x> + '.') - 1`.
- **The trade** (put it in the code comment): native `len(x)` removes the max-length edge and the
  sentinel, but re-excludes trailing blanks (T-SQL semantics, diverging from JS `String.length`).
  It is the right choice for an app with max-length columns and no trailing-blank-significant data —
  not a strict improvement.
- **Lock**: the opt-out's `len(x)` emission is snapshot-lockable on any string (no max-length fixture
  needed — that gap only blocks locking the *default's* edge, which stays a documented limitation).

### #4 — the full design (the round's deepest fork, fully worked out)

The library's `mergeOptional` optionality rule (**optional if *either* operand is optional**, the
same rule `add`/`subtract`/`concat` use) **is** the NULL-propagates (poison) contract — a required
receiver with an optional argument is typed `optional` only because the library anticipates the
argument's NULL reaching the result. Four dialects deliver poison natively; **PostgreSQL and SQL
Server deviate** (they ignore the NULL and return the present operand), realizing the wrong half of
their own declared type. The resolution, ruled:

- **Default: normalize PG + SQL Server to poison.** Emit the **leanest query the build-time
  optionality allows** — only null-check operands that *can* be null: both required → `least(a,b)`
  (no `CASE`); one optional → check just that one; both optional → check both. The other four are
  untouched (native). On SQL Server the `CASE` also collapses the `>=16M`/`<16M` version split and
  fixes the `<2022` `iif` asymmetry.
- **Opt-out**: a connection flag to keep the native ignore-NULL behaviour on PG / SQL Server.
- **User-function opt-in**: a connection option naming a user-provided null-propagating min/max
  function, emitted as `func(a,b)` to avoid the operand repetition (the `concatFunction` pattern).
- **Changelog**: declare the behaviour break on PG and SQL Server (a value change).

The row aggregate `min(col)`/`max(col)` over rows is a **different** function that ignores NULL on
every engine (standard SQL) and is **not** affected — only the scalar two-value `minValue`/`maxValue`.

An alternative was fully explored and rejected: normalizing the *other* direction (make the four
poison dialects ignore NULL like PG). It touches 4–5 dialects instead of 2, **contradicts the
declared type** (would force `minValue` to a bespoke "optional if *both*" rule, unlike every other
binary op), and diverges from `concat`. Poison is also the *primitive*: ignore-NULL is composable
from it (`a.valueWhenNull(b).minValue(b.valueWhenNull(a))`), not the reverse.

---

## Findings

### 1. `len(x + '.') - 1` under-reports the length of a max-length string by one — a regression round 1 introduced

**This is the one to look at first: we shipped it.** Round 1 fixed SQL Server's `LEN()`
trailing-blank bug by appending a sentinel (`len(x + '.') - 1`). But T-SQL string `+` on two
**non-`max`** character types caps the result at the type's declared maximum and **silently
truncates** the overflow — so for a value at its column's max length, the appended `.` is dropped,
`len` returns the max, and `- 1` gives **max − 1**.

**The request** — `SqlServerSqlBuilder.ts:1016`: `len(<x> + '.') - 1`.

**The engine transcript** (great_euler):

```
declare @x8000 varchar(8000) = REPLICATE('a', 8000);
declare @x4000 nvarchar(4000) = REPLICATE(N'a', 4000);
  LEN(@x8000 + '.') - 1  = 7999   LEN(@x8000)  = 8000      <- true length 8000
  LEN(@x4000 + N'.') - 1 = 3999   LEN(@x4000)  = 4000      <- true length 4000

-- column form, driver-independent:
create table t_len(v varchar(8000)); insert values(REPLICATE('a',8000));
  LEN(v + '.') - 1 = 7999   LEN(v) = 8000   DATALENGTH(v) = 8000
```

The **old** `len(x)` returned 8000 correctly for a max-length string with no trailing blank. The
fix traded a common bug (trailing blanks) for a rare one (max-length). Both are silent wrong values.

**The fix, probed** — cast to `(n)varchar(max)` before appending, so the concat can't cap:

```
LEN(CAST(@x8000 AS varchar(max)) + '.') - 1        = 8000   <- regression gone
LEN(CAST('Draft  ' AS varchar(max)) + '.') - 1     = 7      <- trailing-space fix preserved
LEN(CAST('café'    AS nvarchar(max)) + N'.') - 1   = 4      <- char-count preserved
```

**Blast radius**: SQL Server only. **Why the suite can't see it**: every `_length` fixture is short
(`'Ada Lovelace'`, `'café'`, `'Draft  '`); none is at a bounded type's max — and under `tedious` a
`const` string of exactly 4000 chars is sent as `nvarchar(4000)`, so it is reachable without even a
column at the cap.

**Verdict: DEFECT (regression).** The `varchar(max)` cast is the located fix. Note for the
implementer: the same `+ '.'` trick is *not* reused as a length argument elsewhere, so this is the
only site — but re-derive that, don't inherit it.

### 2. `power()` on an int receiver truncates the fractional result to int on SQL Server — the cbrt fix that never generalized

**Found independently by both discovery agents.** `intCol.power(x)` declares its result **`double`**
(`ValueSourceImpl.ts:646`) and `docs/keywords/functions-oprators.md:101` maps it to `POWER(value, x)`.
The base emits `power(<receiver>, <exponent>)` with **no cast on the receiver**
(`AbstractSqlBuilder.ts:3377`), and **SQL Server does not override `_power`**. T-SQL's `POWER`
returns its *first argument's* type, so `power(<int>, …)` computes and returns in int.

**The proof is already in the file.** `SqlServerSqlBuilder._cbrtRadicand` (:1027) casts the base to
float *for exactly this reason*, with the comment *"T-SQL's POWER returns the data type of the first
argument, so power(int, float) truncates to int."* cbrt was fixed; the public `power()` was not —
the runbook's "incomplete local fix" (lens 3) meeting lens 1.

**The engine transcript** (great_euler):

```
POWER(CAST(2 AS INT),   0.5) = 1                    JS Math.pow(2,0.5) = 1.4142135623730951
POWER(CAST(2 AS INT),   -1)  = 0                    JS Math.pow(2,-1)  = 0.5
POWER(CAST(2 AS FLOAT), 0.5) = 1.4142135623730951
BaseType of POWER(int,0.5)   = 'int'

-- even an integer exponent overflows where every other engine widens:
POWER(50000, 2) -> Msg 8115 Arithmetic overflow error for type int, value = 2500000000
pg power(50000::int, 2) = 2500000000
```

**Blast radius**: SQL Server only (Oracle `POWER`→NUMBER, MySQL/MariaDB `POW`→double, PG→double,
SQLite→real all keep the fraction). **Why the suite can't see it**: `grep` for a fractional or
negative exponent across ~4.1k files returns **nothing**; the one test emitting `power(int, double)`
(`select.value-source.numeric-operand-coverage.test.ts:1006`) seeds `issue_id = 1` — `POWER(1, …)=1`,
right and wrong coincide — and launders the assertion through `Number(...)` + `toBeCloseTo(1, 5)`.
A value-degenerate fixture and a laundered assertion in one place.

**Verdict: DEFECT (silent wrong value).** Fix mirrors cbrt: a `SqlServerSqlBuilder._power` override
casting the base via `_appendCastAsDouble`.

### 3. `valueWhenNull` truncates a longer string fallback to the receiver's width on SQL Server (`isnull`)

Round 1's refutations said *"`_valueWhenNull` … lined up, genuinely agree."* They lined up the
spellings, not `ISNULL`'s type coercion — re-derived per *"inherit no verdict."*

Five dialects emit `coalesce`/`nvl`/`ifnull`, which type the result as the widest operand.
**SQL Server emits `isnull`** (`SqlServerSqlBuilder.ts:840`), which types the result as its **first
argument** and coerces the fallback to it.

**The engine transcript** (great_euler):

```
declare @c varchar(3) = null;
  isnull(@c, 'abcdef')   = 'abc'        <- fallback truncated to varchar(3)
  coalesce(@c, 'abcdef') = 'abcdef'
BaseType of isnull(tinyint, 100000) = 'tinyint'   <- same first-arg-type root as POWER
```

`.valueWhenNull('abcdef')` on a NULL `varchar(3)` column returns `'abc'`; every other dialect
returns `'abcdef'`. The numeric analogue narrows a wider fallback. `docs/keywords/functions-oprators.md:85`
maps `ISNULL → valueWhenNull` but **does not warn** about the coercion — not ruled.

**Blast radius**: SQL Server only. **Why the suite can't see it**: `valueWhenNull` fixtures use short
values (`0`, names) whose width already matches the receiver.

**Verdict: DEFECT (silent truncation).** The uuid `convert(nvarchar(36),…)` handling shares these
lines, so the fix (emit a widening form) is entangled — a maintainer fork, but the defect is
confirmed.

### 4. `minValue` / `maxValue` (least/greatest) — NULL semantics split the six dialects into two camps

`.minValue(v)` / `.maxValue(v)` should return the same value on every dialect. The six spell it three
ways — base `least`/`greatest` (PG, Oracle, MySQL, MariaDB), SQLite scalar `min`/`max`, SQL Server
`least`/`greatest` at `>= 16_000_000` else `iif(...)` — and they **disagree on NULL**.

**The engine transcript**:

```
pg      least(NULL::int, 5)  = 5      <- ignores NULL
mysql   least(NULL, 5)       = NULL
sqlite  min(NULL, 5)         = NULL
        (Oracle, MariaDB documented NULL; SQL Server 2022+ ignores NULL like PG)
```

`estimatedHours.minValue(5)` where the column IS NULL → **5** on PostgreSQL and SQL Server 2022+,
**NULL** on MySQL / MariaDB / Oracle / SQLite. Same typed call, two values. **Undocumented** — the
docs only discuss the `LEAST`-vs-`IIF` spelling, never the NULL rule.

**Why the suite can't see it**: min/max tests use non-null operands, where the camps coincide.

**Verdict: DESIGN FORK.** Which camp is the contract? If "NULL operand ⇒ NULL result", PG and
SQL Server drift; if "ignore/clamp NULL", the other four do. Either way it needs normalizing.

### 5. `intCol.valueWhenNull(doubleCol)` throws in the marshaller on valid data

A second, independent defect on `valueWhenNull`. Its result is declared as the **receiver's**
`__valueType` (`ValueSourceImpl.ts:608`), with no promotion — unlike `minValue`/`maxValue`, which
route through `createSqlOperation1ofOverloadedNumber` and promote to `double` when operands mix. So
`intCol.valueWhenNull(doubleCol)` is declared `int`, but its SQL is `coalesce(<int>, <double>)`.

When the int is NULL and the double is fractional, the engine returns the fraction, and the
marshaller's `int` arm (`AbstractConnection.ts:1181`) **throws**
`INVALID_VALUE_RECEIVED_FROM_DATABASE: Invalid int value received from the db: 9.99` — while the
`double` arm accepts silently. A legal, typed query crashes at runtime on legal data.

**Blast radius**: all six (the marshaller is dialect-agnostic). **Why the suite can't see it**: no
test combines an int receiver with a fractional double fallback over a NULL int row.

**Verdict: DEFECT (loud throw, not silent).** Lower severity than 1–4 because it fails loudly, but
it rejects a valid query. Fix: promote `valueWhenNull` to `double` when the operand is a double
source, like the `minValue`/`maxValue` dispatcher.

---

## Base / limitation notes (low severity)

- **Base `_in` / `_notIn` emit invalid `x in ()` for an empty array** (`AbstractSqlBuilder.ts:2776`),
  and all five real dialects override with the **identical** empty-array→`true`/`false` guard
  (mysql/maria :623, pg :410, oracle :1223, mssql :1128, sqlite :423). Same shape as round 1's base
  date-part finding: an unreachable-and-wrong base with a 5×-duplicated guard. A 7th dialect that
  forgets to override emits invalid SQL. Candidate: hoist the guard into the base (and make a real
  dialect reach it, per the round-1 base-dialect ruling).
- **`sum(intCol)` is declared `int`** (`AbstractConnection.ts:1090`) but engines widen differently
  (PG→bigint, MySQL/MariaDB→DECIMAL-as-string, Oracle→NUMBER, SQL Server→int-overflows-past-2³¹,
  SQLite→integer). No silent wrong value (widening engines are correct; SQL Server/SQLite error
  loudly), but the declared `int` is narrower than reality — worth a glance at the `int` marshalling
  arm. Not a filed defect.
- **Value-source `substr` count with a negative-literal start** — `title.substr(-2, someColumn)`
  where `someColumn` is negative at runtime: MySQL/MariaDB `left(tail, -k)` → `''` (JS-correct), but
  PG/SQL Server → "all but last k" (diverges). Extends the existing value-source substr
  `LIMITATIONS.md` note (which only names a value-source *index*, not a value-source *count* paired
  with a negative literal start). Extremely rare; one line in that entry, not a code change.

---

## Refutations — results, so round 3 doesn't re-derive them

**Round 1's own fixes, adversarially checked and cleared:**

- **Oracle `getTime()` sub-second double-count — REFUTED.** `cast(timestamp as date)` **truncates**
  the seconds (probed: `.999`→45s not 46s), so the `FF3` term re-adds the sub-second exactly once.
  Confirmed across `.001`, `.500`, `.900`, `.999`: `2024-06-15 12:00:00.900` →
  `1718452800900`, bit-exact to JS.
- **Oracle `const` `getTime()` bind-type — CLOSED.** The pre-1970 const test
  (`select.value-source.const-temporal-getters.test.ts`, `1969-12-30 → -129600000`,
  `executeSelectMany` + `toEqual`) **ran against real Oracle** in the round-1 `--docker` matrix
  (65 473 passed, exit 0). The new `cast(:n as date)` / `to_char(:n,'FF3')` binds execute fine.
- **MySQL/MariaDB `timestampdiff` overflow — REFUTED.** At DATETIME max (9999-12-31) microseconds ≈
  2.5e17, 36× below BIGINT max 9.2e18; no clamp at either end, no overflow warning.
- **`right()` / `left(right(...))` counted substr forms — REFUTED.** Traced against JS for
  in-range, out-of-range start, over-long count, `n=0`, empty and NULL inputs — all agree.
- **PG date-part override deletion is byte-for-byte preserving.** The base's 9 date-part methods are
  identical to PG's deleted overrides (const-forcing, `::integer`, `- 1`); all four other dialects
  fully override, so the base reaches only PG, which had it before. Parenthesis registration
  preserved end to end.
- **The `AbstractQueryRunner.ts` (82 lines) + query-builder diff is a pure `.map`/`.forEach` → `for`
  refactor** (commit `53854a8c`, "reduce usage of Lambda/Functions"). Every throw condition,
  `undefined→null` coercion, index argument and value transformation preserved. **No value handling
  leaked into the runner layer** — this was the biggest "why did this change?" and it is benign.
- **Oracle `||` opt-in is nesting-safe and complete.** All concat sites (`_concatSql`, the three
  `_likePattern*`) are overridden when `concatFunction` is set; `listagg` uses no `||`;
  `_needParenthesis` returning false for a `f(a,b)` atomic primary is always safe.
- **Insensitive ORDER BY** — all four insensitive modes now fold the sort term; the four
  non-insensitive modes untouched.
- **`char_length` and astral characters** — `char_length` counts code points, not UTF-16 units, so
  an emoji is 1 vs JS's 2. **Shared by all six dialects and pre-dates the fix** — not a regression;
  MySQL/MariaDB joined the consistent-but-astral-imperfect group, which was the goal.

**Numeric surface, lined up and genuinely agreeing:**

- **`_modulo` sign** — all six keep the dividend's sign (JS `%`). SQLite float-truncation and PG
  fractional-literal edges already in `LIMITATIONS.md`.
- **`_round` half-way** — all six round half **away from zero**; the negative-`.5` divergence from
  `Math.round` is already documented (`mysql.md`, `postgresql.md` scope the JS match to *positive*
  `.5`). Default (`usePlatformDependentRound` off) is platform-independent on every engine.
- **`_ceil`/`_floor`** agree with JS on negatives; **`_atan2`** emits `atan2(y, x)` everywhere
  (SQL Server `atn2`), matching `Math.atan2(y, x)`.
- **`_divide` / `_cbrt` / `_asDouble` / `_average`** — round-1 fixes present and consistent.
- **`_is`/`_isNot`** — each dialect's own null-safe-equality spelling, all equivalent.
- **Aggregates** `_sum`/`_min`/`_max`/`_count` and their distinct forms — no dialect overrides;
  homogeneous from the base. **No bitwise operators exist** in the API.
- **`asInt`/`asBigint` round-1 fix is complete** across ValueSourceImpl (one construction each,
  guarded on `__valueType==='double'`); the `_modulo` bigint template is closed both ways (bigint
  overloads that would mix a fractional operand are type-unreachable — commented out, "no bigdouble
  yet").

---

## Coverage holes this round exposes

- **No fixture is a max-length string** (finding 1) — this only blocks locking the *default's*
  max-length edge, which stays a documented limitation (not fixed). The `usePlatformDependentLength`
  opt-out being built instead locks on any string, so no such fixture is required.
- **No fractional or negative `power()` exponent anywhere** (finding 2) — and the one int-base test
  seeds `issue_id = 1`, where right and wrong coincide.
- **No `valueWhenNull` with a wider/fractional fallback over a NULL receiver** (findings 3, 5).
- **No `minValue`/`maxValue` with a NULL operand** (finding 4).

Same lesson as round 1: the defects weren't hiding from the tests — the fixtures couldn't express
them.

## Work order (implementation — not done in this round)

1. **`len` opt-out (finding 1)** — the default sentinel **stays** (its max-length edge is a
   documented `LIMITATIONS.md` limitation, *not* fixed); build the `usePlatformDependentLength` flag
   per the *#1 design* above. The opt-out's `len(x)` emission locks on any string; no max-length
   fixture needed.
2. **`power` on SQL Server (finding 2)** — `_power` override casting the base to float, mirroring
   `_cbrtRadicand`. Needs a fractional-exponent test over an int with a non-degenerate base.
3. **`valueWhenNull` (findings 3 + 5)** — two defects on one method: the `isnull`→`coalesce` widening
   (SQL Server, #3) and the int→double type promotion (all dialects, #5). Reshape both together.
4. **`minValue`/`maxValue` NULL (finding 4)** — normalize PG + SQL Server to poison per the *#4
   design* above (default lean `CASE` + opt-out flag + user-function opt-in + changelog break). The
   other four dialects unchanged.
5. **Base `_in` empty-array guard** — hoist to base + delete a dialect override so a real dialect
   reaches it (round-1 base-dialect ruling).

For each: prove the lock (`git stash push -- src/`, the test **must** fail), then widen with lens 2.
Note the SQL-Server-type-fidelity cluster — check `POWER`, `ISNULL`, and any other spot that feeds
SQL Server a narrow first operand, together.
