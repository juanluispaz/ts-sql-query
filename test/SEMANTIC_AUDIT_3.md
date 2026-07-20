# Semantic audit — round 3

Per [`SEMANTIC_AUDIT_RUNBOOK.md`](./SEMANTIC_AUDIT_RUNBOOK.md). Transient — not kept in the repo.

**Why round 3**: rounds 1–2 swept date/time, string, numeric/math and their fixes; the collation audit
swept the string/collation surface and shipped three forks (`.collate()`, `replaceCollation`,
`replaceAllInsensitive`) plus the min/max NULL-poison and Oracle-concat-poison reworks. This round is a
closing pass: **(A) an adversarial sweep of that just-shipped code** (the runbook's *"probe the interaction,
not just the fix"*) and **(B) the drift lens over surfaces the prior rounds never reached** — aggregates, the
aggregated-array / JSON-projection path, boolean/three-valued logic, and custom-type marshalling.

**Method**: three read-only discovery agents (aggregate + JSON-aggregate drift; boolean/conditional +
custom-type/JSON drift; adversarial over the collation forks + poison helpers) plus the coordinator's own
Wave-A probing. Every candidate probed by the coordinator against a real engine.

**Engines**: PostgreSQL 18.4 · Oracle 26ai (23.x) · MySQL 9.7.1 · MariaDB 12.3.2 · SQL Server 2025 · SQLite
(better-sqlite3). Container names/ports rotate — resolved at probe time.

**Result**: **6 confirmed defects** (2 high, 2 medium, 2 low — one of the low ones is a loud throw, not a
silent value), **1 intentional-seam observation**, and a block of refutations. **The two highest are:
(C2) a hard invalid-SQL regression introduced by the new `replaceCollation` code, on a very common pattern;
and (A) a cross-dialect silent bigint-precision loss in `aggregateAsArray` that — unlike the documented
bigint limitation — has no user escape hatch.** Two independent agents converged on (A), like round 2's
`power`. No `src/` was touched — this round is analysis + rulings only.

---

## Findings, ranked by user impact

### C2. Chained `replaceAll()` emits a double `COLLATE` and the engine rejects it — a regression the new `replaceCollation` code introduced (SQL Server + Oracle)

**This is the one to look at first: it breaks a common pattern by default, and we shipped it.**

**The promise**: `title.replaceAll('a','b').replaceAll('c','d')` — chained multi-substring replace — is
ordinary, valid usage that emitted plain nested `replace(replace(...))` before the collation work.

**The request** — `SqlServerSqlBuilder._replaceAll:842` (and Oracle `OracleSqlBuilder._replaceAll:261`) now
force `<src> collate <replaceCollation>` on the source operand **and** append a trailing reset
(`collate DATABASE_DEFAULT` / `collate USING_NLS_COMP`) to their own result. But `_replaceAll` /
`_replaceAllInsensitive` are **not** registered in `_operationsThatNeedParenthesis`
(`AbstractSqlBuilder.ts:34-64`), so when the source operand is itself a `replaceAll` node,
`_appendSqlParenthesis` does not wrap it — the inner result's trailing reset is immediately followed by the
outer's forced collation. **Two adjacent `COLLATE` clauses.**

**The engine transcript** — the library's actual emission, then the engine's verdict:

```
-- emitted by the library for  title.replaceAll('a','b').replaceAll('c','d')  (default config):
-- SQL Server:
replace(replace(title collate Latin1_General_BIN2, @0 collate Latin1_General_BIN2, @1)
        collate DATABASE_DEFAULT collate Latin1_General_BIN2,          -- <- double COLLATE
        @2 collate Latin1_General_BIN2, @3) collate DATABASE_DEFAULT
  ->  Msg 156, Level 15: Incorrect syntax near the keyword 'collate'.

-- Oracle:
replace(replace(title collate BINARY, :0 collate BINARY, :1)
        collate USING_NLS_COMP collate BINARY,                         -- <- double COLLATE
        :2 collate BINARY, :3) collate USING_NLS_COMP
  ->  ORA-00907: missing right parenthesis
```

Same failure from `title.replaceAll('a','b').collate('X')` and `replaceAll().replaceAllInsensitive()`.
`replaceCollation` is **on by default** (`SqlServerConnection.ts` → `'Latin1_General_BIN2'`,
`OracleConnection.ts` → `'BINARY'`), so this hits stock configurations. The regex engines
(MySQL/MariaDB/PostgreSQL) are unaffected — their `replaceAll` appends no reset, so an outer collation would
land once.

**Blast radius**: SQL Server + Oracle, default config. **Why the suite can't see it**: no test chains
`replaceAll().replaceAll()` / `.collate()` / `.replaceAllInsensitive()`, and no snapshot contains the string
`collate DATABASE_DEFAULT collate` / `collate USING_NLS_COMP collate`.

**The fix direction (probed)**: a **parenthesized** double collate is valid on both engines —
`(('ABCabc' collate BINARY) collate USING_NLS_COMP)` → `ABCabc`. So registering `_replaceAll` /
`_replaceAllInsensitive` in `_operationsThatNeedParenthesis` on SQL Server + Oracle (yielding
`(replace(...) collate RESET) collate FORCE`) produces accepted SQL. Whether to parenthesise or to skip the
redundant re-force when the source already carries a reset is the maintainer's call.

**Verdict: DEFECT (invalid SQL, regression).** CONFIRMED end-to-end (library emission + engine rejection).

### A. `aggregateAsArray*` silently loses `bigint` precision beyond 2^53 on every dialect — and there is no user escape hatch

**Found independently by both the aggregate agent and the custom-type agent.**

**The promise**: `aggregateAsArrayOfOneColumn(bigintCol)` is declared `bigint[]`; `bigint` promises exact
integers of any width.

**The request** — the aggregated values travel as a **JSON text blob**, and `JSON.parse` decodes every number
as an IEEE-754 double. No dialect quotes a `bigint` leaf in native JSON: base/PG emit `json_agg(view_count)`
(`AbstractSqlBuilder.ts:3846`), MySQL/MariaDB/Oracle/SQLite emit `json_arrayagg` / `json_group_array`, SQL
Server ≥17M emits native `json_arrayagg` — all bare column → JSON number. The **only** special-cased leaf is
uuid. The parsed number is then handed to the marshaller's `bigint` arm, whose **number branch is unguarded**
(`AbstractConnection.ts:1225-1231`: `return BigInt(value)` — no `Number.isSafeInteger`, unlike the `int` arm
`:1191`/`:1198` and the `stringInt` arm `:1219`), so a rounded integer coerces to a clean, wrong `bigint`.

**The engine transcript** — every engine emits the exact digits as a bare number; the loss is entirely JS-side:

```
PostgreSQL  json_agg(9007199254740993::bigint)        -> [9007199254740993]
MySQL       json_arrayagg(cast(...9993 as signed))    -> [9007199254740993]
MariaDB     json_arrayagg(...)                         -> [9007199254740993]
SQLite      json_group_array(...)                      -> [9007199254740993]
Oracle      json_arrayagg(...)                         -> [9007199254740993]
SQL Server  json_arrayagg(cast(...9993 as bigint))    -> [9007199254740993]   (native >=17M path)

node> JSON.parse('[9007199254740993]')[0]  ->  9007199254740992          (rounds here)
node> BigInt(9007199254740992)             ->  9007199254740992n         (clean, wrong — no error)
```

**Distinct from the documented `bigint > 2^53` limitation** (`LIMITATIONS.md`): that entry's remedy is
*driver configuration* (`safeIntegers` / `supportBigNumbers` / `fetchTypeHandler`), and it rests on the driver
returning the bigint **column** as a string. Here the value arrives as a single `json`/text column — the
driver never sees a bigint column — so **no driver setting can intervene**; the rounding is in `JSON.parse`.
There is no escape hatch, which makes this categorically more severe than the ruled column case.

**The library already knew.** SQL Server's *manual* `string_agg` JSON builder (compat < 17M) deliberately
**quotes** bigint (`'"' + convert(nvarchar, x) + '"'`, `SqlServerSqlBuilder.ts:1363-1366`), which round-trips
exactly via `BigInt(string)`. The knowledge exists but was applied to one of six-plus emission paths — the
runbook's lens #3 (an incomplete local fix).

**Blast radius**: all six dialects in their default/tested config; the lone safe path is SQL Server manual
`string_agg` (< 17M, one-column/distinct/wrapped). **Why the suite can't see it**:
`select.aggregate-as-array.value-type-coverage.test.ts` seeds `viewCount = 100n / 200n` — exact as JSON
numbers — with a comment that even notes *"a bigint doesn't fit in a JSON int reliably"*.

**Verdict: DEFECT (silent wrong value), cross-dialect.** Fix fork: quote `bigint` (and `customInt` /
`customDouble`) leaves in the native-JSON paths too, mirroring the SQL Server manual path; and/or guard the
marshaller's `bigint` number branch with `Number.isSafeInteger` so the corruption becomes a loud throw rather
than a silent value.

### #1. `replaceAllInsensitive` does not escape its replacement string — the regex-driven engines interpret it

**The promise**: `replaceAllInsensitive(search, replacement)` is the case-insensitive twin of `replaceAll`;
the two should agree on everything except case. `replaceAll` treats the replacement literally on every dialect.

**The request** — the *search* term is regex-escaped (`_escapeRegexpForReplace`), but the *replacement*
(`value2`) is emitted raw into `regexp_replace` on the three regex-driven engines
(`PostgreSqlSqlBuilder.ts:162`, `AbstractMySqlMariaBDSqlBuilder.ts:441/443`), where `\`/`$`/backreference
markers in the replacement are substitution metacharacters.

**The engine transcript** — `'XmasXmas'.replaceAllInsensitive('mas', <replacement>)`:

```
JS String.replaceAll / case-sensitive replaceAll / Oracle,SQLServer,SQLite insensitive :  'a\1b' -> Xa\1bXa\1b  (literal)
PostgreSQL  regexp_replace(...,'gi')  'a\1b' -> XabXab        (\1 = backreference, eaten)   [silent wrong]
                                       'a\&b' -> XamasbXamasb  (\& = whole match)
                                       'a\\1b'-> Xa\1bXa\1b    (escaping the backslash restores literal)
MariaDB     REGEXP_REPLACE            'a\1b' -> XabXab                                        [silent wrong]
MySQL (ICU) REGEXP_REPLACE            'a\1b' -> Xa1bXa1b (backslash dropped) ; 'a$0b' -> whole match  [silent wrong]
```

Same call, three different values across the six dialects; none of the regex engines matches JS or its own
case-sensitive twin. The correct escape is **per-engine** (PostgreSQL/MariaDB escape `\`; MySQL/ICU escapes
`$` and `\`) — the code escapes none of it.

**Blast radius**: PostgreSQL, MySQL, MariaDB (regex-driven). Oracle/SQL Server/SQLite use collation-driven /
literal `replace()`, so their replacement is literal and correct. **Why the suite can't see it**:
`replaceAllInsensitive` tests use plain-letter replacements (no `\`/`$`). Plausible real trigger: path
normalization `x.replaceAllInsensitive('/', '\\')`.

**Verdict: DEFECT (silent wrong value / engine error).** Fix fork: a replacement-escape seam parallel to the
search-term `_escapeRegexpForReplace`, per engine — or document as a limitation (the replacement is
regex-substitution-shaped on the regex engines).

### B. SQL Server (compat < 17M) truncates `double` leaves in `aggregateAsArray*` to ≤6 significant figures

**The promise**: a `double` leaf is declared `number` (full IEEE-754 precision).

**The request** — the manual `string_agg` JSON builder (used when `_useJsonAggregatesWhenPossible()` is false,
i.e. `compatibilityVersion < 17_000_000`) emits `convert(nvarchar, <float>)` for the `double` case
(`SqlServerSqlBuilder.ts:1361`). A styleless `CONVERT(nvarchar, float)` is **style 0**, documented as "a
maximum of 6 digits".

**The engine transcript** (SQL Server 2025):

```
convert(nvarchar, cast(123.456789   as float))      -> 123.457          (6 sig figs, lossy)
convert(nvarchar, cast(123456789.123 as float))     -> 1.23457e+008     (6 sig figs, lossy)
convert(nvarchar, cast(123.456789   as float), 3)   -> 1.2345678900000000e+002   (17 digits, lossless)
```

**Reachability**: `compatibilityVersion < 17M` is every SQL Server ≤ 2022 deployment — the common case, not an
exotic one (the matrix even instantiates a `16_000_000` connection). The native `json_arrayagg` path (≥17M) is
lossless; only the manual path truncates. Non-SQL-Server dialects preserve the double.

**Blast radius**: SQL Server compat < 17M. **Why the suite can't see it**: the double coverage seeds
`4.5 / 12.0 / 8.5` — all exact in ≤6 sig figs.

**Verdict: DEFECT (silent wrong value), SQL-Server-scoped.** Fix: emit `convert(nvarchar, <x>, 3)` (or style
2/128) for the `double` (and `customDouble`) case in the manual builder.

### C1. Oracle's concat NULL-poison guard leaks across a shared receiver node — a silent wrong value in the just-shipped poison code (contrived)

**The promise**: with Oracle's default config (concat NULL-emulation on), any concatenation with a NULL
operand yields NULL, matching the other five dialects.

**The request** — the re-entrancy guard (`OracleSqlBuilder._concat:152`, `_oracleConcatPlainReceivers`) keys
the "render this inner concat bare, no CASE" decision on the **receiver object identity**. When an
**independent** nested concat (one separated from the outer chain by a non-concat op) reuses a column object
that is *also* an outer-chain receiver, its own poison CASE is suppressed in the value branch — while the
null-check, built *before* the suppression set is populated, renders it correctly. The two disagree.

**The engine transcript** — emission for
`body.concat(title).concat( body.concat(optionalConst(null)).valueWhenNull('Z') )` (`body` shared, nullable):

```
-- library emits:
case when "body" is null
       or nvl(case when "body" is null or :0 is null then null else "body" || :1 end, :2) is null  -- inner CORRECT here
     then null
     else "body" || title || nvl("body" || :3, :4) end                                             -- inner BARE here (bug)

-- real Oracle, body='B', optNull=NULL, title='T', Z='Z':
buggy   =  'B' || 'T' || nvl('B' || null, 'Z')                                   -> BTB
correct =  'B' || 'T' || nvl(case when 'B' is null or null is null then null
                                  else 'B'||null end, 'Z')                        -> BTZ
```

The value branch returns `BTB` where the poison contract requires `BTZ`. **A control with a distinct inner
receiver (`title.concat(...)` instead of `body.concat(...)`) emits the correct inner CASE** — confirming the
leak is specifically the shared-receiver case.

**Important refinement of the discovery report**: the *simpler* repro (an inner concat wrapped in an
optionality-**preserving** op like `.toLowerCase()`) is **masked** — the null-check re-renders the inner
correctly and short-circuits to NULL, so no wrong value. The bug only bites when the inner concat is wrapped
in an optionality-**collapsing** op (`valueWhenNull`/`coalesce`) so it is absent from the outer null-check.

**Blast radius**: Oracle only (the guard/Set exists only here). **Why the suite can't see it**: no test chains
a 3-operand concat containing a wrapped nested concat that reuses a receiver column.

**Verdict: DEFECT (silent wrong value), low severity (contrived).** Fix: key the suppression on the concat
**node**, not the receiver object.

### D. Oracle `aggregateAsArray*` of a `localDate` column throws — a valid typed query rejected (loud, not silent)

**The promise**: `aggregateAsArrayOfOneColumn(localDateCol)` returns `Date[]`.

**The request** — Oracle's `DATE` carries a time component, so `json_arrayagg(<localDateCol>)` serialises each
leaf as `"2024-01-15T00:00:00"` (probed), not the bare `"2024-01-15"` the other engines emit. In the aggregate
path the leaf is always a string, so the `localDate` marshaller's string arm runs:
`new Date(value + ' 00:00')` (`AbstractConnection.ts:1293`) → `new Date("2024-01-15T00:00:00 00:00")` =
**Invalid Date** (tested) → the arm throws `INVALID_VALUE_RECEIVED_FROM_DATABASE` (`:1300-1301`).

`localDateTime` is fine — its Oracle form `"2024-01-15T12:30:45.123000"` parses. Only `localDate` (a bare date
that Oracle dresses with `T00:00:00`) trips the ` + ' 00:00'` concatenation.

**Blast radius**: Oracle only. **Why the suite can't see it**: only `localDateTime` is aggregated on Oracle;
no `localDate` aggregate test exists. **Verdict: DEFECT (loud throw on a valid query), low severity.** Lower
than the silent findings because it fails loudly. CONFIRMED by composition (probed Oracle JSON form + read
marshaller + tested `new Date`).

---

## Observation — custom types bypass base-type marshalling (intentional seam, at most a docs note)

`customInt` / `customLocalDate` / … columns are marshalled by their **`__valueTypeName`** (the user typeName),
which the marshaller `switch` has no case for → `default: return value` (`AbstractConnection.ts` tail). SQL
*emission* is base-type-aware (e.g. `_appendJsonValueForAggregate` switches on `customInt`), but *result
marshalling* is not — so a `customInt` with **no adapter** returns the raw driver value (a `string` on
oracledb, a `bigint` on better-sqlite3 with `safeIntegers`), skipping the `int` arm's normalisation.

This is the **documented custom-type seam** — the adapter (or a connection override) owns the conversion, and
the test domains themselves demonstrate the pattern (`SqlServerConnection`'s `baseTypeForCustom` override maps
custom typeNames to base types *precisely because* the default passes them through). **Not a defect.** The
asymmetry (emission base-type-aware, marshalling not) plus the `customInt`/`customLocalDate` naming may be
worth a one-line docs clarification, nothing more.

---

## Refutations — results, so round 4 doesn't re-derive them

- **Boolean / three-valued-NULL surface — REFUTED.** The tri-state machinery is symmetric and correct across
  all six dialects: `bit`/number value↔condition coercion (`= 1`), UNKNOWN→false for required and UNKNOWN→NULL
  for optional via the `case when <cond> then 1 when not <cond> then 0 else null end` forms,
  `_isNull`/`_isNotNull` detecting the unknown state, and the marshaller boolean arm NULL-safe. No per-connector
  result-handling divergence.
- **Date/time leaves through the JSON round-trip — REFUTED** (except Oracle `localDate`, finding D). The
  datetime string forms diverge (PostgreSQL/SQL Server `T`-separated, MySQL space + 6-digit microseconds), but
  all parse to the **same instant under `TZ=UTC`** (the harness's and the recommended config). The residual
  host-zone dependence of `new Date(<datetime-no-offset>)` is the round-1 host↔engine timezone chapter
  (unfixable in SQL, all six dialects), not a new drift — the aggregate path merely always hits the string arm.
- **Row aggregates `sum`/`min`/`max`/`count` (+ distinct) — REFUTED.** Zero dialect overrides; `average*`
  routes through the round-2 `_averageOperandSql` fix. `sum(int)` widening errors loudly (not a silent value)
  on the engines that overflow the declared `int`.
- **`.collate()` — SOUND.** PostgreSQL quotes the name (`collate "<name>"`), the others are bare (all take
  unquoted identifiers); `_collate` is registered in `_operationsThatNeedParenthesis`, so embedding and
  chaining self-wrap correctly.
- **min/max NULL-poison param binding — SOUND.** In every branch the null-check params precede the selection
  params in textual order; placeholders align even for nested/duplicated operands.
- **`replaceAllInsensitive` `''` vs `undefined` collation selection — BY DESIGN.** Oracle falls
  `insensitiveCollation` → `replaceInsensitiveCollation` (default `BINARY_CI`); `''` opts out to the session
  collation (case-sensitive on a default Oracle) — the documented "trust the session" opt-out, not a defect.
- **Oracle concat re-entrancy for distinct receivers — SOUND** (only the shared-receiver + optionality-collapsed
  case, finding C1, leaks).
- **No temporal-arithmetic surface exists** — no `add/subtract/diff` + Day/Month/Year methods, no
  `interval`/`dateadd` emission. The only temporal surface is the getters (swept in round 1) plus
  `currentDate`/`currentTimestamp`. Nothing to sweep.

---

## Coverage holes this round exposes

1. **No `aggregateAsArray` bigint fixture exceeds 2^53** (`viewCount` seeded `100n/200n`) — blocks finding A.
   A lock needs a `> 2^53` bigint leaf.
2. **No `aggregateAsArray` double fixture needs > 6 significant figures** (`4.5/12.0/8.5`) — blocks finding B.
   Needs e.g. `123.456789` and a `compatibilityVersion < 17M` SQL Server cell.
3. **No test chains `replaceAll().replaceAll()` / `.collate()` / `.replaceAllInsensitive()`** — blocks C2.
4. **No `replaceAllInsensitive` replacement contains `\`/`$`** — blocks finding #1.
5. **No Oracle `localDate` aggregate test** (only `localDateTime`) — blocks finding D.
6. **No concat chain reuses a receiver column inside a wrapped nested concat** — blocks C1.

## Work order (implementation — not done in this round; every item is a maintainer fork)

1. **C2 — chained-replace double COLLATE (SQL Server + Oracle).** The invalid-SQL regression. Register
   `_replaceAll`/`_replaceAllInsensitive` in `_operationsThatNeedParenthesis` on the two dialects (parenthesised
   double collate is valid), or skip the re-force when the source already carries a reset.
2. **A — bigint `aggregateAsArray` precision (all dialects).** Quote the `bigint`/`customInt`/`customDouble`
   leaf in the native-JSON paths (mirror the SQL Server manual path), and/or guard the marshaller `bigint`
   number branch with `Number.isSafeInteger`.
3. **#1 — `replaceAllInsensitive` replacement escape (PG/MySQL/MariaDB).** A per-engine replacement-escape seam
   parallel to `_escapeRegexpForReplace`, or a documented limitation.
4. **B — SQL Server < 17M double `aggregateAsArray` truncation.** Add style 3 to the `double`/`customDouble`
   convert in the manual JSON builder.
5. **C1 — Oracle concat shared-receiver leak.** Key the suppression Set on the concat node, not the receiver.
6. **D — Oracle `localDate` aggregate throw.** Handle the `T00:00:00` form in the `localDate` string arm (or
   strip the time in the Oracle aggregate emission).

For each: prove the lock (`git stash push -- src/`, the test **must** fail), then widen with lens 2 before
propagating.
